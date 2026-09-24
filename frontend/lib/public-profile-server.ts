import { cache } from "react";
import type { ProfileConfig } from "./types";
import { publicProfile } from "./server/profiles";

// Shared between the page and metadata in one request. Never cache user drafts.
export const publicProfileOnServer = cache(async (username: string): Promise<ProfileConfig | null> => {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{2,23}$/.test(username)) return null;
  try {
    return await publicProfile(username) as ProfileConfig | null;
  } catch {
    console.error("Public profile storage unavailable");
    throw new Error("Profile temporarily unavailable");
  }
});
