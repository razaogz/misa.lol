"use client";

import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* Focus treatment is shared so keyboard navigation is identical everywhere. */
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f00646]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080a]";

export const buttonStyles = {
  primary:
    "bg-[#f00646] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.14)] hover:bg-[#ff2d63] active:bg-[#d9053f]",
  subtle:
    "border border-white/[.08] bg-white/[.045] text-[#f4f4f5] hover:border-white/[.14] hover:bg-white/[.075] active:bg-white/[.06]",
  ghost:
    "text-[#a1a1aa] hover:bg-white/[.055] hover:text-[#f4f4f5] active:bg-white/[.04]",
  accent:
    "bg-gradient-to-br from-[#ff2d63] to-[#c00436] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.16)] hover:from-[#ff4577] hover:to-[#d1053b]",
};

export function Button({ children, variant = "subtle", className = "", type = "button", disabled = false, onClick }: { children: React.ReactNode; variant?: keyof typeof buttonStyles; className?: string; type?: "button" | "submit" | "reset"; disabled?: boolean; onClick?: () => void }) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition-[background-color,border-color,color,opacity] duration-150 active:scale-[.98] disabled:pointer-events-none disabled:opacity-40 ${focusRing} ${buttonStyles[variant]} ${className}`}>{children}</button>;
}

export function IconButton({ icon: Icon, label, className = "", onClick }: { icon: LucideIcon; label: string; className?: string; onClick?: () => void }) {
  return <button aria-label={label} title={label} onClick={onClick} className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/[.07] bg-white/[.025] text-[#a1a1aa] transition-[background-color,border-color,color] duration-150 hover:border-white/[.12] hover:bg-white/[.06] hover:text-[#f4f4f5] active:scale-95 ${focusRing} ${className}`}><Icon size={16} strokeWidth={1.8} /></button>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <span
      role="switch"
      tabIndex={0}
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onChange(!checked); } }}
      className={`relative inline-block h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${focusRing} ${checked ? "bg-[#f00646]" : "bg-white/[.12]"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[inset-inline-start] duration-200 ease-swift ${checked ? "start-[18px]" : "start-0.5"}`} />
    </span>
  );
}

