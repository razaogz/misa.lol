import "server-only";

import { safeAssetUrl, ASSET_KIND_TYPES } from "./media";
import { safeMediaUrl } from "./media";
import { normalizeDashboardProfile, normalizeHexColor } from "@/lib/profile-normalize";
import { cloneMockProfile } from "@/lib/mock-data";
import { sanitizeIntegrationCard, sanitizePremiumSettings } from "@/lib/premium";
import { normalizeLayouts, type ElementLayouts } from "@/lib/element-layout";
import type { ProfileConfig } from "@/lib/types";
import { database, one } from "./postgres";
import type { User } from "./users";

const urlKinds = new Set(["avatar", "banner", "background", "backgroundVideo", "backgroundEffectVideo", "audio", "audioArtwork", "cursor", "ogImage", "favicon", "customFont", "clickSound", "entryIcon"]);
const text = (value: unknown, limit: number) => String(value || "").replace(/<[^>]*>/g, "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").slice(0, limit);
const number = (value: unknown, fallback: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, Math.trunc(Number(value)))) : fallback;
const bool = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;
const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function safeUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw || raw === "misa:keep" || raw === "misa:remove") return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? raw : "";
  } catch { return ""; }
}

function asset(raw: unknown, previous: unknown) {
  const incoming = record(raw); const old = record(previous); const url = incoming.url === "misa:keep" || incoming.url === "misa:remove" ? incoming.url : safeMediaUrl(incoming.url);
  const finalUrl = url === "misa:keep" ? safeMediaUrl(old.url) : url === "misa:remove" ? null : url || null;
  return { url: finalUrl, name: text(incoming.name, 80), type: text(incoming.type, 40) };
}


function lyricsRecording(raw: unknown) {
  const value = record(raw);
  const id = Number(value.id);
  const duration = Number(value.duration);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(duration) || duration <= 0 || duration > 86_400) return null;
  return {
    id,
    title: text(value.title, 240),
    artist: text(value.artist, 240),
    album: text(value.album, 240),
    duration: Math.round(duration * 1000) / 1000,
  };
}

export async function hasPremium(userId: string) {
  const row = await one<{ active: boolean }>("SELECT EXISTS(SELECT 1 FROM premium_entitlements WHERE user_id=$1 AND active=TRUE AND (expires_at IS NULL OR expires_at>NOW())) AS active", [userId]);
  return row?.active === true;
}

