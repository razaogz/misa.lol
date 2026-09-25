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
  return <img src={`/icons/${provider}.webp`} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl object-cover" />;
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
    { label: t("overview.views"), value: String(profile.views), icon: Eye, color: "#e2b46d", hint: t("overview.viewsHint") },
    { label: t("overview.connections"), value: String(connectedCount), icon: Cloud, color: "#65c7b9", hint: t("overview.connectionsDesc") },
    { label: t("overview.completion"), value: `${completionPercent}%`, icon: Sparkles, color: "#f05279", hint: `${completedTasks} / ${tasks.length} ${t("overview.completionHint")}` },
  ];
  const displayName = savedConfig.profile.displayName.trim() || t("common.member", undefined, "Member");
  const avatar = savedConfig.assets.avatar.url;
  const copyAccountId = async () => {
    if (!user?.accountId) return;
    const copied = await copyText(user.accountId);
    setCopiedAccountId(copied);
    window.setTimeout(() => setCopiedAccountId(false), 1600);
  };

  return <main className="dashboard-page mx-auto min-h-screen max-w-[1360px] px-5 py-7 sm:px-8 sm:py-9 xl:px-10">
    <PageHeader eyebrow={t("overview.eyebrow")} title={t("overview.title")} description={t("overview.description")} action={<a href={publicUrl} target="_blank" rel="noreferrer"><Button variant="subtle"><Globe2 size={15} />{t("common.viewLive")}</Button></a>} />
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.28fr)_minmax(340px,.72fr)]">
      <div className="min-w-0 space-y-5">
        <section aria-label={t("overview.title")} className="surface overview-account-card flex min-w-0 flex-wrap items-center gap-4 rounded-[18px] p-4 sm:p-5">
          <div className="overview-avatar h-[68px] w-[68px] shrink-0 overflow-hidden rounded-full p-[2px]">
            {avatar ? <img src={avatar} alt="" className="h-full w-full rounded-full object-cover" /> : <span className="flex h-full w-full items-center justify-center rounded-full bg-[#180b10] text-2xl font-semibold text-[#ff6685]">{displayName.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-semibold tracking-[-.035em] text-white">{displayName}</p>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-xs text-zinc-400 hover:text-[#ff7896]">misa.lol/{username}</a>
            <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-500"><AtSign size={12} className="shrink-0" /><span className="truncate">@{username}</span>{user?.accountId && <><span aria-hidden="true">·</span><span className="shrink-0">ID</span><span className="truncate font-mono">{user.accountId}</span><button type="button" onClick={() => void copyAccountId()} aria-label={t("overview.accountIdHint", undefined, "Copy account ID")} title={t("overview.accountIdHint", undefined, "Copy account ID")} className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-white/[.06] hover:text-white">{copiedAccountId ? <Check size={12} /> : <Copy size={12} />}</button></>}</div>
          </div>
          <Link href="/customize"><Button variant="subtle" className="h-9 min-h-0 px-3 text-xs"><Pencil size={13} />{t("nav.customize")}</Button></Link>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">{stats.map(({ label, value, icon: Icon, color, hint }, index) => <div key={label} className="surface surface-subtle surface-hover animate-fade-up rounded-[16px] p-4" style={{ animationDelay: `${index * 45}ms` }}><div className="mb-4 flex items-center justify-between gap-2"><span className="text-xs font-medium text-zinc-500">{label}</span><span className="icon-glass flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ color, background: `${color}16` }}><Icon size={16} /></span></div><div className="text-xl font-semibold tracking-[-.03em] text-white">{value}</div><div className="mt-1.5 truncate text-[11px] text-zinc-600">{hint}</div></div>)}</div>

        <section>
          <SectionTitle icon={Sparkles} title={t("overview.statsTitle")} description={t("overview.statsDesc")} action={<span className="text-sm font-medium text-[#ff6685]">{completionPercent}%</span>} />
          <div className="surface rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{t("overview.completion")}</p><p className="mt-1 text-xs text-zinc-500">{t("overview.completionHint")}</p></div><span className="rounded-lg bg-[#f00646]/10 px-2.5 py-1 text-xs font-medium text-[#ff7896]">{completedTasks} / {tasks.length}</span></div>
            <MiniBar value={completionPercent} color="#f00646" />
            <div className="mt-4 grid gap-1 sm:grid-cols-2">{tasks.map(([task, href, done]) => <Link key={task} href={href} className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-2.5 text-sm transition hover:bg-white/[.035]"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${done ? "bg-emerald-400/10 text-emerald-400" : "bg-white/[.06] text-zinc-600"}`}>{done ? <Check size={14} /> : <CircleUserRound size={14} />}</span><span className={`min-w-0 flex-1 truncate ${done ? "text-zinc-300" : "text-zinc-500"}`}>{task}</span>{!done && <span className="text-[10px] text-zinc-600">{t("common.open")}</span>}</Link>)}</div>
          </div>
        </section>

        <ConnectionsCard />

        <section>
          <SectionTitle icon={UsersRound} title={t("overview.manageTitle")} description={t("overview.manageDesc")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface flex min-w-0 items-center gap-4 rounded-2xl p-4"><span className="icon-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-400"><AtSign size={17} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-zinc-200">{t("overview.permanentUsername")}</span><span className="mt-1 block truncate text-xs text-zinc-600">{t("overview.cannotChange", { username })}</span></span></div>
            {[{ title: t("overview.changeDisplay"), desc: t("overview.changeDisplayDesc"), icon: Pencil, href: "/settings" }, { title: t("overview.manageAliases"), desc: t("overview.manageAliasesDesc"), icon: UsersRound, href: "/settings#aliases" }, { title: t("overview.accountSettings"), desc: t("overview.accountSettingsDesc"), icon: ShieldCheck, href: "/settings" }].map(({ title, desc, icon: Icon, href }) => <Link href={href} key={title} className="surface surface-hover flex min-w-0 items-center gap-4 rounded-2xl p-4 text-start"><span className="icon-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-400"><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-zinc-200">{title}</span><span className="mt-1 block truncate text-xs text-zinc-600">{desc}</span></span><ChevronRight size={16} className="shrink-0 text-zinc-700" /></Link>)}
          </div>
        </section>
      </div>

      <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
        <section className="surface min-w-0 overflow-hidden rounded-[18px] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-1"><h2 className="text-sm font-semibold text-white">{t("overview.profilePreview", undefined, "Your profile")}</h2><a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"><Eye size={14} />{t("common.viewLive")}</a></div>
          <div className="overflow-hidden rounded-[14px] border border-white/[.08] bg-[#070609]"><div className="flex h-8 items-center gap-1.5 border-b border-white/[.06] bg-white/[.025] px-3"><span className="h-2 w-2 rounded-full bg-[#fa6678]/70" /><span className="h-2 w-2 rounded-full bg-[#e6ae61]/70" /><span className="h-2 w-2 rounded-full bg-[#78c99b]/70" /><span className="ms-2 truncate font-mono text-[9px] text-zinc-600">misa.lol/{username}</span></div><div className="h-[520px] overflow-auto sm:h-[620px]" dir="ltr">{profileReady ? <LiveProfilePreview config={savedConfig} layoutViewport={previewViewport} className="h-full" /> : <div aria-busy="true" className="h-full animate-pulse bg-white/[.025]" />}</div></div>
          <Link href="/customize" className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl bg-[#f00646] px-3 text-xs font-semibold text-white transition hover:bg-[#ff2d63]">{t("customize.title")}<ChevronRight size={14} /></Link>
        </section>
        <ShareCard username={username} />
        <section className="relative overflow-hidden rounded-2xl border border-[#f00646]/20 bg-gradient-to-br from-[#2a1119] to-[#100c0f] p-5"><div className="absolute -end-8 -top-8 h-32 w-32 rounded-full bg-[#f00646]/20 blur-3xl" /><div className="relative"><div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-[#f00646]/15 text-[#ff7896]"><BadgeCheck size={18} /></div><h3 className="font-medium">{t("overview.promoTitle")}</h3><p className="mt-2 max-w-xs text-xs leading-5 text-zinc-400">{t("overview.promoDesc")}</p><Link href="/customize"><Button variant="accent" className="mt-5 h-9 min-h-0 px-3 text-xs">{t("overview.promoCta")}<ChevronRight size={14} /></Button></Link></div></section>
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
    {oauthError && <p role="alert" className="mb-3 rounded-xl border border-red-400/20 bg-red-400/[.05] px-3 py-2.5 text-xs text-red-200">{oauthError}</p>}
    <div className="surface divide-y divide-white/[.06] rounded-2xl">
      {enabled("integrations.discord") && <div className="flex min-w-0 items-center gap-3 p-4"><ProviderIcon provider="discord" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-zinc-200">Discord</span><span className="mt-1 block truncate text-xs text-zinc-600">{discordSubtitle}</span></span>{discordOn && !discord?.state?.needsReconnect ? <span className="flex items-center gap-1.5 text-xs text-emerald-400"><StatusDot />{t("common.connected")}</span> : <Button variant="subtle" className="h-8 min-h-0 px-3 text-xs" onClick={connectDiscord}>{discordOn ? t("common.reconnect") : t("common.connect")}</Button>}</div>}
      <div className="flex min-w-0 items-center gap-3 p-4"><ProviderIcon provider="google" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-zinc-200">Google</span><span className="mt-1 block truncate text-xs text-zinc-600">{user?.providers?.google ? (user.email || t("common.connected")) : t("common.notConnected")}</span></span>{user?.providers?.google ? <span className="flex items-center gap-1.5 text-xs text-emerald-400"><StatusDot />{t("common.connected")}</span> : <Button variant="ghost" className="h-8 min-h-0 px-2.5 text-xs" onClick={() => window.location.assign("/api/v1/auth/google?next=/dashboard&mode=link")}>{t("common.connect")}</Button>}</div>
    </div>
  </section>;
}
