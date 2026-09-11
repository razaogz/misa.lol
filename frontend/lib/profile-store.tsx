"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth-store";
import { createDefaultProfile } from "./profile-defaults";
import type { AuthUser, ProfileAsset, ProfileConfig } from "./types";

type SaveState = "idle" | "saving" | "saved" | "error";
interface ProfileContextValue {
  config: ProfileConfig;
  updateConfig: (updater: (config: ProfileConfig) => ProfileConfig) => void;
  resetConfig: () => void;
  saveProfile: (nextConfig?: ProfileConfig) => Promise<void>;
  saveState: SaveState;
  saveError: string;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, isReady: authReady } = useAuth();
  const [config, setConfig] = useState<ProfileConfig>(() => createDefaultProfile());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const loadGeneration = useRef(0);

  useEffect(() => {
    if (!authReady) return;
    const generation = ++loadGeneration.current;
    const controller = new AbortController();
    const empty = user ? profileForUser(user) : createDefaultProfile();
    // Do not display the previous account while the current account is loading.
    setConfig(empty);
    setSaveState("idle");
    setSaveError("");
    const load = async () => {
      const next = user ? await loadProfileForUser(user, controller.signal) : empty;
      if (generation === loadGeneration.current) { setConfig(next); setSaveState("idle"); setSaveError(""); }
    };
    void load();
    return () => { controller.abort(); };
  }, [authReady, user]);

  const value = useMemo<ProfileContextValue>(() => ({
    config,
    updateConfig: (updater) => { setConfig((current) => updater(current)); setSaveState("idle"); setSaveError(""); },
    resetConfig: () => { setConfig(user ? profileForUser(user) : createDefaultProfile()); setSaveState("idle"); setSaveError(""); },
    saveProfile: async (nextConfig) => {
      if (!user) { setSaveState("error"); setSaveError("You are not signed in. Log in or create an account before saving your profile."); return; }
      const generation = loadGeneration.current;
      setSaveState("saving");
      setSaveError("");
      try {
        const profileToSave = nextConfig || config;
        const response = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(profileToSave) });
        const result = await response.json() as { profile?: ProfileConfig; error?: string };
        if (!response.ok || !result.profile) throw new Error(result.error || "Profile save failed. Please try again.");
        if (generation !== loadGeneration.current) return;
        setConfig(result.profile);
        setSaveState("saved");
      } catch (error) {
        if (generation !== loadGeneration.current) return;
        setSaveState("error"); setSaveError(error instanceof Error ? error.message : "Profile save failed. Please try again.");
      }
    },
    saveState,
    saveError,
  }), [config, saveState, saveError, user]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useProfile must be used inside ProfileProvider");
  return value;
}

export async function loadProfileForUsername(username: string, signal?: AbortSignal): Promise<ProfileConfig | null> {
  const normalized = username.trim().toLowerCase();
  try {
    const response = await fetch(`/api/profile?username=${encodeURIComponent(normalized)}`, { cache: "no-store", signal });
    if (response.ok) {
      const result = await response.json() as { profile: ProfileConfig };
      return result.profile;
    }
  } catch { return null; }
  return null;
}

export async function assetFromFile(file: File, kind: string): Promise<ProfileAsset> {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  const response = await fetch("/api/v1/profile/assets", { method: "POST", body: form, credentials: "include" });
  const result = await response.json().catch(() => ({})) as { asset?: ProfileAsset; error?: string; detail?: string };
  if (!response.ok || !result.asset) throw new Error(result.error || result.detail || "Upload failed. Please try again.");
  return result.asset;
}

function profileForUser(user: AuthUser): ProfileConfig {
  return createDefaultProfile(user.username || "", user.displayName);
}

async function loadProfileForUser(user: AuthUser, signal: AbortSignal) {
  let profile: ProfileConfig | null = null;
  try {
    const response = await fetch("/api/profile/me", {
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
      signal,
    });
    if (response.ok) profile = (await response.json() as { profile?: ProfileConfig }).profile || null;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
  }
  const next = profile || createDefaultProfile(user.username || "", user.displayName);
  next.profile.username = user.username || "";
  next.profile.uid = user.id;
  if (!next.profile.displayName) next.profile.displayName = user.displayName;
  return next;
}
