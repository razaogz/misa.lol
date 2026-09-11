import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server/backend";
import { mapBackendUser } from "@/lib/auth-user";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store, no-cache, must-revalidate" };
  try {
    const upstream = await backendFetch(request, "/api/v1/me");
    if (upstream.status === 401 || upstream.status === 403) return NextResponse.json({ user: null }, { headers });
    if (!upstream.ok) return NextResponse.json({ error: "Unable to load the account session." }, { status: upstream.status, headers });
    return NextResponse.json({ user: mapBackendUser(await upstream.json()) }, { headers });
  } catch {
    return NextResponse.json({ error: "The backend is unavailable." }, { status: 503, headers });
  }
}
