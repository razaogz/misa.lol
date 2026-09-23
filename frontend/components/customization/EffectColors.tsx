"use client";
import { useAuth } from "@/lib/auth-store";
import { useProfile } from "@/lib/profile-store";
import { mergePremiumSettings, premiumSettings } from "@/lib/premium";
import { EFFECT_COLORS, type ColoredEffect } from "@/lib/effect-colors";
import { PremiumColor } from "@/components/more/PremiumControls";
export function EffectColors() {
  const { user } = useAuth();
  const { config, updateConfig } = useProfile();
  const allowed = user?.premium === true;
  return <section className="mt-5 rounded-2xl border border-white/[.08] bg-white/[.025] p-4"><h3 className="text-sm font-medium">Effect colors <span className="ml-2 text-xs text-rose-300">Premium</span></h3><p className="mt-1 text-xs text-zinc-500">Each effect keeps its own color. Animations and transparency stay unchanged.</p>{allowed ? <div className="mt-4 space-y-3">{(Object.keys(EFFECT_COLORS) as ColoredEffect[]).map(key => <div key={key}><PremiumColor label={key === "Sakura" ? "Sakura petals" : key} value={config.settings.premium?.effectColors?.[key] || EFFECT_COLORS[key]} onChange={color => updateConfig(c => mergePremiumSettings(c, { effectColors: { ...premiumSettings(c).effectColors, [key]: color } }))} /><button type="button" className="mt-1 min-h-9 text-xs text-zinc-500 hover:text-white" onClick={() => updateConfig(c => { const colors = { ...c.settings.premium?.effectColors }; delete colors[key]; return mergePremiumSettings(c, { effectColors: colors }); })}>Reset {key} color</button></div>)}</div> : <p className="mt-4 text-xs text-zinc-400">Default colors are included. Custom effect colors require active Premium access.</p>}</section>;
}
