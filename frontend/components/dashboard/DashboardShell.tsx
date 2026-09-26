"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, BadgeCheck, BookOpen, Check, ChevronRight, CircleHelp, Copy, ExternalLink, LayoutDashboard, Link2, LockKeyhole, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Palette, Search, Settings, Share2, ShieldCheck, Sparkles, Trophy, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LanguageSelect } from "@/components/dashboard/LanguageSelect";
import { RuntimeErrorBoundary } from "@/components/dashboard/RuntimeErrorBoundary";
import { ShareCard } from "@/components/sharing/ShareCard";
import { Modal } from "@/components/ui";
import { UsernameClaimGate } from "@/components/onboarding/UsernameClaimGate";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/lib/i18n";
import { useProfile } from "@/lib/profile-store";
import { publicProfileUrl } from "@/lib/share";
import { isPublicProfilePath } from "@/lib/public-profile-path";
import { useFeatureFlags } from "@/lib/feature-flags";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

type DashboardNavItem = { label: string; href: string; icon: typeof LayoutDashboard };

function NavLink({ href, label, icon: Icon, close }: DashboardNavItem & { close: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      prefetch={false}
      data-dashboard-prefetch={href}
      onClick={close}
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-9 items-center gap-2.5 rounded-[10px] pe-3 ps-3 text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45 ${
        active
          ? "bg-[#f00646]/[.09] font-medium text-[#f4f4f5]"
          : "font-normal text-[#a1a1aa] hover:bg-white/[.045] hover:text-[#f4f4f5]"
      }`}
    >
      {active && <span aria-hidden="true" className="absolute inset-y-1.5 start-0 w-[2px] rounded-full bg-[#f00646]" />}
      <Icon size={16} strokeWidth={active ? 2 : 1.75} className={`shrink-0 transition-colors duration-150 ${active ? "text-[#ff6b8a]" : "text-[#71717a] group-hover:text-[#a1a1aa]"}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarContent({ close, onToggleDesktop }: { close: () => void; onToggleDesktop?: () => void }) {
  const { config, savedConfig, profileReady } = useProfile();
  const { logout, user } = useAuth();
  const { t } = useI18n();
  const { enabled } = useFeatureFlags();
  const router = useRouter();
  const pathname = usePathname();
  const premiumView = useSearchParams().get("view") || "general";
  const premiumActive = isActive(pathname, "/premium");
  const [premiumOpen, setPremiumOpen] = useState(premiumActive);
  const myPage = profileReady && user?.username && savedConfig.profile.username === user.username ? publicProfileUrl(user.username) : null;
  const premiumItems = [{ label: "General", view: "general" }, { label: "Layout Settings", view: "layout" }, { label: "Profile Metadata", view: "metadata" }];
  const [accountOpen, setAccountOpen] = useState(true);
  const [customizeOpen, setCustomizeOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [copiedAccountId, setCopiedAccountId] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const initials = config.profile.displayName.trim().slice(0, 1).toUpperCase() || "U";
  const avatarUrl = config.assets.avatar.url;
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
    enabled("nav.templates") && { label: t("nav.templates"), href: "/templates", icon: BookOpen },
    enabled("nav.leaderboard") && { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
    enabled("nav.premium") && { label: t("nav.premium"), href: "/premium", icon: Sparkles },
  ].filter((item): item is DashboardNavItem => Boolean(item)), [enabled, t]);
  const accountGroup = groups.find((group) => group.label === t("nav.account"));
  const customizeGroup = groups.find((group) => group.label === t("nav.customize"));
  const linksGroup = groups.find((group) => group.label === t("nav.links"));
  const accountActive = Boolean(accountGroup?.items.some((item) => isActive(pathname, item.href)));
  const customizeActive = Boolean(customizeGroup?.items.some((item) => isActive(pathname, item.href)));
  useEffect(() => {
    if (premiumActive) setPremiumOpen(true);
    if (accountActive) setAccountOpen(true);
    if (customizeActive) setCustomizeOpen(true);
  }, [accountActive, customizeActive, premiumActive]);
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="relative flex h-16 shrink-0 items-center px-5 pe-16">
        <Link href="/" onClick={close} className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0e] rounded-[10px]">
          <Image src="/dashboard/apple-touch-icon.png" alt="Misa.lol" width={28} height={28} className="h-7 w-7 rounded-[8px] object-cover" />
          <span className="text-[15px] font-semibold tracking-[-.02em] text-[#f4f4f5]">Misa<span className="text-[#ff6b8a]">.lol</span></span>
        </Link>
        <div className="ms-auto flex items-center gap-1">
          {onToggleDesktop && <button type="button" className="sidebar-close hidden md:flex" onClick={onToggleDesktop} aria-label="Close navigation" title="Close navigation"><X size={17} strokeWidth={1.8} /></button>}
        </div>
        <button type="button" className="sidebar-close absolute end-3 top-1/2 -translate-y-1/2 md:hidden" onClick={close} aria-label={t("nav.close")}><X size={18} strokeWidth={1.9} /></button>
      </div>
      <div className="relative px-4">
        <label className="flex h-9 w-full items-center gap-2.5 rounded-[10px] border border-white/[.07] bg-white/[.02] px-3 text-start text-xs text-[#52525b] transition-colors duration-150 focus-within:border-white/[.14] focus-within:bg-white/[.035] focus-within:text-[#a1a1aa]">
          <Search size={14} className="shrink-0" />
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
            className="h-full w-full bg-transparent text-[13px] text-[#f4f4f5] outline-none placeholder:text-[#52525b]"
          />
        </label>
        {searchOpen && query.trim() && (
          <div className="glass-floating absolute inset-x-4 top-[calc(100%+6px)] z-20 overflow-y-auto rounded-[12px] py-1">
            {searchable.length === 0 ? <p className="px-3 py-2 text-xs text-[#52525b]">{t("nav.searchEmpty")}</p> : searchable.map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href} prefetch={false} onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(""); setSearchOpen(false); close(); }} className="flex h-9 items-center gap-2.5 px-3 text-[13px] text-[#a1a1aa] transition-colors duration-150 hover:bg-white/[.05] hover:text-[#f4f4f5]">
                <Icon size={14} className="shrink-0" />{label}
              </Link>
            ))}
          </div>
        )}
      </div>
      <nav className="mt-7 min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-3 pb-5">
        {accountGroup ? (
          <div>
            <button type="button" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen} className={`flex h-7 w-full items-center gap-2 rounded-[8px] px-3 text-start text-[11px] font-medium uppercase tracking-[.09em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45 ${accountActive ? "text-[#a1a1aa]" : "text-[#52525b] hover:text-[#a1a1aa]"}`}>
              <LayoutDashboard size={13} strokeWidth={1.9} className={accountActive ? "text-[#ff6b8a]" : ""} />
              <span className="flex-1">{accountGroup.label}</span>
              <ChevronRight size={13} className={`transition-transform duration-200 ${accountOpen ? "rotate-90" : ""}`} />
            </button>
            {accountOpen ? <div className="mt-1 space-y-0.5">{accountGroup.items.map((item) => <NavLink key={item.href} {...item} close={close} />)}</div> : null}
          </div>
        ) : null}
        {customizeGroup ? (
          <div>
            <button type="button" onClick={() => setCustomizeOpen((open) => !open)} aria-expanded={customizeOpen} className={`flex h-7 w-full items-center gap-2 rounded-[8px] px-3 text-start text-[11px] font-medium uppercase tracking-[.09em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45 ${customizeActive ? "text-[#a1a1aa]" : "text-[#52525b] hover:text-[#a1a1aa]"}`}>
              <Palette size={13} strokeWidth={1.9} className={customizeActive ? "text-[#ff6b8a]" : ""} />
              <span className="flex-1">{customizeGroup.label}</span>
              <ChevronRight size={13} className={`transition-transform duration-200 ${customizeOpen ? "rotate-90" : ""}`} />
            </button>
            {customizeOpen ? <div className="mt-1 space-y-0.5">{customizeGroup.items.map((item) => <NavLink key={item.href} {...item} close={close} />)}</div> : null}
          </div>
        ) : null}
        {linksGroup?.items.map((item) => <NavLink key={item.href} {...item} close={close} />)}
        {(user?.isAdmin || user?.isStaff) ? <NavLink href="/admin" label={t("nav.admin")} icon={ShieldCheck} close={close} /> : null}
        {moreItems.map((item) => item.href !== "/premium" ? <NavLink key={item.href} {...item} close={close} /> : <div key={item.href}>
          <button type="button" onClick={() => { if (!premiumActive) setPremiumOpen(v => !v); else setPremiumOpen(true); }} aria-expanded={premiumOpen || premiumActive} className={`flex h-7 w-full items-center gap-2 rounded-[8px] px-3 text-start text-[11px] font-medium uppercase tracking-[.09em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45 ${premiumActive ? "text-[#a1a1aa]" : "text-[#52525b] hover:text-[#a1a1aa]"}`}><Sparkles size={13} strokeWidth={1.9} className={premiumActive ? "text-[#ff6b8a]" : ""} /><span className="flex-1">{item.label}</span><ChevronRight size={13} className={`transition-transform duration-200 ${premiumOpen || premiumActive ? "rotate-90" : ""}`} /></button>
          {(premiumOpen || premiumActive) && <div className="mt-1 space-y-0.5">{premiumItems.map(child => { const active = premiumActive && (premiumView === child.view || (child.view === "general" && !["layout", "metadata"].includes(premiumView))); return <Link key={child.view} href={`/premium?view=${child.view}`} scroll={false} onClick={close} aria-current={active ? "page" : undefined} className={`flex h-9 items-center gap-2.5 rounded-[10px] pe-3 ps-9 text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45 ${active ? "bg-[#f00646]/[.09] font-medium text-[#f4f4f5]" : "text-[#a1a1aa] hover:bg-white/[.045] hover:text-[#f4f4f5]"}`}>{child.label}</Link>; })}</div>}
        </div>)}
        <div className="pt-1">
          <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[.09em] text-[#52525b]">{t("language.label")}</p>
          <LanguageSelect compact />
        </div>
        <div className="border-t border-white/[.06] pt-3">
          <NavLink href="/help" label={t("nav.help")} icon={CircleHelp} close={close} />
          {myPage ? <a href={myPage} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center gap-2.5 rounded-[10px] pe-3 ps-3 text-[13px] font-medium text-[#ff6b8a] transition-colors duration-150 hover:bg-[#f00646]/[.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45"><ExternalLink size={16} strokeWidth={1.75} className="shrink-0" />{t("nav.myPage", undefined, "My page")}</a> : <Link href="/settings" onClick={close} className="flex h-9 items-center gap-2.5 rounded-[10px] pe-3 ps-3 text-[13px] text-[#52525b] transition-colors duration-150 hover:bg-white/[.045] hover:text-[#a1a1aa]"><ExternalLink size={16} strokeWidth={1.75} className="shrink-0" />Complete your profile</Link>}
          {myPage && <button type="button" onClick={() => { close(); setShareOpen(true); }} className="flex h-9 w-full items-center gap-2.5 rounded-[10px] pe-3 ps-3 text-start text-[13px] font-medium text-[#a1a1aa] transition-colors duration-150 hover:bg-white/[.045] hover:text-[#f4f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45"><Share2 size={16} strokeWidth={1.75} className="shrink-0" />{t("nav.share")}</button>}
        </div>
      </nav>
      {myPage && <Modal open={shareOpen} onClose={() => setShareOpen(false)} title={t("nav.share", undefined, "Share your profile")}><ShareCard username={config.profile.username} /></Modal>}
      <div className="shrink-0 border-t border-white/[.06] p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3 rounded-[12px] border border-white/[.07] bg-white/[.025] p-2">
          {avatarUrl ? <Image src={avatarUrl} alt="" width={32} height={32} unoptimized className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10" /> : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[.07] text-[11px] font-semibold text-[#a1a1aa]">{initials}</div>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[#f4f4f5]">@{config.profile.username}</p>
            <div className="flex items-center gap-1">
              <p className="truncate font-mono text-[10px] text-[#52525b]">{user?.accountId || "Generating..."}</p>
              {user?.accountId && <button type="button" aria-label="Copy Account ID" title="Copy Account ID" onClick={() => void copyAccountId()} className="rounded p-0.5 text-[#52525b] transition-colors duration-150 hover:bg-white/[.06] hover:text-[#f4f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45">{copiedAccountId ? <Check size={11} /> : <Copy size={11} />}</button>}
            </div>
          </div>
          <button type="button" aria-label={t("nav.logout")} title={t("nav.logout")} onClick={() => void logout()} className="rounded-[8px] p-1.5 text-[#71717a] transition-colors duration-150 hover:bg-white/[.06] hover:text-[#f4f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45"><LogOut size={15} strokeWidth={1.8} /></button>
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
  const mobileSidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileSidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const items = [...(mobileSidebar.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input') || [])].filter(el => el.offsetParent !== null);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const resize = () => { if (window.innerWidth >= 768) setOpen(false); };
    document.addEventListener("keydown", key); window.addEventListener("resize", resize);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); window.removeEventListener("resize", resize); previous?.focus(); };
  }, [open]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const localPreview = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_PREVIEW === "true";
  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("misa.dashboard.sidebarCollapsed") === "1");
  }, []);
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    window.localStorage.setItem("misa.dashboard.sidebarCollapsed", next ? "1" : "0");
  };
  const isPublicProfile = pathname.startsWith("/p/") || pathname.startsWith("/c/") || pathname === "/constellations/examples" || isPublicProfilePath(pathname);
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/dashboard/admin" || pathname.startsWith("/dashboard/admin/") || pathname === "/m" || pathname.startsWith("/m/");
  useEffect(() => {
    if (!localPreview && !isPublicProfile && !isAdminRoute && isReady && !user) {
      window.location.replace(`${process.env.NEXT_PUBLIC_AUTH_ORIGIN || "http://127.0.0.1:8000"}/login`);
    }
  }, [isAdminRoute, isPublicProfile, isReady, localPreview, user]);
  useEffect(() => { setOpen(false); }, [pathname]);
  if (isPublicProfile || isAdminRoute) return <>{children}</>;
  if (!localPreview && (!isReady || !user)) {
    return (
      <div className="app-shell min-h-[100svh]" aria-busy="true">
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
          <main className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 sm:py-11 xl:px-10">
            <div className="h-3 w-24 animate-pulse rounded-[5px] bg-white/[.05]" />
            <div className="mt-4 h-8 w-64 animate-pulse rounded-[10px] bg-white/[.07]" />
            <div className="mt-4 h-4 w-full max-w-md animate-pulse rounded-[7px] bg-white/[.035]" />
            <p className="mt-6 text-xs text-[#52525b]">{isReady ? t("nav.redirecting") : t("nav.loading")}</p>
          </main>
        </div>
      </div>
    );
  }

  if (!localPreview && !user?.username) return <UsernameClaimGate />;
  return (
    <div className="app-shell min-h-screen" dir={dir} lang={locale}>
      <aside id="desktop-navigation" inert={sidebarCollapsed} aria-hidden={sidebarCollapsed} className={`sidebar-glass desktop-sidebar fixed inset-y-0 start-0 z-50 hidden w-[240px] border-e md:block ${sidebarCollapsed ? "is-collapsed" : ""}`}><SidebarContent close={() => undefined} onToggleDesktop={toggleSidebar} /></aside>
      <button type="button" className={`sidebar-edge sidebar-glass fixed top-1/2 z-[51] hidden h-10 w-7 -translate-y-1/2 items-center justify-center rounded-[10px] border text-[#71717a] transition-colors duration-150 hover:text-[#f4f4f5] md:flex ${sidebarCollapsed ? "is-collapsed" : ""}`} onClick={toggleSidebar} aria-expanded={!sidebarCollapsed} aria-controls="desktop-navigation" aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}>
        {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>
      {open && (
        <>
          <button type="button" className="animate-fade-in fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} aria-label={t("nav.close")} />
          <aside ref={mobileSidebar} role="dialog" aria-modal="true" aria-label="Navigation" className="sidebar-glass animate-slide-in fixed inset-y-0 start-0 z-50 w-[min(300px,86vw)] border-e md:hidden"><SidebarContent close={() => setOpen(false)} /></aside>
        </>
      )}
      <div inert={open} className={`dashboard-content ${sidebarCollapsed ? "md:ps-10" : "md:ps-[240px]"}`}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[.06] bg-[#08080a]/85 px-4 backdrop-blur-xl sm:px-6 md:hidden"><button type="button" onClick={() => setOpen(true)} className="rounded-[10px] border border-white/[.08] bg-white/[.03] p-2 text-[#a1a1aa] transition-colors duration-150 hover:bg-white/[.06] hover:text-[#f4f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45" aria-label={t("nav.open")}><Menu size={18} strokeWidth={1.9} /></button><div className="flex items-center gap-2 text-sm font-semibold tracking-[-.02em] text-[#f4f4f5]"><Image src="/dashboard/apple-touch-icon.png" alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-[7px] object-cover" />Misa<span className="text-[#ff6b8a]">.lol</span></div>{user?.username && <a href={publicProfileUrl(user.username)} target="_blank" rel="noreferrer" className="ms-auto inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-white/[.08] bg-white/[.03] px-2.5 text-xs font-medium text-[#a1a1aa] transition-colors duration-150 hover:bg-white/[.06] hover:text-[#f4f4f5]">{t("common.viewLive")}<ExternalLink size={12} /></a>}</header>
        <RuntimeErrorBoundary resetKey={pathname}>{children}</RuntimeErrorBoundary>
      </div>
    </div>
  );
}
