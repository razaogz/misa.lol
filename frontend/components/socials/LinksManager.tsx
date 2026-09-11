"use client";

import { GripVertical, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useProfile } from "@/lib/profile-store";
import { platformOptions } from "@/lib/profile-defaults";
import type { SocialLink, SocialPlatform } from "@/lib/types";
import { Button, FieldLabel, Modal, PageHeader, TextInput, Toggle } from "@/components/ui";
import { SocialIcon } from "./SocialIcon";
import { TranslatedTree } from "@/lib/i18n";

const colors: Record<string, string> = { YouTube: "#ff6b68", Discord: "#8d9bff", Instagram: "#ef9cbb", GitHub: "#d6d6df", Telegram: "#73c5ea", X: "#f5f5f5", Spotify: "#7edb9a", TikTok: "#8ee8e0" };

export function LinksManager() {
  const { config, updateConfig, saveProfile, saveState } = useProfile();
  const [editing, setEditing] = useState<SocialLink | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const active = config.socials.filter((social) => social.enabled);
  const hidden = config.socials.filter((social) => !social.enabled);
  const remove = (id: string) => updateConfig((current) => ({ ...current, socials: current.socials.filter((social) => social.id !== id) }));
  const toggle = (id: string, value: boolean) => updateConfig((current) => ({ ...current, socials: current.socials.map((social) => social.id === id ? { ...social, enabled: value } : social) }));
  const reorder = (targetId: string) => {
    if (!dragged || dragged === targetId) return;
    updateConfig((current) => {
      const list = [...current.socials];
      const from = list.findIndex((item) => item.id === dragged);
      const to = list.findIndex((item) => item.id === targetId);
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      return { ...current, socials: list };
    });
    setDragged(null);
  };

  return <TranslatedTree><main className="mx-auto min-h-screen max-w-[1050px] px-5 py-8 sm:px-8 sm:py-11 xl:px-12">
    <PageHeader eyebrow="Customize" title="Social links" description="Keep your favorite places close. Drag to reorder how they appear on your profile." action={<div className="flex gap-2"><Button variant="subtle" onClick={() => setAdding(true)}><Plus size={16} />Add social</Button><Button variant="accent" onClick={() => void saveProfile()} disabled={saveState === "saving"}>{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save changes"}</Button></div>} />
    <div className="mb-8 rounded-2xl border border-[#9b87f5]/15 bg-[#9b87f5]/[.05] p-4"><div className="flex gap-3"><Link2 size={17} className="mt-0.5 text-[#b6aaff]" /><p className="text-xs leading-5 text-zinc-400">Your links are shown as icons on your public profile. You can add links, text snippets, or custom destinations.</p></div></div>
    <div className="space-y-8"><LinkGroup title="Active links" items={active} onEdit={setEditing} onRemove={remove} onToggle={toggle} onDragStart={setDragged} onDrop={reorder} /><LinkGroup title="Hidden links" items={hidden} onEdit={setEditing} onRemove={remove} onToggle={toggle} onDragStart={setDragged} onDrop={reorder} /></div>
    <AddSocialModal key={editing?.id || (adding ? "new" : "closed")} open={adding || !!editing} initial={editing} onClose={() => { setAdding(false); setEditing(null); }} />
  </main></TranslatedTree>;
}

function LinkGroup({ title, items, onEdit, onRemove, onToggle, onDragStart, onDrop }: { title: string; items: SocialLink[]; onEdit: (item: SocialLink) => void; onRemove: (id: string) => void; onToggle: (id: string, value: boolean) => void; onDragStart: (id: string) => void; onDrop: (id: string) => void }) {
  return <section><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-zinc-300">{title}</h2><span className="rounded-full bg-white/[.06] px-2 py-1 text-[10px] text-zinc-500">{items.length}</span></div>{items.length ? <div className="space-y-2">{items.map((item) => <div key={item.id} draggable onDragStart={() => onDragStart(item.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(item.id)} className="surface surface-hover flex items-center gap-3 rounded-2xl p-3.5"><GripVertical size={16} className="shrink-0 cursor-grab text-zinc-700" /><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ color: colors[item.platform] || "#b5aaff", background: `${colors[item.platform] || "#9b87f5"}16` }}><SocialIcon platform={item.platform} size={18} /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium text-zinc-200">{item.label}</p><p className="mt-1 truncate text-xs text-zinc-600">{item.value}</p></div><button onClick={() => onEdit(item)} className="rounded-lg p-2 text-zinc-600 hover:bg-white/[.06] hover:text-white" aria-label={`Edit ${item.label}`}><Pencil size={15} /></button><button onClick={() => onRemove(item.id)} className="rounded-lg p-2 text-zinc-600 hover:bg-red-400/10 hover:text-red-300" aria-label={`Delete ${item.label}`}><Trash2 size={15} /></button><Toggle label={`Enable ${item.label}`} checked={item.enabled} onChange={(value) => onToggle(item.id, value)} /></div>)}</div> : <div className="rounded-2xl border border-dashed border-white/[.08] px-5 py-8 text-center text-xs text-zinc-600">No hidden links.</div>}</section>;
}

function AddSocialModal({ open, initial, onClose }: { open: boolean; initial: SocialLink | null; onClose: () => void }) {
  const { updateConfig } = useProfile();
  const [platform, setPlatform] = useState<SocialPlatform>(initial?.platform || "YouTube");
  const [value, setValue] = useState(initial?.value || "");
  const [label, setLabel] = useState(initial?.label || "");
  const [displayMode, setDisplayMode] = useState<SocialLink["displayMode"]>(initial?.displayMode || "link");
  const [error, setError] = useState("");
  const save = () => {
    const candidate = value.trim();
    if (!candidate) { setError("Add a URL or text value."); return; }
    if (displayMode === "link") {
      try { new URL(candidate.startsWith("http") ? candidate : `https://${candidate}`); }
      catch { setError("Enter a valid URL, like youtube.com/yourname."); return; }
    }
    updateConfig((current) => {
      if (initial) return { ...current, socials: current.socials.map((item) => item.id === initial.id ? { ...item, platform, label: label || platform, value: candidate, displayMode } : item) };
      return { ...current, socials: [...current.socials, { id: `${platform.toLowerCase().replaceAll(" ", "-")}-${Date.now()}`, platform, label: label || platform, value: candidate, displayMode, enabled: true, clicks: 0 }] };
    });
    onClose();
  };
  return <Modal open={open} title={initial ? `Edit ${initial.platform}` : `Add ${platform}`} description="Save links to your profile, then publish them with Save changes." onClose={onClose}>
    <div className="space-y-4"><div><FieldLabel>Platform</FieldLabel><select value={platform} onChange={(e) => setPlatform(e.target.value as SocialPlatform)} className="h-11 w-full rounded-xl border border-white/[.08] bg-[#111117] px-3 text-sm text-white outline-none focus:border-[#9b87f5]/60">{platformOptions.map((option) => <option key={option}>{option}</option>)}</select></div><div><FieldLabel>Display mode</FieldLabel><div className="grid grid-cols-2 gap-2">{(["link", "text"] as const).map((mode) => <button key={mode} type="button" onClick={() => setDisplayMode(mode)} className={`rounded-xl border px-3 py-2.5 text-left text-xs capitalize ${displayMode === mode ? "border-[#9b87f5]/50 bg-[#9b87f5]/10 text-white" : "border-white/[.08] text-zinc-500"}`}>{mode}<span className="mt-1 block text-[10px] text-zinc-600">{mode === "link" ? "Open a destination" : "Show as a text badge"}</span></button>)}</div></div><div><FieldLabel>Label</FieldLabel><TextInput value={label} onChange={setLabel} placeholder={platform} /></div><div><FieldLabel>{displayMode === "link" ? "URL" : "Text"}</FieldLabel><TextInput value={value} onChange={(next) => { setValue(next); setError(""); }} placeholder={displayMode === "link" ? "youtube.com/..." : "Available for collabs"} /></div>{error && <p className="text-xs text-red-300">{error}</p>}<div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="accent" onClick={save}>{initial ? "Save changes" : "Add link"}</Button></div></div>
  </Modal>;
}
