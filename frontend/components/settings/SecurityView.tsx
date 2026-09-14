"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CircleHelp, Mail, Shield, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountTools } from "@/components/settings/AccountTools";
import { requestEmailChange } from "@/lib/account-security";
import { useAuth } from "@/lib/auth-store";
import { useDiscordLive } from "@/lib/discord-live";
import { useI18n } from "@/lib/i18n";
import { Button, FieldLabel, PageHeader, SectionTitle, StatusDot, TextInput, Toggle } from "@/components/ui";

export function SecurityView() {
  const { user, refresh } = useAuth();
  const { t } = useI18n();
  const discord = useDiscordLive();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(user?.email || "");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [discordMessage, setDiscordMessage] = useState("");
  useEffect(() => { if (user?.email) setEmail(user.email); }, [user?.email]);
  useEffect(() => {
    const result = searchParams.get("email");
    if (result === "confirmed") setEmailMessage(t("settings.emailConfirmed"));
    if (result === "invalid") { setEmailError(true); setEmailMessage(t("settings.emailInvalid")); }
    if (result === "taken") { setEmailError(true); setEmailMessage(t("settings.emailTaken")); }
  }, [searchParams, t]);

  return <main className="mx-auto min-h-screen max-w-[1050px] px-5 py-8 sm:px-8 sm:py-11 xl:px-12">
    <PageHeader eyebrow={t("settings.eyebrow")} title={t("settings.securityTitle", undefined, "Security")} description={t("settings.securityDesc", undefined, "Manage sign-in methods, connected accounts, and account safety.")} action={<Link href="/settings"><Button variant="ghost">{t("settings.generalTitle", undefined, "General settings")}</Button></Link>} />
    <div className="space-y-8">
      <section>
        <SectionTitle icon={Mail} title={t("settings.primaryEmail", undefined, "Email and password")} description={t("settings.emailSecurityDesc", undefined, "Keep your recovery email and sign-in details up to date.")} />
        <div className="surface rounded-2xl p-5 sm:p-6">
          <FieldLabel>{t("settings.primaryEmail")}</FieldLabel>
          <div className="mt-2 relative"><Mail size={15} className="absolute left-3 top-3.5 text-zinc-600" /><TextInput value={email} onChange={setEmail} className="pl-9" autoComplete="email" /></div>
          {user?.hasPassword && <div className="mt-4"><FieldLabel>{t("settings.currentPassword")}</FieldLabel><TextInput type="password" value={emailPassword} onChange={setEmailPassword} autoComplete="current-password" /></div>}
          <div className="mt-4"><Button variant="subtle" disabled={emailBusy} onClick={() => {
            setEmailBusy(true); setEmailError(false);
            void requestEmailChange(email, emailPassword).then((result) => {
              setEmailPassword(""); setEmailMessage(t("settings.emailSent", { email: String(result.pending_email || email) })); void refresh();
            }).catch((error) => { setEmailError(true); setEmailMessage(error instanceof Error ? error.message : t("settings.emailFail")); }).finally(() => setEmailBusy(false));
          }}>{emailBusy ? t("common.sending") : t("settings.sendConfirm")}</Button></div>
          <p className="mt-3 text-xs text-zinc-600">{user?.emailVerified ? t("settings.emailOk") : t("settings.emailPending")}{user?.pendingEmail ? t("settings.emailWaiting", { email: user.pendingEmail }) : ""} <Link href="/help?article=account-email" className="text-[#fda4af] hover:text-white">{t("settings.emailHelp")}</Link></p>
          {emailMessage && <p className={`mt-2 text-xs ${emailError ? "text-red-300" : "text-zinc-500"}`}>{emailMessage}</p>}
        </div>
      </section>
      <section>
        <SectionTitle icon={Shield} title={t("settings.connectedTitle")} description={t("settings.connectedDesc")} />
        <div className="surface divide-y divide-white/[.06] rounded-2xl">
          {(["google", "telegram"] as const).map((provider) => <div key={provider} className="flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e11d48]/10 font-semibold text-[#fda4af]">{provider[0].toUpperCase()}</span><div className="flex-1"><p className="text-sm capitalize text-zinc-200">{provider}</p><p className="mt-1 text-xs text-zinc-600">{user?.providers?.[provider] ? t("common.connected") : t("common.notConnected")}</p></div>{user?.providers?.[provider] ? <span className="flex items-center gap-1.5 text-xs text-emerald-400"><StatusDot />{t("common.connected")}</span> : <Button variant="subtle" className="h-8 min-h-0 px-3 text-xs" onClick={() => window.location.assign(`/api/v1/auth/${provider}`)}>{t("common.connect")}</Button>}</div>)}
          <div className="p-4">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e11d48]/10 font-semibold text-[#fda4af]">d</span><div className="flex-1"><p className="text-sm text-zinc-200">Discord</p><p className="mt-1 text-xs text-zinc-600">{user?.providers?.discord ? (discord?.state?.needsReconnect ? t("settings.discordReconnect") : discord?.state?.username ? t("settings.discordAs", { name: discord.state.username }) : t("common.connected")) : t("common.notConnected")}</p></div>{user?.providers?.discord ? <div className="flex items-center gap-2">{discord?.state?.needsReconnect && <Button variant="subtle" className="h-8 min-h-0 px-3 text-xs" onClick={() => window.location.assign("/api/v1/auth/discord?next=/security")}>{t("common.reconnect")}</Button>}<Button variant="subtle" className="h-8 min-h-0 px-3 text-xs" onClick={() => void discord?.disconnect().then(() => setDiscordMessage(t("settings.discordOff"))).catch((error) => setDiscordMessage(error instanceof Error ? error.message : t("settings.discordFail")))}>{t("common.disconnect")}</Button></div> : <Button variant="subtle" className="h-8 min-h-0 px-3 text-xs" onClick={() => window.location.assign("/api/v1/auth/discord?next=/security")}>{t("common.connect")}</Button>}</div>
            {user?.providers?.discord && discord?.state && !discord.state.needsReconnect && <div className="mt-4 space-y-3 rounded-xl border border-white/[.06] bg-black/20 p-3"><p className="text-[11px] text-zinc-500">{t("settings.discordLive")} <Link href="/help?article=discord-card" className="text-[#fda4af] hover:text-white">{t("settings.discordHelp")}</Link></p>{([["showAvatar", t("settings.discordAvatar")], ["showDecoration", t("settings.discordDecoration")], ["showGuildTag", t("settings.discordTag")]] as const).map(([key, label]) => <div key={key} className="flex items-center justify-between gap-3"><span className="text-sm text-zinc-300">{label}</span><Toggle label={label} checked={Boolean(discord?.state?.prefs?.[key])} onChange={(checked) => void discord?.savePrefs({ [key]: checked }).catch((error) => setDiscordMessage(error instanceof Error ? error.message : t("settings.prefFail")))} /></div>)}</div>}
            {discordMessage && <p className="mt-3 text-xs text-zinc-500">{discordMessage}</p>}
          </div>
        </div>
      </section>
      <AccountTools />
      <section><SectionTitle icon={AlertTriangle} title={t("settings.dangerTitle")} description={t("settings.dangerDesc")} /><div className="rounded-2xl border border-red-400/15 bg-red-400/[.025] p-4"><div className="flex items-start gap-3"><Trash2 size={17} className="mt-0.5 text-red-300" /><div><p className="text-sm text-zinc-300">{t("settings.deleteAccount")}</p><p className="mt-1 text-xs leading-5 text-zinc-600">{t("settings.deleteHint")} <Link href="/help?article=contact-support" className="text-[#fda4af] hover:text-white">{t("settings.contactSupport")}</Link></p></div></div></div></section>
      <p className="text-xs text-zinc-600"><Link href="/help" className="inline-flex items-center gap-1.5 text-[#fda4af] hover:text-white"><CircleHelp size={13} />{t("nav.help")}</Link> {t("settings.footer")}</p>
    </div>
  </main>;
}
