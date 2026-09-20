"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ProfileLayoutElement, ProfileLayoutProvider } from "./ProfileLayoutElement";
import type { LayoutElement, LayoutViewport } from "@/lib/element-layout";
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ProfileAvatar, ProfileBanner, ProfileBio, ProfileIdentity, ProfileAudioModule, ProfileMeta, ProfileModules } from "@/components/profile/ProfileCardModules";
import { BackgroundEffectLayer } from "@/components/profile/BackgroundEffectLayer";
import { playClickSound, prefersReducedMotion } from "@/lib/enter";
import { resolvedAudioSource } from "@/lib/audio";
import { useDefaultFonts } from "@/lib/default-fonts";
import { contentAlign, profileFont, profileLayout } from "@/lib/profile-layout";
import { typeSize } from "@/lib/typography";
import type { ProfileConfig } from "@/lib/types";

function colorWithAlpha(value: string | undefined, alpha: number) {
  const raw = (value || "#ffffff").replace("#", "");
  const hex = raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "rgba(255,255,255," + alpha.toFixed(3) + ")";
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return "rgba(" + red + "," + green + "," + blue + "," + alpha.toFixed(3) + ")";
}

type LayoutSettingsPatch = Partial<ProfileConfig["settings"]>;

export function ProfileRenderer({ config, preview = false, screenshot = false, className = "", manualPositioning = false, onLayoutChange, fitViewport = false, embedded = false, layoutViewport }: { config: ProfileConfig; preview?: boolean; screenshot?: boolean; className?: string; manualPositioning?: boolean; onLayoutChange?: (patch: LayoutSettingsPatch) => void; fitViewport?: boolean; embedded?: boolean; layoutViewport?: LayoutViewport }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<LayoutElement>("frame");
  const [measuredViewport, setMeasuredViewport] = useState<LayoutViewport>("desktop");
  const viewport = layoutViewport ?? measuredViewport;
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const s = config.settings;
  const defaultFonts = useDefaultFonts();
  const selectedDefaultFont = defaultFonts.find((font) => font.id === s.profileFont);
  const layout = profileLayout(s);
  const align = contentAlign(s.socialAlign);
  const customCursor = config.assets.cursor.url ? { cursor: `url(${config.assets.cursor.url}), auto` } : undefined;
  const customFont = config.assets.customFont?.url || "";
  const family = customFont
    ? `"MisaProfile", "Inter", ui-sans-serif, system-ui, sans-serif`
    : selectedDefaultFont?.url
      ? `"MisaDefaultFont", "Inter", ui-sans-serif, system-ui, sans-serif`
      : profileFont(s.profileFont);
  const pageFamily = "Inter, ui-sans-serif, system-ui, sans-serif";
  const [entered, setEntered] = useState(embedded || !s.entryScreen);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [quiet, setQuiet] = useState(false);
  useEffect(() => { setQuiet(prefersReducedMotion()); }, []);
  useEffect(() => { setEntered(embedded || !s.entryScreen); }, [embedded, s.entryScreen, s.pageEnter]);
  const enter = s.pageEnter || "Fade";
  const motionStart = screenshot
    ? { opacity: 1, scale: 1, scaleY: 1 }
    : quiet || !entered || enter === "None"
      ? false
    : enter === "Unfold"
      ? { opacity: 0, scaleY: 0.12 }
      : enter === "Pop"
        ? { opacity: 0, scale: 0.86 }
        : { opacity: 0 };
  const showFrame = s.showProfileFrame !== false;
  const frameOpacity = Math.min(100, Math.max(0, s.profileFrameOpacity ?? 100)) / 100;
  const frameVisible = showFrame && frameOpacity > 0;
  const audioSource = resolvedAudioSource(config.assets);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => setMeasuredViewport(root.clientWidth < 900 ? "mobile" : "desktop");
    const observer = new ResizeObserver(measure);
    observer.observe(root); measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.min(1, Math.max(0, config.assets.volume / 100));
    video.muted = audioSource !== "video" || !audioUnlocked;
    if (entered) void video.play().catch(() => undefined);
  }, [audioSource, audioUnlocked, config.assets.backgroundVideo.url, config.assets.volume, entered]);
  const tap = () => { if (s.clickSound) playClickSound(config.assets.clickSound?.url); };
  const openPage = () => {
    tap(); setAudioUnlocked(true); setEntered(true);
    if (videoRef.current && audioSource === "video") {
      videoRef.current.muted = false;
      void videoRef.current.play().catch(() => undefined);
    }
  };
  const tilt = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!s.cardTilt || quiet || !cardRef.current) return;
    const box = cardRef.current.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    cardRef.current.style.transform = `rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg)`;
  };
  const untilt = () => { if (cardRef.current) cardRef.current.style.transform = ""; };
  return (
    <ProfileLayoutProvider value={{ settings: s, editing: manualPositioning, viewport, selected, select: setSelected, change: onLayoutChange }}>
    <div data-profile-layout data-profile-preview={preview || screenshot || undefined} data-profile-embedded={embedded || undefined} data-layout-viewport={layoutViewport} ref={rootRef} className={`relative isolate ${embedded ? "h-full min-h-0 overflow-visible bg-transparent" : (fitViewport || screenshot ? "h-full min-h-0 overflow-y-auto bg-[#07070a]" : "min-h-[100svh] bg-[#07070a]")} ${preview ? "rounded-[inherit]" : ""} ${className}`} style={{ ...customCursor, fontFamily: pageFamily, fontSize: typeSize(s.fontSize), ["--misa-profile-font" as string]: family, ["--embedded-width" as string]: `${s.profileFrameWidth ?? 430}px`, ["--embedded-scale" as string]: (s.profileFrameScale ?? 100) / 100 } as CSSProperties}>
      {customFont ? <style>{`@font-face{font-family:MisaProfile;src:url("${customFont}");font-display:swap}`}</style> : null}
      {selectedDefaultFont?.url ? <style>{`@font-face{font-family:MisaDefaultFont;src:url("${selectedDefaultFont.url}");font-display:swap}`}</style> : null}
      {!embedded && <ProfileBackground config={config} videoRef={videoRef} reduceMotion={quiet} />}
      {!embedded && <div className="pointer-events-none absolute inset-0 bg-black/35" />}
      <div className="profile-composition relative z-10" style={{ perspective: s.cardTilt ? 900 : undefined, minHeight: embedded || fitViewport || screenshot ? "100%" : "100svh" }}>
        {!embedded && s.entryScreen && !entered && (
          <button type="button" className="absolute inset-0 z-20 grid place-items-center bg-black/60 text-white" onClick={openPage}>
            <span className="flex flex-col items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-lg">â–¶</span>
              <span className="text-xs text-white/70">{s.entryText || "click to enter..."}</span>
            </span>
          </button>
        )}
        <AnimatePresence initial={false}>
          {entered && (
            <>
            <ProfileLayoutElement id="frame">
              <motion.div key="profile-card" initial={motionStart} animate={{ opacity: 1, scale: 1, scaleY: 1 }} transition={{ duration: screenshot || quiet ? 0 : 0.55, ease: [0.22, 1, .36, 1] }} className="relative w-full" style={{ transformOrigin: enter === "Unfold" ? "top center" : undefined, opacity: screenshot ? 1 : undefined }} onClick={(event) => { const node = event.target as HTMLElement; if (node.closest("a, button, [data-copy]")) tap(); }}>
                <div
                  data-profile-variant={layout}
                  ref={cardRef}
                  onPointerMove={manualPositioning ? undefined : tilt}
                  onPointerLeave={manualPositioning ? undefined : untilt}
                  className={"profile-glass relative shadow-2xl transition-transform duration-150 " + (layout === "Sleek" ? "p-0" : layout === "Simplistic" ? "p-6 sm:p-7" : "p-7 sm:p-9")}
                  style={{
                    borderRadius: s.profileRadius + "px",
                    backgroundColor: frameVisible ? "rgba(8,8,13," + (((layout === "Simplistic" ? Math.min(s.profileOpacity + 8, 80) : s.profileOpacity) / 100) * frameOpacity) + ")" : "transparent",
                    backgroundImage: frameVisible && s.profileGradient && layout !== "Simplistic" ? "linear-gradient(145deg, " + colorWithAlpha(s.accentColor, 0.07 * frameOpacity) + ", transparent 40%)" : "none",
                    backdropFilter: frameVisible ? "blur(" + (layout === "Simplistic" ? Math.max(s.profileBlur - 10, 0) : s.profileBlur) + "px)" : "none",
                    border: frameVisible ? (s.borderWidth ?? 1) + "px solid " + colorWithAlpha(s.borderColor, frameOpacity) : "0 solid transparent",
                    boxShadow: embedded ? "none" : frameVisible ? (layout === "Simplistic" ? "0 12px 40px rgba(0,0,0," + (0.22 * frameOpacity).toFixed(3) + ")" : "0 25px 90px rgba(0,0,0," + (0.36 * frameOpacity).toFixed(3) + "), 0 0 70px " + colorWithAlpha(s.accentColor, 0.09 * frameOpacity)) : "none",
                    color: s.textColor,
                    minHeight: "inherit",
                  }}
                >
                  {layout === "Modern" && frameVisible && <div className="absolute inset-x-8 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, " + s.accentColor + "aa, transparent)" }} />}
                  {layout === "Modern" && <ModernCard config={config} preview={preview} align={align} />}
                  {layout === "Simplistic" && <SimplisticCard config={config} preview={preview} align={align} />}
                  {layout === "Sleek" && <SleekCard config={config} preview={preview} align={align} />}
                </div>
              </motion.div>
            </ProfileLayoutElement>
              <div data-profile-mobile-audio className="profile-mobile-audio" />
              <ProfileAudioModule config={config} preview={preview} rootRef={rootRef} viewport={viewport} />
            </>
          )}
        </AnimatePresence>
      </div>

    </div>
    </ProfileLayoutProvider>
  );
}

