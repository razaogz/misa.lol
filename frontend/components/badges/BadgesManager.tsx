"use client";

import { BadgeCheck, ChevronDown, ChevronUp, Crown, Gem, Lock, Sparkles, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { ProfileBadges } from "@/components/profile/ProfileCardModules";
import { Button, FieldLabel, PageHeader, SectionTitle, TextArea, TextInput, Toggle } from "@/components/ui";
import { hasVerifiedBadge, moveOwnedBadge } from "@/lib/badges";
import { useT } from "@/lib/i18n";
import { useProfile } from "@/lib/profile-store";
import type { ProfileBadge } from "@/lib/types";

const iconFor = (name: string) => name === "Premium" ? Crown : ["Winner", "Second Place", "Third Place"].includes(name) ? Trophy : name === "Donor" || name === "Gifter" ? Gem : name === "OG" ? Sparkles : BadgeCheck;

export function BadgesManager() {
  const t = useT();
  const { config, updateConfig, saveProfile, saveState, saveError } = useProfile();
  const owned = config.badges.filter((badge) => badge.owned);
  const locked = config.badges.filter((badge) => !badge.owned);
  const patchBadge = (id: string, patch: Partial<ProfileBadge>) => updateConfig((current) => ({
    ...current,
    badges: current.badges.map((badge) => badge.id === id ? { ...badge, ...patch } : badge),
  }));
  const move = (ownedIndex: number, direction: -1 | 1) => updateConfig((current) => ({
    ...current,
    badges: moveOwnedBadge(current.badges, ownedIndex, direction),
  }));
  return (
    <main className="mx-auto min-h-screen max-w-[1200px] px-5 py-8 sm:px-8 sm:py-11 xl:px-12">
      <PageHeader
        eyebrow={t("badges.eyebrow")}
        title={t("badges.title")}
        description={t("badges.description")}
        action={
          <div className="flex gap-2">
            <Button variant="subtle"><BadgeCheck size={15} />{t("badges.earned", { count: owned.length })}</Button>
            <Button variant="accent" onClick={() => void saveProfile()} disabled={saveState === "saving"}>
              {saveState === "saving" ? t("common.saving") : saveState === "saved" ? t("common.savedCheck") : t("common.save")}
            </Button>
          </div>
        }
      />
      {saveError && <p className="mb-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{saveError}</p>}
      <section className="mb-10 rounded-2xl border border-white/[.07] bg-white/[.02] p-4">
        <p className="text-xs uppercase tracking-[.14em] text-zinc-500">{t("badges.onCard")}</p>
        <div className="mt-2 min-h-12">
          <ProfileBadges config={config} className="mt-0" />
          {owned.filter((badge) => badge.enabled).length === 0 && <p className="text-xs text-zinc-600">{t("badges.noneVisible")}</p>}
        </div>
      </section>
      <VerificationCard owned={hasVerifiedBadge(config.badges)} />
      <section>
        <SectionTitle icon={Sparkles} title={t("badges.yours")} description={t("badges.yoursDesc")} />
        <div className="space-y-3">
          {owned.length === 0 && <p className="rounded-2xl border border-white/[.07] px-4 py-6 text-center text-sm text-zinc-500">{t("badges.noneOwned")}</p>}
          {owned.map((badge, index) => (
            <OwnedBadgeRow
              key={badge.id}
              badge={badge}
              index={index}
              total={owned.length}
              onMove={move}
              iconColor={config.settings.iconColor}
              onPatch={patchBadge}
            />
          ))}
        </div>
      </section>
      <section className="mt-10">
        <SectionTitle icon={Lock} title={t("badges.other")} description={t("badges.otherDesc")} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locked.map((badge) => <LockedBadgeCard key={badge.id} badge={badge} />)}
        </div>
      </section>
    </main>
  );
}

function OwnedBadgeRow({ badge, index, total, iconColor, onMove, onPatch }: { badge: ProfileBadge; index: number; total: number; iconColor: string; onMove: (index: number, direction: -1 | 1) => void; onPatch: (id: string, patch: Partial<ProfileBadge>) => void }) {
  const t = useT();
  const Icon = iconFor(badge.name);
  const paint = badge.monochrome ? iconColor : badge.color;
  return (
    <div className="rounded-2xl border border-white/[.07] bg-white/[.02] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex flex-col gap-1">
            <button type="button" aria-label={`Move ${badge.name} up`} disabled={index === 0} onClick={() => onMove(index, -1)} className="rounded-lg p-1 text-zinc-500 hover:bg-white/[.06] hover:text-white disabled:opacity-30"><ChevronUp size={14} /></button>
            <button type="button" aria-label={`Move ${badge.name} down`} disabled={index === total - 1} onClick={() => onMove(index, 1)} className="rounded-lg p-1 text-zinc-500 hover:bg-white/[.06] hover:text-white disabled:opacity-30"><ChevronDown size={14} /></button>
          </div>
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl" style={{ color: paint, background: `${paint}16` }}>{badge.icon ? <img src={badge.icon} alt="" className="h-6 w-6 object-contain" /> : <Icon size={20} />}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-zinc-200">{badge.name}</p>
              <span className="rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[9px] text-emerald-400">{t("common.owned")}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-600">{badge.description}</p>
          </div>
        </div>
        <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <FieldLabel>{t("badges.color")}</FieldLabel>
            <div className="flex gap-2">
              <input aria-label={`${badge.name} color`} type="color" value={badge.color} onChange={(event) => onPatch(badge.id, { color: event.target.value })} className="h-11 w-12 cursor-pointer rounded-xl border-0 bg-transparent p-0" />
              <TextInput value={badge.color} onChange={(value) => onPatch(badge.id, { color: value })} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-6 rounded-xl border border-white/[.06] px-3 py-2 sm:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">{t("badges.show")}</span>
              <Toggle label={`Show ${badge.name} badge`} checked={badge.enabled} onChange={(value) => onPatch(badge.id, { enabled: value })} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">{t("badges.monochrome")}</span>
              <Toggle label={`Monochrome ${badge.name} badge`} checked={Boolean(badge.monochrome)} onChange={(value) => onPatch(badge.id, { monochrome: value })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerificationCard({ owned }: { owned: boolean }) {
  const t = useT();
  const [status, setStatus] = useState<"none" | "pending" | "approved" | "rejected" | "verified">(owned ? "verified" : "none");
  const [reason, setReason] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch("/api/v1/verification/me", { credentials: "include", cache: "no-store" })
      .then((response) => response.json() as Promise<{ status?: string; reason?: string; proofUrl?: string; reviewNote?: string }>)
      .then((data) => {
        const next = data.status;
        if (next === "pending" || next === "approved" || next === "rejected" || next === "verified") setStatus(next);
        if (data.reason) setReason(data.reason);
        if (data.proofUrl) setProofUrl(data.proofUrl);
        if (data.reviewNote) setReviewNote(data.reviewNote);
      })
      .catch(() => undefined);
  }, []);
  const apply = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/verification/me", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, proofUrl }),
      });
      const data = await response.json() as { status?: string; detail?: string | Array<{ msg?: string }> };
      if (!response.ok) {
        const detail = Array.isArray(data.detail) ? (data.detail[0]?.msg || "Check the reason and proof link.") : data.detail;
        throw new Error(detail || "Could not send that request.");
      }
      setStatus((data.status as typeof status) || "pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that request.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mb-10">
      <SectionTitle icon={BadgeCheck} title={t("badges.verification")} description={t("badges.verificationDesc")} />
      <div className="rounded-2xl border border-white/[.07] bg-white/[.02] p-4">
        {owned || status === "verified" || status === "approved" ? (
          <p className="text-sm text-emerald-300">{t("badges.verified")}</p>
        ) : status === "pending" ? (
          <p className="text-sm text-zinc-300">{t("badges.pending")}</p>
        ) : (
          <div className="space-y-3">
            {status === "rejected" && <p className="text-sm text-amber-200">{reviewNote || t("badges.rejected")}</p>}
            <div>
              <FieldLabel>{t("badges.why")}</FieldLabel>
              <TextArea value={reason} onChange={setReason} placeholder={t("badges.whyPh")} />
            </div>
            <div>
              <FieldLabel>{t("badges.proof")}</FieldLabel>
              <TextInput value={proofUrl} onChange={setProofUrl} placeholder={t("badges.proofPh")} />
            </div>
            {error && <p className="text-xs text-red-300">{error}</p>}
            <Button variant="accent" onClick={() => void apply()} disabled={busy || reason.trim().length < 12}>{busy ? t("common.sending") : t("badges.request")}</Button>
          </div>
        )}
      </div>
    </section>
  );
}

function LockedBadgeCard({ badge }: { badge: ProfileBadge }) {
  const Icon = iconFor(badge.name);
  return (
    <div className="surface rounded-2xl p-4 opacity-55">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl" style={{ color: badge.color, background: `${badge.color}16` }}>{badge.icon ? <img src={badge.icon} alt="" className="h-6 w-6 object-contain" /> : <Icon size={20} />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-200">{badge.name}</p>
          <p className="mt-1 text-xs text-zinc-600">{badge.description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-[10px] text-zinc-600"><Lock size={11} />Earn this badge to display it</div>
    </div>
  );
}
