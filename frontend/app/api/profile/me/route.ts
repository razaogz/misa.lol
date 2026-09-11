import { NextResponse } from "next/server";
import { backendError, backendFetch } from "@/lib/server/backend";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET(request: Request) {
  try {
    const upstream = await backendFetch(request, "/api/v1/profile/me");
    if (!upstream.ok) return NextResponse.json({ error: await backendError(upstream, "Unable to load your profile.") }, { status: upstream.status, headers: noStore });
    return NextResponse.json(await upstream.json(), { headers: noStore });
  } catch {
    return NextResponse.json({ error: "The backend is unavailable." }, { status: 503, headers: noStore });
  }
}