export function sanitizeProfilePayload(raw: unknown, user: User, existing: ProfileConfig | null, readOnly = false): ProfileConfig {
  const input = record(raw); const defaults = cloneMockProfile(); const incomingProfile = record(input.profile); const incomingSettings = record(input.settings); const incomingAssets = record(input.assets); const previous = normalizeDashboardProfile(existing || defaults);
  const config: ProfileConfig = structuredClone(defaults);
  config.profile = { username: user.username || "", uid: user.id, displayName: text(incomingProfile.displayName, 128).trim() || user.display_name || user.username || "", description: text(incomingProfile.description, 4000), location: text(incomingProfile.location, 160), views: 0, joinedAt: user.created_at || previous.profile.joinedAt };
  const settingKeys = ["accentColor","usernameColor","usernameEffectColor","textColor","backgroundColor","iconColor","borderColor"] as const;
  config.settings = { ...previous.settings, ...config.settings };
  for (const key of settingKeys) { const candidate = String(incomingSettings[key] || ""); config.settings[key] = normalizeHexColor(candidate, normalizeHexColor(previous.settings[key], config.settings[key] || "#ffffff")); }
  for (const [key, fallback, min, max] of [["profileOpacity",10,0,80],["backgroundOpacity",88,20,100],["profileBlur",24,0,40],["profileRadius",24,0,80],["profileFrameOpacity",100,0,100],["profileFrameScale",100,50,150],["profileFrameWidth",430,260,800],["profileFrameHeight",0,0,1000],["profileFrameX",0,-45,45],["profileFrameY",0,-45,45],["fontSize",16,12,22],["letterSpacing",0,-2,8],["borderWidth",1,0,8],["bioTypeMs",55,20,160],["bioDeleteMs",35,20,160],["bioPauseMs",1200,400,4000]] as const) (config.settings as Record<string, unknown>)[key] = number(incomingSettings[key], fallback, min, max);
  for (const key of ["profileGradient","showViews","showBadges","showSocials","showJoinDate","showDiscordStatus","showUsername","showProfileFrame","showAvatar","showAvatarBorder","showDisplayName","bioTypewriter","tabTitleAnimate","clickSound","cardTilt","entryScreen","usernameGlow","socialGlow","badgeGlow","monochromeIcons","widgetColorSwap","ogOverlayAvatar","ogOverlayName","ogOverlayAddress"] as const) (config.settings as Record<string, unknown>)[key] = bool(incomingSettings[key], Boolean((previous.settings as Record<string, unknown>)[key]));
  for (const [key, allowed] of [["layout",["Default","Modern","Simplistic","Sleek","Portfolio"]],["avatarShape",["circle","rounded","square"]],["bannerShape",["rounded","square","pill"]],["buttonStyle",["glass","solid","outline"]],["profileFont",["Inter","font-2","font-3","font-4","font-5","font-6","font-7","font-8","font-9","font-10","font-11"]],["profileFontScope",["all","name"]],["pageEnter",["None","Fade","Unfold","Pop"]],["backgroundEffect",["None","Snowflakes","Snow","Sakura","Rain","Fireflies"]],["usernameEffect",["None","Glow","Gradient","Shimmer","Rainbow","Fuzzy","Shuffle","Sparkle","Glitch","Pulse","Wave","Shadow", "Blue Sparkles", "Green Sparkles", "Pink Sparkles", "Red Sparkles", "White Sparkles", "Yellow Sparkles", "Wish Lanterns", "Crystal Rain", "Tiny Crowns", "Gold Sparkles", "Pink Hearts"]],["socialAlign",["left","center","right"]],["cardAlign",["left","center","right"]]] as const) { const value = String(incomingSettings[key] || ""); (config.settings as Record<string, unknown>)[key] = (allowed as readonly string[]).includes(value) ? value : (previous.settings as Record<string, unknown>)[key]; }
  if (incomingSettings.premium || previous.settings.premium) config.settings.premium = sanitizePremiumSettings(incomingSettings.premium, previous.settings.premium);
  const submittedLayouts = Object.prototype.hasOwnProperty.call(incomingSettings, "elementLayouts")
    ? incomingSettings.elementLayouts
    : previous.settings.elementLayouts;
  config.settings.elementLayouts = normalizeLayouts(record(submittedLayouts) as unknown as ElementLayouts);
  config.settings.entryText = text(incomingSettings.entryText, 160) || "click to enter..."; config.settings.ogTitle = text(incomingSettings.ogTitle, 70); config.settings.ogDescription = text(incomingSettings.ogDescription, 200);
  const previousTracks = new Map(previous.assets.tracks.map((track) => [track.id, track]));
  config.assets = {
    ...previous.assets,
    audioTitle: text(incomingAssets.audioTitle, 80),
    audioEnabled: bool(incomingAssets.audioEnabled, true),
    audioSource: ["video", "tracks", "standalone"].includes(String(incomingAssets.audioSource)) ? incomingAssets.audioSource as "video" | "tracks" | "standalone" : previous.assets.audioSource,
    volume: number(incomingAssets.volume, 65, 0, 100),
    tracks: Array.isArray(incomingAssets.tracks)
      ? incomingAssets.tracks
        .slice(0, 8)
        .map((item, index) => {
          const track = record(item);
          const id = /^[\w-]{2,40}$/.test(String(track.id || "")) ? String(track.id) : `track-${index + 1}`;
          const stored = previousTracks.get(id);
          return {
            id,
            title: text(track.title, 80) || "Track",
            audio: asset(record(track.audio), stored?.audio),
            artwork: asset(record(track.artwork), stored?.artwork),
            recording: lyricsRecording(track.recording),
          };
        })
        .filter((track) => Boolean(track.audio.url))
      : [],
  };
  for (const key of urlKinds) (config.assets as Record<string, unknown>)[key] = asset(incomingAssets[key], (previous.assets as Record<string, unknown>)[key]);
  config.socials = Array.isArray(input.socials) ? input.socials.slice(0, 40).map((item, index) => { const social = record(item); return { id: text(social.id,80) || `social-${index}`, platform: (text(social.platform,32) || "Custom URL") as ProfileConfig["socials"][number]["platform"], label: text(social.label,64), value: text(social.value,500), enabled: Boolean(social.enabled), displayMode: social.displayMode === "text" ? "text" : "link", clicks: 0, iconColor: social.iconColor ? normalizeHexColor(social.iconColor) : null, iconGlow: bool(social.iconGlow, false), customIcon: asset(social.customIcon, previous.socials.find(item => item.id === social.id)?.customIcon), action: social.action === "copy" ? "copy" : "open" }; }) : [];
  config.widgets = Array.isArray(input.widgets) ? input.widgets.slice(0, 8).map((item,index) => { const widget=record(item); return { id:text(widget.id,40)||`widget-${index}`, type:text(widget.type,24) as ProfileConfig["widgets"][number]["type"], enabled:Boolean(widget.enabled), value:text(widget.value,500) }; }).filter((widget) => ["youtube","spotify","discord","telegram","roblox","github","lastfm","timezone","weather"].includes(widget.type)) : [];
  const previousSections = new Map(previous.sections.map((section) => [section.id, section]));
  config.sections = Array.isArray(input.sections) ? input.sections.slice(0, 12).map((item, index) => {
    const section = record(item);
    const kind = text(section.type, 24);
    const id = text(section.id, 40) || `${kind}-${index}`;
    const stored = previousSections.get(id);
    return {
      id,
      type: kind as ProfileConfig["sections"][number]["type"],
      enabled: Boolean(section.enabled),
      title: text(section.title, 80),
      body: text(section.body, kind === "lyrics" ? 8000 : 4000),
      href: safeUrl(section.href),
      tags: Array.isArray(section.tags) ? section.tags.slice(0, 16).map((tag) => text(tag, 24)).filter(Boolean) : [],
      cover: asset(section.cover, stored?.cover),
      subtitle: text(section.subtitle, 160),
      leftCard: sanitizeIntegrationCard(section.leftCard),
      rightCard: sanitizeIntegrationCard(section.rightCard),
    };
  }).filter((section) => ["about", "project", "skills", "text", "lyrics", "integration"].includes(section.type)) : [];
  // Legacy data URLs are readable during offline R2 migration but cannot be written anew.
  if (readOnly) {
    for (const key of urlKinds) {
      const rawAsset = record(incomingAssets[key]);
      (config.assets as Record<string, unknown>)[key] = { ...record((config.assets as Record<string, unknown>)[key]), url: safeAssetUrl(rawAsset.url, ASSET_KIND_TYPES[key]) };
    }
  }
  config.badges = []; return config;
}

