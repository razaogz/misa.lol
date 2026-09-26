"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { isPublicProfilePath } from "@/lib/public-profile-path";

const DashboardProviders = dynamic(
  () => import("@/components/providers/DashboardProviders").then((module) => module.DashboardProviders),
  { loading: () => <DashboardBootShell /> },
);

const AdminProviders = dynamic(
  () => import("@/components/providers/AdminProviders").then((module) => module.AdminProviders),
);

function isAdminRoute(pathname: string) {
  return pathname === "/admin"
    || pathname.startsWith("/admin/")
    || pathname === "/dashboard/admin"
    || pathname.startsWith("/dashboard/admin/")
    || pathname === "/m"
    || pathname.startsWith("/m/");
}

function isStandaloneRoute(pathname: string) {
  return pathname === "/auth/verify" || pathname === "/dashboard/auth/verify"
    || pathname === "/preview" || pathname.startsWith("/p/")
    || pathname.startsWith("/c/");
}

function DashboardBootShell() {
  return (
    <div className="app-shell min-h-[100svh]" aria-busy="true" aria-label="Loading dashboard">
      <aside className="sidebar-glass fixed inset-y-0 start-0 hidden w-[240px] border-e p-4 md:block">
        <div className="flex h-16 items-center gap-2.5 px-1"><div className="h-7 w-7 animate-pulse rounded-[8px] bg-white/[.07]" /><div className="h-3.5 w-20 animate-pulse rounded-[6px] bg-white/[.05]" /></div>
        <div className="mt-2 h-9 animate-pulse rounded-[10px] bg-white/[.03]" />
        <div className="mt-7 space-y-6">
          {Array.from({ length: 3 }, (_, group) => (
            <div key={group}>
              <div className="mx-3 h-3 w-16 animate-pulse rounded-[5px] bg-white/[.045]" />
              <div className="mt-3 space-y-1">{Array.from({ length: group === 2 ? 2 : 3 }, (_, item) => <div key={item} className="h-9 animate-pulse rounded-[10px] bg-white/[.03]" />)}</div>
            </div>
          ))}
        </div>
      </aside>
      <div className="md:ps-[240px]">
        <header className="h-14 border-b border-white/[.06] bg-[#08080a]/85 md:hidden" />
        <main className="mx-auto max-w-[1240px] px-5 py-8 sm:px-10 sm:py-10">
          <div className="h-3 w-24 animate-pulse rounded-[5px] bg-white/[.05]" />
          <div className="mt-4 h-8 w-64 animate-pulse rounded-[10px] bg-white/[.07]" />
          <div className="mt-4 h-4 w-full max-w-md animate-pulse rounded-[7px] bg-white/[.035]" />
          <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-card border border-white/[.05] bg-white/[.02]" />)}</div>
        </main>
      </div>
    </div>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isAdminRoute(pathname)) return <AdminProviders>{children}</AdminProviders>;
  if (isStandaloneRoute(pathname) || isPublicProfilePath(pathname)) return <>{children}</>;
  return <DashboardProviders>{children}</DashboardProviders>;
}