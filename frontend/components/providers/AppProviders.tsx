"use client";

import { ProfileProvider } from "@/lib/profile-store";
import { AuthProvider } from "@/lib/auth-store";
import { DiscordLiveProvider } from "@/lib/discord-live";
import { I18nProvider } from "@/lib/i18n";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { FeatureFlagsProvider } from "@/lib/feature-flags";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <FeatureFlagsProvider>
        <AuthProvider>
        <ProfileProvider>
          <DiscordLiveProvider>
            <DashboardShell>{children}</DashboardShell>
          </DiscordLiveProvider>
        </ProfileProvider>
        </AuthProvider>
      </FeatureFlagsProvider>
    </I18nProvider>
  );
}
