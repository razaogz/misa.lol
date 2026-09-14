"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { ProfileAvatar, ProfileBanner, ProfileIdentity, ProfileModules } from "@/components/profile/ProfileCardModules";
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

type FramePositionPatch = { profileFrameScale?: number; profileFrameX?: number; profileFrameY?: number };

export function ProfileRenderer({ config, preview = false, screenshot = false, className = "", manualPositioning = false, onFramePositionChange }: { config: ProfileConfig; preview?: boolean; screenshot?: boolean; className?: string; manualPositioning?: boolean; onFramePositionChange?: (patch: FramePositionPatch) => void }) {
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
  const pageFamily = s.profileFontScope === "name" ? "Inter, ui-sans-serif, system-ui, sans-serif" : family;
  const particles = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ left: `${(i * 37) % 100}%`, top: `${(i * 61) % 100}%`, delay: `${(i % 7) * .5}s`, size: 2 + (i % 3) })), []);
  const [entered, setEntered] = useState(!s.entryScreen);
  const [quiet, setQuiet] = useState(false);
  useEffect(() => { setQuiet(prefersReducedMotion()); }, []);
  useEffect(() => { setEntered(!s.entryScreen); }, [s.entryScreen, s.pageEnter]);
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
  const frameAnchor = s.cardAlign === "left" ? 25 : s.cardAlign === "right" ? 75 : 50;
  const frameScale = Math.min(150, Math.max(50, s.profileFrameScale ?? 100)) / 100;
  const frameX = Math.min(45, Math.max(-45, s.profileFrameX ?? 0));
  const frameY = Math.min(45, Math.max(-45, s.profileFrameY ?? 0));
  const showFrame = s.showProfileFrame !== false;
  const frameOpacity = Math.min(100, Math.max(0, s.profileFrameOpacity ?? 100)) / 100;
  const frameDrag = useRef<{ mode: "move" | "resize"; pointerId: number; startX: number; startY: number; baseX: number; baseY: number; baseScale: number } | null>(null);
  const frameVisible = showFrame && frameOpacity > 0;
  const audioSource = resolvedAudioSource(config.assets);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.min(1, Math.max(0, config.assets.volume / 100));
    video.muted = audioSource !== "video";
    if (entered) void video.play().catch(() => undefined);
  }, [audioSource, config.assets.backgroundVideo.url, config.assets.volume, entered]);
  const tap = () => { if (s.clickSound) playClickSound(config.assets.clickSound?.url); };
  const openPage = () => { tap(); setEntered(true); };
  const tilt = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!s.cardTilt || quiet || !cardRef.current) return;
    const box = cardRef.current.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    cardRef.current.style.transform = `rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg)`;
  };
  const untilt = () => { if (cardRef.current) cardRef.current.style.transform = ""; };
  const startFrameDrag = (event: React.PointerEvent<HTMLDivElement>, mode: "move" | "resize" = "move") => {
    if (!manualPositioning || !onFramePositionChange || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    frameDrag.current = { mode, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, baseX: frameX, baseY: frameY, baseScale: frameScale * 100 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveFrameDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = frameDrag.current;
    if (!drag || drag.pointerId !== event.pointerId || !onFramePositionChange) return;
    const viewportWidth = typeof window === "undefined" ? 1 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? 1 : window.innerHeight;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (drag.mode === "resize") {
      const nextScale = Math.min(150, Math.max(50, drag.baseScale + Math.max(deltaX, deltaY) / 3));
      onFramePositionChange({ profileFrameScale: Math.round(nextScale) });
      return;
    }
    onFramePositionChange({
      profileFrameX: Math.round(Math.min(45, Math.max(-45, drag.baseX + (deltaX / viewportWidth) * 100)) * 10) / 10,
      profileFrameY: Math.round(Math.min(45, Math.max(-45, drag.baseY + (deltaY / viewportHeight) * 100)) * 10) / 10,
    });
  };
  const endFrameDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (frameDrag.current?.pointerId === event.pointerId) frameDrag.current = null;
  };

  return (
    <div className={`relative isolate ${screenshot ? "h-full" : "min-h-[100svh]"} overflow-hidden bg-[#07070a] ${preview ? "rounded-[inherit]" : ""} ${className}`} style={{ ...customCursor, fontFamily: pageFamily, fontSize: typeSize(s.fontSize), ["--misa-profile-font" as string]: family } as CSSProperties}>
      {customFont ? <style>{`@font-face{font-family:MisaProfile;src:url("${customFont}");font-display:swap}`}</style> : null}
      {selectedDefaultFont?.url ? <style>{`@font-face{font-family:MisaDefaultFont;src:url("${selectedDefaultFont.url}");font-display:swap}`}</style> : null}
      <ProfileBackground config={config} videoRef={videoRef} particles={particles} />
      <div className="pointer-events-none absolute inset-0 bg-black/35" />
      <div className={"relative z-10 " + (screenshot ? "h-full" : "min-h-[100svh]") + " px-4 py-10 sm:px-8"} style={{ perspective: s.cardTilt ? 900 : undefined }}>
        {s.entryScreen && !entered && (
          <button type="button" className="absolute inset-0 z-20 grid place-items-center bg-black/60 text-white" onClick={openPage}>
            <span className="flex flex-col items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-lg">▶</span>
              <span className="text-xs text-white/70">{s.entryText || "click to enter..."}</span>
            </span>
          </button>
        )}
        <AnimatePresence initial={false}>
          {entered && (
            <div className={"absolute w-full max-w-[430px] " + (manualPositioning ? "cursor-move touch-none" : "")} onPointerDown={startFrameDrag} onPointerMove={moveFrameDrag} onPointerUp={endFrameDrag} onPointerCancel={endFrameDrag} style={{ left: frameAnchor + "%", top: "50%", transform: "translate(calc(-50% + " + frameX + "vw), calc(-50% + " + frameY + "vh)) scale(" + frameScale + ")" }}>
              <motion.div key="profile-card" initial={motionStart} animate={{ opacity: 1, scale: 1, scaleY: 1 }} transition={{ duration: screenshot || quiet ? 0 : 0.55, ease: [0.22, 1, .36, 1] }} className="w-full" style={{ transformOrigin: enter === "Unfold" ? "top center" : undefined, opacity: screenshot ? 1 : undefined }} onClick={(event) => { const node = event.target as HTMLElement; if (node.closest("a, button, [data-copy]")) tap(); }}>
                <div
                  ref={cardRef}
                  onPointerMove={manualPositioning ? undefined : tilt}
                  onPointerLeave={manualPositioning ? undefined : untilt}
                  className={"relative overflow-hidden shadow-2xl transition-transform duration-150 " + (layout === "Sleek" ? "p-0" : layout === "Simplistic" ? "p-6 sm:p-7" : "p-7 sm:p-9")}
                  style={{
                    borderRadius: s.profileRadius + "px",
                    backgroundColor: frameVisible ? "rgba(8,8,13," + (((layout === "Simplistic" ? Math.min(s.profileOpacity + 8, 80) : s.profileOpacity) / 100) * frameOpacity) + ")" : "transparent",
                    backgroundImage: frameVisible && s.profileGradient && layout !== "Simplistic" ? "linear-gradient(145deg, " + colorWithAlpha(s.accentColor, 0.07 * frameOpacity) + ", transparent 40%)" : "none",
                    backdropFilter: frameVisible ? "blur(" + (layout === "Simplistic" ? Math.max(s.profileBlur - 10, 0) : s.profileBlur) + "px)" : "none",
                    border: frameVisible ? (s.borderWidth ?? 1) + "px solid " + colorWithAlpha(s.borderColor, frameOpacity) : "0 solid transparent",
                    boxShadow: frameVisible ? (layout === "Simplistic" ? "0 12px 40px rgba(0,0,0," + (0.22 * frameOpacity).toFixed(3) + ")" : "0 25px 90px rgba(0,0,0," + (0.36 * frameOpacity).toFixed(3) + "), 0 0 70px " + colorWithAlpha(s.accentColor, 0.09 * frameOpacity)) : "none",
                    color: s.textColor,
                  }}
                >
                  {layout === "Modern" && frameVisible && <div className="absolute inset-x-8 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, " + s.accentColor + "aa, transparent)" }} />}
                  {layout === "Modern" && <ModernCard config={config} preview={preview} align={align} />}
                  {layout === "Simplistic" && <SimplisticCard config={config} preview={preview} align={align} />}
                  {layout === "Sleek" && <SleekCard config={config} preview={preview} align={align} />}
                </div>
              </motion.div>
              {manualPositioning && <div role="presentation" aria-label="Resize profile frame" onPointerDown={(event) => startFrameDrag(event, "resize")} className="pointer-events-auto absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-[#e11d48] shadow-lg" />}
            </div>
          )}
        </AnimatePresence>
      </div>
      {!preview && <div className="absolute bottom-5 left-0 right-0 z-10 text-center text-[10px] tracking-[.18em] text-white/25">misa.lol / {config.profile.username}</div>}
    </div>
  );
}

