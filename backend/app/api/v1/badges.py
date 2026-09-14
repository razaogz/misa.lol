import re

from fastapi import APIRouter, HTTPException, Response, status

from app.core.profile_sanitize import decode_data_url
from app.db import admin_db

router = APIRouter(prefix="/badges", tags=["badges"])
BADGE_ID = re.compile(r"^[a-z0-9-]{2,64}$")


@router.get("/{badge_id}/icon")
async def badge_icon(badge_id: str) -> Response:
    if not BADGE_ID.fullmatch(badge_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Badge not found.")
    decoded = decode_data_url(await admin_db.get_badge_icon(badge_id))
    if not decoded:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Badge icon not found.")
    body, mime = decoded
    media = mime if mime.startswith("image/") else f"image/{mime}"
    return Response(content=body, media_type=media, headers={"Cache-Control": "public, max-age=3600"})
