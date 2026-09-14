"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BadgeCheck, BookOpen, Check, ChevronRight, CircleHelp, Copy, LayoutDashboard, Link2, LockKeyhole, LogOut, Menu, Palette, Search, Settings, Share2, ShieldCheck, Sparkles, Trophy, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LanguageSelect } from "@/components/dashboard/LanguageSelect";
import { UsernameClaimGate } from "@/components/onboarding/UsernameClaimGate";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/lib/i18n";
import { useProfile } from "@/lib/profile-store";
import { useFeatureFlags } from "@/lib/feature-flags";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

type DashboardNavItem = { label: string; href: string; icon: typeof LayoutDashboard };

function NavLink({ href, label, icon: Icon, close }: DashboardNavItem & { close: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link href={href} onClick={close} className={`group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition ${active ? "bg-[#e11d48]/[.12] text-white" : "text-zinc-500 hover:bg-white/[.05] hover:text-zinc-200"}`}>
      <Icon size={17} strokeWidth={active ? 2 : 1.7} className={active ? "text-[#fda4af]" : "text-zinc-600 group-hover:text-zinc-300"} />
      {label}
      {active && <span className="absolute end-3 h-1.5 w-1.5 rounded-full bg-[#fecdd3] shadow-[0_0_10px_#e11d48]" />}
    </Link>
  );
}