function ModernCard({ config, preview, align }: { config: ProfileConfig; preview: boolean; align: "left" | "center" | "right" }) {
  return (
    <>
      <ProfileBanner config={config} />
      <div className={config.assets.banner?.url ? "pt-5" : ""}>
        {config.settings.showAvatar !== false && <ProfileAvatar config={config} className="mb-5" />}
        <ProfileIdentity config={config} align={align} />
        <ProfileModules config={config} preview={preview} align={align} />
        <div className="mt-7 text-[10px] uppercase tracking-[.23em] text-white/20">misa.lol</div>
      </div>
    </>
  );
}

function SimplisticCard({ config, preview, align }: { config: ProfileConfig; preview: boolean; align: "left" | "center" | "right" }) {
  return (
    <>
      {config.settings.showAvatar !== false && <ProfileAvatar config={config} className="mb-4 h-20 w-20" />}
      <ProfileIdentity config={config} align={align} />
      <ProfileModules config={config} preview={preview} align={align} />
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
        <ProfileModules config={config} preview={preview} align={align} />
      </div>
    </>
  );
}

function ProfileBackground({ config, videoRef, particles }: { config: ProfileConfig; videoRef: React.RefObject<HTMLVideoElement | null>; particles: Array<{ left: string; top: string; delay: string; size: number }> }) {
  const { background, backgroundVideo } = config.assets;
  const effect = config.settings.backgroundEffect;
  const accent = config.settings.accentColor;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ backgroundColor: config.settings.backgroundColor }}>
      <div className="absolute -inset-[10%] animate-background-drift" style={{ opacity: config.settings.backgroundOpacity / 100, backgroundImage: background?.url ? "url(" + background.url + ")" : "radial-gradient(circle at 19% 10%, " + accent + "30, transparent 28%), radial-gradient(circle at 80% 75%, #3c205a70, transparent 32%), linear-gradient(135deg, #090a13, #140d25 48%, #07070a)", backgroundSize: "cover", backgroundPosition: "center" }} />
      {backgroundVideo.url && <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" style={{ opacity: config.settings.backgroundOpacity / 100 }} src={backgroundVideo.url} autoPlay loop muted={resolvedAudioSource(config.assets) !== "video"} playsInline preload="metadata" />}
      {effect === "Glow" && <div className="absolute inset-0 animate-background-glow bg-[radial-gradient(ellipse_at_center,transparent_15%,rgba(0,0,0,.45)_78%)]" />}
      {effect === "Aurora" && (
        <div className="absolute inset-0 overflow-hidden">
          <span className="animate-aurora absolute -left-1/4 top-[-10%] h-[60%] w-[70%] rounded-full blur-3xl" style={{ background: accent + "55" }} />
          <span className="animate-aurora absolute -right-1/4 bottom-[-8%] h-[55%] w-[65%] rounded-full blur-3xl" style={{ background: "#5eead455", animationDelay: "-2.4s" }} />
        </div>
      )}
      {effect === "Particles" && <div className="absolute inset-0">{particles.map((particle, i) => <span key={i} className="absolute rounded-full bg-white/35" style={{ left: particle.left, top: particle.top, width: particle.size, height: particle.size, animation: "background-particle " + (7 + i % 5) + "s ease-in-out " + particle.delay + " infinite" }} />)}</div>}
      {effect === "Stars" && <div className="absolute inset-0 animate-background-stars opacity-60" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,.8) 1px, transparent 1px)", backgroundSize: "67px 67px" }} />}
      {effect === "Waves" && <div className="absolute -inset-[20%] animate-background-waves" style={{ opacity: 0.35, backgroundImage: "repeating-linear-gradient(115deg, transparent 0 46px, " + accent + "22 47px 49px, transparent 50px 94px)" }} />}
      {effect === "Embers" && <div className="absolute inset-0">{particles.map((particle, i) => <span key={i} className="absolute rounded-full" style={{ left: particle.left, top: particle.top, width: particle.size + 1, height: particle.size + 1, background: accent, boxShadow: "0 0 12px " + accent, animation: "background-ember " + (5 + i % 4) + "s ease-in-out " + particle.delay + " infinite" }} />)}</div>}
      {effect === "Rain" && <div className="absolute inset-0">{particles.map((particle, i) => <span key={i} className="absolute top-[-15%] h-24 w-px bg-white/25" style={{ left: particle.left, height: 70 + (i % 5) * 24, animation: "background-rain " + (2.6 + i % 4 * .4) + "s linear " + particle.delay + " infinite" }} />)}</div>}
    </div>
  );
}
