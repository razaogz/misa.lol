"use client";

import { MousePointerClick, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader, SectionTitle } from "@/components/ui";
import { loadLeaderboard, type LeaderboardEntry, type LeaderboardMetric, type LeaderboardRange, type LeaderboardSort } from "@/lib/community";
import { useT } from "@/lib/i18n";

const RANGES: Array<[LeaderboardRange, string]> = [["7D", "Week"], ["30D", "Month"], ["ALL", "All time"]];
const METRICS: Array<[LeaderboardMetric, string]> = [["views", "Views"], ["clicks", "Clicks"]];

export function LeaderboardView() {
  const t = useT();
  const [sort, setSort] = useState<LeaderboardSort>("popular");
  const [range, setRange] = useState<LeaderboardRange>("7D");
  const [metric, setMetric] = useState<LeaderboardMetric>("views");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [you, setYou] = useState<LeaderboardEntry | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const publicOrigin = process.env.NEXT_PUBLIC_AUTH_ORIGIN || "http://127.0.0.1:8000";

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void loadLeaderboard(sort, sort === "latest" ? "ALL" : range, metric).then((data) => {
      if (cancelled) return;
      setEntries(data.entries || []);
      setYou(data.you);
      setStatus("ready");
    }).catch(() => {
      if (cancelled) return;
      setEntries([]);
      setYou(null);
      setStatus("error");
    });
    return () => { cancelled = true; };
  }, [sort, range, metric]);

  return (
    <main className="mx-auto min-h-screen max-w-[1100px] px-5 py-8 sm:px-8 sm:py-11 xl:px-12">
      <PageHeader eyebrow="Leaderboard" title={t("community.title")} description={t("community.description")} />
      <div className="mb-4 flex flex-wrap gap-2">
        {([["latest", "Latest"], ["popular", "Most popular"]] as Array<[LeaderboardSort, string]>).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setSort(id)} className={"rounded-xl border px-3 py-2 text-xs transition " + (sort === id ? "border-[#e11d48]/60 bg-[#e11d48]/15 text-white" : "border-white/[.08] text-zinc-500 hover:border-[#e11d48]/35 hover:text-white")}>{label}</button>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {RANGES.map(([id, label]) => (
          <button key={id} type="button" disabled={sort === "latest"} onClick={() => setRange(id)} className={"rounded-xl border px-3 py-2 text-xs transition " + (sort === "latest" ? "cursor-not-allowed border-white/[.05] text-zinc-700" : range === id ? "border-[#e11d48]/60 bg-[#e11d48]/15 text-white" : "border-white/[.08] text-zinc-500 hover:border-[#e11d48]/35 hover:text-white")}>{label}</button>
        ))}
        <span className="mx-1 hidden h-8 w-px bg-white/[.08] sm:block" />
        {METRICS.map(([id, label]) => (
          <button key={id} type="button" disabled={sort === "latest"} onClick={() => setMetric(id)} className={"rounded-xl border px-3 py-2 text-xs transition " + (sort === "latest" ? "cursor-not-allowed border-white/[.05] text-zinc-700" : metric === id ? "border-[#e11d48]/60 bg-[#e11d48]/15 text-white" : "border-white/[.08] text-zinc-500 hover:border-[#e11d48]/35 hover:text-white")}>{label}</button>
        ))}
      </div>
      {you && (
        <div className="surface mb-6 rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[.14em] text-zinc-500">{t("community.yourPlace")}</p>
          <EntryRow entry={you} metric={metric} href={publicOrigin + "/" + you.username} highlight />
        </div>
      )}
      <section className="surface rounded-2xl p-4 sm:p-5">
        <SectionTitle icon={Trophy} title={sort === "latest" ? "Latest profiles" : "Most popular profiles"} description={status === "error" ? t("community.loadFail") : sort === "latest" ? "The newest public profiles on Misa.lol." : "Public profiles ranked by activity."} />
        {status === "ready" && entries.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">{sort === "latest" ? "No profiles yet." : t("community.empty")}</p>}
        <div className="divide-y divide-white/[.06]">
          {entries.map((entry) => (
            <EntryRow key={entry.username} entry={entry} metric={metric} href={publicOrigin + "/" + entry.username} highlight={you?.username === entry.username} />
          ))}
        </div>
      </section>
    </main>
  );
}

function EntryRow({ entry, metric, href, highlight }: { entry: LeaderboardEntry; metric: LeaderboardMetric; href: string; highlight?: boolean }) {
  const value = metric === "clicks" ? entry.clicks : entry.views;
  const Icon = metric === "clicks" ? MousePointerClick : Users;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={"flex items-center gap-3 px-1 py-3 " + (highlight ? "text-white" : "text-zinc-300 hover:bg-white/[.03]")}>
      <span className="w-8 text-right font-mono text-xs text-zinc-500">{entry.rank ?? "-"}</span>
      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/[.06] text-sm font-semibold">
        {entry.avatar ? <img src={entry.avatar} alt="" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
        {(entry.displayName || entry.username).slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{entry.displayName}</span>
        <span className="block truncate text-xs text-zinc-500">@{entry.username}</span>
      </span>
      <span className="flex items-center gap-1.5 text-sm text-zinc-300"><Icon size={14} className="text-[#fb7185]" />{value.toLocaleString()}</span>
    </a>
  );
}
