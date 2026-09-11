import json
import secrets
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import Response
from starlette.requests import Request

from app.core.config import Settings, get_settings
from app.core.security import cookie_should_be_secure
from app.db import data_api
from app.db.dragonfly import get_dragonfly
from app.models import User


def _session_key(token: str) -> str:
    return f"session:{token}"


def _session_id_key(session_id: str) -> str:
    return f"session-id:{session_id}"


def _user_sessions_key(user_id: str) -> str:
    return f"user-sessions:{user_id}"


def _mfa_challenge_key(challenge: str) -> str:
    return f"mfa-login:{challenge}"


def _pending_auth_key(challenge: str) -> str:
    return f"pending-auth:{challenge}"


async def create_session(user_id: str, remember: bool = False, ip: str = "", user_agent: str = "") -> tuple[str, int]:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    session_id = secrets.token_urlsafe(16)
    ttl = settings.session_remember_ttl_seconds if remember else settings.session_ttl_seconds
    payload = {
        "user_id": user_id,
        "remember": remember,
        "session_id": session_id,
        "ip": ip,
        "user_agent": user_agent,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    redis = get_dragonfly()
    await redis.set(_session_key(token), json.dumps(payload), ex=ttl)
    await redis.set(_session_id_key(session_id), token, ex=ttl)
    await redis.sadd(_user_sessions_key(user_id), session_id)
    return token, ttl


async def destroy_session(token: str | None) -> None:
    if not token:
        return
    redis = get_dragonfly()
    raw = await redis.get(_session_key(token))
    await redis.delete(_session_key(token))
    if not raw:
        return
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return
    session_id = payload.get("session_id")
    user_id = payload.get("user_id")
    if session_id:
        await redis.delete(_session_id_key(str(session_id)))
    if user_id and session_id:
        await redis.srem(_user_sessions_key(str(user_id)), str(session_id))


async def load_session(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    raw = await get_dragonfly().get(_session_key(token))
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) and data.get("user_id") else None


async def touch_session(token: str, remember: bool) -> None:
    settings = get_settings()
    ttl = settings.session_remember_ttl_seconds if remember else settings.session_ttl_seconds
    redis = get_dragonfly()
    await redis.expire(_session_key(token), ttl)
    payload = await load_session(token)
    if payload and payload.get("session_id"):
        await redis.expire(_session_id_key(str(payload["session_id"])), ttl)


async def register_legacy_session(token: str, payload: dict[str, Any]) -> None:
    """Index sessions created before session-management metadata was added."""
    if payload.get("session_id") or not payload.get("user_id"):
        return
    session_id = secrets.token_urlsafe(16)
    payload["session_id"] = session_id
    redis = get_dragonfly()
    ttl = max(await redis.ttl(_session_key(token)), 1)
    await redis.set(_session_key(token), json.dumps(payload), ex=ttl)
    await redis.set(_session_id_key(session_id), token, ex=ttl)
    await redis.sadd(_user_sessions_key(str(payload["user_id"])), session_id)


async def list_user_sessions(user_id: str, current_token: str | None = None) -> list[dict[str, Any]]:
    redis = get_dragonfly()
    if current_token:
        current_payload = await load_session(current_token)
        if current_payload and str(current_payload.get("user_id")) == str(user_id):
            await register_legacy_session(current_token, current_payload)
    session_ids = await redis.smembers(_user_sessions_key(user_id))
    sessions: list[dict[str, Any]] = []
    for session_id in session_ids:
        token = await redis.get(_session_id_key(str(session_id)))
        if not token:
            await redis.srem(_user_sessions_key(user_id), str(session_id))
            continue
        payload = await load_session(token)
        if not payload or str(payload.get("user_id")) != str(user_id):
            await redis.srem(_user_sessions_key(user_id), str(session_id))
            continue
        sessions.append({
            "id": str(payload.get("session_id") or session_id),
            "ip": payload.get("ip") or "unknown",
            "user_agent": payload.get("user_agent") or "Unknown device",
            "created_at": payload.get("created_at"),
            "remember": bool(payload.get("remember")),
            "current": bool(current_token and token == current_token),
        })
    sessions.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
    return sessions


async def revoke_user_session(user_id: str, session_id: str) -> bool:
    redis = get_dragonfly()
    token = await redis.get(_session_id_key(session_id))
    if not token:
        await redis.srem(_user_sessions_key(user_id), session_id)
        return False
    payload = await load_session(token)
    if not payload or str(payload.get("user_id")) != str(user_id):
        return False
    await destroy_session(token)
    return True


async def revoke_all_user_sessions(user_id: str) -> None:
    redis = get_dragonfly()
    for session_id in await redis.smembers(_user_sessions_key(user_id)):
        await revoke_user_session(user_id, str(session_id))


async def create_mfa_challenge(user_id: str, remember: bool) -> str:
    challenge = secrets.token_urlsafe(32)
    await get_dragonfly().set(_mfa_challenge_key(challenge), json.dumps({"user_id": user_id, "remember": remember, "attempts": 0}), ex=300)
    return challenge


async def load_mfa_challenge(challenge: str) -> dict[str, Any] | None:
    raw = await get_dragonfly().get(_mfa_challenge_key(challenge))
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


async def update_mfa_challenge(challenge: str, value: dict[str, Any]) -> bool:
    redis = get_dragonfly()
    ttl = await redis.ttl(_mfa_challenge_key(challenge))
    if ttl <= 0:
        return False
    await redis.set(_mfa_challenge_key(challenge), json.dumps(value), ex=ttl)
    return True


async def consume_mfa_challenge(challenge: str) -> dict[str, Any] | None:
    redis = get_dragonfly()
    raw = await redis.getdel(_mfa_challenge_key(challenge))
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


async def create_pending_auth(user_id: str, remember: bool, next_path: str = "/dashboard", provider: str = "password") -> str:
    """Create a short-lived, opaque gate which must be cleared by CAPTCHA before login."""
    challenge = secrets.token_urlsafe(32)
    payload = {
        "user_id": user_id,
        "remember": bool(remember),
        "next": next_path,
        "provider": provider,
    }
    await get_dragonfly().set(_pending_auth_key(challenge), json.dumps(payload), ex=300)
    return challenge


async def load_pending_auth(challenge: str | None) -> dict[str, Any] | None:
    if not challenge:
        return None
    raw = await get_dragonfly().get(_pending_auth_key(challenge))
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) and value.get("user_id") else None


