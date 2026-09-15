# Production deployment

The supported split deployment is:

```text
Browser -> Vercel (Next.js frontend at misa.lol)
             -> https://api.misa.lol (FastAPI API on the VPS)
                 -> prostgres_db -> Supabase PostgreSQL
                 -> Dragonfly sessions/cache
```

## Backend VPS

Deploy `misa-lol-production-package` on a Docker host. Create a fresh `.env` from that package's `.env.example`; never copy an existing `.env` from a workstation. Set the Supabase pooler connection string, a newly generated `DATA_API_KEY`, `MISA_PUBLIC_BASE_URL=https://misa.lol`, the OAuth/Turnstile values, and the admin UUID. Validate and start it with:

```bash
docker compose config --quiet
docker compose up -d --build --force-recreate --remove-orphans
docker compose ps
```

Expose the API through an HTTPS hostname such as `api.misa.lol`. The supplied nginx configuration currently listens on HTTP port 80; add an HTTPS certificate and port 443 before accepting production traffic. Keep Postgres and Dragonfly private.

## Frontend

Deploy this directory as a Next.js project on Vercel or another Node.js host. Set this server-only variable in the production environment:

```env
MISA_BACKEND_URL=https://api.misa.lol
MISA_TURNSTILE_SITE_KEY=0x4AAAA...
```

Then run the normal production build:

```bash
npm ci
npm run build
npm run start
```

The frontend proxy keeps the browser on the main domain and forwards the HTTP-only session cookie to the API. Set the backend's `MISA_PUBLIC_BASE_URL` to the main frontend domain so OAuth callbacks return to the correct host.

## Turnstile and social login

The frontend site key is public and is used to render the Cloudflare widget. The Turnstile secret, OAuth client secrets, and Telegram bot token are server-only values and belong in the backend VPS `.env` created from `misa-lol-production-package/.env.example`:

```env
MISA_TURNSTILE_SITE_KEY=0x4AAAA...
MISA_TURNSTILE_SECRET_KEY=0x4AAAA...

MISA_GOOGLE_CLIENT_ID=...
MISA_GOOGLE_CLIENT_SECRET=...
MISA_DISCORD_CLIENT_ID=...
MISA_DISCORD_CLIENT_SECRET=...
MISA_TELEGRAM_BOT_TOKEN=...
MISA_TELEGRAM_BOT_USERNAME=...
```

Register these exact HTTPS callback URLs with the providers:

```text
Google:   https://misa.lol/api/v1/auth/google/callback
Discord:  https://misa.lol/api/v1/auth/discord/callback
Telegram: https://misa.lol/api/v1/auth/telegram/callback
```

For Turnstile, add `misa.lol`, `www.misa.lol`, and `ukvhq.dev` as allowed hostnames. For Google, register `https://misa.lol` as an authorized JavaScript origin. For Discord, add the callback under OAuth2 redirect URLs. For Telegram, create the bot with BotFather, use `/setdomain` for `misa.lol`, and use the resulting bot username and token in the backend environment.

Keep `MISA_PUBLIC_BASE_URL=https://misa.lol` even when the API is hosted at `api.misa.lol`: the frontend proxy receives the callback and the session cookie must be issued for the main site.

After restarting the backend, check `/api/v1/auth/providers`. Its `google`, `discord`, and `telegram` fields should be `true`; it should return the Turnstile site key, but never return any secret key.

## Admin host separation

The public site remains at `https://misa.lol`. The admin UI is served at `https://ukvhq.dev/m` through the same Caddy/API/Next deployment. Set `MISA_ADMIN_PUBLIC_URL=https://ukvhq.dev/m`, keep `MISA_PUBLIC_BASE_URL=https://misa.lol`, and include `https://ukvhq.dev` in `MISA_CORS_ORIGINS`. The admin session cookie remains host-only, so it is not sent to the public site.

## Before launch

- Rotate every credential that has ever been stored in a local `.env` file.
- Configure DNS for `misa.lol`, `www`, and `api.misa.lol`.
- Configure Turnstile hostnames and OAuth callback URLs for the production domain.
- Back up Supabase before schema or deployment changes.
- Verify `/api/v1/auth/providers`, signup, login, username claiming, profile save, public profiles, logout, and admin access at `https://ukvhq.dev/m` (the old `misa.lol/admin` path must redirect).

The supplied backend currently provides real Postgres-backed application data and Dragonfly sessions. Password reset, analytics, object storage, premium checkout, templates, and connected-account management still require their backend endpoints before those UI areas can be considered production-complete.
