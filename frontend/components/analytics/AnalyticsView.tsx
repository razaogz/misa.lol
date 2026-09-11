"use client";

import { BarChart3, CircleHelp, MousePointerClick, Users, Zap } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui";
import { TranslatedTree } from "@/lib/i18n";

export function AnalyticsView() {
  return <TranslatedTree><main className="mx-auto min-h-screen max-w-[1350px] px-5 py-8 sm:px-8 sm:py-11 xl:px-12">
    <PageHeader eyebrow="Insights" title="Analytics" description="A clear look at how people discover your profile." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <EmptyMetric label="Profile views" icon={Users} />
      <EmptyMetric label="Link clicks" icon={MousePointerClick} />
      <EmptyMetric label="Click rate" icon={Zap} />
      <EmptyMetric label="Avg. daily views" icon={BarChart3} />
    </div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <section className="surface rounded-2xl p-5 sm:p-6">
        <SectionTitle icon={BarChart3} title="Profile views" description="Historical profile traffic will appear here once analytics is enabled." />
        <EmptyState />
      </section>
      <section className="surface rounded-2xl p-5 sm:p-6">
        <SectionTitle icon={Users} title="Visitors" description="Device and visitor breakdowns will appear here once analytics is enabled." />
        <EmptyState />
      </section>
    </div>
    <div className="mt-6 flex gap-3 rounded-2xl border border-white/[.06] bg-white/[.02] p-4 text-xs text-zinc-500">
      <CircleHelp size={15} className="shrink-0 text-zinc-600" />
      Analytics is not connected to the backend yet, so no visitor data is shown.
    </div>
  </main></TranslatedTree>;
}

function EmptyMetric({ label, icon: Icon }: { label: string; icon: typeof Users }) {
  return <div className="surface rounded-2xl p-5"><div className="flex items-start justify-between"><span className="text-xs text-zinc-500">{label}</span><Icon size={16} className="text-[#a99bff]" /></div><p className="mt-5 text-2xl font-semibold tracking-[-.04em] text-zinc-600">—</p><p className="mt-2 text-xs text-zinc-600">Not available yet</p></div>;
}

function EmptyState() {
  return <div className="flex min-h-56 items-center justify-center text-center text-xs text-zinc-600">No analytics data available.</div>;
}
