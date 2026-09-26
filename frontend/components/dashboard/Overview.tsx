"use client";

import { AtSign, BadgeCheck, Check, ChevronRight, CircleUserRound, Cloud, Copy, Eye, Globe2, Pencil, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { useDiscordLive } from "@/lib/discord-live";
import { useFeatureFlags } from "@/lib/feature-flags";
import { useI18n } from "@/lib/i18n";
import { useProfile } from "@/lib/profile-store";
import { copyText, publicProfileUrl } from "@/lib/share";
import { LiveProfilePreview } from "@/components/profile/LiveProfilePreview";
import { ShareCard } from "@/components/sharing/ShareCard";
import { Button, MiniBar, PageHeader, SectionTitle, StatusDot } from "@/components/ui";
import type { LayoutViewport } from "@/lib/element-layout";

function oauthErrorMessage(code: string | null) {
  if (!code) return "";
  if (code === "google_not_configured") return "Google connection is not configured on the server.";
  if (code === "discord_not_configured") return "Discord connection is not configured on the server.";
  if (code === "already_linked") return "That provider account is already linked to another Misa account.";
  if (code === "email_taken" || code === "account_exists") return "That provider email belongs to another Misa account.";
  if (code === "not_authenticated") return "Your session expired. Sign in again before connecting an account.";
  if (code === "oauth_denied") return "The provider connection was cancelled.";
  return "The provider connection failed. Verify the provider credentials and callback URL.";
}

function ProviderIcon({ provider }: { provider: "google" | "discord" }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-white/[.07] bg-white/[.03]">
      {provider === "discord" ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="text-[#5865f2]">
          <path fill="currentColor" d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286ZM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189Zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 48 48" width="17" height="17" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19Z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
        </svg>
      )}
    </span>
  );
}

