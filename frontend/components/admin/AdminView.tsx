"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Database, Flag, KeyRound, Search, ShieldCheck, ShieldOff, Type, Upload, Users } from "lucide-react";
import { Button, FieldLabel, Modal, PageHeader, SectionTitle, TextInput } from "@/components/ui";
import { BADGE_CATALOG } from "@/lib/badges";
import { useT } from "@/lib/i18n";
import { iconFromFile } from "@/lib/socials";
import { assetFromFile } from "@/lib/profile-store";
import { FONT_ACCEPT } from "@/lib/typography";

type Tab = "users" | "bans" | "reserved" | "banned" | "badges" | "premium" | "reports" | "flags" | "bakaboost" | "themes" | "templates" | "fonts" | "audit" | "staff" | "roles";
type StaffRole = "owner" | "admin" | "moderator";
type AdminSession = { id: string; email: string; name: string; role: string; permissions: Record<string, boolean>; status: string; suspended: boolean };
const SECTION_TABS: Tab[] = ["users", "bans", "reserved", "banned", "badges", "premium", "reports", "flags", "bakaboost", "themes", "templates", "fonts", "audit"];
const tabs: Array<[Tab, string]> = [["users", "Users"], ["bans", "Bans"], ["reserved", "Reserved names"], ["banned", "Banned words"], ["badges", "Badges"], ["premium", "Premium"], ["reports", "Reports"], ["flags", "Feature flags"], ["bakaboost", "BakaBoost"], ["themes", "Themes"], ["templates", "Templates"], ["fonts", "Default fonts"], ["audit", "Audit logs"], ["staff", "Staff"], ["roles", "Roles"]];

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1/admin${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({})) as { detail?: string; error?: string };
  if (!response.ok) throw new Error(body.detail || body.error || "Admin request failed.");
  return body as Record<string, any>;
}

