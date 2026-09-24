import { uploadLimits as limits, uploadMime, validUploadBytes } from "@/lib/server/upload-validation";
import { profileFeatureFlags } from "@/lib/server/profile-features";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/server/http";
import { nativeCoreEnabled } from "@/lib/server/rollout";
import { one } from "@/lib/server/postgres";
import { uploadToR2 } from "@/lib/server/r2";
import { currentUser } from "@/lib/server/sessions";

export const runtime = "nodejs";

const premiumKinds = new Set(["entryIcon", "customFont", "clickSound", "ogImage", "favicon"]);
function nameFor(value: string) {
  const name = value.split(/[\\/]/).pop()?.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "") || "upload";
  return name.slice(0, 100);
}

export async function POST(request: NextRequest) {
  if (!nativeCoreEnabled()) return apiError("Not found.", 404);
  try {
    const user = await currentUser(request);
    if (!user) return apiError("Not authenticated.", 401);
    if (Number(request.headers.get("content-length")) > 111_000_000) return apiError("That file is too large.", 413);
    let form: FormData;
    try { form = await request.formData(); } catch { return apiError("Invalid upload body.", 400); }
    const kind = String(form.get("kind") || "");
    const premium = form.get("premium") === "true" || premiumKinds.has(kind);
    const file = form.get("file");
    if (!limits[kind] || !(file instanceof File)) return apiError("Unsupported asset type.");
    const flags = await profileFeatureFlags();
    if (flags["customize.assets"] === false || flags[`customize.assets.${kind}`] === false) return apiError("This upload feature is disabled.",403);
    if (premium) {
      const entitlement = await one<{ active: boolean }>("SELECT EXISTS(SELECT 1 FROM premium_entitlements WHERE user_id = $1 AND active = TRUE AND (expires_at IS NULL OR expires_at > NOW())) AS active", [user.id]);
      if (!entitlement?.active) return apiError("Premium is required for this upload.", 403);
    }
    const name = nameFor(file.name);
    const contentType = uploadMime(kind, name, file.type);
    if (!contentType) return apiError("The file extension and MIME type must match an allowed asset type.", 400);
    if (file.size > limits[kind]) return apiError("That file is too large.", 413);
    const body = new Uint8Array(await file.arrayBuffer());
    if (!validUploadBytes(contentType, body)) return apiError("The file is not a valid upload.");
    const key = `profiles/${user.id}/${kind}/${randomUUID().replaceAll("-", "")}-${name}`;
    const url = await uploadToR2(key, body, contentType);
    return NextResponse.json({ asset: { url, name, type: contentType, key } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return apiError("R2 object storage is temporarily unavailable.", 502);
  }
}
