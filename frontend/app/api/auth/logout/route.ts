import { NextResponse } from "next/server";
import { backendFetch, copyBackendCookie } from "@/lib/server/backend";

export async function POST(request: Request) {
  try {
    const upstream = await backendFetch(request, "/api/v1/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const response = NextResponse.json(await upstream.json().catch(() => ({ ok: upstream.ok })), { status: upstream.status, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
    copyBackendCookie(upstream, response);
    return response;
  } catch {
    return NextResponse.json({ error: "The backend is unavailable." }, { status: 503 });
  }
}
