import json
import secrets
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from jwt import PyJWKClient

from app.core.config import Settings
from app.db.dragonfly import get_dragonfly

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
DISCORD_AUTH_URL = "https://discord.com/api/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_USER_URL = "https://discord.com/api/users/@me"
TELEGRAM_AUTH_URL = "https://oauth.telegram.org/auth"

_google_jwk_client = PyJWKClient(GOOGLE_JWKS_URL)


def _state_key(state: str) -> str:
    return f"oauth:{state}"


async def save_oauth_state(provider: str, next_path: str, nonce: str = "", mode: str = "login") -> str:
    state = secrets.token_urlsafe(32)
    payload = {"provider": provider, "next": next_path, "nonce": nonce, "mode": mode}
    await get_dragonfly().set(_state_key(state), json.dumps(payload), ex=600)
    return state


async def pop_oauth_state(state: str | None, provider: str) -> dict[str, Any] | None:
    if not state:
        return None
    redis = get_dragonfly()
    # Consume the provider state atomically so a callback cannot be replayed
    # concurrently before the delete reaches Dragonfly.
    raw = await redis.getdel(_state_key(state))
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if data.get("provider") != provider:
        return None
    return data


def google_redirect_uri(settings: Settings) -> str:
    return f"{settings.public_base_url.rstrip('/')}/api/v1/auth/google/callback"


def discord_redirect_uri(settings: Settings) -> str:
    return f"{settings.public_base_url.rstrip('/')}/api/v1/auth/discord/callback"


def telegram_redirect_uri(settings: Settings) -> str:
    return f"{settings.public_base_url.rstrip('/')}/api/v1/auth/telegram/callback"


def google_authorize_url(settings: Settings, state: str, nonce: str) -> str:
    query = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": google_redirect_uri(settings),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "nonce": nonce,
            "access_type": "online",
            "prompt": "select_account",
        }
    )
    return f"{GOOGLE_AUTH_URL}?{query}"


def discord_authorize_url(settings: Settings, state: str) -> str:
    query = urlencode(
        {
            "client_id": settings.discord_client_id,
            "redirect_uri": discord_redirect_uri(settings),
            "response_type": "code",
            "scope": "identify email",
            "state": state,
            "prompt": "consent",
        }
    )
    return f"{DISCORD_AUTH_URL}?{query}"


def telegram_authorize_url(settings: Settings) -> str:
    origin = settings.public_base_url.rstrip("/")
    query = urlencode(
        {
            "bot_id": settings.telegram_bot_id,
            "origin": origin,
            "request_access": "write",
            "return_to": telegram_redirect_uri(settings),
        }
    )
    return f"{TELEGRAM_AUTH_URL}?{query}"


async def exchange_google_code(settings: Settings, code: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": google_redirect_uri(settings),
                "grant_type": "authorization_code",
            },
        )
        response.raise_for_status()
        tokens = response.json()
    id_token = tokens.get("id_token")
    if not id_token:
        raise ValueError("Google did not return an id_token")
    signing_key = _google_jwk_client.get_signing_key_from_jwt(id_token)
    claims = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=settings.google_client_id,
        issuer=["accounts.google.com", "https://accounts.google.com"],
    )
    return claims


async def fetch_discord_user(settings: Settings, code: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": "misa.lol (https://misa.lol)"}) as client:
        token_response = await client.post(
            DISCORD_TOKEN_URL,
            data={
                "client_id": settings.discord_client_id,
                "client_secret": settings.discord_client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": discord_redirect_uri(settings),
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        token_response.raise_for_status()
        access_token = token_response.json().get("access_token")
        if not access_token:
            raise ValueError("Discord did not return an access_token")
        user_response = await client.get(
            DISCORD_USER_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_response.raise_for_status()
        return user_response.json()


def discord_avatar_url(user: dict[str, Any]) -> str | None:
    user_id = user.get("id")
    avatar = user.get("avatar")
    if user_id and avatar:
        return f"https://cdn.discordapp.com/avatars/{user_id}/{avatar}.png"
    return None
