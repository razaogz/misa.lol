from contextlib import asynccontextmanager
from html import escape
from pathlib import Path
import json

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.middleware import RequestContextMiddleware
from app.core.sessions import get_user_from_request
from app.db import admin_db, close_admin_db, close_data_api, close_dragonfly, data_api, init_admin_db, init_data_api, init_dragonfly

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"
PAGES_DIR = TEMPLATES_DIR / "pages"
PRIVATE_PAGES = {"dashboard"}
GUEST_PAGES = {"login", "signup"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging("DEBUG" if settings.debug else "INFO")
    init_dragonfly(settings.dragonfly_url)
    await init_data_api(settings.data_api_url, settings.data_api_key)
    await init_admin_db(settings.database_url)
    root_email = settings.admin_root_email.strip().lower()
    if not root_email or "@" not in root_email:
        raise RuntimeError("SUPER_ADMIN_EMAIL is not configured with a valid email address.")
    await admin_db.ensure_root_account(root_email)
    app.state.settings = settings
    yield
    await close_data_api()
    await close_admin_db()
    await close_dragonfly()


def page_file(name: str) -> Path:
    pages = PAGES_DIR.resolve()
    slug = name.removesuffix(".html") or "index"
    if slug != Path(slug).name or slug in {".", ".."}:
        raise HTTPException(status_code=404)
    path = (pages / slug / "index.html").resolve()
    if not path.is_relative_to(pages) or not path.is_file():
        raise HTTPException(status_code=404)
    return path


def html_response(name: str, status_code: int = 200) -> FileResponse:
    return FileResponse(page_file(name), status_code=status_code, media_type="text/html")


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    application.add_middleware(RequestContextMiddleware)
    application.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(api_router, prefix=settings.api_v1_prefix)

    def frontend_config_js() -> Response:
        current = get_settings()
        payload = json.dumps({"turnstileSiteKey": current.turnstile_site_key})
        body = (
            f"window.MISA_CONFIG = {payload};"
            "window.MISA_TURNSTILE_SITE_KEY = window.MISA_CONFIG.turnstileSiteKey;"
        )
        return Response(
            body,
            media_type="application/javascript",
            headers={"Cache-Control": "no-store"},
        )

    # Register before the /js StaticFiles mount so this is not shadowed.
    application.add_api_route("/js/config.js", frontend_config_js, methods=["GET"])
    application.add_api_route("/config.js", frontend_config_js, methods=["GET"])

    application.mount("/css", StaticFiles(directory=TEMPLATES_DIR / "css"), name="css")
    application.mount("/js", StaticFiles(directory=TEMPLATES_DIR / "js"), name="js")
    application.mount("/icons", StaticFiles(directory=TEMPLATES_DIR / "icons"), name="icons")
    application.mount("/images", StaticFiles(directory=TEMPLATES_DIR / "images"), name="images")

    @application.get("/")
    async def home() -> FileResponse:
        return html_response("index.html")

    @application.get("/robots.txt")
    async def robots() -> FileResponse:
        return FileResponse(TEMPLATES_DIR / "robots.txt", media_type="text/plain")

    @application.get("/{page}", response_model=None)
    async def html_page(page: str, request: Request) -> FileResponse | RedirectResponse:
        slug = page.removesuffix(".html") or "index"
        if slug in PRIVATE_PAGES | GUEST_PAGES:
            user = await get_user_from_request(request)
            if slug in PRIVATE_PAGES and user is None:
                return RedirectResponse("/login", status_code=302)
            if slug in GUEST_PAGES and user is not None:
                return RedirectResponse("/dashboard", status_code=302)
        try:
            user = await data_api.find_user(username=slug.lower())
            if user:
                profile = await data_api.get_profile(user.id)
                if profile:
                    return HTMLResponse(render_public_profile(profile))
        except Exception:
            pass
        return html_response(f"{slug}.html")

    @application.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException) -> HTMLResponse | JSONResponse:
        if request.url.path.startswith("/api"):
            return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
        if exc.status_code >= 500:
            return HTMLResponse(
                "<!DOCTYPE html><title>Server error</title><h1>Server error</h1>",
                status_code=exc.status_code,
            )
        return HTMLResponse(
            "<!DOCTYPE html><title>Not found</title><h1>Page not found</h1><p><a href='/'>Back home</a></p>",
            status_code=404,
        )

    return application


