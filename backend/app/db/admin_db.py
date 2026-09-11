import json
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

import asyncpg

_pool: asyncpg.Pool | None = None


async def init_admin_db(database_url: str) -> None:
    global _pool
    if not database_url:
        return
    _pool = await asyncpg.create_pool(database_url, min_size=1, max_size=3, command_timeout=10)
    await _ensure_schema()


async def close_admin_db() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
    _pool = None


def _get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("admin database is not initialised")
    return _pool


async def _ensure_schema() -> None:
    """Extend the existing schema without replacing any user data."""
    for statement in (
        "ALTER TABLE badges ADD COLUMN IF NOT EXISTS icon_url TEXT",
        "ALTER TABLE badges ADD COLUMN IF NOT EXISTS badge_type VARCHAR(32) NOT NULL DEFAULT 'custom'",
        "ALTER TABLE badges ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE badges ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        "ALTER TABLE user_badges ADD COLUMN IF NOT EXISTS reason TEXT",
        "ALTER TABLE user_badges ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ",
        "ALTER TABLE user_badges ADD COLUMN IF NOT EXISTS revoked_by UUID",
        "ALTER TABLE user_badges ADD COLUMN IF NOT EXISTS revocation_reason TEXT",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS disabled_reason TEXT",
        "CREATE TABLE IF NOT EXISTS username_history (id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, old_username VARCHAR(32), new_username VARCHAR(32) NOT NULL, changed_by UUID, reason TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
        "CREATE INDEX IF NOT EXISTS username_history_user_idx ON username_history (user_id, created_at DESC)",
        """CREATE TABLE IF NOT EXISTS admin_accounts (
            id UUID PRIMARY KEY, email VARCHAR(320) NOT NULL UNIQUE, name VARCHAR(128) NOT NULL DEFAULT '',
            role VARCHAR(32) NOT NULL DEFAULT 'admin', permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
            invited_by UUID, invited_at TIMESTAMPTZ, joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_login_at TIMESTAMPTZ, suspended BOOLEAN NOT NULL DEFAULT FALSE,
            status VARCHAR(32) NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS admin_invites (
            id UUID PRIMARY KEY, email VARCHAR(320) NOT NULL, name VARCHAR(128) NOT NULL DEFAULT '',
            token_hash VARCHAR(128) NOT NULL UNIQUE, role VARCHAR(32) NOT NULL DEFAULT 'admin',
            permissions JSONB NOT NULL DEFAULT '{}'::jsonb, expires_at TIMESTAMPTZ NOT NULL,
            invited_by UUID NOT NULL, invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            accepted_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ
        )""",
        """CREATE TABLE IF NOT EXISTS admin_otp_codes (
            id UUID PRIMARY KEY, admin_id UUID NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
            otp_hash VARCHAR(128) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
            locked_until TIMESTAMPTZ, consumed_at TIMESTAMPTZ
        )""",
        """CREATE TABLE IF NOT EXISTS admin_sessions (
            id UUID PRIMARY KEY, admin_id UUID NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
            token_hash VARCHAR(128) NOT NULL UNIQUE, ip VARCHAR(128), user_agent TEXT,
            fingerprint VARCHAR(256), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '8 hours'), revoked_at TIMESTAMPTZ
        )""",
        "ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '8 hours')",
        "CREATE INDEX IF NOT EXISTS admin_otp_active_idx ON admin_otp_codes (admin_id, expires_at DESC) WHERE consumed_at IS NULL",
        "CREATE INDEX IF NOT EXISTS admin_sessions_active_idx ON admin_sessions (admin_id, revoked_at) WHERE revoked_at IS NULL",
        """CREATE TABLE IF NOT EXISTS user_security (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            mfa_secret TEXT,
            mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""",
    ):
        await _get_pool().execute(statement)


