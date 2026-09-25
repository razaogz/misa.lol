# Performance report

Audit completed: 2026-09-26

## Findings and changes

- Dashboard startup eagerly warmed Analytics, Badges, and Constellations data after login, including when users never visited those pages. Navigation could also prefetch several route bundles independently. Replaced the timers with pointer and keyboard intent prefetching; only the selected data-backed section warms, and existing loaders retain their single-flight/TTL cache behavior. For a session that opens none of those sections, this removes four avoidable API requests (Analytics, Badges, and two Constellations reads).
- Public profiles loaded portfolio and background effect code through the shared renderer regardless of whether a profile used those features, and imported Framer Motion for two entrance transitions. The optional views now load on demand; the entrance transitions use existing CSS keyframes and honor reduced-motion settings.
- Project cover images in below-profile sections now use native lazy loading on public profiles and asynchronous decoding; editor previews stay eager so screenshot/capture flows keep their assets ready. This defers below-fold image requests without routing user media through the app optimizer.
- Public static files served by Caddy had validators but no explicit browser cache lifetime. Added `Cache-Control: public, max-age=3600` to the public CSS, JS, icon, image, font, manifest, and robots asset handler. The dynamic configuration endpoint and HTML routes are outside that handler.
- The Arrange Profile editor exposed movable badges over Discord, audio, and widget content, and presented desktop/mobile selector buttons. Those controls now follow the actual viewport; the movable badges stay hidden visually and remain revealable on keyboard focus. The frame badge and resizing remain available.
- Existing architecture already avoids several common costs: account hydration batches independent reads, public profile metadata/page data share a request-scoped cached server load, the page hydrates the shared renderer without a duplicate profile fetch, and dashboard data loaders cache/in-flight-deduplicate. These paths were preserved.

## Measurements

Next.js production build First Load JS (before -> after, kB as reported by Next.js):

| Route | Before | After | Change |
| --- | ---: | ---: | ---: |
| Overview `/` | 219 | 172 | -47 (-21%) |
| Public profile `/p/[username]` | 197 | 151 | -46 (-23%) |
| Preview `/preview` | 198 | 151 | -47 (-24%) |
| Shared by all routes | 103 | 103 | unchanged |

Baseline values were recorded before the changes. Intermediate build after splitting optional profile modules reported 214 kB for Overview and 192 kB for public profiles; removing Framer Motion from the shared profile renderer produced the additional reduction. Route sizes can move slightly between builds as Next.js assigns shared chunks.

Before deployment, local-origin TTFB samples (three requests each, measured from the VPS to its own Caddy/Next services) were: `/` 0.4–1.6 ms, `/dashboard` 1.7–2.5 ms, `/dashboard/analytics` 1.2–1.3 ms, and `/dashboard/customize` 1.2–1.5 ms. These are origin-local measurements and do not represent visitor latency. The previous static asset responses had an ETag but no Cache-Control header.

After deployment, Caddy served the tested CSS asset with `Cache-Control: public, max-age=3600` and an ETag. The frontend container reported healthy; `/`, `/dashboard`, `/dashboard/analytics`, and `/dashboard/customize` returned HTTP 200. Three local-origin TTFB samples per route measured `/` 0.23–0.65 ms, `/dashboard` 1.53–3.08 ms, `/dashboard/analytics` 0.96–1.56 ms, and `/dashboard/customize` 0.89–1.38 ms. Compared with the pre-deploy local sample, results overlap on dashboard routes and remain too local/low-latency to establish user-facing gains.

The browser/API behavior change is source-counted: old authenticated startup scheduled four data reads whether or not the sections were opened; the new path schedules zero until pointer or keyboard intent on one of those links, then only that section's loader runs. No browser lab or field Web Vitals collector was available in this environment, so LCP, INP, CLS, and public-network TTFB are not claimed.

## Files changed

- `frontend/components/dashboard/DashboardPrefetch.tsx`
- `frontend/components/dashboard/DashboardShell.tsx`
- `frontend/components/profile/ProfileRenderer.tsx`
- `frontend/components/profile/ProfileSections.tsx`
- `frontend/components/customization/CustomizationWorkspace.tsx`
- `frontend/public/profile-layout.css`
- `Caddyfile`
- `PERFORMANCE-REPORT.md`

## Validation and remaining work

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 94 tests.
- `npm run build` passed and generated all 67 static pages/routes.
- No API contracts, permission checks, database queries, authentication behavior, or public profile features were changed.

A browser trace with representative public profiles is still needed to quantify deferred image bytes; the Next.js build confirms no route JavaScript regression. Collect field Web Vitals (LCP, INP, CLS) before making further frontend tuning decisions. Database/query and media work should be guided by production traces and actual slow-path evidence; no unproven indexes or architecture changes were introduced.
