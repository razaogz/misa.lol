"use client";

import Link from "next/link";
import { Monitor, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, PageHeader, SectionTitle } from "@/components/ui";

type AdminSession = { id: string; admin_id: string; email: string; name: string; ip?: string; user_agent?: string; created_at: string; last_seen_at: string; expires_at: string };

export default function AdminSessionsPage() {
  const [items, setItems] = useState<AdminSession[]>([]); const [error, setError] = useState("");
  const load = () => void fetch("/api/v1/admin-auth/staff/sessions", { credentials: "include" }).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.detail || "Could not load sessions."); setItems(result.sessions || []); }).catch((e) => setError(e instanceof Error ? e.message : "Could not load sessions."));
  useEffect(load, []);
  const revoke = async (id: string) => { if (!window.confirm("Revoke this admin session?")) return; await fetch(`/api/v1/admin-auth/staff/sessions/${id}`, { method: "DELETE", credentials: "include" }); load(); };
  return <main className="mx-auto min-h-screen max-w-[1200px] px-5 py-8 text-white sm:px-8 sm:py-11"><PageHeader eyebrow="Administration" title="Admin sessions" description="Active administrator sessions and device metadata." action={<Link href="/admin/staff" className="text-sm text-[#b1a5ff]">Back to staff</Link>} />{error && <p className="mb-4 text-xs text-red-300">{error}</p>}<section className="surface rounded-2xl p-5 sm:p-6"><SectionTitle icon={Monitor} title="Active sessions" description="Sessions expire after eight hours and can be revoked by the root administrator." /><div className="space-y-2">{items.map((item) => <div key={item.id} className="rounded-xl border border-white/[.06] p-4 text-xs"><div className="flex flex-wrap items-center gap-2"><span className="text-zinc-200">{item.name || item.email}</span><span className="text-zinc-500">{item.email}</span><Button variant="ghost" className="ml-auto h-8 min-h-0 px-2 text-xs text-red-300" onClick={() => void revoke(item.id)}>Revoke</Button></div><p className="mt-2 text-zinc-500">IP {item.ip || "unknown"} · Created {new Date(item.created_at).toLocaleString()} · Last active {new Date(item.last_seen_at).toLocaleString()}</p><p className="mt-1 truncate text-zinc-700">{item.user_agent || "Unknown device"}</p></div>)}{!items.length && <p className="text-xs text-zinc-600">No active sessions.</p>}</div></section>{error && <ShieldCheck className="mt-5 text-red-300" size={18} />}</main>;
}
