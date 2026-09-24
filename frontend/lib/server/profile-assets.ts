import "server-only";
import { one } from "./postgres";
import { deleteFromR2 } from "./r2";
export function assetUrls(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) assetUrls(item, found);
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "url" && typeof item === "string") found.add(item);
      else if (item && typeof item === "object") assetUrls(item, found);
    }
  }
  return found;
}
export function ownedAssetKey(url: string, userId: string): string | null {
  try {
    const base = new URL(process.env.R2_PUBLIC_BASE_URL || "");
    const parsed = new URL(url);
    const prefix = base.pathname.replace(/\/$/, "") + "/";
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith(prefix)) return null;
    const key = decodeURIComponent(parsed.pathname.slice(prefix.length));
    return key.startsWith(`profiles/${userId}/`) && !key.split("/").some(s => s === ".." || s === ".") ? key : null;
  } catch { return null; }
}
export async function cleanupProfileAssets(userId: string, previous: unknown, current: unknown) {
  const kept = assetUrls(current);
  for (const url of assetUrls(previous)) {
    if (kept.has(url)) continue;
    const key = ownedAssetKey(url, userId);
    if (!key) continue;
    // Template snapshots and constellation snapshots may still use an old asset.
    const reference = await one<{ used: boolean }>(`SELECT
      EXISTS(SELECT 1 FROM profiles WHERE strpos(config::text,$1)>0)
      OR EXISTS(SELECT 1 FROM profile_templates WHERE strpos(config::text,$1)>0)
      OR EXISTS(SELECT 1 FROM constellation_members WHERE strpos(profile_config::text,$1)>0) AS used`, [url]);
    if (reference?.used === false) await deleteFromR2(key);
  }
}
