# misa.lol VPS deployment bundle

This is the single-folder Docker deployment for the selected misa.lol frontend and backend. The browser reaches Caddy over HTTPS; Caddy routes to Next.js; Next.js proxies API requests to FastAPI; FastAPI uses the Rust data API for Supabase PostgreSQL and Dragonfly for sessions/cache.

## Deploy on the VPS

1. Upload this whole folder to the VPS.
2. Install Docker Engine and the Docker Compose plugin.
3. Copy `.env.example` to `.env` and fill in the Supabase pooler URL, Supabase Storage URL/service-role key, a new `DATA_API_KEY`, admin UUID, Turnstile values, and optional OAuth credentials.
4. Ensure Cloudflare DNS has proxied A records for `misa.lol` and `www` pointing to the VPS IP. Set Cloudflare SSL/TLS mode to `Full (strict)`.
5. Run:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=100
```

Caddy obtains and renews the HTTPS certificate automatically. Ports 80 and 443 must be reachable from the internet. Do not expose the API, data API, database, or Dragonfly ports publicly.

## Database and recovery

The production database is Supabase PostgreSQL; there is no disposable local Postgres container. On first start, the Rust data API runs its idempotent schema migrations against `DATABASE_URL`. The data API has outbound access only through its dedicated egress network so it can reach Supabase; the Dragonfly network remains internal. Dragonfly data is stored in the named `dragonfly_data` volume. Back up Supabase before changes and do not run `docker compose down -v` unless you intentionally want to delete the local Dragonfly volume and Caddy certificate state.

Profile assets use Supabase Storage. The API automatically creates a public `misa-assets` bucket on the first upload when `MISA_SUPABASE_URL` and `MISA_SUPABASE_SERVICE_ROLE_KEY` are configured. Keep the service-role key in `.env` only; it must never be placed in frontend code.

## OAuth callback URLs

Register these exact URLs:

```text
https://misa.lol/api/v1/auth/google/callback
https://misa.lol/api/v1/auth/discord/callback
https://misa.lol/api/v1/auth/telegram/callback
```

The backend must keep `MISA_PUBLIC_BASE_URL=https://misa.lol` because the frontend proxy receives callbacks and sets the main-site session cookie.

## Checks

```bash
curl -I https://misa.lol
curl -s https://misa.lol/api/v1/auth/providers
docker compose exec data-api sh -c 'wget -qO- http://127.0.0.1:8080/health'
```
