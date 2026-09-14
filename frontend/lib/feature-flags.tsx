 "use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const DEFAULT_FEATURE_FLAGS: Record<string, boolean> = {
  "nav.overview": true, "nav.analytics": true, "nav.badges": true, "nav.settings": true, "nav.security": true, "nav.constellations": true,
  "nav.customize": true, "nav.links": true, "nav.leaderboard": true, "nav.premium": true, "nav.templates": true,
  "customize.assets": true, "customize.assets.avatar": true, "customize.assets.background": true,
  "customize.assets.backgroundVideo": true, "customize.assets.audio": true, "customize.assets.audioCrop": true,
  "customize.layout": true, "customize.effects": true, "customize.effects.username": true,
  "customize.widgets": true, "customize.portfolio": true, "customize.sharing": true,
  "profile.frame": true, "profile.avatar": true, "profile.avatarBorder": true, "profile.displayName": true,
  "profile.socials": true, "profile.widgets": true, "profile.badges": true, "profile.audio": true,
  "profile.views": true, "profile.joinDate": true, "integrations.discord": true,
  "feature.usernameEffects.glitch": true, "feature.usernameEffects.pulse": true, "feature.usernameEffects.outline": true,
  "feature.usernameEffects.neon": true, "feature.usernameEffects.wave": true, "feature.usernameEffects.shadow": true,
};

const FeatureFlagsContext = createContext<Record<string, boolean>>(DEFAULT_FEATURE_FLAGS);

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState(DEFAULT_FEATURE_FLAGS);
  useEffect(() => {
    let alive = true;
    fetch("/api/v1/feature-flags", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("flags")))
      .then((payload: { flags?: Record<string, boolean> }) => { if (alive && payload.flags) setFlags({ ...DEFAULT_FEATURE_FLAGS, ...payload.flags }); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const value = useMemo(() => flags, [flags]);
  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags() {
  const flags = useContext(FeatureFlagsContext);
  return { flags, enabled: (key: string) => flags[key] !== false };
}