async def ensure_root_account(root_email: str) -> None:
    normalized_email = root_email.strip().lower()
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            # The environment value is the only root identity. Any former
            # super-admin record is revoked if the configured email changes.
            await conn.execute(
                "UPDATE admin_accounts SET role='admin', permissions='{}'::jsonb, status='revoked', suspended=TRUE WHERE role='super_admin' AND lower(email) <> $1",
                normalized_email,
            )
            await conn.execute(
                "INSERT INTO admin_accounts (id, email, name, role, permissions, status, suspended) VALUES ($1,$2,'Root Administrator','super_admin','{\"*\": true}'::jsonb,'active',FALSE) ON CONFLICT (email) DO UPDATE SET name='Root Administrator', role='super_admin', permissions='{\"*\": true}'::jsonb, status='active', suspended=FALSE",
                uuid4(), normalized_email,
            )


async def admin_by_email(email: str) -> dict[str, Any] | None:
    row = await _get_pool().fetchrow("SELECT id, email, name, role, permissions, status, suspended, joined_at, last_login_at FROM admin_accounts WHERE email=$1", email.lower())
    return dict(row) if row else None


async def admin_by_id(admin_id: UUID) -> dict[str, Any] | None:
    row = await _get_pool().fetchrow("SELECT id, email, name, role, permissions, status, suspended, joined_at, last_login_at FROM admin_accounts WHERE id=$1", admin_id)
    return dict(row) if row else None


async def invalidate_admin_otps(admin_id: UUID) -> None:
    await _get_pool().execute("UPDATE admin_otp_codes SET consumed_at=NOW() WHERE admin_id=$1 AND consumed_at IS NULL", admin_id)


async def create_admin_otp(admin_id: UUID, otp_hash: str, expires_at: Any) -> UUID:
    await invalidate_admin_otps(admin_id)
    otp_id = uuid4()
    await _get_pool().execute("INSERT INTO admin_otp_codes (id, admin_id, otp_hash, expires_at) VALUES ($1,$2,$3,$4)", otp_id, admin_id, otp_hash, expires_at)
    return otp_id


async def verify_admin_otp(admin_id: UUID, otp_hash: str) -> tuple[bool, str]:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow("SELECT id, otp_hash, expires_at, attempts, locked_until FROM admin_otp_codes WHERE admin_id=$1 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE", admin_id)
            if row is None or row["expires_at"] <= datetime.now(timezone.utc):
                return False, "expired"
            if row["locked_until"] and row["locked_until"] > datetime.now(timezone.utc):
                return False, "locked"
            if not hmac.compare_digest(row["otp_hash"], otp_hash):
                attempts = row["attempts"] + 1
                if attempts >= 5:
                    await conn.execute("UPDATE admin_otp_codes SET attempts=$2, locked_until=NOW()+INTERVAL '15 minutes' WHERE id=$1", row["id"], attempts)
                    return False, "locked"
                await conn.execute("UPDATE admin_otp_codes SET attempts=$2 WHERE id=$1", row["id"], attempts)
                return False, "invalid"
            await conn.execute("UPDATE admin_otp_codes SET consumed_at=NOW() WHERE id=$1", row["id"])
    return True, "ok"


async def log_admin_event(actor_id: UUID | None, action: str, metadata: dict[str, Any] | None = None, target_id: str | None = None) -> None:
    await _get_pool().execute("INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata) VALUES ($1,$2,'admin', $3, $4::jsonb)", actor_id, action, target_id, json.dumps(metadata or {}))


async def create_admin_session(admin_id: UUID, token_hash: str, ip: str, user_agent: str, fingerprint: str) -> UUID:
    session_id = uuid4()
    await _get_pool().execute("INSERT INTO admin_sessions (id, admin_id, token_hash, ip, user_agent, fingerprint, expires_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()+INTERVAL '8 hours')", session_id, admin_id, token_hash, ip, user_agent, fingerprint)
    await _get_pool().execute("UPDATE admin_accounts SET last_login_at=NOW() WHERE id=$1", admin_id)
    return session_id


async def admin_from_session(token_hash: str) -> dict[str, Any] | None:
    row = await _get_pool().fetchrow("SELECT a.id, a.email, a.name, a.role, a.permissions, a.status, a.suspended, s.id AS session_id FROM admin_sessions s JOIN admin_accounts a ON a.id=s.admin_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > NOW() AND a.status='active' AND NOT a.suspended", token_hash)
    if row:
        await _get_pool().execute("UPDATE admin_sessions SET last_seen_at=NOW() WHERE id=$1", row["session_id"])
    return dict(row) if row else None


