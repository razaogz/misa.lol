import type { ProfileConfig, ProfileSection, ProfileWidget } from "./types";

export const CURSOR_EFFECTS = ["None", "Cursor Cat", "Snowflakes", "Ghost Cursor", "Following Dot", "Bubbles"] as const;
export const CLICK_PRESETS = ["None", "Crisp Click", "Pixel Click", "Bass Tick", "Mouse Click", "Custom"] as const;
export const BORDER_TYPES = ["Static", "Dashed", "Shimmer", "Pulse"] as const;
export const PREMIUM_EFFECT_COLOR_KEYS = ["Fireflies", "Snowflakes", "Snow", "Sakura"] as const;
export type PremiumEffectColor = typeof PREMIUM_EFFECT_COLOR_KEYS[number];
export interface PremiumSettings {
  effectColors?: Partial<Record<PremiumEffectColor, string>>;
  version: 1;
  cursorEffect: typeof CURSOR_EFFECTS[number];
  cursorColor: string;
  clickPreset: typeof CLICK_PRESETS[number];
  entrySubtitle: string;
  typewriterTexts: string[];
  hero: "Classic" | "Centered";
  borderType: typeof BORDER_TYPES[number];
  borderOpacity: number;
  borderEnabled: boolean;
  lyricsHeight: number;
}
export const PREMIUM_DEFAULTS: PremiumSettings = { version: 1, cursorEffect: "None", cursorColor: "#ffffff", clickPreset: "None", entrySubtitle: "", typewriterTexts: [], hero: "Classic", borderType: "Static", borderOpacity: 100, borderEnabled: true, lyricsHeight: 560 };

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const own = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const cleanText = (value: unknown, limit: number) => String(value ?? "").replace(/<[^>]*>/g, "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").slice(0, limit);
const integer = (value: unknown, fallback: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, Math.trunc(Number(value)))) : fallback;
const color = (value: unknown, fallback: string) => HEX_COLOR.test(String(value || "")) ? String(value) : HEX_COLOR.test(fallback) ? fallback : "#ffffff";
const choice = <T extends string>(value: unknown, allowed: readonly T[], fallback: T) => allowed.includes(value as T) ? value as T : fallback;

export function premiumSettings(config: ProfileConfig): PremiumSettings {
  return { ...PREMIUM_DEFAULTS, ...config.settings.premium, effectColors: config.settings.premium?.effectColors ? { ...config.settings.premium.effectColors } : undefined };
}

export function mergePremiumSettings(config: ProfileConfig, patch: Partial<PremiumSettings>): ProfileConfig {
  return { ...config, settings: { ...config.settings, premium: { ...premiumSettings(config), ...patch } } };
}

/** Validate every persisted Premium field. Explicit effectColors objects are
 * authoritative so deleting a color survives save/reload; omitted objects keep
 * previously stored colors for older clients. */
export function sanitizePremiumSettings(raw: unknown, previous?: PremiumSettings): PremiumSettings {
  const input = record(raw);
  const base = { ...PREMIUM_DEFAULTS, ...(previous || {}) };
  const effectSource = own(input, "effectColors") && input.effectColors && typeof input.effectColors === "object" && !Array.isArray(input.effectColors)
    ? record(input.effectColors)
    : record(base.effectColors);
  const effectColors: Partial<Record<PremiumEffectColor, string>> = {};
  for (const key of PREMIUM_EFFECT_COLOR_KEYS) {
    if (!own(effectSource, key)) continue;
    const candidate = String(effectSource[key] || "");
    if (HEX_COLOR.test(candidate)) effectColors[key] = candidate;
    else if (base.effectColors?.[key] && HEX_COLOR.test(base.effectColors[key]!)) effectColors[key] = base.effectColors[key];
  }
  const texts = Array.isArray(input.typewriterTexts) ? input.typewriterTexts : base.typewriterTexts;
  return {
    version: 1,
    cursorEffect: choice(input.cursorEffect, CURSOR_EFFECTS, choice(base.cursorEffect, CURSOR_EFFECTS, PREMIUM_DEFAULTS.cursorEffect)),
    cursorColor: color(input.cursorColor, base.cursorColor),
    clickPreset: choice(input.clickPreset, CLICK_PRESETS, choice(base.clickPreset, CLICK_PRESETS, PREMIUM_DEFAULTS.clickPreset)),
    entrySubtitle: own(input, "entrySubtitle") ? cleanText(input.entrySubtitle, 160) : cleanText(base.entrySubtitle, 160),
    typewriterTexts: texts.slice(0, 12).map(value => cleanText(value, 200)),
    hero: choice(input.hero, ["Classic", "Centered"] as const, choice(base.hero, ["Classic", "Centered"] as const, PREMIUM_DEFAULTS.hero)),
    borderType: choice(input.borderType, BORDER_TYPES, choice(base.borderType, BORDER_TYPES, PREMIUM_DEFAULTS.borderType)),
    borderOpacity: integer(input.borderOpacity, integer(base.borderOpacity, PREMIUM_DEFAULTS.borderOpacity, 0, 100), 0, 100),
    borderEnabled: typeof input.borderEnabled === "boolean" ? input.borderEnabled : base.borderEnabled === true,
    lyricsHeight: integer(input.lyricsHeight, integer(base.lyricsHeight, PREMIUM_DEFAULTS.lyricsHeight, 320, 900), 320, 900),
    effectColors: Object.keys(effectColors).length ? effectColors : undefined,
  };
}

export const INTEGRATION_CARD_TYPES = ["presence", "youtube", "spotify", "discord", "telegram", "roblox", "github", "lastfm", "timezone", "weather"] as const;
export type IntegrationCard = { enabled: boolean; type: ProfileWidget["type"] | "presence"; value: string };
export function sanitizeIntegrationCard(raw: unknown): IntegrationCard | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const value = record(raw);
  const type = choice(value.type, INTEGRATION_CARD_TYPES, "presence");
  if (!INTEGRATION_CARD_TYPES.includes(value.type as typeof INTEGRATION_CARD_TYPES[number])) return undefined;
  return { enabled: value.enabled === true, type, value: type === "presence" ? "" : cleanText(value.value, 500) };
}
export function sectionWidgets(sections: ProfileSection[] = []): ProfileWidget[] {
  return sections.filter(s => s.enabled).flatMap(s => (["leftCard", "rightCard"] as const).flatMap(side => {
    const card = s[side];
    return card?.enabled && card.type !== "presence" ? [{ id: `${s.id.slice(0, 38)}-${side === "leftCard" ? "l" : "r"}`, type: card.type, enabled: true, value: card.value }] : [];
  }));
}
export function profileWidgets(config: ProfileConfig) {
  return [...config.widgets.filter(w => w.enabled), ...sectionWidgets(config.sections)];
}