async def consume_pending_auth(challenge: str | None) -> dict[str, Any] | None:
    if not challenge:
        return None
    raw = await get_dragonfly().getdel(_pending_auth_key(challenge))
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) and value.get("user_id") else None


def attach_pending_auth_cookie(response: Response, request: Request, challenge: str, settings: Settings) -> None:
    response.set_cookie(
        key="misa_pending_auth",
        value=challenge,
        max_age=300,
        path="/",
        httponly=True,
        secure=cookie_should_be_secure(request, settings),
        samesite="lax",
    )


def clear_pending_auth_cookie(response: Response, request: Request, settings: Settings) -> None:
    response.delete_cookie(
        key="misa_pending_auth",
        path="/",
        httponly=True,
        secure=cookie_should_be_secure(request, settings),
        samesite="lax",
    )


def attach_session_cookie(response: Response, request: Request, token: str, ttl: int, settings: Settings) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=ttl,
        path="/",
        httponly=True,
        secure=cookie_should_be_secure(request, settings),
        samesite="lax",
    )


def clear_session_cookie(response: Response, request: Request, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=cookie_should_be_secure(request, settings),
        samesite="lax",
    )


async def get_user_from_request(request: Request) -> User | None:
    settings = get_settings()
    token = request.cookies.get(settings.session_cookie_name)
    data = await load_session(token)
    if not data or not token:
        return None
    try:
        UUID(str(data["user_id"]))
    except ValueError:
        return None
    user = await data_api.get_user(str(data["user_id"]))
    if user is None:
        await destroy_session(token)
        return None
    if user.currently_suspended:
        await destroy_session(token)
        return None
    await touch_session(token, bool(data.get("remember")))
    return user
