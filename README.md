# misa.lol VPS deployment bundle

This is the single-folder Docker deployment for misa.lol. Cloudflare Tunnel is the only public ingress. Caddy listens on a loopback-only host port, routes dashboard traffic to Next.js and profile/API traffic to FastAPI, and passes the original HTTPS scheme to the applications.

## Production topology

- `cloudflared` runs on the VPS host and connects outbound to Cloudflare.
- Tunnel ingress targets `http://127.0.0.1:8080`.
- Caddy is the only published container port, bound to VPS loopback only.
- FastAPI, Next.js, the Rust data API, and Dragonfly have no host-published ports.
- The `app` and `data` Docker networks are internal. Services that require outbound access each use a separate egress network.
- PostgreSQL remains Supabase-hosted. Dragonfly is reachable only on the private `data` network.

## VPS environment

Copy `.env.example` to `.env` and fill in the Supabase pooler URL, R2 credentials, a new `DATA_API_KEY`, admin values, Turnstile values, and optional OAuth credentials. Keep:

```dotenv
MISA_ENVIRONMENT=production
MISA_PUBLIC_BASE_URL=https://misa.lol
MISA_ADMIN_PUBLIC_URL=https://ukvhq.dev/m
MISA_CORS_ORIGINS=https://misa.lol,https://www.misa.lol,https://ukvhq.dev
MISA_TRUSTED_HOSTS=misa.lol,www.misa.lol,ukvhq.dev,localhost,127.0.0.1,api
R2_PUBLIC_BASE_URL=https://r2.misa.lol
NEXT_PUBLIC_MEDIA_HOSTS=r2.misa.lol,PROJECT_REF.supabase.co
```

Replace `PROJECT_REF.supabase.co` with the exact legacy storage host, or remove it after all profile media has moved to R2. `MISA_MEDIA_FETCH_HOSTS` is optional and must contain only exact, operator-controlled CDN hostnames.

## Cloudflare Tunnel

Create a named Tunnel and route these public hostnames to it: `misa.lol`, `www.misa.lol`, and `ukvhq.dev`. Do not keep public A or AAAA records pointing to the VPS.

Example `/etc/cloudflared/config.yml`:

```yaml
tunnel: YOUR_TUNNEL_UUID
credentials-file: /etc/cloudflared/YOUR_TUNNEL_UUID.json

ingress:
  - hostname: misa.lol
    service: http://127.0.0.1:8080
    originRequest:
      httpHostHeader: misa.lol
  - hostname: www.misa.lol
    service: http://127.0.0.1:8080
    originRequest:
      httpHostHeader: www.misa.lol
  - hostname: ukvhq.dev
    service: http://127.0.0.1:8080
    originRequest:
      httpHostHeader: ukvhq.dev
  - service: http_status:404
```

Cloudflare should use HTTPS for visitors. The Tunnel-to-Caddy hop is intentionally local HTTP; Caddy sets `X-Forwarded-Proto: https` for secure redirects and cookies. Caddy handles WebSocket upgrades automatically.

## Start and verify

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl -fsS -H 'Host: misa.lol' http://127.0.0.1:8080/api/v1/
sudo systemctl restart cloudflared
curl -I https://misa.lol
curl -s https://misa.lol/api/v1/auth/providers
docker compose exec data-api sh -c 'curl -fsS http://127.0.0.1:8080/health'
```

After the Tunnel works, close public inbound ports 80 and 443 at both the VPS firewall and hosting-provider firewall. Keep only the administrative access you actually use (normally SSH restricted to trusted source addresses). Never publish ports for `api`, `data-api`, Dragonfly, or PostgreSQL.

## OAuth callbacks

Register these exact URLs:

```text
https://misa.lol/api/v1/auth/google/callback
https://misa.lol/api/v1/auth/discord/callback
https://misa.lol/api/v1/auth/telegram/callback
```

## Data safety

Production PostgreSQL is Supabase. Dragonfly data is stored in the `dragonfly_data` volume. Back up Supabase before schema or migration work. Do not run `docker compose down -v`; it removes local named-volume data. Profile JSON remains in PostgreSQL and media files remain in R2/Supabase storage.
