import "server-only";

const backendBaseUrl = () => {
  const value = process.env.MISA_BACKEND_URL || process.env.MISA_API_BASE_URL;
  if (!value) throw new Error("MISA_BACKEND_URL is not configured.");
  return value.replace(/\/$/, "");
};

export async function backendFetch(request: Request, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  return fetch(`${backendBaseUrl()}${path}`, { ...init, headers, cache: "no-store", redirect: "manual" });
}

export function copyBackendCookie(source: Response, target: Response) {
  // `Set-Cookie` is a multi-value response header. Preserve every cookie
  // separately when the backend is reached through the Next.js proxy.
  const headers = source.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
  for (const cookie of cookies) target.headers.append("set-cookie", cookie);
}

export async function backendError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({})) as { detail?: string; error?: string };
  return payload.detail || payload.error || fallback;
}
