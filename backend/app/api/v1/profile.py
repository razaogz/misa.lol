from typing import Any, Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from httpx import HTTPError

from app.core.config import get_settings
from app.core.og_card import fallback_favicon_png, render_og_png
from app.core.profile_sanitize import ASSET_KIND_TYPES, ASSET_KINDS, SECTION_ID, apply_badge_ownership, decode_data_url, merge_kept_profile, safe_asset_url, sanitize_profile_config
from app.core.profiles import default_public_profile, resolve_public_profile, stamp_join_date, unwrap_profile_config
from app.core.security import USERNAME_RE
from app.core.sessions import get_user_from_request
from app.core.rate_limit import client_ip, rate_limit
from app.core.usernames import current_handle_for, username_redirect
from app.core.widgets import resolve_profile_widgets
from app.db import data_api
from app.models import User

router = APIRouter(prefix="/profile", tags=["profiles"])


async def require_user(request: Request) -> User:
    user = await get_user_from_request(request)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    return user


def _media_response(url: str) -> Response | None:
    decoded = decode_data_url(url)
    if decoded:
        body, mime = decoded
        return Response(content=body, media_type=mime, headers={"Cache-Control": "no-store", "Accept-Ranges": "bytes"})
    parsed = urlparse(url)
    if parsed.scheme in {"http", "https"} and parsed.netloc and not parsed.username and not parsed.password:
        return RedirectResponse(url, status_code=302)
    return None


@router.get("/limits")
async def profile_limits() -> dict[str, int]:
    settings = get_settings()
    return {
        "maxTracks": max(1, min(20, settings.max_profile_tracks)),
        "maxTrackBytes": max(500_000, settings.max_track_upload_bytes),
        "maxArtworkBytes": 3_000_000,
    }


@router.get("")
async def public_profile(username: Annotated[str, Query(min_length=3, max_length=24)], response: Response):
    response.headers["Cache-Control"] = "no-store"
    handle = username.strip().lower()
    alias = await current_handle_for(handle)
    if alias:
        return username_redirect(f"/api/v1/profile?username={alias}")
    profile = await resolve_public_profile(handle)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    return {"profile": profile}


def _public_media(url: str | None, kind: str) -> Response | None:
    safe = safe_asset_url(url, kind)
    return _media_response(safe) if safe else None


@router.get("/{username}/widgets")
async def public_profile_widgets(username: str, request: Request) -> dict[str, Any]:
    handle = username.strip().lower()
    if not USERNAME_RE.fullmatch(handle):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    await rate_limit(f"rl:widgets:{client_ip(request)}", 40, 60)
    alias = await current_handle_for(handle)
    if alias:
        return username_redirect(f"/api/v1/profile/{alias}/widgets")
    profile = await resolve_public_profile(handle)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    return {"widgets": await resolve_profile_widgets(profile)}


@router.get("/{username}/sections/{section_id}/cover")
async def public_section_cover(username: str, section_id: str) -> Response:
    handle = username.strip().lower()
    if not USERNAME_RE.fullmatch(handle) or not SECTION_ID.fullmatch(section_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    alias = await current_handle_for(handle)
    if alias:
        return username_redirect(f"/api/v1/profile/{alias}/sections/{section_id}/cover")
    profile = await resolve_public_profile(handle)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    section = next((item for item in profile.get("sections") or [] if isinstance(item, dict) and item.get("id") == section_id and item.get("enabled")), None)
    cover = section.get("cover") if isinstance(section, dict) else None
    url = str((cover or {}).get("url") or "") if isinstance(cover, dict) else ""
    media = _public_media(url, "image")
    if media:
        return media
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")


@router.get("/{username}/assets/{kind}")
async def public_profile_asset(username: str, kind: str) -> Response:
    handle = username.strip().lower()
    if kind not in ASSET_KINDS or not USERNAME_RE.fullmatch(handle):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    alias = await current_handle_for(handle)
    if alias:
        return username_redirect(f"/api/v1/profile/{alias}/assets/{kind}")
    media = _public_media(await data_api.get_public_asset_url(handle, kind), ASSET_KIND_TYPES[kind])
    if media:
        return media
    if kind == "favicon":
        media = _public_media(await data_api.get_public_asset_url(handle, "avatar"), "image")
        if media:
            return media
        bits = await data_api.get_share_card_bits(handle)
        if bits:
            identity = bits.get("identity") if isinstance(bits.get("identity"), dict) else {}
            settings = bits.get("settings") if isinstance(bits.get("settings"), dict) else {}
            initial = str(identity.get("displayName") or bits.get("username") or handle)[:1]
            return Response(
                content=fallback_favicon_png(initial, str(settings.get("accentColor") or "#9b87f5")),
                media_type="image/png",
                headers={"Cache-Control": "public, max-age=120"},
            )
    if kind in {"audio", "audioArtwork"}:
        fallback = "audio" if kind == "audio" else "artwork"
        media = _public_media(
            await data_api.get_public_track_asset_url(handle, "track-1", fallback),
            "audio" if fallback == "audio" else "image",
        )
        if media:
            return media
    profile = await resolve_public_profile(username)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    assets = profile.get("assets") or {}
    item = assets.get(kind)
    url = str((item or {}).get("url") or "") if isinstance(item, dict) else ""
    media = _media_response(url)
    if media:
        return media
    if kind in {"audio", "audioArtwork"}:
        first = next((track for track in assets.get("tracks") or [] if isinstance(track, dict)), None)
        source = (first or {}).get("audio" if kind == "audio" else "artwork")
        media = _media_response(str((source or {}).get("url") or "") if isinstance(source, dict) else "")
        if media:
            return media
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")


@router.get("/{username}/og.jpg")
@router.get("/{username}/og.png")
async def public_og_image(username: str) -> Response:
    handle = username.strip().lower()
    if not USERNAME_RE.fullmatch(handle):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    alias = await current_handle_for(handle)
    if alias:
        return username_redirect(f"/api/v1/profile/{alias}/og.jpg")
    bits = await data_api.get_share_card_bits(handle)
    if bits is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    image = await render_og_png(bits)
    version = str(bits.get("version") or "0")
    return Response(
        content=image,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
            "ETag": f'W/"{handle}-{version}"',
        },
    )