async def revoke_admin_session(token_hash: str) -> None:
    await _get_pool().execute("UPDATE admin_sessions SET revoked_at=NOW() WHERE token_hash=$1 AND revoked_at IS NULL", token_hash)


async def list_admin_sessions() -> list[dict[str, Any]]:
    rows = await _get_pool().fetch("SELECT s.id, s.admin_id, a.email, a.name, s.ip, s.user_agent, s.created_at, s.last_seen_at, s.expires_at FROM admin_sessions s JOIN admin_accounts a ON a.id=s.admin_id WHERE s.revoked_at IS NULL AND s.expires_at > NOW() ORDER BY s.last_seen_at DESC")
    return [dict(row) for row in rows]


async def revoke_admin_session_by_id(actor_id: UUID, session_id: UUID) -> bool:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow("SELECT admin_id FROM admin_sessions WHERE id=$1 AND revoked_at IS NULL", session_id)
            if row is None:
                return False
            await conn.execute("UPDATE admin_sessions SET revoked_at=NOW() WHERE id=$1", session_id)
            await _audit(conn, actor_id, "admin.session.revoked", "admin_session", str(session_id), {"admin_id": str(row["admin_id"])})
    return True


async def revoke_admin_sessions_for_admin(actor_id: UUID, target_id: UUID) -> int:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            result = await conn.execute("UPDATE admin_sessions SET revoked_at=NOW() WHERE admin_id=$1 AND revoked_at IS NULL", target_id)
            await _audit(conn, actor_id, "admin.sessions.revoked_all", "admin", str(target_id))
    return int(result.split()[-1])


async def list_admin_staff() -> list[dict[str, Any]]:
    rows = await _get_pool().fetch("SELECT id, email, name, role, permissions, joined_at, last_login_at, suspended, status FROM admin_accounts ORDER BY joined_at")
    return [dict(row) for row in rows]


async def create_admin_invite(invite_id: UUID, email: str, name: str, token_hash: str, role: str, permissions: dict[str, Any], expires_at: Any, invited_by: UUID) -> None:
    await _get_pool().execute("INSERT INTO admin_invites (id,email,name,token_hash,role,permissions,expires_at,invited_by) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)", invite_id, email.lower(), name, token_hash, role, json.dumps(permissions), expires_at, invited_by)


async def list_admin_invites() -> list[dict[str, Any]]:
    rows = await _get_pool().fetch("SELECT id, email, name, role, permissions, invited_by, invited_at, expires_at, accepted_at, revoked_at FROM admin_invites ORDER BY invited_at DESC LIMIT 200")
    return [dict(row) for row in rows]


async def revoke_admin_invite(actor_id: UUID, invite_id: UUID) -> bool:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            result = await conn.execute("UPDATE admin_invites SET revoked_at=NOW() WHERE id=$1 AND accepted_at IS NULL AND revoked_at IS NULL", invite_id)
            if result != "UPDATE 1":
                return False
            await _audit(conn, actor_id, "admin.invite.revoked", "admin_invite", str(invite_id))
    return True


async def accept_admin_invite(token_hash: str) -> dict[str, Any] | None:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            invite = await conn.fetchrow("SELECT * FROM admin_invites WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW() FOR UPDATE", token_hash)
            if invite is None:
                return None
            admin_id = uuid4()
            await conn.execute("INSERT INTO admin_accounts (id,email,name,role,permissions,invited_by,invited_at,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'active') ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, permissions=EXCLUDED.permissions, status='active', suspended=FALSE", admin_id, invite["email"], invite["name"], invite["role"], invite["permissions"], invite["invited_by"], invite["invited_at"])
            await conn.execute("UPDATE admin_invites SET accepted_at=NOW() WHERE id=$1", invite["id"])
            row = await conn.fetchrow("SELECT id,email,name,role,permissions,status,suspended FROM admin_accounts WHERE email=$1", invite["email"])
    return dict(row) if row else None


async def _audit(conn: asyncpg.Connection, actor_id: UUID, action: str, target_type: str | None, target_id: str | None, metadata: dict[str, Any] | None = None) -> None:
    await conn.execute(
        "INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata) VALUES ($1,$2,$3,$4,$5::jsonb)",
        actor_id, action, target_type, target_id, json.dumps(metadata or {}),
    )


