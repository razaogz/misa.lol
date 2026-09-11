import { NextResponse } from "next/server";
import { backendError, backendFetch } from "@/lib/server/backend";

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username")?.trim().toLowerCase();
  if (!username) return NextResponse.json({ error: "A username is required." }, { status: 400 });
  try {
    const upstream = await backendFetch(request, `/api/v1/profile?username=${encodeURIComponent(username)}`);
    if (!upstream.ok) return NextResponse.json({ error: await backendError(upstream, "Profile not found.") }, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(await upstream.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The backend is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function PUT(request: Request) {
  try {
    const upstream = await backendFetch(request, "/api/v1/profile/me", { method: "PUT", headers: { "content-type": "application/json" }, body: await request.text() });
    if (!upstream.ok) return NextResponse.json({ error: await backendError(upstream, "Profile save failed.") }, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(await upstream.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The backend is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
