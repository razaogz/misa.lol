"use client";

import { motion } from "framer-motion";
import { AlignCenter, AlignLeft, AlignRight, AppWindow, Brush, CalendarDays, Check, CircleDot, Crop, Eye, Image as ImageIcon, Laptop, Layers, LayoutTemplate, Maximize2, Move, MousePointer2, Palette, RotateCcw, Share2, Shield, SlidersHorizontal, Sparkles, Type, Upload, UsersRound, Video, Volume2, WandSparkles, type LucideIcon } from "lucide-react";
import { PortfolioPanel } from "@/components/customization/PortfolioPanel";
import { WidgetsPanel } from "@/components/customization/WidgetsPanel";
import { useEffect, useRef, useState } from "react";
import { ImageCropModal } from "@/components/customization/ImageCropModal";
import { AudioCropModal } from "@/components/customization/AudioCropModal";
import { PlaylistEditor } from "@/components/customization/PlaylistEditor";
import { ProfileRenderer } from "@/components/profile/ProfileRenderer";
import { SharingAppearance } from "@/components/sharing/SharingAppearance";
import { sharePageCopy } from "@/lib/share";
import { Button, FieldLabel, PageHeader, RangeControl, SelectBox, SectionTitle, TextArea, TextInput, Toggle } from "@/components/ui";
import { canCropAsset, IMAGE_ACCEPT, isAnimatedAsset, prepareCursorAsset } from "@/lib/image-edit";
import { syncPlaylist } from "@/lib/audio";
import { PreviewPlayerProvider } from "@/lib/preview-player";
import { assetFromFile, useProfile } from "@/lib/profile-store";
import type { AudioTrack, BannerShape, ButtonStyle, PageEnter, ProfileAsset, ProfileFont, ProfileShape, SocialAlign, UsernameEffect } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useDefaultFonts } from "@/lib/default-fonts";
import { useFeatureFlags } from "@/lib/feature-flags";
import { FONT_ACCEPT, PAGE_ENTERS, USERNAME_EFFECTS } from "@/lib/typography";

const tabRows = [
  [
    { id: "assets", label: "Assets", icon: ImageIcon },
    { id: "layout", label: "Layout", icon: LayoutTemplate },
    { id: "widgets", label: "Widgets", icon: AppWindow },
    { id: "portfolio", label: "Portfolio", icon: Layers },
  ],
  [
    { id: "general", label: "General", icon: SlidersHorizontal },
    { id: "colors", label: "Colors", icon: Palette },
    { id: "effects", label: "Effects", icon: WandSparkles },
    { id: "sharing", label: "Sharing appearance", icon: Share2 },
  ],
] as const;
const tabs = tabRows.flat();
type Tab = (typeof tabs)[number]["id"];
type CropKey = "avatar" | "background" | "banner" | "ogImage" | "favicon";
const cropSpec: Record<CropKey, { title: string; aspect: number; width: number; height: number; mime: string }> = {
  avatar: { title: "Crop avatar", aspect: 1, width: 512, height: 512, mime: "image/jpeg" },
  background: { title: "Crop background", aspect: 16 / 9, width: 1280, height: 720, mime: "image/jpeg" },
  banner: { title: "Crop banner", aspect: 3, width: 1200, height: 400, mime: "image/jpeg" },
  ogImage: { title: "Crop share image", aspect: 1200 / 630, width: 1200, height: 630, mime: "image/jpeg" },
  favicon: { title: "Crop favicon", aspect: 1, width: 128, height: 128, mime: "image/png" },
};