export function AdminView() {
  const t = useT();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [adminReady, setAdminReady] = useState(false);
  const [tab, setTab] = useState<Tab>("users");
  const [role, setRole] = useState<StaffRole | null>(null);
  const [sections, setSections] = useState<Tab[]>(SECTION_TABS);
  const [accessReady, setAccessReady] = useState(false);
  const tabLabel: Record<Tab, string> = { users: t("admin.users"), bans: t("admin.bans"), reserved: t("admin.reserved"), banned: t("admin.banned"), badges: t("admin.badges"), premium: t("admin.premium"), reports: t("admin.reports"), flags: t("admin.flags"), bakaboost: t("admin.bakaboost"), themes: t("admin.themes"), templates: t("admin.templates"), fonts: "Default fonts", audit: t("admin.audit"), staff: t("admin.staff"), roles: t("admin.roles") };
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/admin-auth/session", { credentials: "include", cache: "no-store", headers: { "Cache-Control": "no-store" } })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = await response.json() as { admin?: AdminSession };
        return body.admin || null;
      })
      .then((currentAdmin) => {
        if (cancelled) return;
        if (!currentAdmin) {
          router.replace("/admin/login");
          return;
        }
        setAdmin(currentAdmin);
        setAdminReady(true);
      })
      .catch(() => { if (!cancelled) router.replace("/admin/login"); })
      .finally(() => { if (!cancelled) setAdminReady(true); });
    return () => { cancelled = true; };
  }, [router]);
  useEffect(() => {
    if (!adminReady || !admin) return;
    void api("/access").then((r) => {
      const nextRole = r.role === "owner" || r.role === "admin" || r.role === "moderator" ? r.role : null;
      const nextSections = Array.isArray(r.sections) ? r.sections.filter((item: string): item is Tab => SECTION_TABS.includes(item as Tab)) : SECTION_TABS;
      setRole(nextRole);
      setSections(nextRole === "owner" ? SECTION_TABS : nextSections);
      setAccessReady(true);
    }).catch(() => setAccessReady(true));
  }, [admin, adminReady]);
  const visible = tabs.filter(([id]) => {
    if (id === "roles") return role === "owner";
    if (id === "staff") return role === "owner" || role === "admin";
    return role === "owner" || sections.includes(id);
  });
  useEffect(() => {
    if (!accessReady || !visible.length) return;
    if (!visible.some(([id]) => id === tab)) setTab(visible[0][0]);
  }, [accessReady, tab, visible]);
  if (!adminReady || !admin) return <main className="mx-auto max-w-[1200px] px-5 py-12 text-zinc-500">{t("admin.loading")}</main>;
  return <main className="mx-auto min-h-screen max-w-[1400px] px-5 py-8 sm:px-8 sm:py-11 xl:px-12"><PageHeader eyebrow={t("admin.eyebrow")} title={t("admin.title")} description={t("admin.description")} /><div className="mb-8 flex flex-wrap gap-2">{visible.map(([id]) => <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-xl border px-3 py-2 text-xs ${tab === id ? "border-[#e11d48]/50 bg-[#e11d48]/15 text-white" : "border-white/[.08] text-zinc-500 hover:text-white"}`}>{tabLabel[id]}</button>)}</div>{tab === "users" && <UsersPanel staffRole={role} />}{tab === "bans" && <BansPanel />}{tab === "reserved" && <ReservedPanel />}{tab === "banned" && <BannedPanel />}{tab === "badges" && <BadgesPanel />}{tab === "premium" && <PremiumPanel />}{tab === "reports" && <ReportsPanel />}{tab === "flags" && <FlagsPanel />}{tab === "bakaboost" && <BakaBoostPanel />}{tab === "themes" && <ThemesPanel />}{tab === "templates" && <TemplatesPanel />}{tab === "fonts" && <DefaultFontsPanel />}{tab === "audit" && <AuditPanel />}{tab === "staff" && (role === "owner" || role === "admin") && <StaffPanel staffRole={role} />}{tab === "roles" && role === "owner" && <RolesPanel />}</main>;
}

function UsersPanel({ staffRole }: { staffRole: StaffRole | null }) {
  const t = useT();
  const [search, setSearch] = useState(""); const [items, setItems] = useState<any[]>([]); const [error, setError] = useState("");
  const load = () => void api(`/users?search=${encodeURIComponent(search)}`).then((r) => setItems(r.users || [])).catch((e) => setError(e.message)); useEffect(load, []);
  const suspend = async (item: any) => { const suspended = !item.suspended_at; if (!window.confirm(`${suspended ? "Suspend" : "Unsuspend"} this user?`)) return; try { await api(`/users/${item.id}/suspension`, { method: "PATCH", body: JSON.stringify({ suspended, reason: suspended ? "Administrative action" : null }) }); load(); } catch (e) { setError(e instanceof Error ? e.message : "Update failed."); } };
  const toggleCreator = async (item: any) => { try { await api(`/users/${item.id}/roles`, { method: "PATCH", body: JSON.stringify({ role: "template_creator", granted: !item.is_template_creator }) }); load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update creator role."); } };
  const setStaff = async (item: any, role: "admin" | "moderator", granted: boolean) => { try { await api(`/users/${item.id}/roles`, { method: "PATCH", body: JSON.stringify({ role, granted }) }); load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update role."); } };
  const roleText = (item: any) => item.staff_role === "owner" ? t("admin.owner") : item.staff_role === "admin" ? t("admin.adminRole") : item.staff_role === "moderator" ? t("admin.moderatorRole") : item.is_template_creator || item.is_admin ? (item.is_admin ? "Admin" : "Creator") : "No";
  return <section><SectionTitle icon={Users} title={t("admin.users")} description={t("admin.usersDesc")} /><div className="mb-4 flex gap-2"><div className="relative max-w-lg flex-1"><Search size={15} className="absolute left-3 top-3.5 text-zinc-600" /><TextInput value={search} onChange={setSearch} placeholder={t("admin.searchUsers")} className="pl-9" /></div><Button variant="accent" onClick={load}>{t("common.search")}</Button></div>{error && <p className="mb-3 text-xs text-red-300">{error}</p>}<div className="surface overflow-x-auto rounded-2xl"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-white/[.06] text-zinc-600"><tr><th className="p-4">User</th><th className="p-4">Email</th><th className="p-4">Providers</th><th className="p-4">State</th><th className="p-4">Creator</th><th className="p-4">Action</th></tr></thead><tbody className="divide-y divide-white/[.06]">{items.map((item) => <tr key={item.id}><td className="p-4"><p className="text-zinc-200">@{item.username || "unclaimed"}</p><p className="mt-1 font-mono text-[10px] text-zinc-600">{item.id}</p></td><td className="p-4 text-zinc-400">{item.email || "—"}</td><td className="p-4 text-zinc-500">{Object.entries(item.providers || {}).filter(([, value]) => value).map(([key]) => key).join(", ") || "email"}</td><td className="p-4">{item.suspended_at ? <span className="text-red-300">Suspended</span> : <span className="text-emerald-400">Active</span>}</td><td className="p-4">{item.staff_role || item.is_template_creator || item.is_admin ? <span className="text-[#b6aaff]">{roleText(item)}</span> : <span className="text-zinc-600">No</span>}</td><td className="p-4"><div className="flex flex-wrap gap-2"><Button variant="ghost" className="h-8 min-h-0 px-2 text-xs" onClick={() => void suspend(item)}>{item.suspended_at ? "Unsuspend" : "Suspend"}</Button><Button variant="ghost" className="h-8 min-h-0 px-2 text-xs" onClick={() => void toggleCreator(item)}>{item.is_template_creator ? "Revoke creator" : "Grant creator"}</Button>{staffRole === "owner" && item.staff_role !== "owner" && <Button variant="ghost" className="h-8 min-h-0 px-2 text-xs" onClick={() => void setStaff(item, "admin", item.staff_role !== "admin")}>{item.staff_role === "admin" ? t("admin.revokeAdmin") : t("admin.grantAdmin")}</Button>}{(staffRole === "owner" || staffRole === "admin") && item.staff_role !== "owner" && item.staff_role !== "admin" && <Button variant="ghost" className="h-8 min-h-0 px-2 text-xs" onClick={() => void setStaff(item, "moderator", item.staff_role !== "moderator")}>{item.staff_role === "moderator" ? t("admin.revokeMod") : t("admin.grantMod")}</Button>}</div></td></tr>)}</tbody></table>{!items.length && <p className="p-8 text-center text-xs text-zinc-600">No users found.</p>}</div></section>;
}

function StaffPanel({ staffRole }: { staffRole: StaffRole }) {
  const t = useT();
  const canAdmin = staffRole === "owner";
  const [items, setItems] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"admin" | "moderator">(canAdmin ? "admin" : "moderator");
  const [error, setError] = useState("");
  const load = () => void api("/staff").then((r) => setItems(r.staff || [])).catch((e) => setError(e.message));
  useEffect(load, []);
  const assign = async () => {
    try {
      await api("/staff", { method: "POST", body: JSON.stringify({ username, role, granted: true }) });
      setUsername("");
      setError("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign that role.");
    }
  };
  const remove = async (item: any) => {
    if (!window.confirm(`Remove ${item.staff_role} from @${item.username || item.id}?`)) return;
    try {
      await api(`/staff/${encodeURIComponent(item.username || item.id)}?role=${encodeURIComponent(item.staff_role)}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that role.");
    }
  };
  return (
    <section>
      <SectionTitle icon={ShieldCheck} title={t("admin.staffTitle")} description={t("admin.staffDesc")} />
      <div className="surface mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_auto_auto]">
        <TextInput value={username} onChange={setUsername} placeholder={t("admin.staffUsername")} />
        <select value={role} onChange={(event) => setRole(event.target.value as "admin" | "moderator")} className="h-11 rounded-xl border border-white/[.08] bg-white/[.04] px-3 text-sm text-zinc-200 outline-none">
          {canAdmin && <option value="admin">{t("admin.adminRole")}</option>}
          <option value="moderator">{t("admin.moderatorRole")}</option>
        </select>
        <Button variant="accent" onClick={() => void assign()}>{t("admin.staffAssign")}</Button>
      </div>
      {error && <p className="mb-3 text-xs text-red-300">{error}</p>}
      <div className="surface divide-y divide-white/[.06] rounded-2xl">
        {(staffRole === "admin" ? items.filter((item) => item.staff_role === "moderator") : items).map((item) => (
          <div key={`${item.id}-${item.staff_role}`} className="flex items-center gap-3 p-4">
            <span className="flex-1 text-sm text-zinc-200">
              @{item.username || "unclaimed"}
              <span className="ms-3 text-xs text-[#b6aaff]">{item.staff_role === "admin" ? t("admin.adminRole") : t("admin.moderatorRole")}</span>
            </span>
            <Button variant="ghost" className="h-8 min-h-0 px-2 text-xs text-red-300" onClick={() => void remove(item)}>{t("common.remove")}</Button>
          </div>
        ))}
        {!(staffRole === "admin" ? items.filter((item) => item.staff_role === "moderator") : items).length && <p className="p-8 text-center text-xs text-zinc-600">{t("admin.staffEmpty")}</p>}
      </div>
    </section>
  );
}