function ModernCard({ config, preview, align }: { config: ProfileConfig; preview: boolean; align: "left" | "center" | "right" }) {
  return (
    <>
      <ProfileBanner config={config} />
      <div className={config.assets.banner?.url ? "pt-5" : ""}>
        <div className="profile-header">{config.settings.showAvatar !== false && <ProfileAvatar config={config} className="mb-5" />}
        <div style={{ textAlign: align }}><ProfileIdentity config={config} align={align} /><ProfileBio config={config} align={align} /></div></div>
        <ProfileModules config={config} preview={preview} align={align} />
        <ProfileMeta config={config} align="left" />
      </div>
    </>
  );
}

function SimplisticCard({ config, preview, align }: { config: ProfileConfig; preview: boolean; align: "left" | "center" | "right" }) {
  return (
    <>
      <div className="profile-header">{config.settings.showAvatar !== false && <ProfileAvatar config={config} className="mb-4 h-20 w-20" />}
      <div style={{ textAlign: align }}><ProfileIdentity config={config} align={align} /><ProfileBio config={config} align={align} /></div></div>
      <ProfileModules config={config} preview={preview} align={align} />
        <ProfileMeta config={config} align="left" />
    </>
  );
}

function SleekCard({ config, preview, align }: { config: ProfileConfig; preview: boolean; align: "left" | "center" | "right" }) {
  return (
    <>
      <div className="relative">
        {config.assets.banner?.url ? <ProfileBanner config={config} /> : <div className="h-28" style={{ background: `linear-gradient(135deg, ${config.settings.accentColor}55, transparent)` }} />}
        {config.settings.showAvatar !== false && <div className="absolute -bottom-8 left-5"><ProfileAvatar config={config} className="mb-0 h-[4.5rem] w-[4.5rem]" /></div>}
      </div>
      <div className="px-5 pb-6 pt-12">
        <ProfileIdentity config={config} align={align} />
        <div style={{ textAlign: align }}><ProfileBio config={config} align={align} /></div>
        <ProfileModules config={config} preview={preview} align={align} />
        <ProfileMeta config={config} align="left" />
      </div>
    </>
  );
}

