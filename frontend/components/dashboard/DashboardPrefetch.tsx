"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-store";
import { loadAnalytics } from "@/lib/analytics";
import { loadBadgeCollection } from "@/lib/badges";
import { loadConstellationDashboard } from "@/lib/constellations";

/** Warm route code and data only when a signed-in user points to or focuses a dashboard link. */
export function DashboardPrefetch() {
  const router = useRouter();
  const { isReady, user } = useAuth();

  useEffect(() => {
    if (!isReady || !user?.id) return;
    const warmed = new Set<string>();
    const onIntent = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[data-dashboard-prefetch]");
      const href = link?.dataset.dashboardPrefetch;
      if (!href || warmed.has(href)) return;
      warmed.add(href);
      router.prefetch(href);
      if (href === "/analytics") void loadAnalytics("7D").catch(() => undefined);
      else if (href === "/badges") void loadBadgeCollection().catch(() => undefined);
      else if (href === "/constellations") void loadConstellationDashboard().catch(() => undefined);
    };
    document.addEventListener("pointerover", onIntent, { passive: true });
    document.addEventListener("focusin", onIntent);
    return () => {
      document.removeEventListener("pointerover", onIntent);
      document.removeEventListener("focusin", onIntent);
    };
  }, [isReady, router, user?.id]);

  return null;
}
