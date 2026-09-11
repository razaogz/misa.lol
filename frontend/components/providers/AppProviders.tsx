"use client";

import { ProfileProvider } from "@/lib/profile-store";
import { AuthProvider } from "@/lib/auth-store";
import { LocaleProvider } from "@/lib/i18n";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider><ProfileProvider><LocaleProvider>{children}</LocaleProvider></ProfileProvider></AuthProvider>;
}