function ProfileBackground({ config, videoRef, reduceMotion }: { config: ProfileConfig; videoRef: React.RefObject<HTMLVideoElement | null>; reduceMotion: boolean }) {
  const { background, backgroundVideo, backgroundEffectVideo } = config.assets;
  const accent = config.settings.accentColor;
  return (
    <div className="profile-background pointer-events-none absolute inset-0 overflow-hidden" style={{ backgroundColor: config.settings.backgroundColor }}>
      <div className="absolute -inset-[10%] animate-background-drift" style={{ opacity: config.settings.backgroundOpacity / 100, backgroundImage: background?.url ? "url(" + background.url + ")" : "radial-gradient(circle at 19% 10%, " + accent + "30, transparent 28%), radial-gradient(circle at 80% 75%, #3c205a70, transparent 32%), linear-gradient(135deg, #090a13, #140d25 48%, #07070a)", backgroundSize: "cover", backgroundPosition: "center" }} />
      {backgroundVideo.url && <video data-bg-video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" style={{ opacity: config.settings.backgroundOpacity / 100 }} src={backgroundVideo.url} autoPlay loop muted playsInline preload="metadata" />}
      <BackgroundEffectLayer effect={config.settings.backgroundEffect || "None"} className="z-[1]" />
      {config.settings.backgroundEffect === "None" && backgroundEffectVideo?.url ? <video className="absolute inset-0 z-[1] h-full w-full object-cover" src={backgroundEffectVideo.url} autoPlay={!reduceMotion} loop muted playsInline preload="metadata" aria-hidden="true" /> : null}
    </div>
  );
}
