import "server-only";
import { database } from "./postgres";
import type { ProfileConfig } from "@/lib/types";
let cached: { expires: number; flags: Record<string, boolean> } | undefined;
export async function profileFeatureFlags() {
  if (cached && cached.expires > Date.now()) return cached.flags;
  const result = await database().query<{key:string;enabled:boolean}>("SELECT key,enabled FROM feature_flags");
  const flags = Object.fromEntries(result.rows.map(row => [row.key, row.enabled]));
  cached = {expires: Date.now() + 5000, flags};
  return flags;
}
export function disabledProfileChange(next: ProfileConfig, previous: ProfileConfig, flags: Record<string, boolean>): string | null {
  const changed = (a: unknown,b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
  for (const [kind,asset] of Object.entries(next.assets)) {
    if ((flags["customize.assets"] === false || flags[`customize.assets.${kind}`] === false) && changed(asset,(previous.assets as Record<string,unknown>)[kind])) return "Asset customization is disabled.";
  }
  for (const [flag,a,b] of [
    ["customize.widgets",next.widgets,previous.widgets], ["customize.portfolio",next.sections,previous.sections],
    ["customize.layout",next.settings.layout,previous.settings.layout], ["nav.links",next.socials,previous.socials],
    ["customize.effects.username",next.settings.usernameEffect,previous.settings.usernameEffect],
    ["customize.effects",next.settings.backgroundEffect,previous.settings.backgroundEffect],
  ] as const) if (flags[flag] === false && changed(a,b)) return "This customization feature is disabled.";
  if (flags[`feature.usernameEffects.${next.settings.usernameEffect.toLowerCase()}`] === false && next.settings.usernameEffect !== previous.settings.usernameEffect) return "This name effect is disabled.";
  return null;
}
export function projectProfileFeatures(config: ProfileConfig, flags: Record<string,boolean>) {
  const result = structuredClone(config);
  for (const [flag,key] of [["profile.frame","showProfileFrame"],["profile.avatar","showAvatar"],["profile.avatarBorder","showAvatarBorder"],["profile.displayName","showDisplayName"],["profile.socials","showSocials"],["profile.badges","showBadges"],["profile.views","showViews"],["profile.joinDate","showJoinDate"],["integrations.discord","showDiscordStatus"]] as const) if (flags[flag] === false) result.settings[key] = false;
  if (flags["profile.widgets"] === false) result.widgets = [];
  if (flags["profile.audio"] === false) result.assets.audioEnabled = false;
  if (flags[`feature.usernameEffects.${result.settings.usernameEffect.toLowerCase()}`] === false) result.settings.usernameEffect = "None";
  return result;
}
