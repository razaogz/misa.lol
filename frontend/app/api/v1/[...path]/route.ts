import { NextResponse } from "next/server";
import { backendFetch, copyBackendCookie } from "@/lib/server/backend";

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: Request, context: Context) {
  const { path } = await context.params;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  try {
    const upstream = await backendFetch(request, `/api/v1/${path.join("/")}${new URL(request.url).search}`, {
      method: request.method,
      headers: { "content-type": request.headers.get("content-type") || "application/json" },
      body,
    });
    const headers = new Headers();
    for (const name of ["content-type", "location", "cache-control", "www-authenticate"] as const) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    const response = new NextResponse(upstream.body, { status: upstream.status, headers });
    copyBackendCookie(upstream, response);
    return response;
  } catch {
    return NextResponse.json({ error: "The backend is unavailable. Configure MISA_BACKEND_URL and try again." }, { status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
