"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser } from "./types";
import { mapBackendUser } from "./auth-user";

type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string } | { ok: false; mfaRequired: true; challenge: string } | { ok: false; captchaRequired: true; challenge: string };
interface AuthContextValue {
  user: AuthUser | null;
  isReady: boolean;
  signUp: (input: { username: string; displayName: string; email: string; password: string; confirmPassword: string; turnstileToken: string }) => Promise<AuthResult>;
  login: (identifier: string, password: string, remember: boolean) => Promise<AuthResult>;
  finalizeCaptcha: (challenge: string, turnstileToken: string) => Promise<AuthResult>;
  verifyMfa: (challenge: string, code: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const broadcast = useCallback((type: "session" | "logout") => {
    channelRef.current?.postMessage({ type });
  }, []);

  const refreshSession = useCallback(async () => {
    const requestId = ++requestRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
        signal: controller.signal,
      });
      const result = response.ok ? await response.json() as { user: AuthUser | null } : { user: null };
      if (requestId === requestRef.current) setUser(result.user || null);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError") && requestId === requestRef.current) setUser(null);
    } finally {
      if (requestId === requestRef.current) setIsReady(true);
    }
  }, []);

  const commitUser = useCallback((next: AuthUser | null) => {
    requestRef.current += 1;
    abortRef.current?.abort();
    setUser(next);
  }, []);

  useEffect(() => {
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("misa-auth-events");
    channelRef.current = channel;
    if (channel) channel.onmessage = (event) => {
      if (event.data?.type === "session" || event.data?.type === "logout") void refreshSession();
    };
    void refreshSession();
    return () => {
      channel?.close();
      channelRef.current = null;
      abortRef.current?.abort();
    };
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isReady,
    signUp: async (input) => requestAuth("/api/auth/signup", input, (next) => { commitUser(next); broadcast("session"); }),
    login: async (identifier, password, remember) => requestAuth("/api/auth/login", { identifier, password, remember }, (next) => { commitUser(next); broadcast("session"); }),
    finalizeCaptcha: async (challenge, turnstileToken) => requestAuth("/api/auth/captcha", { challenge, turnstileToken }, (next) => { commitUser(next); broadcast("session"); }),
    verifyMfa: async (challenge, code) => {
      try {
        const response = await fetch("/api/v1/auth/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ challenge, code }) });
        const result = await response.json() as { error?: string; detail?: string };
        if (!response.ok) return { ok: false, error: result.error || result.detail || "MFA verification failed." };
        const session = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
        const sessionResult = await session.json() as { user?: AuthUser | null };
        if (!session.ok || !sessionResult.user) return { ok: false, error: "Signed in, but the account session could not be loaded." };
        commitUser(sessionResult.user);
        broadcast("session");
        return { ok: true, user: sessionResult.user };
      } catch { return { ok: false, error: "The backend could not be reached." }; }
    },
    logout: async () => {
      try { await fetch("/api/auth/logout", { method: "POST", credentials: "include", cache: "no-store", headers: { "Cache-Control": "no-store" } }); }
      finally { commitUser(null); broadcast("logout"); }
    },
    updateDisplayName: async (displayName) => {
      const response = await fetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ displayName }) });
      if (!response.ok) throw new Error("Could not update the account display name.");
      const result = await response.json() as { user: AuthUser };
      commitUser(result.user);
      broadcast("session");
    },
    updateUsername: async (username) => {
      const response = await fetch("/api/v1/me/username", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ username }) });
      const result = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(String(result.detail || result.error || "Could not claim that username."));
      commitUser(mapBackendUser(result));
      broadcast("session");
    },
  }), [broadcast, commitUser, isReady, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

async function requestAuth(path: string, body: object, setUser: (user: AuthUser) => void): Promise<AuthResult> {
  try {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    const result = await response.json() as { user?: Record<string, unknown>; error?: string; detail?: string; mfa_required?: boolean; captcha_required?: boolean; challenge?: string };
    if (result.mfa_required && result.challenge) return { ok: false, mfaRequired: true, challenge: result.challenge };
    if (result.captcha_required && result.challenge) return { ok: false, captchaRequired: true, challenge: result.challenge };
    if (!response.ok || !result.user) return { ok: false, error: result.error || result.detail || "Something went wrong. Please try again." };
    const user = mapBackendUser(result.user);
    setUser(user);
    return { ok: true, user };
  } catch { return { ok: false, error: "The backend could not be reached. Configure MISA_BACKEND_URL and try again." }; }
}
