"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-store";

export type DiscordCard = {
  avatar?: string | null;
  decoration?: string | null;
  guildTag?: { tag: string; badge: string } | null;
};

export type DiscordState = {
  connected: boolean;
  needsReconnect: boolean;
  canDisconnect: boolean;
  username: string;
  prefs: { showAvatar: boolean; showDecoration: boolean; showGuildTag: boolean };
  card: DiscordCard;
};

type DiscordLiveValue = {
  state: DiscordState | null;
  reload: () => Promise<void>;
  savePrefs: (prefs: Partial<DiscordState["prefs"]>) => Promise<void>;
  disconnect: () => Promise<void>;
};

const DiscordLiveContext = createContext<DiscordLiveValue | null>(null);

const empty: DiscordState = {
  connected: false,
  needsReconnect: false,
  canDisconnect: false,
  username: "",
  prefs: { showAvatar: false, showDecoration: false, showGuildTag: false },
  card: {},
};

export function DiscordLiveProvider({ children }: { children: React.ReactNode }) {
  const { user, isReady, refresh } = useAuth();
  const [state, setState] = useState<DiscordState | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      setState(null);
      return;
    }
    const response = await fetch("/api/v1/discord", { credentials: "include", cache: "no-store" });
    if (!response.ok) {
      setState(empty);
      return;
    }
    setState(await response.json() as DiscordState);
  }, [user]);

  useEffect(() => {
    if (!isReady) return;
    void reload();
  }, [isReady, reload]);

  const value = useMemo<DiscordLiveValue>(() => ({
    state,
    reload,
    savePrefs: async (prefs) => {
      const previous = state;
      setState((current) => {
        if (!current) return current;
        const nextPrefs = { ...current.prefs, ...prefs };
        return {
          ...current,
          prefs: nextPrefs,
          card: {
            ...current.card,
            avatar: nextPrefs.showAvatar ? current.card.avatar : null,
            decoration: nextPrefs.showDecoration ? current.card.decoration : null,
            guildTag: nextPrefs.showGuildTag ? current.card.guildTag : null,
          },
        };
      });
      try {
        const response = await fetch("/api/v1/discord", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prefs),
        });
        const result = await response.json() as DiscordState & { detail?: string };
        if (!response.ok) throw new Error(String(result.detail || "Could not save Discord display options."));
        setState(result);
      } catch (error) {
        setState(previous);
        throw error;
      }
    },
    disconnect: async () => {
      const response = await fetch("/api/v1/discord/disconnect", { method: "POST", credentials: "include" });
      const result = await response.json() as { detail?: string };
      if (!response.ok) throw new Error(String(result.detail || "Could not disconnect Discord."));
      setState(empty);
      await refresh();
    },
  }), [reload, refresh, state]);

  return <DiscordLiveContext.Provider value={value}>{children}</DiscordLiveContext.Provider>;
}

export function useDiscordLive() {
  return useContext(DiscordLiveContext);
}
