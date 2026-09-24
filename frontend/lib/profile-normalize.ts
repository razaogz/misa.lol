import type { ProfileConfig } from "./types";
import { cloneMockProfile } from "./mock-data";
import { normalizeProfileSocials } from "./socials";
export function normalizeHexColor(value: unknown, fallback = "#ffffff"): string {
  if (typeof value !== "string") return fallback;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (/^#[0-9a-f]{3}$/i.test(value)) return "#" + value.slice(1).split("").map(c => c + c).join("");
  if (/^#[0-9a-f]{8}$/i.test(value)) return value.slice(0, 7);
  return fallback;
}
export function cssUrl(value: string): string {
  return `url("${value.replace(/["<>\\\n\r\f]/g, c => "\\" + c.charCodeAt(0).toString(16) + " ")}")`;
}
export function profileDefaults(): ProfileConfig {
  const defaults = cloneMockProfile();
  defaults.profile = {
    username: "",
    displayName: "",
    description: "",
    location: "",
    views: 0,
    uid: "",
    joinedAt: "",
  };
  defaults.socials = [];
  defaults.badges = [];
  defaults.widgets = [];
  defaults.sections = [];
  return defaults;
}

export function normalizeDashboardProfile(input: ProfileConfig): ProfileConfig {
  const defaults = profileDefaults();
  const incoming = (input && typeof input === "object" ? input : {}) as Partial<ProfileConfig>;
  const assets = (incoming.assets && typeof incoming.assets === "object" ? incoming.assets : {}) as Partial<ProfileConfig["assets"]>;
  const normalizedAssets = { ...defaults.assets, ...assets } as ProfileConfig["assets"];
  for (const key of ["avatar", "banner", "background", "backgroundVideo", "backgroundEffectVideo", "audio", "audioArtwork", "cursor", "ogImage", "favicon", "customFont", "clickSound"] as const) {
    if (!normalizedAssets[key] || typeof normalizedAssets[key] !== "object") normalizedAssets[key] = defaults.assets[key] || { url: null };
  }
  normalizedAssets.tracks = Array.isArray(assets.tracks) ? assets.tracks.filter(t => t && typeof t === "object").map(t => ({ ...t, audio: t.audio && typeof t.audio === "object" ? t.audio : { url: null }, artwork: t.artwork && typeof t.artwork === "object" ? t.artwork : { url: null } })) : [];
  const settings = { ...defaults.settings, ...(incoming.settings || {}) };
  for (const key of ["accentColor", "usernameColor", "usernameEffectColor", "textColor", "backgroundColor", "iconColor", "borderColor"] as const) {
    settings[key] = normalizeHexColor(settings[key], defaults.settings[key] || "#ffffff");
  }
  return normalizeProfileSocials({
    ...defaults,
    ...incoming,
    profile: { ...defaults.profile, ...(incoming.profile || {}) },
    settings,
    assets: normalizedAssets,
    socials: Array.isArray(incoming.socials) ? incoming.socials.filter(item => item && typeof item === "object") : defaults.socials,
    badges: Array.isArray(incoming.badges) ? incoming.badges.filter(item => item && typeof item === "object") : defaults.badges,
    widgets: Array.isArray(incoming.widgets) ? incoming.widgets.filter(item => item && typeof item === "object") : defaults.widgets,
    sections: Array.isArray(incoming.sections) ? incoming.sections.filter(item => item && typeof item === "object") : defaults.sections,
  } as ProfileConfig);
}
