import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/server/http";
import { nativeCoreEnabled } from "@/lib/server/rollout";
import { currentUser } from "@/lib/server/sessions";
import { hasPremium, persistProfile, sanitizeProfilePayload, savedProfile } from "@/lib/server/profile-persistence";
import { protectWrite } from "@/lib/server/premium";
import { cleanupProfileAssets } from "@/lib/server/profile-assets";
import { profileDefaults } from "@/lib/profile-normalize";
import { disabledProfileChange, profileFeatureFlags } from "@/lib/server/profile-features";
import type { ProfileConfig } from "@/lib/types";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!nativeCoreEnabled()) return apiError("Not found.",404);
  try {
    const user = await currentUser(request);
    if (!user) return apiError("Not authenticated.",401);
    return NextResponse.json({ profile: await savedProfile(user.id) },{headers:{"Cache-Control":"no-store"}});
  } catch { return apiError("Profile storage is temporarily unavailable.",503); }
}
export async function PUT(request: NextRequest) {
  if (!nativeCoreEnabled()) return apiError("Not found.",404);
  try {
    const user = await currentUser(request);
    if (!user) return apiError("Not authenticated.",401);
    if (Number(request.headers.get("content-length")) > 1_000_000) return apiError("Profile configuration is too large. Upload media separately.",413);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1_000_000) return apiError("Profile configuration is too large. Upload media separately.",413);
    let payload;
    try { payload = JSON.parse(raw); } catch { return apiError("Invalid JSON.",400); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return apiError("Invalid profile.",400);
    const existing = await savedProfile(user.id);
    let config = sanitizeProfilePayload(payload,user,existing);
    if (!config.profile.displayName) return apiError("Display name cannot be empty.");
    const disabled = disabledProfileChange(config, existing || profileDefaults(), await profileFeatureFlags());
    if (disabled) return apiError(disabled,403);
    const entitled = await hasPremium(user.id);
    try { config = protectWrite(config as unknown as Record<string, unknown>,existing as unknown as Record<string, unknown> | null,entitled) as unknown as ProfileConfig; }
    catch { return apiError("An active Premium entitlement is required to change premium settings.",403); }
    const saved = await persistProfile(user.id,config);
    // Deletion is restricted to the owner's objects and happens only after persistence.
    await cleanupProfileAssets(user.id,existing,saved).catch(() => console.error("Profile asset cleanup deferred"));
    return NextResponse.json({profile:saved},{headers:{"Cache-Control":"no-store"}});
  } catch { return apiError("Profile storage is temporarily unavailable.",503); }
}
