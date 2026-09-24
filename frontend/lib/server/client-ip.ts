import "server-only";
import { isIP } from "node:net";
export function clientIp(request: Request) {
  if (process.env.MISA_TRUST_PROXY !== "true") return "unknown";
  const value = (request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "").trim();
  return isIP(value) ? value : "unknown";
}
