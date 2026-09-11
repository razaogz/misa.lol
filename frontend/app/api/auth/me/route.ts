import { NextResponse } from "next/server";
import { backendError, backendFetch } from "@/lib/server/backend";
import { mapBackendUser } from "@/lib/auth-user";

export async function PATCH(request: Request) {
  const input = await request.json().catch(() => ({})) as { displayName?: string };
  try {
    const upstream = await backendFetch(request, "/api/v1/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ display_name: input.displayName || "" }) });
    if (!upstream.ok) return NextResponse.json({ error: await backendError(upstream, "Could not update the account.") }, { status: upstream.status });
    return NextResponse.json({ user: mapBackendUser(await upstream.json()) });
  } catch {
    return NextResponse.json({ error: "The backend is unavailable." }, { status: 503 });
  }
}