export function RangeControl({ label, value, min, max, suffix = "", onChange, onReset }: { label: string; value: number; min: number; max: number; suffix?: string; onChange: (value: number) => void; onReset?: () => void }) {
  const progress = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-[#a1a1aa]">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs tabular-nums text-[#71717a]">{value}{suffix}</span>
          {onReset && <button type="button" onClick={onReset} aria-label={"Reset " + label} title={"Reset " + label} className={`rounded-md p-1 text-[#52525b] transition-colors duration-150 hover:bg-white/[.06] hover:text-[#f4f4f5] ${focusRing}`}><RotateCcw size={12} /></button>}
        </div>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/[.08] outline-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#08080a] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,.6)] [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110 focus-visible:[&::-webkit-slider-thumb]:bg-[#ff2d63] [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#08080a] [&::-moz-range-thumb]:bg-white"
        style={{ background: `linear-gradient(to right, #f00646 0%, #f00646 ${progress}%, rgba(255,255,255,.08) ${progress}%, rgba(255,255,255,.08) 100%)` }}
      />
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-[11px] font-medium uppercase tracking-[.09em] text-[#71717a]">{children}</label>;
}

export function TextInput({ value, onChange, placeholder, className = "", type = "text", id, name, autoComplete, disabled = false }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string; type?: string; id?: string; name?: string; autoComplete?: string; disabled?: boolean }) {
  return <input id={id} name={name} autoComplete={autoComplete} disabled={disabled} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`h-10 w-full rounded-[10px] border border-white/[.08] bg-white/[.025] px-3.5 text-sm text-[#f4f4f5] outline-none transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-[#52525b] hover:border-white/[.13] focus:border-[#f00646]/55 focus:bg-white/[.04] focus:ring-[3px] focus:ring-[#f00646]/12 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} />;
}

export function TextArea({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full resize-none rounded-[10px] border border-white/[.08] bg-white/[.025] px-3.5 py-3 text-sm text-[#f4f4f5] outline-none transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-[#52525b] hover:border-white/[.13] focus:border-[#f00646]/55 focus:bg-white/[.04] focus:ring-[3px] focus:ring-[#f00646]/12" />;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[.12em] text-[#71717a]">{eyebrow}</p>}
        <h1 className="dashboard-page-title text-[28px] text-[#f4f4f5] sm:text-[34px]">{title}</h1>
        {description && <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-[#71717a]">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function SectionTitle({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 gap-3">
        {Icon && (
          <span className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-white/[.07] bg-white/[.03] text-[#a1a1aa]">
            <Icon size={14} strokeWidth={1.9} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium leading-snug text-[#f4f4f5]">{title}</h2>
          {description && <p className="mt-1 text-[13px] leading-relaxed text-[#71717a]">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function Modal({ open, title, description, onClose, children, size = "md" }: { open: boolean; title: string; description?: string; onClose: () => void; children: React.ReactNode; size?: "md" | "lg" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const label = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    const previous = document.activeElement as HTMLElement | null;
    node.showModal();
    return () => { node.close(); previous?.focus(); };
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby={label}
      onCancel={(event) => { event.preventDefault(); closeRef.current(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeRef.current(); }}
      className={`glass-floating animate-modal-in fixed max-h-[85dvh] w-[calc(100%-32px)] overflow-y-auto rounded-[18px] p-6 text-[#f4f4f5] backdrop:bg-black/70 backdrop:backdrop-blur-sm ${size === "lg" ? "max-w-lg" : "max-w-md"}`}
    >
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={label} className="text-lg font-semibold tracking-[-.02em]">{title}</h2>
          {description && <p className="mt-1.5 text-sm text-[#71717a]">{description}</p>}
        </div>
        <button type="button" onClick={onClose} className={`sidebar-close -me-1.5 -mt-1 ${focusRing}`} aria-label="Close"><X size={16} /></button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}

export function MiniBar({ value, color = "#f00646" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[.07]">
      <div className="h-full rounded-full transition-[width] duration-500 ease-swift" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function StatusDot({ active = true }: { active?: boolean }) {
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-emerald-400" : "bg-[#52525b]"}`} />;
}

export function SelectBox({ value, options, onChange, onReset }: { value: string; options: string[]; onChange: (value: string) => void; onReset?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={`flex h-10 min-w-[128px] items-center justify-between gap-4 rounded-[10px] border border-white/[.08] bg-white/[.025] px-3 text-sm text-[#f4f4f5] transition-[border-color,background-color] duration-150 hover:border-white/[.13] hover:bg-white/[.045] ${focusRing}`}
        >
          <span className="truncate">{value}</span>
          <ChevronDown size={15} className={`shrink-0 text-[#71717a] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <button type="button" onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" aria-label="Close options" />
            <div className="glass-floating absolute right-0 top-[calc(100%+6px)] z-20 max-h-64 min-w-full overflow-y-auto rounded-[12px] p-1">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { onChange(option); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-150 ${option === value ? "bg-white/[.06] text-[#f4f4f5]" : "text-[#a1a1aa] hover:bg-white/[.05] hover:text-[#f4f4f5]"}`}
                >
                  {option}
                  {option === value && <Check size={13} className="shrink-0 text-[#ff6b8a]" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {onReset && (
        <button type="button" onClick={onReset} aria-label={"Reset " + value} title="Reset" className={`rounded-md p-1.5 text-[#52525b] transition-colors duration-150 hover:bg-white/[.06] hover:text-[#f4f4f5] ${focusRing}`}>
          <RotateCcw size={12} />
        </button>
      )}
    </div>
  );
}

export function LoadingButton({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return <Button disabled={loading}>{loading && <LoaderCircle size={15} className="animate-spin" />}{children}</Button>;
}
