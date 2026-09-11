"use client";

import { useEffect, useState } from "react";
import { loadProfileForUsername } from "@/lib/profile-store";
import type { ProfileConfig } from "@/lib/types";
import { ProfileRenderer } from "./ProfileRenderer";

export function PublicProfileView({ username }: { username: string }) {
  const [config, setConfig] = useState<ProfileConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadProfileForUsername(username).then((profile) => {
      if (!cancelled) { setConfig(profile); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [username]);

  if (loading) return <main className="grid min-h-[100svh] place-items-center bg-[#07070a] text-sm text-white/50">Loading profile…</main>;
  if (!config) return <main className="grid min-h-[100svh] place-items-center bg-[#07070a] p-6 text-center text-white"><div><p className="text-lg font-medium">Profile not found</p><p className="mt-2 text-sm text-white/45">This username is not available.</p></div></main>;
  return <ProfileRenderer config={config} />;
}
