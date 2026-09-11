export function GET() {
  const siteKey = process.env.MISA_TURNSTILE_SITE_KEY || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  return new Response(`window.MISA_CONFIG = ${JSON.stringify({ turnstileSiteKey: siteKey })};window.MISA_TURNSTILE_SITE_KEY = window.MISA_CONFIG.turnstileSiteKey;`, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } });
}
