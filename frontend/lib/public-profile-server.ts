import { cache } from "react";
import type { ProfileConfig } from "./types";

// Shared between the page and metadata in one request. Never cache user drafts.
export const publicProfileOnServer = cache(async (username: string): Promise<ProfileConfig | null> => {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{2,63}$/.test(username)) return null;
  const origin = process.env.API_PROXY_TARGET || "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${origin}/api/v1/profile?username=${encodeURIComponent(username)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const result = await response.json() as { profile?: ProfileConfig };
    return result.profile || null;
  } catch { return null; }
});
