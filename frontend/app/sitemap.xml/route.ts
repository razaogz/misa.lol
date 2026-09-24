export const dynamic = "force-static";
export function GET() {
  const origin = (process.env.MISA_PUBLIC_BASE_URL || "https://misa.lol").replace(/\/$/, "");
  const escape = (value: string) => value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
  // Only public marketing URLs; never enumerate private or suspended accounts.
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(origin)}/</loc></url></urlset>`, { headers: { "Content-Type":"application/xml; charset=utf-8", "Cache-Control":"public, max-age=3600" } });
}
