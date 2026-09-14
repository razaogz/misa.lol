"use client";

import { UsersRound } from "lucide-react";
import { Button, PageHeader, SectionTitle } from "@/components/ui";

export function ConstellationsView() {
  return <main className="mx-auto min-h-screen max-w-[1050px] px-5 py-8 sm:px-8 sm:py-11 xl:px-12">
    <PageHeader eyebrow="Customize" title="Constellations" description="A future space for connected profiles and 2+ person pages." />
    <section>
      <SectionTitle icon={UsersRound} title="Constellations" description="A place for profiles to connect when the 2+ people feature is ready." />
      <div className="rounded-2xl border border-[#e11d48]/20 bg-[#e11d48]/[.04] p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e11d48]/10 text-[#fb7185]"><UsersRound size={18} /></span>
          <div><p className="text-sm font-medium text-white">Connect profiles into a constellation</p><p className="mt-1 text-xs leading-5 text-zinc-500">This is a placeholder for the upcoming 2+ people feature. Nothing is enabled yet.</p><Button variant="subtle" className="mt-4 h-9 min-h-0 px-3 text-xs" disabled>Coming soon</Button></div>
        </div>
      </div>
    </section>
  </main>;
}