function SidebarContent({ close }: { close: () => void }) {
  const { config } = useProfile();
  const { logout, user } = useAuth();
  const { t } = useI18n();
  const { enabled } = useFeatureFlags();
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [copiedAccountId, setCopiedAccountId] = useState(false);
  const initials = config.profile.displayName.trim().slice(0, 1).toUpperCase() || "U";
  const publicOrigin = process.env.NEXT_PUBLIC_AUTH_ORIGIN || "http://127.0.0.1:8000";
  const copyAccountId = async () => {
    if (!user?.accountId) return;
    try {
      await navigator.clipboard.writeText(user.accountId);
      setCopiedAccountId(true);
      window.setTimeout(() => setCopiedAccountId(false), 1600);
    } catch { /* clipboard access can be unavailable in insecure previews */ }
  };
  const groups = useMemo(() => [
    { label: t("nav.account"), items: [
      enabled("nav.overview") && { label: t("nav.overview"), href: "/", icon: LayoutDashboard },
      enabled("nav.analytics") && { label: t("nav.analytics"), href: "/analytics", icon: BarChart3 },
      enabled("nav.badges") && { label: t("nav.badges"), href: "/badges", icon: BadgeCheck },
      enabled("nav.settings") && { label: t("nav.settings"), href: "/settings", icon: Settings },
      enabled("nav.security") && { label: t("nav.security", undefined, "Security"), href: "/security", icon: LockKeyhole },
    ].filter((item): item is DashboardNavItem => Boolean(item)) },
    { label: t("nav.customize"), items: enabled("nav.customize") ? [{ label: t("nav.customize"), href: "/customize", icon: Palette }, enabled("nav.constellations") && { label: t("nav.constellations", undefined, "Constellations"), href: "/constellations", icon: UsersRound }].filter((item): item is DashboardNavItem => Boolean(item)) : [] },
    { label: t("nav.links"), items: enabled("nav.links") ? [{ label: t("nav.links"), href: "/links", icon: Link2 }] : [] },
  ].filter((group) => group.items.length), [enabled, t]);
  const moreItems = useMemo(() => [
    enabled("nav.leaderboard") && { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
    enabled("nav.premium") && { label: t("nav.premium"), href: "/premium", icon: Sparkles },
    enabled("nav.templates") && { label: t("nav.templates"), href: "/templates", icon: BookOpen },
  ].filter((item): item is DashboardNavItem => Boolean(item)), [enabled, t]);
  const searchable = useMemo(() => {
    const items = [
      ...groups.flatMap((group) => group.items),
      ...moreItems,
      { label: t("nav.help"), href: "/help", icon: CircleHelp },
    ];
    if (user?.isAdmin || user?.isStaff) items.push({ label: t("nav.admin"), href: "/admin", icon: ShieldCheck });
    const needle = query.trim().toLowerCase();
    return needle ? items.filter((item) => item.label.toLowerCase().includes(needle)) : items;
  }, [groups, moreItems, query, t, user?.isAdmin, user?.isStaff]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[76px] items-center justify-between px-5">
        <Link href="/" onClick={close} className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#c5b8ff] via-[#e11d48] to-[#881337] text-sm font-bold text-white shadow-[0_0_25px_rgba(155,135,245,.28)]">M</span>
          <span className="text-[15px] font-semibold tracking-[-.02em]">Misa<span className="text-[#fb7185]">.lol</span></span>
        </Link>
        <button type="button" className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[.06] hover:text-white md:hidden" onClick={close} aria-label={t("nav.close")}><X size={18} /></button>
      </div>
      <div className="relative px-4">
        <label className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-white/[.06] bg-white/[.025] px-3 text-start text-xs text-zinc-500 transition focus-within:border-white/[.16] focus-within:text-zinc-300">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchable[0]) {
                router.push(searchable[0].href);
                setQuery("");
                setSearchOpen(false);
                close();
              }
            }}
            placeholder={t("nav.search")}
            className="h-full w-full bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-500"
          />
        </label>
        {searchOpen && query.trim() && (
          <div className="absolute inset-x-4 top-12 z-20 overflow-hidden rounded-xl border border-white/[.08] bg-[#0d0d14] py-1 shadow-xl">
            {searchable.length === 0 ? <p className="px-3 py-2 text-xs text-zinc-600">{t("nav.searchEmpty")}</p> : searchable.map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href} onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(""); setSearchOpen(false); close(); }} className="flex h-9 items-center gap-2.5 px-3 text-xs text-zinc-400 hover:bg-white/[.05] hover:text-white">
                <Icon size={14} />{label}
              </Link>
            ))}
          </div>
        )}
      </div>
      <nav className="mt-8 flex-1 space-y-7 overflow-y-auto px-3 pb-5">
        {groups.map((group) => (
          <div key={group.label}>
            <button type="button" onClick={() => group.label === t("nav.account") && setAccountOpen((open) => !open)} className="mb-2 flex w-full items-center justify-between px-3 text-start text-[10px] font-semibold uppercase tracking-[.2em] text-zinc-600">
              {group.label}
              {group.label === t("nav.account") && <ChevronRight size={13} className={`transition-transform ${accountOpen ? "rotate-90" : ""}`} />}
            </button>
            <div className={`space-y-1 ${group.label === t("nav.account") && !accountOpen ? "hidden" : ""}`}>
              {group.items.map((item) => <NavLink key={item.href} {...item} close={close} />)}
            </div>
          </div>
        ))}
        {(user?.isAdmin || user?.isStaff) && <NavLink href="/admin" label={t("nav.admin")} icon={ShieldCheck} close={close} />}
        <div>
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.2em] text-zinc-600">{t("nav.more")}</div>
          <div className="space-y-1">{moreItems.map((item) => <NavLink key={item.href} {...item} close={close} />)}</div>
        </div>
      </nav>
      <div className="space-y-1 border-t border-white/[.06] p-3">
        <LanguageSelect compact />
        <NavLink href="/help" label={t("nav.help")} icon={CircleHelp} close={close} />
        <a href={`${publicOrigin}/${config.profile.username}`} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-3 rounded-lg px-3 text-xs text-zinc-500 hover:bg-white/[.05] hover:text-zinc-200"><Share2 size={15} />{t("nav.share")}</a>
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.025] p-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#5d4ea4] to-[#241d45] text-xs font-semibold">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-200">@{config.profile.username}</p>
            <div className="flex items-center gap-1">
              <p className="font-mono text-[10px] text-zinc-600">{user?.accountId || "Generating..."}</p>
              {user?.accountId && <button type="button" aria-label="Copy Account ID" title="Copy Account ID" onClick={() => void copyAccountId()} className="rounded p-0.5 text-zinc-600 hover:bg-white/[.06] hover:text-white">{copiedAccountId ? <Check size={11} /> : <Copy size={11} />}</button>}
            </div>
          </div>
          <button type="button" aria-label={t("nav.logout")} title={t("nav.logout")} onClick={() => void logout()} className="rounded-lg p-1.5 text-zinc-600 hover:bg-white/[.06] hover:text-white"><LogOut size={15} /></button>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isReady } = useAuth();
  const { dir, locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const isPublicProfile = pathname.startsWith("/p/");
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  useEffect(() => {
    if (!isPublicProfile && !isAdminRoute && isReady && !user) {
      window.location.replace(`${process.env.NEXT_PUBLIC_AUTH_ORIGIN || "http://127.0.0.1:8000"}/login`);
    }
  }, [isAdminRoute, isPublicProfile, isReady, user]);
  useEffect(() => { setOpen(false); }, [pathname]);
  if (isPublicProfile || isAdminRoute) return <>{children}</>;
  if (!isReady || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070a] text-sm text-zinc-500">
        {isReady ? t("nav.redirecting") : t("nav.loading")}
      </div>
    );
  }
  if (!user.username) return <UsernameClaimGate />;
  return (
    <div className="app-shell min-h-screen" dir={dir} lang={locale}>
      <aside className="sidebar-glass fixed inset-y-0 start-0 z-50 hidden w-[248px] border-e md:block"><SidebarContent close={() => undefined} /></aside>
      {open && (
        <>
          <button type="button" className="animate-fade-in fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} aria-label={t("nav.close")} />
          <aside className="sidebar-glass animate-slide-in fixed inset-y-0 start-0 z-50 w-[272px] border-e md:hidden"><SidebarContent close={() => setOpen(false)} /></aside>
        </>
      )}
      <div className="md:ps-[248px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center border-b border-white/[.06] bg-[#07070a]/70 px-4 backdrop-blur-xl sm:px-8 md:hidden">
          <button type="button" onClick={() => setOpen(true)} className="rounded-[11px] border border-[#e11d48]/30 bg-[#e11d48]/10 p-2 text-[#fecdd3] hover:bg-[#e11d48]/20" aria-label={t("nav.open")}><Menu size={19} /></button>
          <div className="ms-3 flex items-center gap-2 text-sm font-semibold">Misa<span className="text-[#fb7185]">.lol</span></div>
        </header>
        {children}
      </div>
    </div>
  );
}
