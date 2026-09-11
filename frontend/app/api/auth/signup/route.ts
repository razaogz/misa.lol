import { NextResponse } from "next/server";
import { backendError, backendFetch, copyBackendCookie } from "@/lib/server/backend";
import { mapBackendUser } from "@/lib/auth-user";

export async function POST(request: Request) {
  const input = await request.json().catch(() => ({})) as { username?: string; displayName?: string; email?: string; password?: string; confirmPassword?: string; turnstileToken?: string };
  const email = input.email?.trim().toLowerCase() || "";
  const username = input.username?.trim().toLowerCase() || "";
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return NextResponse.json({ error: "Usernames must be 3–24 characters using lowercase letters, numbers, or underscores." }, { status: 400 });
  try {
    const upstream = await backendFetch(request, "/api/v1/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: input.password || "", confirm_password: input.confirmPassword || "", tos: true, turnstile_token: input.turnstileToken || "" }) });
    if (!upstream.ok) return NextResponse.json({ error: await backendError(upstream, "Unable to create the account.") }, { status: upstream.status });
    const sessionCookie = upstream.headers.get("set-cookie") || "";
    const claim = await backendFetch({ headers: new Headers({ cookie: sessionCookie }) } as Request, "/api/v1/me/username", { method: "PATCH", headers: { "content-type": "application/json", cookie: sessionCookie }, body: JSON.stringify({ username }) });
    if (!claim.ok) return NextResponse.json({ error: await backendError(claim, "The account was created, but the username could not be claimed.") }, { status: claim.status });
    const claimedUser = await claim.json() as Record<string, unknown>;
    let finalUser = claimedUser;
    if (input.displayName?.trim()) {
      const updated = await backendFetch({ headers: new Headers({ cookie: sessionCookie }) } as Request, "/api/v1/me", { method: "PATCH", headers: { "content-type": "application/json", cookie: sessionCookie }, body: JSON.stringify({ display_name: input.displayName.trim() }) });
      if (updated.ok) finalUser = await updated.json() as Record<string, unknown>;
    }
    const response = NextResponse.json({ user: mapBackendUser(finalUser), redirect: "/dashboard" });
    copyBackendCookie(upstream, response);
    return response;
  } catch {
    return NextResponse.json({ error: "The backend is unavailable. Configure MISA_BACKEND_URL and try again." }, { status: 503 });
  }
}
