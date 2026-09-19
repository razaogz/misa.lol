import type { ProfileBadge, ProfileConfig } from "./types";

export type AchievementProgress = { current: number; target: number; label: string; percent: number };
export type AchievementBadge = ProfileBadge & {
  slug: string;
  rarity: string;
  category_slug?: string | null;
  category_name?: string | null;
  progress?: AchievementProgress | null;
  source?: "AUTOMATIC" | "MANUAL" | "PURCHASE" | null;
  earned_at?: string | null;
  featured?: boolean;
  purchasable?: boolean;
  price_minor?: number | null;
  currency?: string;
  asset_url?: string;
  preview_url?: string;
};
export type AchievementRank = {
  id: string;
  slug: string;
  name: string;
  description: string;
  level: number;
  color: string;
  owned: boolean;
  progress?: AchievementProgress | null;
  source?: "AUTOMATIC" | "MANUAL" | "PURCHASE" | null;
  earned_at?: string | null;
  badges?: Array<{ id: string; name: string; previewUrl?: string; assetUrl?: string }>;
};
export type AchievementCollection = {
  categories: Array<{ id: string; slug: string; name: string; description: string }>;
  badges: AchievementBadge[];
  ranks: AchievementRank[];
  currentRank: AchievementRank | null;
  featuredLimit: number;
};

export function mergeBadgeCatalog(badges: ProfileBadge[]): ProfileBadge[] {
  return (badges || []).map((badge) => ({ ...badge, monochrome: Boolean(badge.monochrome) }));
}

export function moveOwnedBadge(badges: ProfileBadge[], ownedIndex: number, direction: -1 | 1): ProfileBadge[] {
  const owned = badges.filter((badge) => badge.owned);
  const locked = badges.filter((badge) => !badge.owned);
  const next = ownedIndex + direction;
  if (next < 0 || next >= owned.length) return badges;
  const copy = [...owned];
  [copy[ownedIndex], copy[next]] = [copy[next], copy[ownedIndex]];
  return [...copy, ...locked];
}

export function hasVerifiedBadge(badges: ProfileBadge[] | undefined) {
  return (badges || []).some((badge) => badge.id === "verified" && badge.owned);
}

export function badgePaint(badge: ProfileBadge, settings: ProfileConfig["settings"]) {
  const color = badge.monochrome ? settings.iconColor : badge.color;
  return { color, backgroundColor: `${color}22`, borderColor: `${color}66`, boxShadow: settings.badgeGlow ? `0 0 18px ${color}4d` : undefined };
}