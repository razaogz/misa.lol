"use client";
import { RangeControl } from "@/components/ui";
import { PortfolioPanel } from "@/components/customization/PortfolioPanel";
import { useProfile } from "@/lib/profile-store";
import { mergePremiumSettings, premiumSettings, type PremiumSettings } from "@/lib/premium";
import { PremiumPanel, PremiumSelect, PremiumToggle } from "./PremiumControls";

export function PremiumLayout() {
  const { config, updateConfig } = useProfile();
  const s = config.settings, p = premiumSettings(config);
  const settings = (patch: Partial<typeof s>) => updateConfig(c => ({ ...c, settings: { ...c.settings, premium: premiumSettings(c), ...patch } }));
  const premium = (patch: Partial<PremiumSettings>) => updateConfig(c => mergePremiumSettings(c, patch));
  return <div className="space-y-4"><PremiumPanel title="Hero & visibility"><PremiumSelect label="Hero layout" value={p.hero} options={["Classic", "Centered"]} onChange={v => premium({ hero: v as PremiumSettings["hero"] })} /><PremiumToggle label="Show avatar" checked={s.showAvatar !== false} onChange={showAvatar => settings({ showAvatar })} /><PremiumToggle label="Show social links" checked={s.showSocials} onChange={showSocials => settings({ showSocials })} /></PremiumPanel><PremiumPanel title="Lyrics player" description="Adjust the panel height. Lyrics automatically follow the music."><RangeControl label="Lyrics panel height" min={320} max={900} value={p.lyricsHeight} suffix="px" onChange={lyricsHeight => premium({ lyricsHeight })} /></PremiumPanel><PremiumPanel title="Profile modules" description="Drag modules to reorder, or use the arrow buttons. Each card keeps its own configuration."><PortfolioPanel premium /></PremiumPanel></div>;
}