export async function savedProfile(userId: string) { const row = await one<{ config: ProfileConfig }>("SELECT config FROM profiles WHERE user_id=$1", [userId]); if (!row?.config) return null;
  const config = normalizeDashboardProfile((record(row.config).config || row.config) as ProfileConfig);
  const [grants, stats] = await Promise.all([
    database().query<Record<string, unknown>>("SELECT b.id,b.name,b.description,b.color,a.featured AS enabled FROM badge_awards a JOIN badges b ON b.id=a.badge_id WHERE a.user_id=$1 AND a.revoked_at IS NULL AND (a.expires_at IS NULL OR a.expires_at>NOW()) AND b.active=TRUE ORDER BY a.display_order,b.display_order", [userId]),
    one<{ views: number }>("SELECT views FROM profile_stats WHERE user_id=$1", [userId]).catch(() => null),
  ]);
  config.badges = grants.rows.map(b => ({ id: String(b.id), name: String(b.name), description: String(b.description || ""), color: normalizeHexColor(b.color), owned: true, enabled: Boolean(b.enabled), monochrome: false, icon: `/api/v1/badges/${encodeURIComponent(String(b.id))}/icon` }));
  config.profile.views = Number(stats?.views || 0);
  delete config.rank;
  return config; }
export async function persistProfile(userId: string, config: ProfileConfig) { const row = await one<{ config: ProfileConfig }>("INSERT INTO profiles (user_id, config, updated_at) VALUES ($1,$2::jsonb,NOW()) ON CONFLICT (user_id) DO UPDATE SET config=EXCLUDED.config, updated_at=NOW() RETURNING config", [userId, JSON.stringify(config)]); if (!row) throw new Error("Profile save failed."); await database().query("UPDATE users SET display_name=$2, updated_at=NOW() WHERE id=$1", [userId, config.profile.displayName]); return row.config; }
