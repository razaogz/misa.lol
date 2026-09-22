-- Exact idempotent schema operations migrated from backend/app/db/admin_db.py.
-- Applied once under a transaction-scoped advisory lock by data-api.

-- ensure_badge_icons (legacy lines 2005-2011)
ALTER TABLE badges ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT '';


-- ensure_verification_requests (legacy lines 2269-2292)
CREATE TABLE IF NOT EXISTS verification_requests (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                reason TEXT NOT NULL DEFAULT '',
                proof_url TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                review_note TEXT NOT NULL DEFAULT '',
                reviewed_by UUID,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                reviewed_at TIMESTAMPTZ
            );

CREATE UNIQUE INDEX IF NOT EXISTS verification_requests_pending_user ON verification_requests (user_id) WHERE status = 'pending';


-- ensure_discord_links (legacy lines 232-255)
CREATE TABLE IF NOT EXISTS discord_links (
                user_id UUID PRIMARY KEY,
                discord_id TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                access_token TEXT,
                access_expires_at TIMESTAMPTZ,
                show_avatar BOOLEAN NOT NULL DEFAULT TRUE,
                show_decoration BOOLEAN NOT NULL DEFAULT TRUE,
                show_guild_tag BOOLEAN NOT NULL DEFAULT TRUE,
                show_status BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

ALTER TABLE discord_links ADD COLUMN IF NOT EXISTS show_status BOOLEAN NOT NULL DEFAULT TRUE;


-- ensure_analytics_tables (legacy lines 267-315)
CREATE TABLE IF NOT EXISTS profile_events (
                id BIGSERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                kind TEXT NOT NULL,
                social_id TEXT NOT NULL DEFAULT '',
                social_label TEXT NOT NULL DEFAULT '',
                referrer_host TEXT NOT NULL DEFAULT '',
                country TEXT NOT NULL DEFAULT '',
                device TEXT NOT NULL DEFAULT 'desktop',
                visitor_hash TEXT NOT NULL,
                occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

CREATE INDEX IF NOT EXISTS profile_events_user_time
            ON profile_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS profile_events_user_kind_time
            ON profile_events (user_id, kind, occurred_at DESC);

CREATE INDEX IF NOT EXISTS profile_events_kind_time
            ON profile_events (kind, occurred_at DESC);

CREATE TABLE IF NOT EXISTS profile_stats (
                user_id UUID PRIMARY KEY,
                views BIGINT NOT NULL DEFAULT 0,
                clicks BIGINT NOT NULL DEFAULT 0
            );


-- ensure_template_tables (legacy lines 318-386)
CREATE TABLE IF NOT EXISTS user_roles (
                user_id UUID NOT NULL,
                role TEXT NOT NULL,
                granted_by UUID,
                granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, role)
            );

CREATE TABLE IF NOT EXISTS profile_templates (
                id UUID PRIMARY KEY,
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                config JSONB NOT NULL,
                preview JSONB NOT NULL DEFAULT '{}'::jsonb,
                preview_image_url TEXT,
                published BOOLEAN NOT NULL DEFAULT TRUE,
                created_by UUID NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

ALTER TABLE profile_templates ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE profile_templates ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

ALTER TABLE profile_templates ADD COLUMN IF NOT EXISTS preview_image_url TEXT;

CREATE TABLE IF NOT EXISTS template_favorites (
                template_id UUID NOT NULL REFERENCES profile_templates(id) ON DELETE CASCADE,
                user_id UUID NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (template_id, user_id)
            );

CREATE INDEX IF NOT EXISTS template_favorites_user_idx ON template_favorites (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS template_favorites_template_created_idx ON template_favorites (template_id, created_at DESC);

CREATE INDEX IF NOT EXISTS profile_templates_published_idx ON profile_templates (published, updated_at DESC);

CREATE INDEX IF NOT EXISTS profile_templates_creator_idx ON profile_templates (created_by);


-- ensure_username_history (legacy lines 674-695)
CREATE TABLE IF NOT EXISTS username_history (
                id BIGSERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                old_username VARCHAR(32),
                new_username VARCHAR(32),
                changed_by UUID,
                reason TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

CREATE INDEX IF NOT EXISTS username_history_old_idx ON username_history (lower(old_username));


-- ensure_account_security (legacy lines 698-727)
CREATE TABLE IF NOT EXISTS user_security (
                user_id UUID PRIMARY KEY,
                mfa_secret TEXT,
                mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

CREATE TABLE IF NOT EXISTS mfa_backup_codes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                code_hash TEXT NOT NULL,
                used_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

CREATE INDEX IF NOT EXISTS mfa_backup_codes_user_idx ON mfa_backup_codes (user_id) WHERE used_at IS NULL;


-- ensure_banned_username_words (legacy lines 1679-1694)
CREATE TABLE IF NOT EXISTS banned_username_words (
                word VARCHAR(24) PRIMARY KEY,
                reason TEXT,
                created_by UUID,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );


-- ensure_user_bans (legacy lines 1733-1761)
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_ip VARCHAR(45);

CREATE INDEX IF NOT EXISTS users_signup_ip_idx ON users (signup_ip);

CREATE TABLE IF NOT EXISTS banned_accounts (
                user_id UUID PRIMARY KEY,
                username TEXT,
                reason TEXT,
                created_by UUID,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

CREATE TABLE IF NOT EXISTS banned_ips (
                ip VARCHAR(45) PRIMARY KEY,
                reason TEXT,
                created_by UUID,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );


-- ensure_staff_access (legacy lines 2122-2148)
CREATE TABLE IF NOT EXISTS staff_section_access (
                role TEXT NOT NULL,
                section TEXT NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                PRIMARY KEY (role, section)
            );


-- ensure_feature_flags (legacy lines 2538-2558)
CREATE TABLE IF NOT EXISTS feature_flags (
                key VARCHAR(128) PRIMARY KEY,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                description TEXT NOT NULL DEFAULT '',
                updated_by UUID,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );


-- ensure_premium_ranks (legacy lines 2382-2414)
CREATE TABLE IF NOT EXISTS premium_ranks (
                id UUID PRIMARY KEY,
                name TEXT NOT NULL,
                slug VARCHAR(64) NOT NULL UNIQUE,
                created_by UUID,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );


-- ensure_default_fonts (legacy lines 2606-2628)
CREATE TABLE IF NOT EXISTS default_profile_fonts (
            slot SMALLINT PRIMARY KEY CHECK (slot BETWEEN 2 AND 11),
            name TEXT NOT NULL,
            data_url TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            updated_by UUID,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

ALTER TABLE default_profile_fonts
        DROP CONSTRAINT IF EXISTS default_profile_fonts_slot_check,
        ADD CONSTRAINT default_profile_fonts_slot_check CHECK (slot BETWEEN 2 AND 11);


-- ensure_constellation_tables (legacy lines 109-230)

        CREATE TABLE IF NOT EXISTS constellations (
            id UUID PRIMARY KEY,
            owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(60) NOT NULL,
            slug VARCHAR(32) NOT NULL UNIQUE,
            description VARCHAR(500) NOT NULL DEFAULT '',
            capacity SMALLINT NOT NULL CHECK (capacity BETWEEN 2 AND 4),
            assignment_mode VARCHAR(16) NOT NULL DEFAULT 'owner'
                CHECK (assignment_mode IN ('owner', 'self')),
            global_font VARCHAR(120) NOT NULL DEFAULT 'Inter',
            allow_member_fonts BOOLEAN NOT NULL DEFAULT TRUE,
            allow_member_move BOOLEAN NOT NULL DEFAULT TRUE,
            allow_member_resize BOOLEAN NOT NULL DEFAULT TRUE,
            frame_mode VARCHAR(16) NOT NULL DEFAULT 'member'
                CHECK (frame_mode IN ('member', 'framed', 'frameless')),
            background JSONB NOT NULL DEFAULT '{"type":"color","color":"#08080d"}'::jsonb,
            shared_assets JSONB NOT NULL DEFAULT '{"cursor":null,"audio":null}'::jsonb,
            status VARCHAR(16) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published', 'suspended')),
            published_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        ;


        ALTER TABLE constellations
        ADD COLUMN IF NOT EXISTS shared_assets JSONB NOT NULL
        DEFAULT '{"cursor":null,"audio":null}'::jsonb
        ;


        CREATE TABLE IF NOT EXISTS constellation_members (
            constellation_id UUID NOT NULL REFERENCES constellations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
            slot SMALLINT NOT NULL CHECK (slot >= 1 AND slot <= 4),
            position_x NUMERIC(6,3) NOT NULL DEFAULT 50,
            position_y NUMERIC(6,3) NOT NULL DEFAULT 50,
            scale NUMERIC(5,3) NOT NULL DEFAULT 1,
            frame_override VARCHAR(16) NOT NULL DEFAULT 'inherit'
                CHECK (frame_override IN ('inherit', 'framed', 'frameless')),
            profile_config JSONB,
            joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (constellation_id, user_id),
            UNIQUE (constellation_id, slot)
        )
        ;


        ALTER TABLE constellation_members
        ADD COLUMN IF NOT EXISTS profile_config JSONB
        ;


        UPDATE constellation_members AS member
        SET profile_config = profile.config
        FROM profiles AS profile
        WHERE profile.user_id = member.user_id
          AND profile.disabled_at IS NULL
          AND member.profile_config IS NULL
        ;


        CREATE TABLE IF NOT EXISTS constellation_invitations (
            id UUID PRIMARY KEY,
            constellation_id UUID NOT NULL REFERENCES constellations(id) ON DELETE CASCADE,
            token_hash CHAR(64) NOT NULL UNIQUE,
            invited_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            invited_username VARCHAR(32),
            invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ,
            accepted_at TIMESTAMPTZ,
            accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        ;


        DO $constellation_limit$
        DECLARE capacity_definition TEXT;
        BEGIN
            SELECT pg_get_constraintdef(oid) INTO capacity_definition
            FROM pg_constraint
            WHERE conrelid = 'constellations'::regclass
              AND conname = 'constellations_capacity_check';
            IF capacity_definition IS NULL OR capacity_definition NOT LIKE '%4%' THEN
                ALTER TABLE constellations DROP CONSTRAINT IF EXISTS constellations_capacity_check;
                ALTER TABLE constellations ADD CONSTRAINT constellations_capacity_check
                    CHECK (capacity BETWEEN 2 AND 4) NOT VALID;
            END IF;
        END;
        $constellation_limit$;
        ;


        DO $constellation_slot_limit$
        DECLARE slot_definition TEXT;
        BEGIN
            SELECT pg_get_constraintdef(oid) INTO slot_definition
            FROM pg_constraint
            WHERE conrelid = 'constellation_members'::regclass
              AND conname = 'constellation_members_slot_check';
            IF slot_definition IS NULL OR slot_definition NOT LIKE '%4%' THEN
                ALTER TABLE constellation_members DROP CONSTRAINT IF EXISTS constellation_members_slot_check;
                ALTER TABLE constellation_members ADD CONSTRAINT constellation_members_slot_check
                    CHECK (slot BETWEEN 1 AND 4) NOT VALID;
            END IF;
        END;
        $constellation_slot_limit$;
        ;

CREATE INDEX IF NOT EXISTS constellations_owner_idx ON constellations (owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS constellations_status_idx ON constellations (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS constellation_members_user_idx ON constellation_members (user_id, joined_at DESC);

CREATE INDEX IF NOT EXISTS constellation_invites_target_idx ON constellation_invitations (invited_user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS constellation_invites_group_idx ON constellation_invitations (constellation_id, created_at DESC);


-- ensure_apple_support (legacy lines 258-264)
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id VARCHAR(128) UNIQUE;


-- ensure_admin_auth_tables (legacy lines 2684-2767)
CREATE TABLE IF NOT EXISTS admin_accounts (
            id UUID PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL DEFAULT 'Misa administrator',
            role TEXT NOT NULL DEFAULT 'admin',
            permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
            status TEXT NOT NULL DEFAULT 'active',
            suspended BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS admin_otps (
            id UUID PRIMARY KEY,
            admin_id UUID NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
            code_hash TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            consumed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS admin_sessions (
            id UUID PRIMARY KEY,
            admin_id UUID NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            ip_address TEXT,
            user_agent TEXT,
            device_fingerprint TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS admin_invites (
            id UUID PRIMARY KEY,
            email TEXT NOT NULL,
            name TEXT NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL DEFAULT 'admin',
            permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
            expires_at TIMESTAMPTZ NOT NULL,
            created_by UUID,
            accepted_at TIMESTAMPTZ,
            revoked_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS admin_otps_admin_created_idx ON admin_otps (admin_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS admin_sessions_token_idx ON admin_sessions (token_hash);
        CREATE INDEX IF NOT EXISTS admin_sessions_admin_idx ON admin_sessions (admin_id);
        CREATE INDEX IF NOT EXISTS admin_invites_email_idx ON admin_invites (lower(email));

ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;

ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

ALTER TABLE admin_invites ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE admin_invites ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- Legacy startup seeds; preserve operator overrides on upgrade.
INSERT INTO staff_section_access (role, section, enabled) VALUES
    ('admin','users',TRUE),
    ('admin','constellations',TRUE),
    ('admin','bans',TRUE),
    ('admin','reserved',TRUE),
    ('admin','banned',TRUE),
    ('admin','badges',TRUE),
    ('admin','premium',TRUE),
    ('admin','reports',TRUE),
    ('admin','flags',TRUE),
    ('admin','bakaboost',TRUE),
    ('admin','themes',TRUE),
    ('admin','templates',TRUE),
    ('admin','fonts',TRUE),
    ('admin','audit',TRUE),
    ('moderator','users',TRUE),
    ('moderator','constellations',TRUE),
    ('moderator','bans',TRUE),
    ('moderator','reserved',TRUE),
    ('moderator','banned',TRUE),
    ('moderator','badges',TRUE),
    ('moderator','premium',TRUE),
    ('moderator','reports',TRUE),
    ('moderator','flags',TRUE),
    ('moderator','bakaboost',TRUE),
    ('moderator','themes',TRUE),
    ('moderator','templates',TRUE),
    ('moderator','fonts',TRUE),
    ('moderator','audit',TRUE)
ON CONFLICT (role, section) DO NOTHING;

INSERT INTO feature_flags (key, enabled, description) VALUES
    ('nav.overview',TRUE,'Overview navigation'),
    ('nav.analytics',TRUE,'Analytics navigation'),
    ('nav.badges',TRUE,'Badges navigation'),
    ('nav.settings',TRUE,'Settings navigation'),
    ('nav.security',TRUE,'Security navigation'),
    ('nav.constellations',TRUE,'Constellations navigation'),
    ('nav.customize',TRUE,'Customize navigation'),
    ('nav.links',TRUE,'Links navigation'),
    ('nav.leaderboard',TRUE,'Leaderboard navigation'),
    ('nav.premium',TRUE,'Premium navigation'),
    ('nav.templates',TRUE,'Templates navigation'),
    ('customize.assets',TRUE,'Assets customization'),
    ('customize.assets.avatar',TRUE,'Avatar uploads'),
    ('customize.assets.background',TRUE,'Background image'),
    ('customize.assets.backgroundVideo',TRUE,'Background video'),
    ('customize.assets.audio',TRUE,'Profile audio'),
    ('customize.assets.audioCrop',TRUE,'Extract and crop audio from video'),
    ('customize.layout',TRUE,'Layout customization'),
    ('customize.effects',TRUE,'Effects customization'),
    ('customize.effects.username',TRUE,'Username effect controls'),
    ('customize.widgets',TRUE,'Widgets customization'),
    ('customize.portfolio',TRUE,'Portfolio customization'),
    ('customize.sharing',TRUE,'Sharing appearance'),
    ('profile.frame',TRUE,'Profile frame'),
    ('profile.avatar',TRUE,'Profile avatar'),
    ('profile.avatarBorder',TRUE,'Avatar border'),
    ('profile.displayName',TRUE,'Display name'),
    ('profile.socials',TRUE,'Social links'),
    ('profile.widgets',TRUE,'Profile widgets'),
    ('profile.badges',TRUE,'Profile badges'),
    ('profile.audio',TRUE,'Profile audio playback'),
    ('profile.views',TRUE,'Profile views'),
    ('profile.joinDate',TRUE,'Profile join date'),
    ('integrations.discord',TRUE,'Discord integration'),
    ('feature.usernameEffects.glitch',TRUE,'Glitch username effect'),
    ('feature.usernameEffects.pulse',TRUE,'Pulse username effect'),
    ('feature.usernameEffects.wave',TRUE,'Wave username effect'),
    ('feature.usernameEffects.shadow',TRUE,'Shadow username effect')
ON CONFLICT (key) DO NOTHING;

-- Match legacy initial premium-rank seeding before badge/rank conversion.
INSERT INTO premium_ranks (id, name, slug)
SELECT gen_random_uuid(), plan, slug FROM (
    SELECT plan, left(trim(both '_' from regexp_replace(
        regexp_replace(lower(btrim(plan)), '[^[:alnum:]]+', '_', 'g'),
        '_+', '_', 'g'
    )), 64) AS slug
    FROM (SELECT DISTINCT plan FROM premium_entitlements
          WHERE plan IS NOT NULL AND length(plan) > 0) AS plans
) AS normalized
WHERE slug <> '' AND NOT EXISTS (SELECT 1 FROM premium_ranks)
ON CONFLICT (slug) DO NOTHING;
