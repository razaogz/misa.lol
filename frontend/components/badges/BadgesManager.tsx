"use client";

import { BadgeCheck, Crown, Gem, Lock, Sparkles, Trophy, UserRound } from "lucide-react";
import Image from "next/image";
import { useProfile } from "@/lib/profile-store";
import type { ProfileBadge } from "@/lib/types";
import { Button, PageHeader, SectionTitle, Toggle } from "@/components/ui";
import { TranslatedTree } from "@/lib/i18n";

const iconFor = (name: string) => name === "Premium" ? Crown : ["Winner", "Second Place", "Third Place"].includes(name) ? Trophy : name === "Donor" || name === "Gifter" ? Gem : name === "OG" ? Sparkles : BadgeCheck;

export function BadgesManager() {
  const { config, updateConfig, saveProfile, saveState, saveError } = useProfile();
  const owned = config.badges.filter((badge) => badge.owned);
  const locked = config.badges.filter((badge) => !badge.owned);
  const toggle = (id: string, enabled: boolean) => { const next = { ...config, badges: config.badges.map((badge) => badge.id === id ? { ...badge, enabled } : badge) }; updateConfig(() => next); void saveProfile(next); };
  return <TranslatedTree><main className="mx-auto min-h-screen max-w-[1200px] px-5 py-8 sm:px-8 sm:py-11 xl:px-12"><PageHeader eyebrow="Identity" title="Badges" description="Badges awarded by the misa team are stored on your account." action={<Button variant="subtle"><BadgeCheck size={15} />{owned.length} earned</Button>} />{saveState === "saved" && <p className="mb-5 text-xs text-emerald-400">Badge display settings saved.</p>}{saveError && <p className="mb-5 text-xs text-red-300">{saveError}</p>}<section><SectionTitle icon={Sparkles} title="Your badges" description="Choose which badges appear on your public profile." />{owned.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{owned.map((badge) => <BadgeCard key={badge.id} badge={badge} onToggle={toggle} />)}</div> : <EmptyBadges />}</section>{locked.length > 0 && <section className="mt-10"><SectionTitle icon={Lock} title="Other badges" description="More badge types can be introduced by administrators." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{locked.map((badge) => <BadgeCard key={badge.id} badge={badge} onToggle={toggle} />)}</div></section>}</main></TranslatedTree>;
}

function BadgeCard({ badge, onToggle }: { badge: ProfileBadge; onToggle: (id: string, enabled: boolean) => void }) {
  const Icon = iconFor(badge.name);
  return <div className={`surface rounded-2xl p-4 transition ${badge.owned ? "" : "opacity-55"}`}><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl" style={{ color: badge.color, background: `${badge.color}16`, boxShadow: badge.enabled ? `0 0 24px ${badge.color}16` : undefined }}>{badge.iconUrl ? <Image src={badge.iconUrl} alt="" width={44} height={44} unoptimized className="h-full w-full object-cover" /> : <Icon size={20} />}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-medium text-zinc-200">{badge.name}</p>{badge.owned && <span className="rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[9px] text-emerald-400">Owned</span>}</div><p className="mt-1 text-xs text-zinc-600">{badge.description}</p>{badge.type && <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-700">{badge.type}</p>}</div>{badge.owned && <Toggle label={`Show ${badge.name} badge`} checked={badge.enabled} onChange={(value) => onToggle(badge.id, value)} />}</div>{!badge.owned && <div className="mt-4 flex items-center gap-1.5 text-[10px] text-zinc-600"><Lock size={11} />Earn this badge to display it</div>}</div>;
}

function EmptyBadges() { return <div className="surface rounded-2xl border-dashed p-8 text-center"><BadgeCheck className="mx-auto text-zinc-700" size={25} /><p className="mt-3 text-sm text-zinc-400">No badges assigned yet.</p><p className="mt-1 text-xs text-zinc-600">Badges awarded by administrators will appear here automatically.</p></div>; }
