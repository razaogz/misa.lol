"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth, type AuthUser } from "./auth-store";
import { compactProfileForSave, savePayloadTooLarge } from "./audio";
import { cloneMockProfile } from "./mock-data";
import { normalizeProfileSocials } from "./socials";
import type { ProfileAsset, ProfileConfig } from "./types";

type SaveState = "idle" | "saving" | "saved" | "error";
interface ProfileContextValue {
  config: ProfileConfig;
  updateConfig: (updater: (config: ProfileConfig) => ProfileConfig) => void;
  resetConfig: () => void;
  saveProfile: (nextConfig?: ProfileConfig) => Promise<void>;
  hydrateFromServer: (nextConfig: ProfileConfig) => void;
  saveState: SaveState;
  saveError: string;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, isReady: authReady } = useAuth();
  const [config, setConfig] = useState<ProfileConfig>(() => cloneMockProfile());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const lastSavedRef = useRef("");

  const persist = useCallback(async (nextConfig: ProfileConfig) => {
    if (!user) { setSaveState("error"); setSaveError("You are not signed in."); return; }
    if (!user.username) { setSaveState("error"); setSaveError("Choose a username in Account settings before saving your profile."); return; }
    const profileToSave = normalizeProfileSocials(nextConfig);
    const snapshot = JSON.stringify(profileToSave);
    if (snapshot === lastSavedRef.current) { setSaveState("saved"); return; }
    let previous: ProfileConfig | null = null;
    try { previous = lastSavedRef.current ? JSON.parse(lastSavedRef.current) as ProfileConfig : null; } catch { previous = null; }
    const body = JSON.stringify(compactProfileForSave(profileToSave, previous));
    if (savePayloadTooLarge(body)) {
      setSaveState("error");
      setSaveError("That playlist is too large to save at once. Use smaller files or fewer tracks.");
      return;
    }
    setSaveState("saving");
    setSaveError("");
    try {
      const response = await fetch("/api/v1/profile/me", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body });
      const raw = await response.text();
      let result: { profile?: ProfileConfig; detail?: string; error?: string } = {};
      try { result = raw ? JSON.parse(raw) as typeof result : {}; } catch { /* The proxy may return an HTML error page. */ }
      if (!response.ok && !result.detail && !result.error) result.detail = `Profile save failed (server returned ${response.status}).`;
      if (!response.ok || !result.profile) throw new Error(result.detail || result.error || "Profile save failed. Please try again.");
      const saved = normalizeProfileSocials(result.profile);
      lastSavedRef.current = JSON.stringify(saved);
      setConfig(saved);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Profile save failed. Please try again.");
    }
  }, [user]);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    const load = async () => {
      const next = user ? await loadProfileForUser(user) : cloneMockProfile();
      if (cancelled) return;
      const normalized = normalizeProfileSocials(next);
      setConfig(normalized);
      lastSavedRef.current = user?.username ? JSON.stringify(normalized) : "";
      setSaveState("idle");
      setSaveError("");
    };
    void load();
    return () => { cancelled = true; };
  }, [authReady, user]);

  const value = useMemo<ProfileContextValue>(() => ({
    config,
    updateConfig: (updater) => { setConfig((current) => updater(current)); setSaveState("idle"); setSaveError(""); },
    resetConfig: () => { setConfig(user ? profileForUser(user) : cloneMockProfile()); setSaveState("idle"); setSaveError(""); },
    saveProfile: async (nextConfig) => { await persist(nextConfig || config); },
    hydrateFromServer: (nextConfig) => {
      const normalized = normalizeProfileSocials(nextConfig);
      lastSavedRef.current = JSON.stringify(normalized);
      setConfig(normalized);
      setSaveState("saved");
      setSaveError("");
    },
    saveState,
    saveError,
  }), [config, persist, saveState, saveError, user]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useProfile must be used inside ProfileProvider");
  return value;
}

export async function loadProfileForUsername(username: string): Promise<ProfileConfig | null> {
  const normalized = username.trim().toLowerCase();
  try {
    const response = await fetch(`/api/v1/profile?username=${encodeURIComponent(normalized)}`, { cache: "no-store" });
    if (response.ok) {
      const result = await response.json() as { profile?: ProfileConfig };
      if (result.profile) return normalizeProfileSocials(result.profile);
    }
  } catch { /* Keep public profiles from crashing if the API is briefly down. */ }
  return null;
}

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  ico: "image/x-icon",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

export function assetFromFile(file: File): Promise<ProfileAsset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const type = file.type || MIME_BY_EXT[file.name.split(".").pop()?.toLowerCase() || ""] || "";
      let url = raw || null;
      if (url?.startsWith("data:") && type.startsWith("font/")) url = url.replace(/^data:[^;,]*/, `data:${type}`);
      else if (url?.startsWith("data:application/octet-stream") && type) url = url.replace("data:application/octet-stream", `data:${type}`);
      resolve({ url, name: file.name, type });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function profileForUser(user: AuthUser) {
  const profile = cloneMockProfile();
  profile.profile.username = user.username || "choose-username";
  profile.profile.displayName = user.displayName;
  profile.profile.uid = user.id;
  profile.socials = profile.socials.map((social) => ({ ...social, value: social.value.replaceAll("demo", user.username || "user") }));
  return profile;
}

async function loadProfileForUser(user: AuthUser) {
  const response = await fetch("/api/v1/profile/me", { credentials: "include", cache: "no-store" });
  if (response.ok) {
    const result = await response.json() as { profile?: ProfileConfig };
    if (result.profile) return normalizeProfileSocials(result.profile);
  }
  return profileForUser(user);
}