export function CustomizationWorkspace() {
  const t = useT();
  const { config, updateConfig, resetConfig, saveProfile, saveState, saveError } = useProfile();
  const { enabled } = useFeatureFlags();
  const [tab, setTab] = useState<Tab>("assets");
  const [crop, setCrop] = useState<{ key: CropKey; asset: ProfileAsset } | null>(null);
  const [audioCrop, setAudioCrop] = useState<ProfileAsset | null>(null);
  const [manualMove, setManualMove] = useState(false);
  const [fullPreview, setFullPreview] = useState(false);
  const shareCopy = sharePageCopy(config);
  const tabIcon = config.assets.favicon?.url || config.assets.avatar?.url || "";
  const setSettings = (patch: Partial<typeof config.settings>) => updateConfig((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  const setProfile = (patch: Partial<typeof config.profile>) => updateConfig((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
  const setAsset = (key: keyof typeof config.assets, asset: ProfileAsset | boolean | number | string) => updateConfig((current) => ({ ...current, assets: { ...current.assets, [key]: asset } }));
  const openManualMove = () => { setManualMove(true); setFullPreview(true); };
  const uploadAsset = async (key: keyof typeof config.assets, file: File) => {
    const maxBytes = key === "clickSound" ? 400_000 : key === "customFont" ? 2_000_000 : key === "audio" || key === "backgroundVideo" ? 8_000_000 : 3_000_000;
    if (file.size > maxBytes) { window.alert(t("customize.fileTooLarge", { mb: Math.round(maxBytes / 1_000_000) })); return; }
    const uploaded = await assetFromFile(file);
    const next = key === "cursor" ? await prepareCursorAsset(uploaded) : uploaded;
    updateConfig((current) => ({
      ...current,
      assets: {
        ...current.assets,
        [key]: next,
        ...(key === "audio" ? syncPlaylist([{ id: "track-1", title: file.name.replace(/\.[^.]+$/, ""), audio: next, artwork: current.assets.audioArtwork || { url: null } }]) : {}),
      },
    }));
    if ((key === "avatar" || key === "background" || key === "banner" || key === "ogImage" || key === "favicon") && canCropAsset(next)) setCrop({ key, asset: next });
  };
  useEffect(() => { if (saveError) window.alert(saveError); }, [saveError]);
  const tabLabel: Record<Tab, string> = { assets: t("customize.tabAssets"), layout: t("customize.tabLayout"), widgets: t("customize.tabWidgets"), portfolio: t("customize.tabPortfolio"), general: t("customize.tabGeneral"), colors: t("customize.tabColors"), effects: t("customize.tabEffects"), sharing: t("customize.sharingTitle") };
  const visibleTabRows = tabRows.map((row) => row.filter(({ id }) => enabled(id === "assets" ? "customize.assets" : id === "layout" ? "customize.layout" : id === "widgets" ? "customize.widgets" : id === "portfolio" ? "customize.portfolio" : id === "effects" ? "customize.effects" : id === "sharing" ? "customize.sharing" : "customize.general"))).filter((row) => row.length);
  return <PreviewPlayerProvider><main className="mx-auto min-h-screen max-w-[1500px] px-5 py-8 sm:px-8 sm:py-10 xl:px-10"><PageHeader eyebrow={t("customize.eyebrow")} title={t("customize.title")} description={t("customize.description")} action={<div className="flex gap-2"><Button variant="ghost" onClick={resetConfig}><RotateCcw size={15} />{t("common.reset")}</Button><Button variant="accent" onClick={() => void saveProfile()} disabled={saveState === "saving"}>{saveState === "saving" ? t("common.saving") : saveState === "saved" ? <><Check size={15} />{t("common.savedCheck")}</> : <><Check size={15} />{t("common.save")}</>}</Button></div>} /><div className="grid gap-6 xl:grid-cols-[minmax(390px,.82fr)_minmax(460px,1.18fr)]"><section className="min-w-0 rounded-2xl border border-white/[.07] bg-[#0d0d12] p-4 sm:p-5"><div className="mb-6 space-y-1 rounded-2xl bg-white/[.035] p-1.5">{visibleTabRows.map((row, index) => <div key={index} className={`grid gap-1 ${index === 0 ? "grid-cols-4" : "grid-cols-4"}`}>{row.map(({ id, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium transition ${tab === id ? "bg-white/[.12] text-white shadow-sm" : "text-zinc-500 hover:bg-white/[.04] hover:text-zinc-200"}`}><Icon size={14} className="shrink-0" /><span className="truncate">{tabLabel[id]}</span></button>)}</div>)}</div><motion.div key={tab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .2 }}>{tab === "assets" && <AssetsPanel config={config} setAsset={setAsset} onUpload={uploadAsset} onCrop={setCrop} onAudioCrop={setAudioCrop} onTracks={(tracks) => updateConfig((current) => ({ ...current, assets: { ...current.assets, ...syncPlaylist(tracks) } }))} />}{tab === "layout" && <LayoutsPanel config={config} setSettings={setSettings} onManualMove={openManualMove} />}{tab === "widgets" && <WidgetsPanel />}{tab === "portfolio" && <PortfolioPanel />}{tab === "general" && <GeneralPanel config={config} setSettings={setSettings} setProfile={setProfile} />}{tab === "sharing" && <SharingAppearance config={config} setSettings={setSettings} setAsset={(key, asset) => setAsset(key, asset)} onUpload={uploadAsset} onCrop={setCrop} />}{tab === "colors" && <ColorsPanel config={config} setSettings={setSettings} />}{tab === "effects" && <EffectsPanel config={config} setSettings={setSettings} setAsset={setAsset} onUpload={uploadAsset} />}</motion.div></section><section className="min-w-0"><div className="sticky top-4"><div className="mb-3 flex items-center justify-between gap-3 px-1"><div className="flex items-center gap-2 text-sm font-medium"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e11d48]/10 text-[#fecdd3]"><Laptop size={14} /></span>{t("customize.preview")}</div><div className="flex items-center gap-2"><span className="hidden items-center gap-2 text-[11px] text-zinc-600 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{t("customize.instant")}</span><Button variant="ghost" className="h-8 min-h-0 px-2 text-[11px]" onClick={() => setFullPreview(true)}><Maximize2 size={13} />{t("customize.fullView", undefined, "Full view")}</Button></div></div><div className="overflow-hidden rounded-2xl border border-white/[.1] bg-[#08080d] shadow-2xl shadow-black/30"><div className="flex h-9 items-center gap-1.5 border-b border-white/[.06] bg-white/[.025] px-3"><span className="h-2.5 w-2.5 rounded-full bg-[#ff6f70]/70" /><span className="h-2.5 w-2.5 rounded-full bg-[#ffcb70]/70" /><span className="h-2.5 w-2.5 rounded-full bg-[#70d69a]/70" /><div className="mx-auto flex h-5 max-w-[260px] flex-1 items-center justify-center gap-1.5 rounded-md bg-black/20 px-2 text-[9px] text-zinc-600">{tabIcon ? <img src={tabIcon} alt="" className="h-3 w-3 rounded-[3px] object-cover" /> : null}<span className="truncate">{shareCopy.title}</span></div></div><div className="h-[580px] sm:h-[650px]" dir="ltr"><ProfileRenderer config={config} preview manualPositioning={manualMove} onFramePositionChange={setSettings} /></div></div></div></section></div>{saveState === "saved" && <div role="status" className="fixed bottom-6 end-6 z-40 rounded-xl border border-emerald-400/20 bg-[#12191a] px-4 py-3 text-sm text-emerald-300 shadow-xl">{t("customize.savedToast")}</div>}
    {fullPreview && <div className="fixed inset-0 z-[100] flex flex-col bg-black/80 p-3 sm:p-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[.1] bg-[#08080d] shadow-2xl">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[.06] bg-white/[.025] px-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white"><Maximize2 size={15} className="text-[#fecdd3]" />{t("customize.fullView", undefined, "Full view")}</div>
          <div className="flex items-center gap-2">
            {manualMove ? <Button variant="ghost" className="h-8 min-h-0 px-2 text-[11px]" onClick={() => setManualMove(false)}>{t("customize.exitMove", undefined, "Exit move mode")}</Button> : null}
            <button type="button" aria-label="Close full view" onClick={() => setFullPreview(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-zinc-400 transition hover:bg-white/[.06] hover:text-white">x</button>
          </div>
        </div>
        <div className="min-h-0 flex-1" dir="ltr"><ProfileRenderer config={config} preview manualPositioning={manualMove} onFramePositionChange={setSettings} /></div>
      </div>
    </div>}
    <AudioCropModal
      open={Boolean(audioCrop)}
      src={audioCrop?.url || ""}
      onCancel={() => setAudioCrop(null)}
      onApply={(url, mime) => {
        const next = { url, name: "Video audio", type: mime };
        updateConfig((current) => ({
          ...current,
          assets: {
            ...current.assets,
            audioEnabled: true,
            ...syncPlaylist([{ id: "video-audio", title: "Video audio", audio: next, artwork: current.assets.audioArtwork || { url: null } }]),
          },
        }));
        setAudioCrop(null);
      }}
    />
    <ImageCropModal
      open={Boolean(crop)}
      title={crop ? cropSpec[crop.key].title : "Crop image"}
      src={crop?.asset.url || ""}
      aspect={crop ? cropSpec[crop.key].aspect : 1}
      outputWidth={crop ? cropSpec[crop.key].width : 512}
      outputHeight={crop ? cropSpec[crop.key].height : 512}
      mime={crop ? cropSpec[crop.key].mime : "image/jpeg"}
      onCancel={() => setCrop(null)}
      onApply={(url) => {
        if (!crop) return;
        setAsset(crop.key, { ...crop.asset, url, type: cropSpec[crop.key].mime });
        setCrop(null);
      }}
    />
  </main></PreviewPlayerProvider>;
}

function AssetsPanel({ config, setAsset, onUpload, onCrop, onAudioCrop, onTracks }: { config: ReturnType<typeof import("@/lib/mock-data").cloneMockProfile>; setAsset: (key: keyof typeof config.assets, asset: ProfileAsset | boolean | number | string) => void; onUpload: (key: keyof typeof config.assets, file: File) => Promise<void>; onCrop: (next: { key: CropKey; asset: ProfileAsset }) => void; onAudioCrop: (asset: ProfileAsset) => void; onTracks: (tracks: AudioTrack[]) => void }) {
  const t = useT();
  const { enabled } = useFeatureFlags();
  const items: Array<{ key: keyof typeof config.assets; title: string; description: string; icon: typeof ImageIcon; accept: string }> = [
    { key: "background", title: t("customize.bgImage"), description: t("customize.bgImageDesc"), icon: ImageIcon, accept: IMAGE_ACCEPT },
    { key: "banner", title: t("customize.banner"), description: t("customize.bannerDesc"), icon: ImageIcon, accept: IMAGE_ACCEPT },
    { key: "backgroundVideo", title: t("customize.bgVideo"), description: t("customize.bgVideoDesc"), icon: Video, accept: "video/mp4,video/webm" },
    { key: "avatar", title: t("customize.avatar"), description: t("customize.avatarDesc"), icon: CircleDot, accept: IMAGE_ACCEPT },
    { key: "cursor", title: t("customize.cursor"), description: t("customize.cursorDesc"), icon: MousePointer2, accept: "image/png,image/gif,image/x-icon" },
  ];
  return <div><SectionTitle icon={Brush} title={t("customize.assetsTitle")} description={t("customize.assetsDesc")} /><div className="space-y-3">{items.map((item) => <AssetRow key={item.key} item={item} asset={(config.assets[item.key] as ProfileAsset) || { url: null }} setAsset={setAsset} onUpload={onUpload} onCrop={onCrop} />)}</div><div className="mt-4"><PlaylistEditor config={config} onChange={onTracks} /></div>{enabled("customize.assets.audioCrop") && config.assets.backgroundVideo?.url && <Button variant="subtle" className="mt-3 w-full text-xs" onClick={() => onAudioCrop(config.assets.backgroundVideo)}>Use audio from uploaded video</Button>}<div className="mt-4 space-y-1 divide-y divide-white/[.06] rounded-2xl border border-white/[.07] bg-white/[.02] px-4"><ToggleRow label={t("customize.enableAudio")} checked={config.assets.audioEnabled} onChange={(checked) => setAsset("audioEnabled", checked)} /><div className="py-3"><RangeControl label={t("customize.volume")} value={config.assets.volume} min={0} max={100} suffix="%" onChange={(value) => setAsset("volume", value)} /></div></div></div>;
}

function AssetRow({ item, asset, setAsset, onUpload, onCrop }: { item: { key: keyof ReturnType<typeof import("@/lib/mock-data").cloneMockProfile>["assets"]; title: string; description: string; icon: typeof ImageIcon; accept: string }; asset: ProfileAsset; setAsset: (key: keyof ReturnType<typeof import("@/lib/mock-data").cloneMockProfile>["assets"], asset: ProfileAsset | boolean | number | string) => void; onUpload: (key: keyof ReturnType<typeof import("@/lib/mock-data").cloneMockProfile>["assets"], file: File) => Promise<void>; onCrop: (next: { key: CropKey; asset: ProfileAsset }) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const isImage = item.key === "avatar" || item.key === "background" || item.key === "banner";
  const croppable = isImage && canCropAsset(asset);
  return <div className="rounded-2xl border border-white/[.07] bg-white/[.02] p-3.5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[.06] text-zinc-500">{asset?.url && isImage ? <img src={asset.url} alt="" className="h-full w-full object-cover" /> : <item.icon size={17} />}</div><div className="min-w-0 flex-1"><p className="text-sm font-medium text-zinc-200">{item.title}</p><p className="mt-1 truncate text-xs text-zinc-600">{asset?.url ? (isAnimatedAsset(asset) ? t("customize.animated") : asset.name || t("customize.uploaded")) : item.description}</p></div><input ref={input} className="hidden" type="file" accept={item.accept} onChange={(e) => { const file = e.target.files?.[0]; if (file) void onUpload(item.key, file); e.target.value = ""; }} /><Button variant="subtle" className="h-9 min-h-0 px-3 text-xs" onClick={() => input.current?.click()}>{asset?.url ? t("common.replace") : <><Upload size={13} />{t("common.upload")}</>}</Button>{croppable && <Button variant="ghost" className="h-9 min-h-0 px-3 text-xs" onClick={() => onCrop({ key: item.key as CropKey, asset })}><Crop size={13} />{t("common.crop")}</Button>}{asset?.url && <button onClick={() => setAsset(item.key, { url: null })} className="px-1 text-xs text-zinc-600 hover:text-red-300">{t("common.remove")}</button>}</div>{asset?.url && item.key === "backgroundVideo" && <video src={asset.url} muted loop autoPlay playsInline className="mt-3 h-24 w-full rounded-xl object-cover opacity-75" />}</div>;
}

function LayoutsPanel({ config, setSettings, onManualMove }: { config: ReturnType<typeof import("@/lib/mock-data").cloneMockProfile>; setSettings: (patch: Partial<typeof config.settings>) => void; onManualMove: () => void }) {
  const t = useT();
  return (
    <div>
      <SectionTitle icon={LayoutTemplate} title={t("customize.layoutsTitle")} description={t("customize.layoutsDesc")} />
      <div className="space-y-5 rounded-2xl border border-white/[.07] bg-white/[.02] p-4"><RangeControl label={t("customize.opacity")} value={config.settings.profileOpacity} min={0} max={80} suffix="%" onChange={(value) => setSettings({ profileOpacity: value })} /><RangeControl label={t("customize.bgOpacity")} value={config.settings.backgroundOpacity} min={20} max={100} suffix="%" onChange={(value) => setSettings({ backgroundOpacity: value })} /><RangeControl label={t("customize.blur")} value={config.settings.profileBlur} min={0} max={40} suffix="px" onChange={(value) => setSettings({ profileBlur: value })} /><RangeControl label={t("customize.radius")} value={config.settings.profileRadius} min={0} max={40} suffix="px" onChange={(value) => setSettings({ profileRadius: value })} /><RangeControl label={t("customize.frameOpacity")} value={config.settings.profileFrameOpacity ?? 100} min={0} max={100} suffix="%" onChange={(value) => setSettings({ profileFrameOpacity: value })} /></div>
      <div className="mt-6 space-y-5 rounded-2xl border border-white/[.07] bg-white/[.02] p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
          <FieldLabel>{t("customize.avatarShape")}</FieldLabel>
          <SelectBox value={config.settings.avatarShape || "circle"} options={["circle", "rounded", "square"]} onChange={(value) => setSettings({ avatarShape: value as ProfileShape })} />
        </div>
        <div>
          <FieldLabel>{t("customize.bannerShape")}</FieldLabel>
          <SelectBox value={config.settings.bannerShape || "rounded"} options={["rounded", "square", "pill"]} onChange={(value) => setSettings({ bannerShape: value as BannerShape })} />
        </div>
        <div>
          <FieldLabel>{t("customize.buttonStyle")}</FieldLabel>
          <SelectBox value={config.settings.buttonStyle || "glass"} options={["glass", "solid", "outline"]} onChange={(value) => setSettings({ buttonStyle: value as ButtonStyle })} />
        </div>
        </div>
        <div>
          <FieldLabel>{t("customize.cardAlign")}</FieldLabel>
          <div className="grid grid-cols-3 gap-2">{([{ id: "left", label: t("common.left"), icon: AlignLeft }, { id: "center", label: t("common.center"), icon: AlignCenter }, { id: "right", label: t("common.right"), icon: AlignRight }] as Array<{ id: SocialAlign; label: string; icon: typeof AlignLeft }>).map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setSettings({ cardAlign: id })} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${(config.settings.cardAlign || "center") === id ? "border-[#e11d48]/50 bg-[#e11d48]/10 text-white" : "border-white/[.08] text-zinc-500"}`}><Icon size={14} />{label}</button>)}</div>
        </div>
        <div className="space-y-1 divide-y divide-white/[.06] rounded-2xl border border-white/[.07] bg-white/[.02] px-4">
          <ToggleRow label={t("customize.showFrame")} checked={config.settings.showProfileFrame !== false} onChange={(checked) => setSettings({ showProfileFrame: checked })} />
          <ToggleRow label={t("customize.showAvatar")} checked={config.settings.showAvatar !== false} onChange={(checked) => setSettings({ showAvatar: checked })} />
          <ToggleRow label={t("customize.showAvatarBorder")} checked={config.settings.showAvatarBorder !== false} onChange={(checked) => setSettings({ showAvatarBorder: checked })} />
          <ToggleRow label={t("customize.showDisplayName")} checked={config.settings.showDisplayName !== false} onChange={(checked) => setSettings({ showDisplayName: checked })} />
        </div>
        <button type="button" onClick={onManualMove} className="flex w-full items-center gap-4 rounded-2xl border border-white/[.07] bg-white/[.035] p-4 text-left transition hover:border-[#e11d48]/40 hover:bg-[#e11d48]/[.08]">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e11d48]/10 text-[#fecdd3]"><Move size={24} /></span>
        <span className="min-w-0 flex-1"><span className="block text-base font-medium text-white">{t("customize.manualMove", undefined, "Move manually")}</span><span className="mt-1 block text-xs text-zinc-500">{t("customize.manualMoveHint", undefined, "Drag and resize the profile frame yourself.")}</span></span>
        <span className="text-2xl text-zinc-400" aria-hidden="true">&gt;</span>
      </button>
      <div className="space-y-5 rounded-2xl border border-white/[.07] bg-white/[.02] p-4">
          <p className="text-xs leading-5 text-zinc-500">{t("customize.frameHint")}</p>
          <RangeControl label={t("customize.frameSize")} value={config.settings.profileFrameScale ?? 100} min={50} max={150} suffix="%" onChange={(value) => setSettings({ profileFrameScale: value })} />
          <RangeControl label={t("customize.frameHorizontal")} value={config.settings.profileFrameX ?? 0} min={-45} max={45} suffix="%" onChange={(value) => setSettings({ profileFrameX: value })} />
          <RangeControl label={t("customize.frameVertical")} value={config.settings.profileFrameY ?? 0} min={-45} max={45} suffix="%" onChange={(value) => setSettings({ profileFrameY: value })} />
        </div>
        <RangeControl label={t("customize.borderWidth")} value={config.settings.borderWidth ?? 1} min={0} max={8} suffix="px" onChange={(value) => setSettings({ borderWidth: value })} />
        <div>
          <FieldLabel>{t("customize.borderColor")}</FieldLabel>
          <div className="flex gap-2"><input aria-label="Border color" type="color" value={config.settings.borderColor || "#ffffff"} onChange={(event) => setSettings({ borderColor: event.target.value })} className="h-11 w-12 cursor-pointer rounded-xl border-0 bg-transparent p-0" /><TextInput value={config.settings.borderColor || "#ffffff"} onChange={(value) => setSettings({ borderColor: value })} /></div>
        </div>
      </div>
    </div>
  );
}

function GeneralPanel({ config, setSettings, setProfile }: { config: ReturnType<typeof import("@/lib/mock-data").cloneMockProfile>; setSettings: (patch: Partial<typeof config.settings>) => void; setProfile: (patch: Partial<typeof config.profile>) => void }) {
  const t = useT();
  return <div><SectionTitle icon={SlidersHorizontal} title={t("customize.generalTitle")} description={t("customize.generalDesc")} /><div className="space-y-6"><div className="grid gap-3 sm:grid-cols-2"><div><FieldLabel>{t("customize.displayName")}</FieldLabel><TextInput value={config.profile.displayName} onChange={(value) => setProfile({ displayName: value })} /></div><div><FieldLabel>{t("customize.username")}</FieldLabel><TextInput value={`@${config.profile.username}`} onChange={() => undefined} disabled /></div></div><p className="-mt-3 text-xs text-zinc-600">{t("customize.usernameHint")}</p><div><FieldLabel>{t("customize.fieldDesc")}</FieldLabel><TextArea value={config.profile.description} onChange={(value) => setProfile({ description: value })} placeholder={t("customize.descriptionPh")} /><p className="mt-1 text-[11px] text-zinc-600">{t("customize.descriptionHint")}</p></div><div><FieldLabel>{t("customize.location")}</FieldLabel><TextInput value={config.profile.location} onChange={(value) => setProfile({ location: value })} placeholder={t("customize.locationPh")} /></div><div className="space-y-1 divide-y divide-white/[.06] rounded-2xl border border-white/[.07] bg-white/[.02] px-4"><ToggleRow icon={CircleDot} label={t("customize.gradient")} checked={config.settings.profileGradient} onChange={(checked) => setSettings({ profileGradient: checked })} /><ToggleRow icon={Eye} label={t("customize.showViews")} checked={config.settings.showViews} onChange={(checked) => setSettings({ showViews: checked })} /><ToggleRow icon={CalendarDays} label={t("customize.showJoin")} checked={Boolean(config.settings.showJoinDate)} onChange={(checked) => setSettings({ showJoinDate: checked })} /><ToggleRow icon={Shield} label={t("customize.showBadges")} checked={config.settings.showBadges} onChange={(checked) => setSettings({ showBadges: checked })} /><ToggleRow icon={UsersRound} label={t("customize.showSocials")} checked={config.settings.showSocials} onChange={(checked) => setSettings({ showSocials: checked })} /><ToggleRow icon={Laptop} label={t("customize.entryScreen")} checked={config.settings.entryScreen} onChange={(checked) => setSettings({ entryScreen: checked })} /></div><div><FieldLabel>{t("customize.iconAlign")}</FieldLabel><div className="grid grid-cols-3 gap-2">{([{ id: "left", label: t("common.left"), icon: AlignLeft }, { id: "center", label: t("common.center"), icon: AlignCenter }, { id: "right", label: t("common.right"), icon: AlignRight }] as Array<{ id: SocialAlign; label: string; icon: typeof AlignLeft }>).map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setSettings({ socialAlign: id })} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${(config.settings.socialAlign || "center") === id ? "border-[#e11d48]/50 bg-[#e11d48]/10 text-white" : "border-white/[.08] text-zinc-500"}`}><Icon size={14} />{label}</button>)}</div></div><div><FieldLabel>{t("customize.entryText")}</FieldLabel><TextInput value={config.settings.entryText} onChange={(value) => setSettings({ entryText: value })} /><p className="mt-1 text-[11px] text-zinc-600">{t("customize.entryHint")}</p></div></div></div>;
}

function ColorsPanel({ config, setSettings }: { config: ReturnType<typeof import("@/lib/mock-data").cloneMockProfile>; setSettings: (patch: Partial<typeof config.settings>) => void }) {
  const t = useT();
  const colors: Array<{ label: string; key: "accentColor" | "textColor" | "backgroundColor" | "iconColor" }> = [{ label: t("customize.accent"), key: "accentColor" }, { label: t("customize.textColor"), key: "textColor" }, { label: t("customize.bgColor"), key: "backgroundColor" }, { label: t("customize.iconColor"), key: "iconColor" }];
  return (
    <div>
      <SectionTitle icon={Palette} title={t("customize.colorsTitle")} description={t("customize.colorsDesc")} />
      <div className="grid gap-3 sm:grid-cols-2">{colors.map(({ label, key }) => <div key={key} className="rounded-2xl border border-white/[.07] bg-white/[.02] p-4"><FieldLabel>{label}</FieldLabel><div className="flex gap-2"><input aria-label={label} type="color" value={config.settings[key]} onChange={(e) => setSettings({ [key]: e.target.value })} className="h-11 w-12 cursor-pointer rounded-xl border-0 bg-transparent p-0" /><TextInput value={config.settings[key]} onChange={(value) => setSettings({ [key]: value })} /></div></div>)}</div>
      <div className="mt-4 space-y-1 divide-y divide-white/[.06] rounded-2xl border border-white/[.07] bg-white/[.02] px-4">
        <ToggleRow label={t("customize.mono")} checked={Boolean(config.settings.monochromeIcons)} onChange={(checked) => setSettings({ monochromeIcons: checked })} />
        <ToggleRow label={t("customize.swap")} checked={Boolean(config.settings.widgetColorSwap)} onChange={(checked) => setSettings({ widgetColorSwap: checked })} />
      </div>
    </div>
  );
}

function EffectsPanel({ config, setSettings, setAsset, onUpload }: { config: ReturnType<typeof import("@/lib/mock-data").cloneMockProfile>; setSettings: (patch: Partial<typeof config.settings>) => void; setAsset: (key: keyof typeof config.assets, asset: ProfileAsset | boolean | number | string) => void; onUpload: (key: keyof typeof config.assets, file: File) => Promise<void> }) {
  const t = useT();
  const defaultFonts = useDefaultFonts();
  const { enabled } = useFeatureFlags();
  const fontInput = useRef<HTMLInputElement>(null);
  const soundInput = useRef<HTMLInputElement>(null);
  const customFont = config.assets.customFont || { url: null };
  const clickFile = config.assets.clickSound || { url: null };
  const selectedFont = defaultFonts.find((font) => font.id === (config.settings.profileFont || "Inter")) || defaultFonts[0];
  return (
    <div>
      <SectionTitle icon={Sparkles} title={t("customize.effectsTitle")} description={t("customize.effectsDesc")} />
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>{t("customize.bgEffect")}</FieldLabel><SelectBox value={config.settings.backgroundEffect} options={["None", "Particles", "Stars", "Glow", "Aurora"]} onChange={(value) => setSettings({ backgroundEffect: value as typeof config.settings.backgroundEffect })} /></div>
        <div><FieldLabel>{t("customize.nameEffect")}</FieldLabel><SelectBox value={config.settings.usernameEffect} options={USERNAME_EFFECTS.filter((effect) => !["Glitch", "Pulse", "Outline", "Neon", "Wave", "Shadow"].includes(effect) || enabled("feature.usernameEffects." + effect.toLowerCase()))} onChange={(value) => setSettings({ usernameEffect: value as UsernameEffect })} /></div>
        <div><FieldLabel>{t("customize.pageEnter")}</FieldLabel><SelectBox value={config.settings.pageEnter || "Fade"} options={[...PAGE_ENTERS]} onChange={(value) => setSettings({ pageEnter: value as PageEnter })} /></div>
        <div><FieldLabel>{t("customize.font")}</FieldLabel><SelectBox value={selectedFont?.name || "Inter"} options={defaultFonts.map((font) => font.name)} onChange={(value) => { const next = defaultFonts.find((font) => font.name === value); if (next) setSettings({ profileFont: next.id }); }} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel>{t("customize.usernameColor", undefined, "Username color")}</FieldLabel><div className="flex gap-2"><input aria-label="Username color" type="color" value={config.settings.usernameColor || "#ffffff"} onChange={(event) => setSettings({ usernameColor: event.target.value })} className="h-10 w-11 cursor-pointer rounded-xl border-0 bg-transparent p-0" /><TextInput value={config.settings.usernameColor || "#ffffff"} onChange={(value) => setSettings({ usernameColor: value })} /></div></div>
          <div><FieldLabel>{t("customize.usernameEffectColor", undefined, "Effect color")}</FieldLabel><div className="flex gap-2"><input aria-label="Username effect color" type="color" value={config.settings.usernameEffectColor || config.settings.accentColor || "#e11d48"} onChange={(event) => setSettings({ usernameEffectColor: event.target.value })} className="h-10 w-11 cursor-pointer rounded-xl border-0 bg-transparent p-0" /><TextInput value={config.settings.usernameEffectColor || config.settings.accentColor || "#e11d48"} onChange={(value) => setSettings({ usernameEffectColor: value })} /></div></div>
        </div>
        <div className="rounded-2xl border border-white/[.07] bg-white/[.02] p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[.06] text-zinc-500"><Type size={17} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">{t("customize.customFont")}</p>
              <p className="mt-1 truncate text-xs text-zinc-600">{customFont.url ? customFont.name || t("customize.uploadedFont") : t("customize.customFontHint")}</p>
            </div>
            <input ref={fontInput} className="hidden" type="file" accept={FONT_ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload("customFont", file); event.target.value = ""; }} />
            <Button variant="subtle" className="h-9 min-h-0 px-3 text-xs" onClick={() => fontInput.current?.click()}>{customFont.url ? t("common.replace") : <><Upload size={13} />{t("common.upload")}</>}</Button>
            {customFont.url ? <Button variant="ghost" className="h-9 min-h-0 px-3 text-xs" onClick={() => setAsset("customFont", { url: null })}>{t("common.remove")}</Button> : null}
          </div>
        </div>
        <div className="space-y-5 rounded-2xl border border-white/[.07] bg-white/[.02] p-4">
          <RangeControl label={t("customize.textSize")} value={config.settings.fontSize ?? 16} min={12} max={22} suffix="px" onChange={(value) => setSettings({ fontSize: value })} />
          <RangeControl label={t("customize.tracking")} value={config.settings.letterSpacing ?? 0} min={-2} max={8} suffix="px" onChange={(value) => setSettings({ letterSpacing: value })} />
        </div>
        <div className="space-y-1 divide-y divide-white/[.06] rounded-2xl border border-white/[.07] bg-white/[.02] px-4">
          <ToggleRow label={t("customize.nameGlow")} checked={config.settings.usernameGlow} onChange={(checked) => setSettings({ usernameGlow: checked })} />
          <ToggleRow label={t("customize.socialGlow")} checked={config.settings.socialGlow} onChange={(checked) => setSettings({ socialGlow: checked })} />
          <ToggleRow label={t("customize.badgeGlow")} checked={config.settings.badgeGlow} onChange={(checked) => setSettings({ badgeGlow: checked })} />
          <ToggleRow label={t("customize.tilt")} checked={Boolean(config.settings.cardTilt)} onChange={(checked) => setSettings({ cardTilt: checked })} />
          <ToggleRow label={t("customize.clickSound")} checked={Boolean(config.settings.clickSound)} onChange={(checked) => setSettings({ clickSound: checked })} />
          <ToggleRow label={t("customize.typewriter")} checked={Boolean(config.settings.bioTypewriter)} onChange={(checked) => setSettings({ bioTypewriter: checked })} />
          <ToggleRow label={t("customize.tabAnimate")} checked={Boolean(config.settings.tabTitleAnimate)} onChange={(checked) => setSettings({ tabTitleAnimate: checked })} />
        </div>
        {config.settings.clickSound && (
          <div className="rounded-2xl border border-white/[.07] bg-white/[.02] p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[.06] text-zinc-500"><Volume2 size={17} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-200">{t("customize.clickFile")}</p>
                <p className="mt-1 truncate text-xs text-zinc-600">{clickFile.url ? clickFile.name || t("customize.uploadedClick") : t("customize.clickFileHint")}</p>
              </div>
              <input ref={soundInput} className="hidden" type="file" accept="audio/mpeg,audio/wav,audio/mp3,.mp3,.wav" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload("clickSound", file); event.target.value = ""; }} />
              <Button variant="subtle" className="h-9 min-h-0 px-3 text-xs" onClick={() => soundInput.current?.click()}>{clickFile.url ? t("common.replace") : <><Upload size={13} />{t("common.upload")}</>}</Button>
              {clickFile.url ? <Button variant="ghost" className="h-9 min-h-0 px-3 text-xs" onClick={() => setAsset("clickSound", { url: null })}>{t("common.remove")}</Button> : null}
            </div>
          </div>
        )}
        {config.settings.bioTypewriter && (
          <div className="space-y-5 rounded-2xl border border-white/[.07] bg-white/[.02] p-4">
            <RangeControl label={t("customize.typeSpeed")} value={config.settings.bioTypeMs ?? 55} min={20} max={160} suffix="ms" onChange={(value) => setSettings({ bioTypeMs: value })} />
            <RangeControl label={t("customize.deleteSpeed")} value={config.settings.bioDeleteMs ?? 35} min={20} max={160} suffix="ms" onChange={(value) => setSettings({ bioDeleteMs: value })} />
            <RangeControl label={t("customize.pauseSpeed")} value={config.settings.bioPauseMs ?? 1200} min={400} max={4000} suffix="ms" onChange={(value) => setSettings({ bioPauseMs: value })} />
          </div>
        )}
        <div className="rounded-2xl border border-[#e11d48]/15 bg-[#e11d48]/[.05] p-4"><div className="flex gap-3"><WandSparkles size={17} className="mt-0.5 shrink-0 text-[#fecdd3]" /><p className="text-xs leading-5 text-zinc-400">{t("customize.tabNote")}</p></div></div>
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, checked, onChange }: { icon?: LucideIcon; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-3 py-3.5"><div className="flex min-w-0 items-center gap-3">{Icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e11d48]/[.08] text-[#fda4af]"><Icon size={17} strokeWidth={1.8} /></span>}<span className="text-sm text-zinc-300">{label}</span></div><Toggle label={label} checked={checked} onChange={onChange} /></div>;
}
