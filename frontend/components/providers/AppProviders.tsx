"use client";

import { ProfileProvider } from "@/lib/profile-store";
import { AuthProvider } from "@/lib/auth-store";
import { DiscordLiveProvider } from "@/lib/discord-live";
import { I18nProvider } from "@/lib/i18n";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import { DashboardTabState } from "@/components/dashboard/DashboardTabState";
import { RuntimeErrorBoundary } from "@/components/dashboard/RuntimeErrorBoundary";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <RuntimeErrorBoundary>
      <I18nProvider>
        <DashboardTabState />
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
    </RuntimeErrorBoundary>
  );
}