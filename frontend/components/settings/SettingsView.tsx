"use client";

import { AlertTriangle, AtSign, Check, ChevronRight, Globe2, KeyRound, Languages, LockKeyhole, Mail, Shield, Smartphone, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { useProfile } from "@/lib/profile-store";
import { LOCALE_LABELS, SUPPORTED_LOCALES, TranslatedTree, useI18n } from "@/lib/i18n";
import { Button, FieldLabel, PageHeader, SectionTitle, StatusDot, TextInput, Toggle } from "@/components/ui";

type SecurityState = { password_enabled: boolean; mfa_enabled: boolean };
type UserSession = { id: string; ip?: string; user_agent?: string; created_at?: string; current?: boolean; remember?: boolean };

async function settingsApi(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({})) as { detail?: string; error?: string };
  if (!response.ok) throw new Error(body.detail || body.error || "The request failed.");
  return body as Record<string, unknown>;
}

export function SettingsView() {
  const { user } = useAuth();
  const { config, updateConfig, saveProfile, saveState } = useProfile();
  const { locale, setLocale } = useI18n();
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState(config.profile.displayName);
  const language = locale;
  const [security, setSecurity] = useState<SecurityState>({ password_enabled: false, mfa_enabled: false });
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaUri, setMfaUri] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [showSessions, setShowSessions] = useState(false);

  useEffect(() => { setDisplayName(config.profile.displayName); }, [config.profile.displayName]);
  useEffect(() => { void Promise.all([settingsApi("/me/security"), settingsApi("/me/sessions")]).then(([status, result]) => { setSecurity(status as unknown as SecurityState); setSessions((result.sessions || []) as UserSession[]); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load account security.")); }, []);

  const save = async () => {
    setError("");
    const next = { ...config, profile: { ...config.profile, displayName: displayName.trim() || config.profile.displayName }, settings: { ...config.settings, language } };
    updateConfig(() => next);
    await saveProfile(next);
    if (saveState !== "error") { setSaved(true); window.setTimeout(() => setSaved(false), 1800); }
  };

  const connect = (provider: "google" | "discord") => { window.location.assign(`/api/v1/auth/${provider}?next=${encodeURIComponent("/dashboard/settings")}&mode=link`); };

  const changePassword = async () => {
    setError(""); setMessage("");
    try { await settingsApi("/me/password", { method: "PATCH", body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }) }); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setShowPassword(false); setSecurity((value) => ({ ...value, password_enabled: true })); setMessage("Password updated successfully."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update your password."); }
  };

  const toggleMfa = async (enabled: boolean) => {
    setError(""); setMessage("");
    try {
      if (!enabled) {
        const code = window.prompt("Enter the current six-digit authenticator code to disable MFA.") || "";
        await settingsApi("/me/mfa/disable", { method: "POST", body: JSON.stringify({ code }) });
        setSecurity((value) => ({ ...value, mfa_enabled: false })); setMessage("Multi-factor authentication disabled."); return;
      }
      const setup = await settingsApi("/me/mfa/setup", { method: "POST" });
      setMfaSecret(String(setup.secret || "")); setMfaUri(String(setup.otpauth_url || ""));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update MFA."); }
  };

  const confirmMfa = async () => {
    setError("");
    try { await settingsApi("/me/mfa/verify", { method: "POST", body: JSON.stringify({ code: mfaCode }) }); setMfaSecret(""); setMfaUri(""); setMfaCode(""); setSecurity((value) => ({ ...value, mfa_enabled: true })); setMessage("Multi-factor authentication enabled."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid authenticator code."); }
  };

  const loadSessions = async () => { try { const result = await settingsApi("/me/sessions"); setSessions((result.sessions || []) as UserSession[]); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load active sessions."); } };
  const revokeSession = async (id: string) => { try { await settingsApi(`/me/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }); await loadSessions(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not revoke the session."); } };

  const deleteAccount = async () => {
    const confirmation = window.prompt(`Type ${user?.email || "your account email"} to permanently delete your account.`);
    if (confirmation === null) return;
    const password = security.password_enabled ? window.prompt("Enter your current password.") || "" : "";
    setError("");
    try { await settingsApi("/me/delete", { method: "POST", body: JSON.stringify({ confirmation, password }) }); window.location.assign("/"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete your account."); }
  };

  return <TranslatedTree><main className="mx-auto min-h-screen max-w-[1050px] px-5 py-8 sm:px-8 sm:py-11 xl:px-12">
    <PageHeader eyebrow="Account" title="Settings" description="Your account, your preferences, your control." action={<Button variant="accent" onClick={() => void save()} disabled={saveState === "saving"}>{saved ? <><Check size={15} />Saved</> : saveState === "saving" ? "Saving…" : "Save changes"}</Button>} />
    {(message || error) && <p role="alert" className={`mb-6 rounded-xl border px-3 py-2.5 text-xs ${error ? "border-red-400/20 bg-red-400/[.06] text-red-200" : "border-emerald-400/20 bg-emerald-400/[.06] text-emerald-300"}`}>{error || message}</p>}
    <div className="space-y-8">
      <section><SectionTitle icon={UserRound} title="General information" description="How your account appears across Misa.lol." /><div className="surface grid gap-5 rounded-2xl p-5 sm:grid-cols-2 sm:p-6"><div><FieldLabel>Username · permanent</FieldLabel><div className="flex min-h-11 items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.025] px-3.5"><AtSign size={15} className="text-zinc-600" /><div><p className="text-sm text-zinc-200">{config.profile.username}</p><p className="text-[11px] text-zinc-600">This public identifier cannot be changed.</p></div></div></div><div><FieldLabel>Display name</FieldLabel><TextInput value={displayName} onChange={setDisplayName} /></div><div><FieldLabel>Primary email</FieldLabel><div className="relative"><Mail size={15} className="absolute left-3 top-3.5 text-zinc-600" /><TextInput value={user?.email || ""} onChange={() => undefined} className="pl-9" disabled /></div></div><div><FieldLabel>Language</FieldLabel><div className="relative"><Languages size={15} className="pointer-events-none absolute left-3 top-3.5 text-zinc-600" /><select value={language} onChange={(event) => setLocale(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-white/[.08] bg-black/20 px-10 text-sm text-zinc-300 outline-none focus:border-[#9b87f5]/60">{SUPPORTED_LOCALES.map((code) => <option key={code} value={code}>{LOCALE_LABELS[code]}</option>)}</select><ChevronRight size={14} className="pointer-events-none absolute right-3 top-3.5 rotate-90 text-zinc-700" /></div></div></div></section>
      <section><SectionTitle icon={Shield} title="Connected accounts" description="Services linked to your account." /><div className="surface divide-y divide-white/[.06] rounded-2xl">{(["discord", "google"] as const).map((provider) => { const connected = Boolean(user?.providers?.[provider]); const label = provider[0].toUpperCase() + provider.slice(1); return <div key={provider} className="flex items-center gap-3 p-4"><span className={`flex h-10 w-10 items-center justify-center rounded-xl font-semibold ${provider === "discord" ? "bg-[#7289da]/10 text-[#8c9cff]" : "bg-[#df9a73]/10 text-[#f1ad86]"}`}>{provider === "discord" ? "D" : "G"}</span><div className="flex-1"><p className="text-sm text-zinc-200">{label}</p><p className="mt-1 text-xs text-zinc-600">{connected ? user?.email || "Connected" : "Not connected"}</p></div>{connected ? <span className="flex items-center gap-1.5 text-xs text-emerald-400"><StatusDot />Connected</span> : <Button variant="subtle" className="h-8 min-h-0 px-3 text-xs" onClick={() => connect(provider)}>Connect</Button>}</div>; })}</div></section>
      <section><SectionTitle icon={LockKeyhole} title="Security" description="Keep your account protected." /><div className="surface divide-y divide-white/[.06] rounded-2xl"><div className="p-4"><button type="button" onClick={() => setShowPassword((value) => !value)} className="flex w-full items-center gap-3 text-left"><KeyRound size={17} className="text-zinc-500" /><span className="flex-1"><span className="block text-sm text-zinc-300">Change password</span><span className="mt-1 block text-xs text-zinc-600">{security.password_enabled ? "Update the password used for email sign-in." : "Set a password for email sign-in."}</span></span><ChevronRight size={16} className={`text-zinc-700 transition ${showPassword ? "rotate-90" : ""}`} /></button>{showPassword && <div className="mt-4 grid gap-2 sm:grid-cols-3"><TextInput type="password" value={currentPassword} onChange={setCurrentPassword} placeholder={security.password_enabled ? "Current password" : "Current password (optional)"} /><TextInput type="password" value={newPassword} onChange={setNewPassword} placeholder="New password" /><TextInput type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password" /><Button variant="accent" disabled={newPassword.length < 8 || !confirmPassword} onClick={() => void changePassword()}>Update</Button></div>}</div><div className="p-4"><div className="flex items-center gap-3"><Smartphone size={17} className="text-zinc-500" /><span className="flex-1"><span className="block text-sm text-zinc-300">Multi-factor authentication</span><span className="mt-1 block text-xs text-zinc-600">{security.mfa_enabled ? "Authenticator app protection is enabled." : "Add another layer of protection."}</span></span><Toggle label="Enable multi-factor authentication" checked={security.mfa_enabled} onChange={(value) => void toggleMfa(value)} /></div>{mfaSecret && <div className="mt-4 space-y-2 rounded-xl border border-[#9b87f5]/20 bg-[#9b87f5]/[.05] p-3 text-xs"><p className="text-zinc-300">Add this account to your authenticator app, then enter the generated code.</p><p className="break-all font-mono text-[#c1b8ff]">{mfaSecret}</p>{mfaUri && <a href={mfaUri} className="block break-all text-[#b8acff] underline">Open authenticator setup</a>}<div className="flex gap-2"><TextInput value={mfaCode} onChange={setMfaCode} placeholder="Six-digit code" /><Button variant="accent" disabled={mfaCode.length !== 6} onClick={() => void confirmMfa()}>Verify</Button></div></div>}</div><div className="p-4"><button type="button" onClick={() => { setShowSessions((value) => !value); if (!showSessions) void loadSessions(); }} className="flex w-full items-center gap-3 text-left"><Globe2 size={17} className="text-zinc-500" /><span className="flex-1"><span className="block text-sm text-zinc-300">Active sessions</span><span className="mt-1 block text-xs text-zinc-600">{sessions.length} active session{sessions.length === 1 ? "" : "s"}</span></span><ChevronRight size={16} className={`text-zinc-700 transition ${showSessions ? "rotate-90" : ""}`} /></button>{showSessions && <div className="mt-4 space-y-2">{sessions.map((session) => <div key={session.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[.06] p-3 text-xs"><div className="min-w-0 flex-1"><p className="text-zinc-300">{session.current ? "This device" : session.user_agent || "Unknown device"}</p><p className="mt-1 text-zinc-600">{session.ip || "unknown IP"} · {session.created_at ? new Date(session.created_at).toLocaleString() : "Unknown time"}</p></div>{session.current ? <span className="text-emerald-400">Current</span> : <Button variant="ghost" className="h-8 min-h-0 px-2 text-xs text-red-300" onClick={() => void revokeSession(session.id)}>Revoke</Button>}</div>)}{!sessions.length && <p className="text-xs text-zinc-600">No active sessions found.</p>}</div>}</div></div></section>
      <section><SectionTitle icon={AlertTriangle} title="Danger zone" description="Irreversible account actions." /><div className="rounded-2xl border border-red-400/15 bg-red-400/[.025] p-4 sm:flex sm:items-center sm:gap-4"><div className="flex flex-1 items-start gap-3"><Trash2 size={17} className="mt-0.5 text-red-300" /><div><p className="text-sm text-zinc-300">Delete your account</p><p className="mt-1 text-xs leading-5 text-zinc-600">Permanently remove your account, profile, and connected data.</p></div></div><Button variant="ghost" onClick={() => void deleteAccount()} className="mt-4 border border-red-300/15 text-red-300 hover:bg-red-300/10 sm:mt-0">Delete account</Button></div></section>
    </div>
  </main></TranslatedTree>;
}
