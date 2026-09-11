import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server/backend";

export async function GET(request: Request) {
  try {
    const upstream = await backendFetch(request, "/api/v1/auth/providers");
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "The backend is unavailable." }, { status: 503 });
  }
}
