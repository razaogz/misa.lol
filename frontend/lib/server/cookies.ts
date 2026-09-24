import "server-only";
import type { NextRequest } from "next/server";
export function cookieSecure(request: NextRequest) {
  const host = (request.headers.get("host") || new URL(request.url).host).split(":")[0].toLowerCase();
  if (["localhost", "127.0.0.1"].includes(host)) return false;
  if ((process.env.MISA_ENVIRONMENT || "production").toLowerCase() === "production") return true;
  return new URL(request.url).protocol === "https:" || (process.env.MISA_TRUST_PROXY === "true" && request.headers.get("x-forwarded-proto") === "https");
}
