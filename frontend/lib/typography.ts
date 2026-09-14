import type { PageEnter, ProfileFont, UsernameEffect } from "./types";

export const PROFILE_FONTS: ProfileFont[] = ["Inter", "font-2", "font-3", "font-4", "font-5", "font-6", "font-7", "font-8", "font-9", "font-10", "font-11"];
export const USERNAME_EFFECTS: UsernameEffect[] = ["None", "Glow", "Gradient", "Shimmer", "Typewriter", "Rainbow", "Fuzzy", "Shuffle", "Sparkle", "Glitch", "Pulse", "Outline", "Neon", "Wave", "Shadow"];
export const PAGE_ENTERS: PageEnter[] = ["None", "Fade", "Unfold", "Pop"];
export const FONT_ACCEPT = ".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf";

export function fontStack(_font?: ProfileFont) {
  return '"Inter", ui-sans-serif, system-ui, sans-serif';
}

export function typeSize(value?: number) {
  const size = Number(value);
  return Number.isFinite(size) ? Math.max(12, Math.min(22, Math.round(size))) : 16;
}

export function nameTracking(value?: number) {
  const size = Number(value);
  return Number.isFinite(size) ? Math.max(-2, Math.min(8, Math.round(size))) : 0;
}

export function bioLines(description: string) {
  return description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 8);
}

export function typeMs(value?: number, fallback = 55) {
  const ms = Number(value);
  return Number.isFinite(ms) ? Math.max(20, Math.min(160, Math.round(ms))) : fallback;
}
