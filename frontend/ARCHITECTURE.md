# misa.lol frontend architecture

This directory is the authoritative misa.lol web application selected after comparing both supplied packages and their archives. It contains the complete Next.js dashboard, profile editor, public profile renderer, and auth screens.

## Runtime boundary

- The browser talks only to same-origin Next.js route handlers.
- `app/api/v1/[...path]/route.ts` forwards API calls to the FastAPI service from the production package.
- `app/api/auth/*` and `app/api/profile/route.ts` translate frontend payloads to the backend’s snake_case API and forward the HTTP-only `misa_session` cookie.
- `MISA_BACKEND_URL` is server-only. Do not expose it as a `NEXT_PUBLIC_*` variable.

## Local setup

1. Start the FastAPI/Postgres/Dragonfly services from `misa-lol-production-package`.
2. Copy `.env.example` to `.env.local` and set `MISA_BACKEND_URL`.
3. Run `npm install`, then `npm run dev`.

For a container deployment, set `MISA_BACKEND_URL=http://app01:8000` when the frontend shares the Compose network with the FastAPI service. If the frontend is deployed separately, use the backend’s private HTTPS origin instead.

The frontend intentionally does not contain a local account database, mock analytics, or data-URL upload fallback. If the backend or object-storage endpoint is unavailable, the UI reports that state instead of presenting sample data or persisting pretend production data.

## Current backend gaps

The supplied backend package does not yet expose password reset, analytics, object-storage uploads, premium checkout/entitlement UI, template management, or connected-account management. The corresponding frontend surfaces remain honest unavailable states or preserved navigation labels until those APIs are implemented.