export function Overview() {
  const { config, savedConfig, profileReady } = useProfile();
  const { user } = useAuth();
  const { t } = useI18n();
  const { profile, assets, socials } = config;
  const username = user?.username || profile.username;
  const publicUrl = publicProfileUrl(username);
  const [copiedAccountId, setCopiedAccountId] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<LayoutViewport>("desktop");
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setPreviewViewport(query.matches ? "mobile" : "desktop");
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const tasks = [
    [t("overview.taskAvatar"), "/customize", Boolean(assets.avatar.url)],
    [t("overview.taskDescription"), "/customize", Boolean(profile.description.trim())],
    [t("overview.taskSocials"), "/links", socials.some((social) => social.enabled)],
    [t("overview.taskBackground"), "/customize", Boolean(assets.background.url || assets.backgroundVideo.url)],
    [t("overview.taskMusic"), "/customize", Boolean(assets.audio.url)],
  ] as const;
  const completedTasks = tasks.filter(([, , done]) => done).length;
  const completionPercent = Math.round((completedTasks / tasks.length) * 100);
  const providers = user?.providers;
  const connectedCount = [providers?.discord, providers?.google, providers?.telegram].filter(Boolean).length;
  const stats = [
    { label: t("overview.views"), value: String(profile.views), icon: Eye, hint: t("overview.viewsHint") },
    { label: t("overview.connections"), value: String(connectedCount), icon: Cloud, hint: t("overview.connectionsDesc") },
    { label: t("overview.completion"), value: `${completionPercent}%`, icon: Sparkles, hint: `${completedTasks} / ${tasks.length} ${t("overview.completionHint")}` },
  ];
  const displayName = savedConfig.profile.displayName.trim() || t("common.member", undefined, "Member");
  const avatar = savedConfig.assets.avatar.url;
  const copyAccountId = async () => {
    if (!user?.accountId) return;
    const copied = await copyText(user.accountId);
    setCopiedAccountId(copied);
    window.setTimeout(() => setCopiedAccountId(false), 1600);
  };

  return <main className="dashboard-page min-h-screen py-8 sm:py-10">
    <PageHeader eyebrow={t("overview.eyebrow")} title={t("overview.title")} description={t("overview.description")} action={<a href={publicUrl} target="_blank" rel="noreferrer"><Button variant="subtle"><Globe2 size={15} />{t("common.viewLive")}</Button></a>} />
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.28fr)_minmax(340px,.72fr)]">
      <div className="min-w-0 space-y-5">
        <section aria-label={t("overview.title")} className="surface overview-account-card flex min-w-0 flex-wrap items-center gap-4 rounded-panel p-4 sm:p-5">
          <div className="overview-avatar h-[60px] w-[60px] shrink-0 overflow-hidden rounded-full border border-white/[.08]">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-[#a1a1aa]">{displayName.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-semibold tracking-[-.03em] text-[#f4f4f5]">{displayName}</p>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-xs text-[#71717a] transition-colors duration-150 hover:text-[#ff6b8a]">misa.lol/{username}</a>
            <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-[#52525b]"><AtSign size={12} className="shrink-0" /><span className="truncate">@{username}</span>{user?.accountId && <><span aria-hidden="true">·</span><span className="shrink-0">ID</span><span className="truncate font-mono">{user.accountId}</span><button type="button" onClick={() => void copyAccountId()} aria-label={t("overview.accountIdHint", undefined, "Copy account ID")} title={t("overview.accountIdHint", undefined, "Copy account ID")} className="shrink-0 rounded p-1 text-[#52525b] transition-colors duration-150 hover:bg-white/[.06] hover:text-[#f4f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45">{copiedAccountId ? <Check size={12} /> : <Copy size={12} />}</button></>}</div>
          </div>
          <Link href="/customize"><Button variant="subtle" className="h-9 min-h-0 px-3 text-xs"><Pencil size={13} />{t("nav.customize")}</Button></Link>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">{stats.map(({ label, value, icon: Icon, hint }, index) => <div key={label} className="surface surface-subtle surface-hover animate-fade-up rounded-card p-4" style={{ animationDelay: `${index * 45}ms` }}><div className="mb-3.5 flex items-center justify-between gap-2"><span className="text-[13px] text-[#71717a]">{label}</span><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-white/[.07] bg-white/[.03] text-[#a1a1aa]"><Icon size={14} strokeWidth={1.9} /></span></div><div className="text-[26px] font-semibold leading-none tracking-[-.03em] text-[#f4f4f5]">{value}</div><div className="mt-2 truncate text-xs text-[#52525b]">{hint}</div></div>)}</div>

        <section>
          <SectionTitle icon={Sparkles} title={t("overview.statsTitle")} description={t("overview.statsDesc")} action={<span className="font-mono text-sm tabular-nums text-[#ff6b8a]">{completionPercent}%</span>} />
          <div className="surface rounded-panel p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-[#f4f4f5]">{t("overview.completion")}</p><p className="mt-1 text-[13px] text-[#71717a]">{t("overview.completionHint")}</p></div><span className="rounded-full border border-white/[.07] bg-white/[.03] px-2.5 py-1 font-mono text-xs tabular-nums text-[#a1a1aa]">{completedTasks} / {tasks.length}</span></div>
            <MiniBar value={completionPercent} color="#f00646" />
            <div className="mt-4 grid gap-1 sm:grid-cols-2">{tasks.map(([task, href, done]) => <Link key={task} href={href} className="flex min-w-0 items-center gap-3 rounded-[10px] px-2 py-2.5 text-sm transition-colors duration-150 hover:bg-white/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border ${done ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-400" : "border-white/[.07] bg-white/[.02] text-[#52525b]"}`}>{done ? <Check size={13} /> : <CircleUserRound size={13} />}</span><span className={`min-w-0 flex-1 truncate text-[13px] ${done ? "text-[#a1a1aa]" : "text-[#71717a]"}`}>{task}</span>{!done && <span className="text-[10px] text-[#52525b]">{t("common.open")}</span>}</Link>)}</div>
          </div>
        </section>

        <ConnectionsCard />

        <section>
          <SectionTitle icon={UsersRound} title={t("overview.manageTitle")} description={t("overview.manageDesc")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface flex min-w-0 items-center gap-4 rounded-card p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-white/[.07] bg-white/[.03] text-[#71717a]"><AtSign size={16} strokeWidth={1.8} /></span><span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-[#f4f4f5]">{t("overview.permanentUsername")}</span><span className="mt-1 block truncate text-xs text-[#52525b]">{t("overview.cannotChange", { username })}</span></span></div>
            {[{ title: t("overview.changeDisplay"), desc: t("overview.changeDisplayDesc"), icon: Pencil, href: "/settings" }, { title: t("overview.manageAliases"), desc: t("overview.manageAliasesDesc"), icon: UsersRound, href: "/settings#aliases" }, { title: t("overview.accountSettings"), desc: t("overview.accountSettingsDesc"), icon: ShieldCheck, href: "/settings" }].map(({ title, desc, icon: Icon, href }) => <Link href={href} key={title} className="surface surface-hover flex min-w-0 items-center gap-4 rounded-card p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-white/[.07] bg-white/[.03] text-[#71717a]"><Icon size={16} strokeWidth={1.8} /></span><span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-[#f4f4f5]">{title}</span><span className="mt-1 block truncate text-xs text-[#52525b]">{desc}</span></span><ChevronRight size={15} className="shrink-0 text-[#52525b] transition-colors duration-150 group-hover:text-[#a1a1aa]" /></Link>)}
          </div>
        </section>
      </div>

      <aside className="min-w-0 space-y-5 xl:sticky xl:top-8">
        <section className="surface min-w-0 overflow-hidden rounded-panel p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-1"><h2 className="text-sm font-medium text-[#f4f4f5]">{t("overview.profilePreview", undefined, "Your profile")}</h2><a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[#71717a] transition-colors duration-150 hover:text-[#f4f4f5]"><Eye size={13} />{t("common.viewLive")}</a></div>
          <div className="overflow-hidden rounded-card border border-white/[.07] bg-[#0b0b0e]"><div className="flex h-7 items-center gap-1.5 border-b border-white/[.06] bg-white/[.02] px-3"><span className="h-1.5 w-1.5 rounded-full bg-white/[.12]" /><span className="h-1.5 w-1.5 rounded-full bg-white/[.12]" /><span className="h-1.5 w-1.5 rounded-full bg-white/[.12]" /><span className="ms-2 truncate font-mono text-[9px] text-[#52525b]">misa.lol/{username}</span></div><div className="h-[520px] overflow-auto sm:h-[620px]" dir="ltr">{profileReady ? <LiveProfilePreview config={savedConfig} layoutViewport={previewViewport} className="h-full" /> : <div aria-busy="true" className="h-full animate-pulse bg-white/[.02]" />}</div></div>
          <Link href="/customize" className="mt-3 flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[#f00646] px-3 text-xs font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#ff2d63] active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101014]">{t("customize.title")}<ChevronRight size={14} /></Link>
        </section>
        <ShareCard username={username} />
        <section className="surface rounded-panel p-5"><div className="mb-4 flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#f00646]/25 bg-[#f00646]/10 text-[#ff6b8a]"><BadgeCheck size={17} strokeWidth={1.9} /></div><h3 className="text-[15px] font-medium tracking-[-.01em] text-[#f4f4f5]">{t("overview.promoTitle")}</h3><p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[#71717a]">{t("overview.promoDesc")}</p><Link href="/customize"><Button variant="subtle" className="mt-5 h-9 min-h-0 px-3 text-xs">{t("overview.promoCta")}<ChevronRight size={14} /></Button></Link></section>
      </aside>
    </div>
  </main>;
}

function ConnectionsCard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const discord = useDiscordLive();
  const { enabled } = useFeatureFlags();
  const [oauthError, setOauthError] = useState("");
  useEffect(() => {
    setOauthError(oauthErrorMessage(new URLSearchParams(window.location.search).get("error")));
  }, []);
  const discordOn = Boolean(user?.providers?.discord);
  const discordSubtitle = !discordOn
    ? t("overview.discordHint")
    : discord?.state?.needsReconnect
      ? t("settings.discordReconnect")
      : discord?.state?.username
        ? t("settings.discordAs", { name: discord.state.username })
        : t("common.connected");
  const connectDiscord = () => window.location.assign("/api/v1/auth/discord?next=/dashboard&mode=link");

  return <section>
    <SectionTitle icon={UsersRound} title={t("overview.connections")} description={t("overview.connectionsDesc")} />
    {oauthError && <p role="alert" className="mb-3 rounded-[10px] border border-red-400/20 bg-red-400/[.06] px-3 py-2.5 text-xs text-red-300">{oauthError}</p>}
    <div className="surface divide-y divide-white/[.06] rounded-card">
      {enabled("integrations.discord") && <div className="flex min-w-0 items-center gap-3 p-4"><ProviderIcon provider="discord" /><span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-[#f4f4f5]">Discord</span><span className="mt-1 block truncate text-xs text-[#52525b]">{discordSubtitle}</span></span>{discordOn && !discord?.state?.needsReconnect ? <span className="flex items-center gap-1.5 text-xs text-emerald-400"><StatusDot />{t("common.connected")}</span> : <Button variant="subtle" className="h-8 min-h-0 px-3 text-xs" onClick={connectDiscord}>{discordOn ? t("common.reconnect") : t("common.connect")}</Button>}</div>}
      <div className="flex min-w-0 items-center gap-3 p-4"><ProviderIcon provider="google" /><span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-[#f4f4f5]">Google</span><span className="mt-1 block truncate text-xs text-[#52525b]">{user?.providers?.google ? (user.email || t("common.connected")) : t("common.notConnected")}</span></span>{user?.providers?.google ? <span className="flex items-center gap-1.5 text-xs text-emerald-400"><StatusDot />{t("common.connected")}</span> : <Button variant="ghost" className="h-8 min-h-0 px-2.5 text-xs" onClick={() => window.location.assign("/api/v1/auth/google?next=/dashboard&mode=link")}>{t("common.connect")}</Button>}</div>
    </div>
  </section>;
}
