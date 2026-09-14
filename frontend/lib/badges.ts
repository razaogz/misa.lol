import type { ProfileBadge, ProfileConfig } from "./types";

export const BADGE_CATALOG: Array<Pick<ProfileBadge, "id" | "name" | "description" | "color">> = [
  { id: "verified", name: "Verified", description: "Verified creator", color: "#8f8dff" },
  { id: "premium", name: "Premium", description: "Premium member", color: "#d9a4ff" },
  { id: "staff", name: "Staff", description: "Misa.lol staff", color: "#ff9fcf" },
  { id: "helper", name: "Helper", description: "Community helper", color: "#76d9c8" },
  { id: "donor", name: "Donor", description: "Generous supporter", color: "#ffcb71" },
  { id: "gifter", name: "Gifter", description: "Community gifter", color: "#ff8f9d" },
  { id: "og", name: "OG", description: "Original member", color: "#98adff" },
  { id: "server-booster", name: "Server Booster", description: "Server booster", color: "#f69bd7" },
  { id: "bug-hunter", name: "Bug Hunter", description: "Bug hunter", color: "#bbd968" },
  { id: "winner", name: "Winner", description: "Event winner", color: "#ffcf76" },
  { id: "second-place", name: "Second Place", description: "Second place", color: "#bbc6d8" },
  { id: "third-place", name: "Third Place", description: "Third place", color: "#c69470" },
];

export function mergeBadgeCatalog(badges: ProfileBadge[]): ProfileBadge[] {
  const byId = new Map((badges || []).map((badge) => [badge.id, badge]));
  const owned = (badges || []).filter((badge) => badge.owned).map((badge) => ({ ...badge, monochrome: Boolean(badge.monochrome) }));
  const seen = new Set(owned.map((badge) => badge.id));
  const locked: ProfileBadge[] = [];
  for (const item of BADGE_CATALOG) {
    if (seen.has(item.id)) continue;
    const current = byId.get(item.id);
    locked.push({
      id: item.id,
      name: current?.name || item.name,
      description: current?.description || item.description,
      color: current?.color || item.color,
      owned: false,
      enabled: false,
      monochrome: false,
      icon: current?.icon || "",
    });
    seen.add(item.id);
  }
  for (const badge of badges || []) {
    if (seen.has(badge.id)) continue;
    locked.push({ ...badge, owned: false, enabled: false, monochrome: Boolean(badge.monochrome) });
    seen.add(badge.id);
  }
  return [...owned, ...locked];
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
  return {
    color,
    backgroundColor: `${color}22`,
    borderColor: `${color}66`,
    boxShadow: settings.badgeGlow ? `0 0 18px ${color}4d` : undefined,
  };
}
