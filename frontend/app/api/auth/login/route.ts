import { NextResponse } from "next/server";
import { backendError, backendFetch, copyBackendCookie } from "@/lib/server/backend";
import { mapBackendUser } from "@/lib/auth-user";

export async function POST(request: Request) {
  const input = await request.json().catch(() => ({})) as { identifier?: string; password?: string; turnstileToken?: string; remember?: boolean };
  const email = input.identifier?.trim().toLowerCase() || "";
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Use the email address for this account." }, { status: 400 });
  try {
    const upstream = await backendFetch(request, "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: input.password || "", remember: input.remember !== false }) });
    if (!upstream.ok) return NextResponse.json({ error: await backendError(upstream, "Unable to sign in.") }, { status: upstream.status });
    const result = await upstream.json() as { ok?: boolean; redirect?: string; captcha_required?: boolean; mfa_required?: boolean; challenge?: string };
    if (result.captcha_required && result.challenge) return NextResponse.json({ captcha_required: true, challenge: result.challenge });
    if (result.mfa_required && result.challenge) return NextResponse.json({ mfa_required: true, challenge: result.challenge });
    const sessionCookie = upstream.headers.get("set-cookie");
    const me = await backendFetch({ headers: new Headers({ cookie: sessionCookie || "" }) } as Request, "/api/v1/me");
    if (!me.ok) return NextResponse.json({ error: "Signed in, but the account session could not be loaded." }, { status: 502 });
    const response = NextResponse.json({ user: mapBackendUser(await me.json()), redirect: result.redirect || "/dashboard" });
    copyBackendCookie(upstream, response);
    return response;
  } catch {
    return NextResponse.json({ error: "The backend is unavailable. Configure MISA_BACKEND_URL and try again." }, { status: 503 });
  }
}