def render_public_profile(config: dict) -> str:
    profile = config.get("profile") or {}
    settings = config.get("settings") or {}
    assets = config.get("assets") or {}
    username = escape(str(profile.get("username") or "user"))
    display_name = escape(str(profile.get("displayName") or username))
    description = escape(str(profile.get("description") or ""))
    location = escape(str(profile.get("location") or ""))
    accent = escape(str(settings.get("accentColor") or "#9b87f5"))
    text_color = escape(str(settings.get("textColor") or "#ffffff"))
    background = escape(str(settings.get("backgroundColor") or "#08080d"))
    avatar = str((assets.get("avatar") or {}).get("url") or "")
    background_image = str((assets.get("background") or {}).get("url") or "")
    video = str((assets.get("backgroundVideo") or {}).get("url") or "")
    avatar_tag = f'<img class="avatar" src="{escape(avatar, quote=True)}" alt="{display_name}">' if avatar else '<div class="avatar avatar-placeholder">âœ¦</div>'
    video_tag = f'<video class="background" autoplay muted loop playsinline><source src="{escape(video, quote=True)}"></video>' if video else ""
    image_style = f'background-image:url("{escape(background_image, quote=True)}");' if background_image else ""
    socials = []
    for social in config.get("socials") or []:
        if not social.get("enabled"):
            continue
        label = escape(str(social.get("label") or social.get("platform") or "Link"))
        value = str(social.get("value") or "")
        if social.get("displayMode") == "text":
            socials.append(f'<span class="social">{label}: {escape(value)}</span>')
        else:
            href = value if value.startswith(("http://", "https://", "mailto:")) else f"https://{value}"
            socials.append(f'<a class="social" href="{escape(href, quote=True)}" target="_blank" rel="noreferrer">{label}</a>')
    links = "".join(socials)
    location_tag = f'<p class="location">âŒ– {location}</p>' if location else ""
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{display_name} Â· misa.lol</title>
<style>
*{{box-sizing:border-box}}html,body{{margin:0;min-height:100%;background:{background};color:{text_color};font-family:Inter,system-ui,sans-serif}}body{{display:grid;place-items:center;overflow:hidden}}.background{{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;opacity:.28;z-index:0}}.backdrop{{position:fixed;inset:0;background:linear-gradient(135deg,{background}e8,{background}b8),radial-gradient(circle at 20% 20%,{accent}33,transparent 42%);background-size:cover;background-position:center;z-index:1}}.card{{position:relative;z-index:2;width:min(92vw,560px);padding:42px 34px;border:1px solid {accent}4d;border-radius:28px;background:#111118cc;backdrop-filter:blur(22px);box-shadow:0 24px 90px #0008;text-align:center}}.avatar{{width:96px;height:96px;object-fit:cover;border-radius:50%;margin:0 auto 20px;border:3px solid {accent};box-shadow:0 0 36px {accent}66}}.avatar-placeholder{{display:grid;place-items:center;background:{accent}22;color:{accent};font-size:36px}}h1{{margin:0;font-size:32px;letter-spacing:-.04em}}.handle{{margin:8px 0 0;color:{accent}}}.description{{margin:18px auto 0;max-width:420px;color:#d5d1df;line-height:1.6}}.location{{color:#aaa6b6;font-size:13px}}.socials{{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:26px}}.social{{padding:10px 15px;border:1px solid #ffffff18;border-radius:999px;background:#ffffff0d;color:inherit;text-decoration:none;font-size:13px}}.social:hover{{border-color:{accent};background:{accent}22}}.brand{{display:block;margin-top:28px;color:#777382;text-decoration:none;font-size:12px}}.brand span{{color:{accent}}}
</style></head><body>{video_tag}<div class="backdrop" style="{image_style}"></div><main class="card">{avatar_tag}<h1>{display_name}</h1><p class="handle">@{username}</p>{location_tag}<p class="description">{description}</p><div class="socials">{links}</div><a class="brand" href="/">made with <span>misa.lol</span></a></main></body></html>"""


app = create_app()