async def search_users(search: str = "", limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    term = f"%{search.strip()}%"
    rows = await _get_pool().fetch(
        """SELECT id, email, email_verified, username, display_name, avatar_url,
                  google_id, discord_id, telegram_id, telegram_username,
                  created_at, updated_at, last_login_at, is_admin,
                  suspended_at, suspension_reason, suspended_until,
                  (SELECT COUNT(*) FROM user_badges ub WHERE ub.user_id = users.id AND ub.revoked_at IS NULL) AS badge_count
           FROM users
           WHERE $1 = '%' OR id::text ILIKE $1 OR COALESCE(username, '') ILIKE $1 OR COALESCE(email, '') ILIKE $1 OR COALESCE(discord_id, '') ILIKE $1
           ORDER BY created_at DESC LIMIT $2 OFFSET $3""",
        term, max(1, min(limit, 100)), max(0, offset),
    )
    return [dict(row) for row in rows]


async def overview() -> dict[str, Any]:
    row = await _get_pool().fetchrow(
        """SELECT
          (SELECT COUNT(*) FROM users) AS total_users,
          (SELECT COUNT(*) FROM profiles WHERE disabled_at IS NULL) AS published_profiles,
          (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days') AS new_registrations,
          (SELECT COUNT(*) FROM users WHERE last_login_at >= NOW() - INTERVAL '30 days') AS active_users,
          (SELECT COUNT(*) FROM premium_entitlements WHERE active AND (expires_at IS NULL OR expires_at > NOW())) AS premium_users,
          (SELECT COUNT(*) FROM reports WHERE status = 'open') AS unresolved_reports,
          (SELECT COUNT(*) FROM audit_logs WHERE action LIKE '%error%' OR action LIKE '%failed%') AS processing_errors"""
    )
    purchases = await _get_pool().fetch("SELECT id, user_id, plan, active, expires_at, created_at FROM premium_entitlements ORDER BY created_at DESC LIMIT 8")
    return {"stats": dict(row), "recent_purchases": [dict(item) for item in purchases]}


async def user_detail(user_id: UUID) -> dict[str, Any] | None:
    pool = _get_pool()
    user = await pool.fetchrow("SELECT id, email, email_verified, username, display_name, avatar_url, google_id, discord_id, telegram_id, telegram_username, created_at, updated_at, last_login_at, is_admin, suspended_at, suspension_reason, suspended_until FROM users WHERE id = $1", user_id)
    if user is None:
        return None
    profile = await pool.fetchrow("SELECT config, updated_at, disabled_at, disabled_reason FROM profiles WHERE user_id = $1", user_id)
    return {
        "user": dict(user),
        "profile": dict(profile) if profile else None,
        "badges": await list_user_badges(user_id, include_revoked=True),
        "reports": [dict(row) for row in await pool.fetch("SELECT id, reason, details, status, created_at, reviewed_at FROM reports WHERE target_user_id = $1 OR reporter_user_id = $1 ORDER BY created_at DESC", user_id)],
        "activity": [dict(row) for row in await pool.fetch("SELECT action, target_type, target_id, metadata, created_at FROM audit_logs WHERE target_id = $1 ORDER BY created_at DESC LIMIT 50", str(user_id))],
    }


async def set_suspension(actor_id: UUID, user_id: UUID, suspended: bool, reason: str | None, until: Any) -> bool:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            result = await conn.execute(
                "UPDATE users SET suspended_at = CASE WHEN $2 THEN NOW() ELSE NULL END, suspension_reason = CASE WHEN $2 THEN $3 ELSE NULL END, suspended_until = CASE WHEN $2 THEN $4::timestamptz ELSE NULL END, updated_at = NOW() WHERE id = $1",
                user_id, suspended, reason, until,
            )
            if result != "UPDATE 1":
                return False
            await _audit(conn, actor_id, "user.suspend" if suspended else "user.unsuspend", "user", str(user_id), {"reason": reason, "until": str(until) if until else None})
    return True


async def disable_profile(actor_id: UUID, user_id: UUID, disabled: bool, reason: str | None) -> bool:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            result = await conn.execute("UPDATE profiles SET disabled_at=CASE WHEN $2 THEN NOW() ELSE NULL END, disabled_reason=CASE WHEN $2 THEN $3 ELSE NULL END, updated_at=NOW() WHERE user_id=$1", user_id, disabled, reason)
            if result != "UPDATE 1":
                return False
            await _audit(conn, actor_id, "profile.disable" if disabled else "profile.restore", "user", str(user_id), {"reason": reason})
    return True


async def get_user_security(user_id: UUID) -> tuple[bool, str | None]:
    row = await _get_pool().fetchrow("SELECT mfa_enabled, mfa_secret FROM user_security WHERE user_id=$1", user_id)
    return (bool(row["mfa_enabled"]), row["mfa_secret"]) if row else (False, None)


async def set_mfa_secret(user_id: UUID, secret: str) -> None:
    await _get_pool().execute(
        "INSERT INTO user_security (user_id, mfa_secret, mfa_enabled, updated_at) VALUES ($1,$2,FALSE,NOW()) ON CONFLICT (user_id) DO UPDATE SET mfa_secret=EXCLUDED.mfa_secret, mfa_enabled=FALSE, updated_at=NOW()",
        user_id, secret,
    )


async def enable_mfa(user_id: UUID) -> bool:
    result = await _get_pool().execute("UPDATE user_security SET mfa_enabled=TRUE, updated_at=NOW() WHERE user_id=$1 AND mfa_secret IS NOT NULL", user_id)
    return result == "UPDATE 1"


async def disable_mfa(user_id: UUID) -> None:
    await _get_pool().execute("UPDATE user_security SET mfa_enabled=FALSE, mfa_secret=NULL, updated_at=NOW() WHERE user_id=$1", user_id)


async def list_reserved() -> list[dict[str, Any]]:
    return [dict(row) for row in await _get_pool().fetch("SELECT username, reason, created_by, created_at FROM reserved_usernames ORDER BY username")]


async def is_reserved(username: str) -> bool:
    row = await _get_pool().fetchrow("SELECT 1 FROM reserved_usernames WHERE username = $1", username.lower())
    return row is not None


async def add_reserved(actor_id: UUID, username: str, reason: str | None) -> None:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            await conn.execute("INSERT INTO reserved_usernames (username, reason, created_by) VALUES ($1,$2,$3)", username.lower(), reason, actor_id)
            await _audit(conn, actor_id, "reserved_username.create", "reserved_username", username.lower(), {"reason": reason})


async def remove_reserved(actor_id: UUID, username: str) -> bool:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            result = await conn.execute("DELETE FROM reserved_usernames WHERE username = $1", username.lower())
            if result != "DELETE 1":
                return False
            await _audit(conn, actor_id, "reserved_username.delete", "reserved_username", username.lower())
    return True


async def username_history(user_id: UUID | None = None) -> list[dict[str, Any]]:
    if user_id:
        rows = await _get_pool().fetch("SELECT id, user_id, old_username, new_username, changed_by, reason, created_at FROM username_history WHERE user_id=$1 ORDER BY created_at DESC", user_id)
    else:
        rows = await _get_pool().fetch("SELECT id, user_id, old_username, new_username, changed_by, reason, created_at FROM username_history ORDER BY created_at DESC LIMIT 200")
    return [dict(row) for row in rows]


async def force_change_username(actor_id: UUID, user_id: UUID, username: str, reason: str) -> bool:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            current = await conn.fetchrow("SELECT username FROM users WHERE id=$1 FOR UPDATE", user_id)
            if current is None:
                return False
            if await conn.fetchval("SELECT 1 FROM reserved_usernames WHERE username=$1", username):
                raise ValueError("That username is reserved.")
            if await conn.fetchval("SELECT 1 FROM users WHERE username=$1 AND id<>$2", username, user_id):
                raise ValueError("That username is already in use.")
            await conn.execute("INSERT INTO username_history (user_id, old_username, new_username, changed_by, reason) VALUES ($1,$2,$3,$4,$5)", user_id, current["username"], username, actor_id, reason)
            await conn.execute("UPDATE users SET username=$2, updated_at=NOW() WHERE id=$1", user_id, username)
            await _audit(conn, actor_id, "username.force_change", "user", str(user_id), {"old": current["username"], "new": username, "reason": reason})
    return True


async def list_badges() -> list[dict[str, Any]]:
    return [dict(row) for row in await _get_pool().fetch("""SELECT b.id, b.name, b.description, b.color, b.icon_url, b.badge_type, b.active, b.created_at, b.updated_at,
        COUNT(ub.user_id) FILTER (WHERE ub.revoked_at IS NULL) AS recipient_count
        FROM badges b LEFT JOIN user_badges ub ON ub.badge_id = b.id GROUP BY b.id ORDER BY b.name""")]


async def add_badge(actor_id: UUID, badge_id: str, name: str, description: str, color: str, badge_type: str, icon_url: str | None) -> None:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            await conn.execute("INSERT INTO badges (id, name, description, color, badge_type, icon_url, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())", badge_id, name, description, color, badge_type, icon_url)
            await _audit(conn, actor_id, "badge.create", "badge", badge_id, {"name": name, "type": badge_type})


async def update_badge(actor_id: UUID, badge_id: str, name: str, description: str, color: str, badge_type: str, icon_url: str | None, active: bool) -> bool:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            result = await conn.execute("UPDATE badges SET name=$2, description=$3, color=$4, badge_type=$5, icon_url=$6, active=$7, updated_at=NOW() WHERE id=$1", badge_id, name, description, color, badge_type, icon_url, active)
            if result != "UPDATE 1":
                return False
            await _audit(conn, actor_id, "badge.update", "badge", badge_id, {"name": name, "active": active})
    return True


async def delete_badge(actor_id: UUID, badge_id: str) -> bool:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            if await conn.fetchval("SELECT 1 FROM user_badges WHERE badge_id=$1", badge_id):
                raise ValueError("Badge has assignment history; disable it instead of deleting it.")
            result = await conn.execute("DELETE FROM badges WHERE id=$1", badge_id)
            if result != "DELETE 1":
                return False
            await _audit(conn, actor_id, "badge.delete", "badge", badge_id)
    return True


async def assign_badge(actor_id: UUID, user_id: UUID, badge_id: str, enabled: bool, reason: str | None) -> None:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            await conn.execute("INSERT INTO user_badges (user_id, badge_id, enabled, granted_by, reason, revoked_at, revoked_by, revocation_reason) VALUES ($1,$2,$3,$4,$5,NULL,NULL,NULL) ON CONFLICT (user_id,badge_id) DO UPDATE SET enabled = EXCLUDED.enabled, granted_by = EXCLUDED.granted_by, granted_at = NOW(), reason = EXCLUDED.reason, revoked_at = NULL, revoked_by = NULL, revocation_reason = NULL", user_id, badge_id, enabled, actor_id, reason)
            await _audit(conn, actor_id, "badge.assign", "user", str(user_id), {"badge_id": badge_id, "enabled": enabled, "reason": reason})


async def revoke_badge(actor_id: UUID, user_id: UUID, badge_id: str, reason: str | None) -> bool:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            result = await conn.execute("UPDATE user_badges SET revoked_at=NOW(), revoked_by=$3, revocation_reason=$4 WHERE user_id=$1 AND badge_id=$2 AND revoked_at IS NULL", user_id, badge_id, actor_id, reason)
            if result != "UPDATE 1":
                return False
            await _audit(conn, actor_id, "badge.revoke", "user", str(user_id), {"badge_id": badge_id, "reason": reason})
    return True


async def list_user_badges(user_id: UUID, include_revoked: bool = False) -> list[dict[str, Any]]:
    where = "" if include_revoked else " AND ub.revoked_at IS NULL AND b.active"
    rows = await _get_pool().fetch(f"""SELECT b.id, b.name, b.description, b.color, b.icon_url, b.badge_type, b.active,
        ub.enabled, ub.granted_by, ub.granted_at, ub.reason, ub.revoked_at, ub.revoked_by, ub.revocation_reason
        FROM user_badges ub JOIN badges b ON b.id=ub.badge_id WHERE ub.user_id=$1{where} ORDER BY ub.granted_at DESC""", user_id)
    return [dict(row) for row in rows]


async def sync_badge_visibility(user_id: UUID, badges: list[dict[str, Any]]) -> None:
    async with _get_pool().acquire() as conn:
        for badge in badges:
            badge_id = str(badge.get("id") or "")
            if badge_id:
                await conn.execute("UPDATE user_badges SET enabled=$3 WHERE user_id=$1 AND badge_id=$2 AND revoked_at IS NULL", user_id, badge_id, bool(badge.get("enabled", True)))


async def list_entitlements() -> list[dict[str, Any]]:
    return [dict(row) for row in await _get_pool().fetch("SELECT id, user_id, plan, active, expires_at, granted_by, created_at FROM premium_entitlements ORDER BY created_at DESC")]


async def add_entitlement(actor_id: UUID, user_id: UUID, plan: str, active: bool, expires_at: Any) -> UUID:
    entitlement_id = uuid4()
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            await conn.execute("INSERT INTO premium_entitlements (id, user_id, plan, active, expires_at, granted_by) VALUES ($1,$2,$3,$4,$5,$6)", entitlement_id, user_id, plan, active, expires_at, actor_id)
            await _audit(conn, actor_id, "premium.grant", "user", str(user_id), {"plan": plan, "expires_at": str(expires_at) if expires_at else None})
    return entitlement_id


async def list_reports() -> list[dict[str, Any]]:
    return [dict(row) for row in await _get_pool().fetch("SELECT id, reporter_user_id, target_user_id, target_username, reason, details, status, reviewed_by, reviewed_at, created_at FROM reports ORDER BY created_at DESC LIMIT 200")]


async def update_report(actor_id: UUID, report_id: UUID, status: str) -> bool:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            result = await conn.execute("UPDATE reports SET status = $2, reviewed_by = $3, reviewed_at = NOW() WHERE id = $1", report_id, status, actor_id)
            if result != "UPDATE 1":
                return False
            await _audit(conn, actor_id, "report.update", "report", str(report_id), {"status": status})
    return True


async def list_flags() -> list[dict[str, Any]]:
    return [dict(row) for row in await _get_pool().fetch("SELECT key, enabled, description, updated_by, updated_at FROM feature_flags ORDER BY key")]


async def update_flag(actor_id: UUID, key: str, enabled: bool, description: str) -> None:
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            await conn.execute("INSERT INTO feature_flags (key, enabled, description, updated_by, updated_at) VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (key) DO UPDATE SET enabled = EXCLUDED.enabled, description = EXCLUDED.description, updated_by = EXCLUDED.updated_by, updated_at = NOW()", key, enabled, description, actor_id)
            await _audit(conn, actor_id, "feature_flag.update", "feature_flag", key, {"enabled": enabled})


async def list_audit_logs() -> list[dict[str, Any]]:
    return [dict(row) for row in await _get_pool().fetch("SELECT id, actor_user_id, action, target_type, target_id, metadata, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 300")]


async def list_bakaboost_connections() -> list[dict[str, Any]]:
    return [dict(row) for row in await _get_pool().fetch("SELECT user_id, provider, external_id, status, metadata, connected_at, updated_at FROM bakaboost_connections ORDER BY updated_at DESC")]


async def list_themes() -> list[dict[str, Any]]:
    return [dict(row) for row in await _get_pool().fetch("SELECT id, name, config, active, created_by, updated_by, created_at, updated_at FROM theme_presets ORDER BY name")]


async def save_theme(actor_id: UUID, name: str, config: dict[str, Any], active: bool) -> UUID:
    theme_id = uuid4()
    async with _get_pool().acquire() as conn:
        async with conn.transaction():
            await conn.execute("INSERT INTO theme_presets (id, name, config, active, created_by, updated_by) VALUES ($1,$2,$3::jsonb,$4,$5,$5) ON CONFLICT (name) DO UPDATE SET config = EXCLUDED.config, active = EXCLUDED.active, updated_by = EXCLUDED.updated_by, updated_at = NOW()", theme_id, name, json.dumps(config), active, actor_id)
            await _audit(conn, actor_id, "theme_preset.save", "theme_preset", name, {"active": active})
    return theme_id