function RolesPanel() {
  const t = useT();
  const labels: Record<string, string> = { users: t("admin.users"), bans: t("admin.bans"), reserved: t("admin.reserved"), banned: t("admin.banned"), badges: t("admin.badges"), premium: t("admin.premium"), reports: t("admin.reports"), flags: t("admin.flags"), bakaboost: t("admin.bakaboost"), themes: t("admin.themes"), templates: t("admin.templates"), audit: t("admin.audit") };
  const empty = { admin: Object.fromEntries(SECTION_TABS.map((id) => [id, true])), moderator: Object.fromEntries(SECTION_TABS.map((id) => [id, true])) };
  const [access, setAccess] = useState<Record<string, Record<string, boolean>>>(empty);
  const [error, setError] = useState("");
  const load = () => void api("/access").then((r) => { if (r.access) setAccess({ admin: { ...empty.admin, ...(r.access.admin || {}) }, moderator: { ...empty.moderator, ...(r.access.moderator || {}) } }); }).catch((e) => setError(e.message));
  useEffect(load, []);
  const toggle = async (role: "admin" | "moderator", section: string) => {
    const next = { ...access[role], [section]: !access[role][section] };
    setAccess((current) => ({ ...current, [role]: next }));
    try {
      await api("/access", { method: "PUT", body: JSON.stringify({ role, sections: next }) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update access.");
      load();
    }
  };
  return (
    <section>
      <SectionTitle icon={ShieldCheck} title={t("admin.rolesTitle")} description={t("admin.rolesDesc")} />
      {error && <p className="mb-3 text-xs text-red-300">{error}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        {(["admin", "moderator"] as const).map((role) => (
          <div key={role} className="surface rounded-2xl p-5">
            <h3 className="mb-4 text-sm font-medium text-white">{role === "admin" ? t("admin.rolesAdmin") : t("admin.rolesModerator")}</h3>
            <div className="divide-y divide-white/[.06]">
              {SECTION_TABS.map((section) => (
                <div key={section} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-zinc-300">{labels[section]}</span>
                  <button type="button" onClick={() => void toggle(role, section)} className={`relative h-6 w-11 rounded-full transition ${access[role][section] ? "bg-[#e11d48]" : "bg-white/10"}`} aria-pressed={access[role][section]}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${access[role][section] ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReservedPanel() { const t = useT(); const [items, setItems] = useState<any[]>([]); const [username, setUsername] = useState(""); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const load = () => void api("/reserved-usernames").then((r) => setItems(r.reserved || [])).catch((e) => setError(e.message)); useEffect(load, []); const add = async () => { try { await api("/reserved-usernames", { method: "POST", body: JSON.stringify({ username, reason }) }); setUsername(""); setReason(""); load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not reserve username."); } }; const remove = async (value: string) => { if (!window.confirm(`Remove ${value}?`)) return; try { await api(`/reserved-usernames/${encodeURIComponent(value)}`, { method: "DELETE" }); load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not remove username."); } }; return <section><SectionTitle icon={KeyRound} title={t("admin.reservedTitle")} description={t("admin.reservedDesc")} /><div className="surface mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_1fr_auto]"><TextInput value={username} onChange={setUsername} placeholder="username" /><TextInput value={reason} onChange={setReason} placeholder="Reason" /><Button variant="accent" onClick={() => void add()}>Reserve</Button></div>{error && <p className="mb-3 text-xs text-red-300">{error}</p>}<div className="surface divide-y divide-white/[.06] rounded-2xl">{items.map((item) => <div key={item.username} className="flex items-center gap-3 p-4"><span className="flex-1 text-sm text-zinc-200">@{item.username}<span className="ml-3 text-xs text-zinc-600">{item.reason || "No reason"}</span></span><Button variant="ghost" className="h-8 min-h-0 px-2 text-xs text-red-300" onClick={() => void remove(item.username)}>Remove</Button></div>)}</div></section>; }

function BansPanel() {
  const t = useT();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [ips, setIps] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [accountReason, setAccountReason] = useState("");
  const [ip, setIp] = useState("");
  const [ipReason, setIpReason] = useState("");
  const [error, setError] = useState("");
  const load = () => void api("/bans").then((r) => { setAccounts(r.accounts || []); setIps(r.ips || []); }).catch((e) => setError(e.message));
  useEffect(load, []);
  const banAccount = async () => {
    try {
      await api("/bans/accounts", { method: "POST", body: JSON.stringify({ username, reason: accountReason }) });
      setUsername("");
      setAccountReason("");
      setError("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not ban that account.");
    }
  };
  const unbanAccount = async (value: string) => {
    if (!window.confirm(`Unban ${value}?`)) return;
    try {
      await api(`/bans/accounts/${encodeURIComponent(value)}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unban that account.");
    }
  };
  const banIp = async () => {
    try {
      await api("/bans/ips", { method: "POST", body: JSON.stringify({ ip, reason: ipReason }) });
      setIp("");
      setIpReason("");
      setError("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not ban that IP.");
    }
  };
  const unbanIp = async (value: string) => {
    if (!window.confirm(`Unban ${value}?`)) return;
    try {
      await api(`/bans/ips?ip=${encodeURIComponent(value)}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unban that IP.");
    }
  };
  return (
    <section className="space-y-10">
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div>
        <SectionTitle icon={ShieldOff} title={t("admin.bansAccountsTitle")} description={t("admin.bansAccountsDesc")} />
        <div className="surface mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_1fr_auto]">
          <TextInput value={username} onChange={setUsername} placeholder={t("admin.bansUsername")} />
          <TextInput value={accountReason} onChange={setAccountReason} placeholder={t("admin.bansReason")} />
          <Button variant="accent" onClick={() => void banAccount()}>{t("admin.bansAccountAdd")}</Button>
        </div>
        <div className="surface divide-y divide-white/[.06] rounded-2xl">
          {accounts.map((item) => (
            <div key={item.user_id} className="flex items-center gap-3 p-4">
              <span className="flex-1 text-sm text-zinc-200">
                @{item.username || "unclaimed"}
                <span className="ms-3 text-xs text-zinc-600">{item.reason || t("admin.bansNoReason")}</span>
                <span className="ms-3 font-mono text-[11px] text-zinc-500">{item.signup_ip || t("admin.bansNoIp")}</span>
              </span>
              <Button variant="ghost" className="h-8 min-h-0 px-2 text-xs text-red-300" onClick={() => void unbanAccount(item.username || item.user_id)}>{t("common.remove")}</Button>
            </div>
          ))}
          {!accounts.length && <p className="p-8 text-center text-xs text-zinc-600">{t("admin.bansAccountsEmpty")}</p>}
        </div>
      </div>
      <div>
        <SectionTitle icon={ShieldOff} title={t("admin.bansIpsTitle")} description={t("admin.bansIpsDesc")} />
        <div className="surface mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_1fr_auto]">
          <TextInput value={ip} onChange={setIp} placeholder={t("admin.bansIp")} />
          <TextInput value={ipReason} onChange={setIpReason} placeholder={t("admin.bansReason")} />
          <Button variant="accent" onClick={() => void banIp()}>{t("admin.bansIpAdd")}</Button>
        </div>
        <div className="surface divide-y divide-white/[.06] rounded-2xl">
          {ips.map((item) => (
            <div key={item.ip} className="flex items-center gap-3 p-4">
              <span className="flex-1 text-sm text-zinc-200">
                <span className="font-mono">{item.ip}</span>
                <span className="ms-3 text-xs text-zinc-600">{item.reason || t("admin.bansNoReason")}</span>
                <span className="ms-3 text-xs text-zinc-500">{item.usernames?.length ? item.usernames.map((name: string) => `@${name}`).join(", ") : t("admin.bansNoAccounts")}</span>
              </span>
              <Button variant="ghost" className="h-8 min-h-0 px-2 text-xs text-red-300" onClick={() => void unbanIp(item.ip)}>{t("common.remove")}</Button>
            </div>
          ))}
          {!ips.length && <p className="p-8 text-center text-xs text-zinc-600">{t("admin.bansIpsEmpty")}</p>}
        </div>
      </div>
    </section>
  );
}

function BannedPanel() {
  const t = useT();
  const [items, setItems] = useState<any[]>([]);
  const [word, setWord] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const load = () => void api("/banned-words").then((r) => setItems(r.words || [])).catch((e) => setError(e.message));
  useEffect(load, []);
  const add = async () => {
    try {
      await api("/banned-words", { method: "POST", body: JSON.stringify({ word, reason }) });
      setWord("");
      setReason("");
      setError("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not ban that word.");
    }
  };
  const remove = async (value: string) => {
    if (!window.confirm(`Remove ${value}?`)) return;
    try {
      await api(`/banned-words/${encodeURIComponent(value)}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that word.");
    }
  };
  return (
    <section>
      <SectionTitle icon={Ban} title={t("admin.bannedTitle")} description={t("admin.bannedDesc")} />
      <div className="surface mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_1fr_auto]">
        <TextInput value={word} onChange={setWord} placeholder={t("admin.bannedWord")} />
        <TextInput value={reason} onChange={setReason} placeholder={t("admin.bannedReason")} />
        <Button variant="accent" onClick={() => void add()}>{t("admin.bannedAdd")}</Button>
      </div>
      {error && <p className="mb-3 text-xs text-red-300">{error}</p>}
      <div className="surface divide-y divide-white/[.06] rounded-2xl">
        {items.map((item) => (
          <div key={item.word} className="flex items-center gap-3 p-4">
            <span className="flex-1 text-sm text-zinc-200">{item.word}<span className="ms-3 text-xs text-zinc-600">{item.reason || t("admin.bannedNoReason")}</span></span>
            <Button variant="ghost" className="h-8 min-h-0 px-2 text-xs text-red-300" onClick={() => void remove(item.word)}>{t("common.remove")}</Button>
          </div>
        ))}
        {!items.length && <p className="p-8 text-center text-xs text-zinc-600">{t("admin.bannedEmpty")}</p>}
      </div>
    </section>
  );
}

function BadgesPanel() {
  const t = useT();
  const official = new Set(BADGE_CATALOG.map((item) => item.id));
  const [items, setItems] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [form, setForm] = useState({ id: "", name: "", description: "", color: "#e11d48", icon: "" });
  const [iconName, setIconName] = useState("");
  const [grant, setGrant] = useState<{ id: string; name: string; granted: boolean } | null>(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const iconInput = useRef<HTMLInputElement>(null);
  const canCreate = /^[a-z0-9-]{2,64}$/.test(form.id) && form.name.trim().length > 0 && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(form.color) && Boolean(form.icon);
  const load = () => {
    void api("/badges").then((result) => setItems(result.badges || [])).catch((err) => setError(err.message));
    void api("/verification?status=pending").then((result) => setQueue(result.requests || [])).catch((err) => setError(err.message));
  };
  useEffect(load, []);
  const add = async () => {
    setError("");
    setNotice("");
    try {
      await api("/badges", { method: "POST", body: JSON.stringify(form) });
      setForm({ id: "", name: "", description: "", color: "#e11d48", icon: "" });
      setIconName("");
      setNotice("Custom badge created.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create badge.");
    }
  };
  const submitGrant = async () => {
    if (!grant) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await api(`/badges/${grant.id}/grants`, { method: "PUT", body: JSON.stringify({ user: target.trim(), granted: grant.granted }) });
      setNotice(grant.granted ? `Granted ${grant.name} to that user.` : `Revoked ${grant.name} from that user.`);
      setGrant(null);
      setTarget("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that badge grant.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (!window.confirm(`Delete ${id}? Anyone who has it will lose it.`)) return;
    setError("");
    setNotice("");
    try {
      await api(`/badges/${id}`, { method: "DELETE" });
      setNotice("Custom badge deleted.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete badge.");
    }
  };
  const review = async (id: string, status: "approved" | "rejected") => {
    setError("");
    setNotice("");
    try {
      await api(`/verification/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice(status === "approved" ? "Verification approved." : "Verification rejected.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review that request.");
    }
  };
  return (
    <section>
      <SectionTitle icon={ShieldCheck} title={t("admin.badgesTitle")} description={t("admin.badgesDesc")} />
      {error && <p className="mb-3 text-xs text-red-300">{error}</p>}
      {notice && <p className="mb-3 text-xs text-emerald-300">{notice}</p>}
      <div className="surface mb-8 space-y-4 rounded-2xl p-4">
        <FieldLabel>Verification queue</FieldLabel>
        {queue.length === 0 && <p className="text-xs text-zinc-600">No pending requests.</p>}
        {queue.map((item) => (
          <div key={item.id} className="rounded-xl border border-white/[.06] p-3">
            <p className="text-sm text-zinc-200">@{item.username || "unknown"} <span className="text-xs text-zinc-600">{item.display_name || ""}</span></p>
            <p className="mt-1 text-xs text-zinc-400">{item.reason}</p>
            {item.proof_url && <a href={item.proof_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-[#b6aaff] underline">{item.proof_url}</a>}
            <div className="mt-3 flex gap-2">
              <Button variant="accent" className="h-8 min-h-0 px-3 text-xs" onClick={() => void review(item.id, "approved")}>Approve</Button>
              <Button variant="ghost" className="h-8 min-h-0 px-3 text-xs" onClick={() => void review(item.id, "rejected")}>Reject</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="surface mb-5 space-y-4 rounded-2xl p-4">
        <FieldLabel>New custom badge</FieldLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Badge id</FieldLabel>
            <TextInput value={form.id} onChange={(value) => setForm({ ...form, id: value.trim().toLowerCase() })} placeholder="custom-badge-id" />
          </div>
          <div>
            <FieldLabel>Name</FieldLabel>
            <TextInput value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="My badge" />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Description</FieldLabel>
            <TextInput value={form.description} onChange={(value) => setForm({ ...form, description: value })} placeholder="Shown on the badges page" />
          </div>
          <div>
            <FieldLabel>Color</FieldLabel>
            <div className="flex gap-2">
              <input aria-label="Badge color" type="color" value={/^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : "#e11d48"} onChange={(event) => setForm({ ...form, color: event.target.value })} className="h-11 w-12 cursor-pointer rounded-xl border-0 bg-transparent p-0" />
              <TextInput value={form.color} onChange={(value) => setForm({ ...form, color: value })} placeholder="#e11d48" />
            </div>
          </div>
          <div>
            <FieldLabel>Icon</FieldLabel>
            <div className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.025] p-3">
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl" style={{ color: form.color, background: `${form.color}16` }}>
                {form.icon ? <img src={form.icon} alt="" className="h-6 w-6 object-contain" /> : <ShieldCheck size={16} />}
              </span>
              <p className="min-w-0 flex-1 text-xs text-zinc-400">{iconName || "PNG, JPG, WebP, or GIF. 512KB max."}</p>
              <input ref={iconInput} className="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void iconFromFile(file).then((asset) => {
                  setForm((current) => ({ ...current, icon: asset.url || "" }));
                  setIconName(asset.name || file.name);
                  setError("");
                }).catch((err) => setError(err instanceof Error ? err.message : "That icon could not be used."));
                event.target.value = "";
              }} />
              <Button variant="subtle" className="h-9 min-h-0 px-3 text-xs" onClick={() => iconInput.current?.click()}><Upload size={13} />{form.icon ? "Replace" : "Upload"}</Button>
            </div>
          </div>
        </div>
        <Button variant="accent" onClick={() => void add()} disabled={!canCreate}>Create custom badge</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="surface rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl" style={{ color: item.color, background: `${item.color || "#e11d48"}16` }}>
                {item.has_icon ? <img src={`/api/v1/badges/${item.id}/icon`} alt="" className="h-6 w-6 object-contain" /> : <ShieldCheck size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-200">{item.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{item.description || item.id}</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-600">{item.id}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="subtle" className="h-8 min-h-0 px-2 text-xs" onClick={() => { setGrant({ id: item.id, name: item.name, granted: true }); setTarget(""); setError(""); }}>Grant</Button>
              <Button variant="ghost" className="h-8 min-h-0 px-2 text-xs" onClick={() => { setGrant({ id: item.id, name: item.name, granted: false }); setTarget(""); setError(""); }}>Revoke</Button>
              {!official.has(item.id) && <Button variant="ghost" className="h-8 min-h-0 px-2 text-xs text-red-300" onClick={() => void remove(item.id)}>Delete</Button>}
            </div>
          </div>
        ))}
      </div>
      <Modal
        open={Boolean(grant)}
        title={grant?.granted ? `Grant ${grant?.name}` : `Revoke ${grant?.name}`}
        description="Enter the user ID from Admin → Users. Username also works."
        onClose={() => { if (!busy) { setGrant(null); setTarget(""); } }}
      >
        <div className="space-y-4">
          <div>
            <FieldLabel>User ID</FieldLabel>
            <TextInput value={target} onChange={setTarget} placeholder="user id or @username" />
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setGrant(null); setTarget(""); }} disabled={busy}>Cancel</Button>
            <Button variant="accent" onClick={() => void submitGrant()} disabled={busy || target.trim().length < 3}>{busy ? "Saving…" : grant?.granted ? "Grant badge" : "Revoke badge"}</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function PremiumPanel() {
  const t = useT();
  const [ranks, setRanks] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [open, setOpen] = useState<any | null>(null);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const load = () => void api("/entitlements").then((r) => setRanks(r.ranks || [])).catch((e) => setError(e.message));
  const loadRank = (id: string) => void api(`/entitlements/ranks/${id}`).then((r) => setOpen(r.rank)).catch((e) => setError(e.message));
  useEffect(load, []);
  const create = async () => {
    try {
      await api("/entitlements/ranks", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      setError("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create that rank.");
    }
  };
  const grant = async () => {
    if (!open) return;
    try {
      await api(`/entitlements/ranks/${open.id}/grants`, { method: "POST", body: JSON.stringify({ username }) });
      setUsername("");
      setError("");
      loadRank(open.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not grant that rank.");
    }
  };
  const revoke = async (handle: string) => {
    if (!open || !window.confirm(`Revoke ${open.name} from @${handle}?`)) return;
    try {
      await api(`/entitlements/ranks/${open.id}/grants/${encodeURIComponent(handle)}`, { method: "DELETE" });
      loadRank(open.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke that rank.");
    }
  };
  return (
    <section>
      <SectionTitle icon={ShieldCheck} title={t("admin.premiumTitle")} description={t("admin.premiumDesc")} />
      {error && <p className="mb-3 text-xs text-red-300">{error}</p>}
      {open ? (
        <div>
          <button type="button" onClick={() => { setOpen(null); setError(""); }} className="mb-4 text-xs text-[#b6aaff] hover:text-white">{t("admin.premiumBack")}</button>
          <h3 className="mb-4 text-lg font-medium text-white">{open.name}</h3>
          <div className="surface mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_auto]">
            <TextInput value={username} onChange={setUsername} placeholder={t("admin.premiumUsername")} />
            <Button variant="accent" onClick={() => void grant()}>{t("admin.premiumGrant")}</Button>
          </div>
          <div className="surface divide-y divide-white/[.06] rounded-2xl">
            {(open.holders || []).map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 p-4">
                <span className="flex-1 text-sm text-zinc-200">@{item.username || "unclaimed"}</span>
                <Button variant="ghost" className="h-8 min-h-0 px-2 text-xs text-red-300" onClick={() => void revoke(item.username || item.user_id)}>{t("admin.premiumRevoke")}</Button>
              </div>
            ))}
            {!(open.holders || []).length && <p className="p-8 text-center text-xs text-zinc-600">{t("admin.premiumNoHolders")}</p>}
          </div>
        </div>
      ) : (
        <div>
          <div className="surface mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_auto]">
            <TextInput value={name} onChange={setName} placeholder={t("admin.premiumRank")} />
            <Button variant="accent" onClick={() => void create()}>{t("admin.premiumCreate")}</Button>
          </div>
          <div className="surface divide-y divide-white/[.06] rounded-2xl">
            {ranks.map((item) => (
              <button key={item.id} type="button" onClick={() => { setError(""); loadRank(item.id); }} className="flex w-full items-center gap-3 p-4 text-start hover:bg-white/[.03]">
                <span className="flex-1 text-sm text-zinc-200">{item.name}</span>
                <span className="text-xs text-zinc-500">{item.holders || 0}</span>
              </button>
            ))}
            {!ranks.length && <p className="p-8 text-center text-xs text-zinc-600">{t("admin.premiumEmpty")}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function ReportsPanel() { const t = useT(); const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const load = () => void api("/reports").then((r) => setItems(r.reports || [])).catch((e) => setError(e.message)); useEffect(load, []); const update = async (id: string, status: string) => { try { await api(`/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update report."); } }; return <section><SectionTitle icon={Flag} title={t("admin.reportsTitle")} description={t("admin.reportsDesc")} />{error && <p className="mb-3 text-xs text-red-300">{error}</p>}<div className="surface divide-y divide-white/[.06] rounded-2xl">{items.map((item) => <div key={item.id} className="p-4"><div className="flex gap-3"><div className="flex-1"><p className="text-sm text-zinc-200">{item.reason} <span className="ml-2 text-xs text-zinc-600">{item.target_username || item.target_user_id || "unknown target"}</span></p><p className="mt-1 text-xs text-zinc-500">{item.details || "No details"}</p></div><span className="text-xs text-zinc-500">{item.status}</span></div><div className="mt-3 flex gap-2"><Button variant="ghost" className="h-8 min-h-0 px-2 text-xs" onClick={() => void update(item.id, "reviewed")}>Review</Button><Button variant="ghost" className="h-8 min-h-0 px-2 text-xs" onClick={() => void update(item.id, "resolved")}>Resolve</Button><Button variant="ghost" className="h-8 min-h-0 px-2 text-xs" onClick={() => void update(item.id, "dismissed")}>Dismiss</Button></div></div>)}{!items.length && <p className="p-8 text-center text-xs text-zinc-600">No reports.</p>}</div></section>; }

function FlagsPanel() { const t = useT(); const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const load = () => void api("/feature-flags").then((r) => setItems(r.flags || [])).catch((e) => setError(e.message)); useEffect(load, []); const toggle = async (item: any) => { try { await api(`/feature-flags/${encodeURIComponent(item.key)}`, { method: "PUT", body: JSON.stringify({ enabled: !item.enabled, description: item.description }) }); load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update flag."); } }; return <section><SectionTitle icon={Flag} title={t("admin.flagsTitle")} description={t("admin.flagsDesc")} />{error && <p className="mb-3 text-xs text-red-300">{error}</p>}<div className="surface divide-y divide-white/[.06] rounded-2xl">{items.map((item) => <div key={item.key} className="flex items-center gap-3 p-4"><div className="flex-1"><p className="font-mono text-sm text-zinc-200">{item.key}</p><p className="mt-1 text-xs text-zinc-600">{item.description}</p></div><Button variant={item.enabled ? "accent" : "ghost"} className="h-8 min-h-0 px-3 text-xs" onClick={() => void toggle(item)}>{item.enabled ? "Enabled" : "Disabled"}</Button></div>)}{!items.length && <p className="p-8 text-center text-xs text-zinc-600">No feature flags yet.</p>}</div></section>; }

function AuditPanel() { const t = useT(); const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); useEffect(() => { void api("/audit-logs").then((r) => setItems(r.logs || [])).catch((e) => setError(e.message)); }, []); return <section><SectionTitle icon={Database} title={t("admin.auditTitle")} description={t("admin.auditDesc")} />{error && <p className="mb-3 text-xs text-red-300">{error}</p>}<div className="surface divide-y divide-white/[.06] rounded-2xl">{items.map((item) => <div key={item.id} className="grid gap-1 p-4 text-xs sm:grid-cols-[180px_1fr_1fr]"><span className="text-zinc-600">{new Date(item.created_at).toLocaleString()}</span><span className="font-mono text-[#fda4af]">{item.action}</span><span className="text-zinc-500">{item.target_type || "—"}: {item.target_id || "—"}</span></div>)}{!items.length && <p className="p-8 text-center text-xs text-zinc-600">{t("admin.noAudit")}</p>}</div></section>; }

function BakaBoostPanel() { const t = useT(); const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); useEffect(() => { void api("/bakaboost").then((r) => setItems(r.connections || [])).catch((e) => setError(e.message)); }, []); return <section><SectionTitle icon={Database} title={t("admin.bakaTitle")} description={t("admin.bakaDesc")} />{error && <p className="mb-3 text-xs text-red-300">{error}</p>}<div className="surface divide-y divide-white/[.06] rounded-2xl">{items.map((item) => <div key={item.user_id} className="flex items-center gap-3 p-4 text-xs"><span className="flex-1 font-mono text-zinc-400">{item.user_id}</span><span className="text-zinc-500">{item.provider}</span><span className={item.status === "connected" ? "text-emerald-400" : "text-amber-300"}>{item.status}</span></div>)}{!items.length && <p className="p-8 text-center text-xs text-zinc-600">{t("admin.noBaka")}</p>}</div></section>; }

function ThemesPanel() { const t = useT(); const [items, setItems] = useState<any[]>([]); const [name, setName] = useState(""); const [error, setError] = useState(""); const load = () => void api("/themes").then((r) => setItems(r.themes || [])).catch((e) => setError(e.message)); useEffect(load, []); const add = async () => { try { await api("/themes", { method: "POST", body: JSON.stringify({ name, config: {}, active: true }) }); setName(""); load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not save theme."); } }; return <section><SectionTitle icon={Database} title={t("admin.themesTitle")} description={t("admin.themesDesc")} /><div className="surface mb-5 flex gap-2 rounded-2xl p-4"><TextInput value={name} onChange={setName} placeholder="Preset name" /><Button variant="accent" onClick={() => void add()}>Save preset</Button></div>{error && <p className="mb-3 text-xs text-red-300">{error}</p>}<div className="surface divide-y divide-white/[.06] rounded-2xl">{items.map((item) => <div key={item.id} className="flex items-center gap-3 p-4 text-sm"><span className="flex-1 text-zinc-300">{item.name}</span><span className={item.active ? "text-emerald-400" : "text-zinc-600"}>{item.active ? "Active" : "Inactive"}</span></div>)}{!items.length && <p className="p-8 text-center text-xs text-zinc-600">No presets yet.</p>}</div></section>; }

function DefaultFontsPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(0);
  const inputs = useRef<Record<number, HTMLInputElement | null>>({});
  const load = async () => { try { const response = await api("/fonts"); setItems(response.fonts || []); } catch (e) { setError(e instanceof Error ? e.message : "Could not load default fonts."); } };
  useEffect(() => { void load(); }, []);
  const upload = async (slot: number, file: File) => {
    if (file.size > 2_000_000) { setError("Font must be smaller than 2 MB."); return; }
    try {
      setBusy(slot);
      const asset = await assetFromFile(file);
      if (!asset.url) throw new Error("Could not read that font.");
      await api(`/fonts/${slot}`, { method: "PUT", body: JSON.stringify({ name: file.name.replace(/\.[^.]+$/, ""), data_url: asset.url, mime_type: asset.type || "font/woff2" }) });
      setError("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not upload that font."); }
    finally { setBusy(0); }
  };
  const remove = async (slot: number) => { try { setBusy(slot); await api(`/fonts/${slot}`, { method: "DELETE" }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not remove that font."); } finally { setBusy(0); } };
  return <section><SectionTitle icon={Type} title="Default fonts" description="Manage ten uploaded fonts plus Inter in the profile font selector." />{error && <p className="mb-3 text-xs text-red-300">{error}</p>}<div className="surface divide-y divide-white/[.06] rounded-2xl"><div className="flex items-center gap-3 p-4"><div className="flex-1"><p className="text-sm text-zinc-200">Inter</p><p className="text-xs text-zinc-600">Built-in default font</p></div><span className="text-xs text-emerald-400">Default</span></div>{[2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((slot) => { const item = items.find((entry) => entry.slot === slot); return <div key={slot} className="flex items-center gap-3 p-4"><div className="flex-1"><p className="text-sm text-zinc-200">Font {slot - 1}</p><p className="text-xs text-zinc-600">{item?.name || "Empty slot"}</p></div><input ref={(node) => { inputs.current[slot] = node; }} className="hidden" type="file" accept={FONT_ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(slot, file); event.target.value = ""; }} /><Button variant="subtle" className="h-9 min-h-0 px-3 text-xs" disabled={busy === slot} onClick={() => inputs.current[slot]?.click()}><Upload size={13} />{item ? "Replace" : "Upload"}</Button>{item ? <Button variant="ghost" className="h-9 min-h-0 px-3 text-xs" disabled={busy === slot} onClick={() => void remove(slot)}>Remove</Button> : null}</div>; })}</div></section>;
}

function TemplatesPanel() {
  const t = useT();
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");
  const load = () => void api("/templates").then((r) => setItems(r.templates || [])).catch((e) => setError(e.message));
  useEffect(load, []);
  const toggle = async (item: any) => { try { await api(`/templates/${item.id}`, { method: "PATCH", body: JSON.stringify({ published: !item.published }) }); load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update template."); } };
  const remove = async (item: any) => { if (!window.confirm(`Delete ${item.name}?`)) return; try { await api(`/templates/${item.id}`, { method: "DELETE" }); load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not delete template."); } };
  return <section><SectionTitle icon={Database} title={t("admin.templatesTitle")} description={t("admin.templatesDesc")} />{error && <p className="mb-3 text-xs text-red-300">{error}</p>}<div className="surface divide-y divide-white/[.06] rounded-2xl">{items.map((item) => <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="text-sm text-zinc-200">{item.name}</p><p className="mt-1 text-xs text-zinc-500">{item.slug} · {item.creator_username ? `@${item.creator_username}` : "system"} · {item.published ? "Published" : "Unpublished"}</p></div><div className="flex gap-2"><Button variant="ghost" className="h-8 min-h-0 px-2 text-xs" onClick={() => void toggle(item)}>{item.published ? "Unpublish" : "Publish"}</Button><Button variant="ghost" className="h-8 min-h-0 px-2 text-xs text-red-300" onClick={() => void remove(item)}>Delete</Button></div></div>)}{!items.length && <p className="p-8 text-center text-xs text-zinc-600">No templates yet.</p>}</div></section>;
}