@router.get("/{username}/tracks/{track_id}/{kind}")
async def public_track_asset(username: str, track_id: str, kind: str) -> Response:
    handle = username.strip().lower()
    if kind not in {"audio", "artwork"} or not USERNAME_RE.fullmatch(handle):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    alias = await current_handle_for(handle)
    if alias:
        return username_redirect(f"/api/v1/profile/{alias}/tracks/{track_id}/{kind}")
    media = _public_media(await data_api.get_public_track_asset_url(handle, track_id, kind), "audio" if kind == "audio" else "image")
    if media:
        return media
    if kind == "artwork":
        media = _public_media(await data_api.get_public_asset_url(handle, "avatar"), "image")
        if media:
            return media
    profile = await resolve_public_profile(username)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    assets = profile.get("assets") or {}
    track = next((item for item in assets.get("tracks") or [] if isinstance(item, dict) and item.get("id") == track_id), None)
    if track is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    source = track.get("audio" if kind == "audio" else "artwork")
    url = str((source or {}).get("url") or "") if isinstance(source, dict) else ""
    media = _media_response(url)
    if media:
        return media
    if kind == "artwork":
        avatar = (assets.get("avatar") or {}).get("url") if isinstance(assets.get("avatar"), dict) else ""
        media = _media_response(str(avatar or ""))
        if media:
            return media
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")


@router.get("/me")
async def my_profile(user: User = Depends(require_user)) -> dict[str, Any]:
    profile = unwrap_profile_config(await data_api.get_profile(user.id))
    grants = await data_api.list_user_badge_grants(user.id)
    if profile is None:
        if not user.username:
            return {"profile": None}
        cleaned = apply_badge_ownership(sanitize_profile_config(stamp_join_date(default_public_profile(user), user)), None, grants)
    else:
        cleaned = apply_badge_ownership(sanitize_profile_config(stamp_join_date(profile, user)), profile, grants)
    identity = cleaned.get("profile")
    if isinstance(identity, dict):
        identity["views"] = await data_api.get_profile_view_count(user.id)
    return {"profile": cleaned}


@router.put("/me")
async def save_my_profile(payload: dict[str, Any], user: User = Depends(require_user)) -> dict[str, Any]:
    if not isinstance(payload, dict) or not isinstance(payload.get("profile"), dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid profile payload.")
    if not user.username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a username before saving your profile.")
    profile = payload["profile"]
    if str(profile.get("username", "")).strip().lower() != user.username.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Profile username does not match the signed-in account.")
    profile["username"] = user.username
    profile["uid"] = user.id
    existing = unwrap_profile_config(await data_api.get_profile(user.id))
    payload = apply_badge_ownership(
        sanitize_profile_config(stamp_join_date(merge_kept_profile(payload, existing), user)),
        existing,
        await data_api.list_user_badge_grants(user.id),
    )
    display_name = str(profile.get("displayName", "")).strip()
    if not display_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Display name cannot be empty.")
    try:
        updated = await data_api.update_user(user.id, display_name=display_name)
        if updated is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
        saved = await data_api.save_profile(user.id, payload)
    except HTTPException:
        raise
    except (HTTPError, RuntimeError, ValueError, TimeoutError, OSError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Profile storage is temporarily unavailable. Please try again.") from None
    return {"profile": sanitize_profile_config(saved) if isinstance(saved, dict) else saved}
