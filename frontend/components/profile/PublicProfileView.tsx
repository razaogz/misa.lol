"use client";

import { useEffect, useRef, useState } from "react";
import { loadProfileForUsername, normalizeDashboardProfile } from "@/lib/profile-store";
import type { ProfileConfig } from "@/lib/types";
import { ProfilePageMetadata } from "./ProfilePageMetadata";
import { ProfileRenderer } from "./ProfileRenderer";

function PublicProfileAnalytics({ config }: { config: ProfileConfig }) {
  const lastViewedUsername = useRef("");
  useEffect(() => {
    const username = config.profile.username;
    const socialLabels = new Map(config.socials.map((social) => [social.id, social.platform]));
    const device = /iPad|Tablet/i.test(navigator.userAgent) ? "tablet" : /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
    const send = (kind: "view" | "click", socialId = "") => {
      void fetch("/api/v1/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({ username, kind, socialId, socialLabel: socialLabels.get(socialId) || "", referrer: document.referrer, device }),
      }).catch(() => undefined);
    };
    if (lastViewedUsername.current !== username) {
      lastViewedUsername.current = username;
      send("view");
    }
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-social-id]") : null;
      const socialId = target?.dataset.socialId;
      if (socialId && socialLabels.has(socialId)) send("click", socialId);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [config]);
  return null;
}

export function PublicProfileView({ username, initialProfile }: { username: string; initialProfile?: ProfileConfig | null }) {
  const [config, setConfig] = useState<ProfileConfig | null>(() => initialProfile ? normalizeDashboardProfile(initialProfile) : null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(initialProfile ? "ready" : initialProfile === null ? "missing" : "loading");

  useEffect(() => {
    document.documentElement.classList.add("live-card");
    return () => document.documentElement.classList.remove("live-card");
  }, []);

  useEffect(() => {
    if (initialProfile !== undefined) {
      setConfig(initialProfile ? normalizeDashboardProfile(initialProfile) : null);
      setStatus(initialProfile ? "ready" : "missing");
      return;
    }
    let cancelled = false;
    void loadProfileForUsername(username).then((profile) => {
      if (cancelled) return;
      if (!profile) {
        setConfig(null);
        setStatus("missing");
        return;
      }
      setConfig(profile);
      setStatus("ready");
    });
    return () => { cancelled = true; };
  }, [username, initialProfile]);


  if (status === "loading") return <div className="min-h-[100svh] bg-[#07070a]" />;
  if (status === "missing" || !config) {
    return (
      <main className="grid min-h-[100svh] place-items-center bg-[#07070a] px-6 text-center">
        <div>
          <p className="text-sm uppercase tracking-[.2em] text-[#fb7185]">misa.lol</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">This profile was not found</h1>
          <p className="mt-2 text-sm text-zinc-500">@{username} is not a public Misa page.</p>
        </div>
      </main>
    );
  }
  return <><ProfilePageMetadata config={config} /><PublicProfileAnalytics config={config} /><ProfileRenderer config={config} /></>;
}
