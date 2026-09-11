"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { AtSign, BadgeCheck, BookOpen, ExternalLink, Mail, Pause, Play, Sparkles, Volume2, VolumeX, Zap } from "lucide-react";
import { SiDiscord, SiFacebook, SiGithub, SiInstagram, SiKick, SiPatreon, SiPaypal, SiPinterest, SiReddit, SiRoblox, SiSnapchat, SiSolana, SiSoundcloud, SiSpotify, SiSteam, SiTelegram, SiThreads, SiTiktok, SiTwitch, SiX, SiYoutube } from "react-icons/si";
import { FaBitcoin, FaEthereum, FaLink, FaLinkedin, FaLitecoinSign } from "react-icons/fa6";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProfileConfig, SocialPlatform } from "@/lib/types";

const socialIcons: Partial<Record<SocialPlatform, React.ComponentType<{ size?: number; strokeWidth?: number }>>> = { YouTube: SiYoutube, Discord: SiDiscord, Instagram: SiInstagram, X: SiX, TikTok: SiTiktok, Telegram: SiTelegram, Spotify: SiSpotify, SoundCloud: SiSoundcloud, GitHub: SiGithub, Reddit: SiReddit, Twitch: SiTwitch, Snapchat: SiSnapchat, Facebook: SiFacebook, LinkedIn: FaLinkedin, Steam: SiSteam, Roblox: SiRoblox, PayPal: SiPaypal, Pinterest: SiPinterest, Patreon: SiPatreon, Threads: SiThreads, Kick: SiKick, Bitcoin: FaBitcoin, Ethereum: FaEthereum, Litecoin: FaLitecoinSign, Solana: SiSolana, Email: Mail, "Custom URL": FaLink };

export function ProfileRenderer({ config, preview = false, className = "" }: { config: ProfileConfig; preview?: boolean; className?: string }) {
  const [entered, setEntered] = useState(preview || !config.settings.entryScreen);
  const [audioStarted, setAudioStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoHasAudio, setVideoHasAudio] = useState<boolean | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoProbeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const s = config.settings;
  const { audio, audioEnabled, backgroundVideo, volume } = config.assets;
  const visibleSocials = config.socials.filter((social) => social.enabled);
  const visibleBadges = config.badges.filter((badge) => badge.owned && badge.enabled);
  const customCursor = config.assets.cursor.url ? { cursor: `url(${config.assets.cursor.url}), auto` } : undefined;
  const particles = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ left: `${(i * 37) % 100}%`, top: `${(i * 61) % 100}%`, delay: `${(i % 7) * .5}s`, size: 2 + (i % 3) })), []);

  const probeVideoAudio = useCallback(() => {
    if (videoProbeTimer.current) clearTimeout(videoProbeTimer.current);
    let attempts = 0;
    const probe = () => {
      const video = videoRef.current;
      if (!video || !backgroundVideo.url) { setVideoHasAudio(false); return; }
      const detected = detectVideoAudio(video);
      if (detected !== null) { setVideoHasAudio(detected); return; }
      if (attempts++ >= 15) { setVideoHasAudio(false); return; }
      videoProbeTimer.current = setTimeout(probe, 100);
    };
    probe();
  }, [backgroundVideo.url]);

  const syncMedia = useCallback((userInitiated = false) => {
    const video = videoRef.current;
    const profileAudio = audioRef.current;
    const shouldPlay = entered || userInitiated;
    if (video) {
      video.volume = volume / 100;
      video.muted = !audioEnabled || muted || videoHasAudio !== true;
    }
    if (profileAudio) {
      profileAudio.volume = volume / 100;
      profileAudio.muted = muted;
    }
    if (!shouldPlay) {
      profileAudio?.pause();
      if (video && !shouldPlay) video.pause();
      setAudioStarted(false);
      return;
    }

    if (!audioEnabled) {
      // OFF selects the separately uploaded Profile Audio. The background
      // video remains available visually, but its audio is always muted.
      if (video && backgroundVideo.url) {
        video.muted = true;
        void video.play().catch(() => undefined);
      }
      if (profileAudio && audio.url) {
        void profileAudio.play().then(() => setAudioStarted(true)).catch(() => undefined);
      } else {
        setAudioStarted(false);
      }
      return;
    }

    // ON selects only the background video's audio track. Keep the uploaded
    // Profile Audio paused, including while the video's track is inspected.
    profileAudio?.pause();
    if (video && backgroundVideo.url) {
      video.muted = muted || videoHasAudio !== true;
      void video.play().then(() => { if (videoHasAudio === true) setAudioStarted(true); }).catch(() => undefined);
    } else {
      setAudioStarted(false);
    }
  }, [audio.url, audioEnabled, backgroundVideo.url, entered, muted, videoHasAudio, volume]);

  useEffect(() => { if (preview) setEntered(true); }, [preview]);
  useEffect(() => { setVideoHasAudio(backgroundVideo.url ? null : false); }, [backgroundVideo.url]);
  useEffect(() => { syncMedia(); }, [syncMedia, s.entryScreen]);
  useEffect(() => () => { if (videoProbeTimer.current) clearTimeout(videoProbeTimer.current); videoRef.current?.pause(); audioRef.current?.pause(); }, [backgroundVideo.url, audio.url]);

  const enterProfile = () => { setEntered(true); syncMedia(true); };
  const toggleAudio = () => {
    const active = audioEnabled ? (videoHasAudio === true ? videoRef.current : null) : audioRef.current;
    if (!active) return;
    if (active.paused) { void active.play().then(() => setAudioStarted(true)).catch(() => undefined); }
    else { active.pause(); setAudioStarted(false); }
  };
  const toggleMute = () => { const next = !muted; setMuted(next); if (audioRef.current) audioRef.current.muted = next; if (videoRef.current) videoRef.current.muted = next || videoHasAudio !== true || !audioEnabled; };
  return <div className={`relative isolate min-h-[100svh] overflow-hidden bg-[#07070a] ${preview ? "rounded-[inherit]" : ""} ${className}`} style={customCursor}>
    <ProfileBackground config={config} videoRef={videoRef} particles={particles} muted={!audioEnabled || muted || videoHasAudio !== true} onVideoReady={probeVideoAudio} onVideoError={() => setVideoHasAudio(false)} />
    {audio.url && <audio ref={audioRef} src={audio.url} loop preload="none" />}
    <div className="absolute inset-0 bg-black/35" />
    <AnimatePresence>{!entered && <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: .65 }} onClick={enterProfile} className="absolute inset-0 z-30 flex cursor-pointer flex-col items-center justify-center bg-black/60 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b1a4ff]"><div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[.16] bg-white/[.07] text-[#c1b7ff] backdrop-blur-md"><Play size={18} fill="currentColor" /></div><span className="text-sm font-medium tracking-[.24em] text-white/90 uppercase">{s.entryText || "click to enter..."}</span><span className="mt-3 text-xs text-white/40">{config.profile.username}.lol</span></motion.button>}</AnimatePresence>
    <div className="relative z-10 flex min-h-[100svh] items-center justify-center px-4 py-10 sm:px-8"><AnimatePresence>{entered && <motion.div initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .7, ease: [0.22, 1, .36, 1] }} className="w-full max-w-[430px]">
      <div className="relative overflow-hidden p-7 text-center shadow-2xl sm:p-9" style={{ borderRadius: `${s.profileRadius}px`, backgroundColor: `rgba(8,8,13,${s.profileOpacity / 100})`, backgroundImage: s.profileGradient ? `linear-gradient(145deg, ${s.accentColor}12, transparent 40%)` : undefined, backdropFilter: `blur(${s.profileBlur}px)`, border: "1px solid rgba(255,255,255,.12)", boxShadow: `0 25px 90px rgba(0,0,0,.36), 0 0 70px ${s.accentColor}18` }}>
        <div className="absolute inset-x-8 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${s.accentColor}aa, transparent)` }} />
        <motion.div initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: .14, type: "spring", stiffness: 200 }} className="relative mx-auto mb-5 h-24 w-24 rounded-full p-1" style={{ background: `linear-gradient(135deg, ${s.accentColor}, #ffffff55, ${s.accentColor}22)` }}><div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-[#15151d] bg-gradient-to-br from-[#6358a3] via-[#282442] to-[#0d0d13] text-3xl font-semibold text-white shadow-[0_0_30px_rgba(155,135,245,.25)]">{config.assets.avatar.url ? <Image src={config.assets.avatar.url} alt="" width={192} height={192} unoptimized className="h-full w-full object-cover" /> : config.profile.displayName.slice(0, 1)}</div></motion.div>
        <div className="flex items-center justify-center gap-2"><h1 className={`text-2xl font-semibold tracking-[-.04em] ${s.usernameEffect === "Gradient" ? "bg-gradient-to-r from-white via-[#c5baff] to-[#8d7df0] bg-clip-text text-transparent" : s.usernameEffect === "Shimmer" ? "animate-shimmer bg-gradient-to-r from-white via-[#b7a9ff] to-white bg-clip-text text-transparent" : "text-white"}`} style={{ textShadow: s.usernameGlow ? `0 0 24px ${s.accentColor}aa` : undefined }}>{config.profile.displayName}</h1><span className="text-[#a99bff]" title="Verified"><BadgeCheck size={19} fill="currentColor" strokeWidth={1.4} /></span></div><p className="mt-1 text-xs text-white/35">@{config.profile.username}</p><p className="mx-auto mt-3 max-w-[280px] text-sm leading-6 text-white/65">{config.profile.description}</p>{config.profile.location && <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/40"><AtSign size={12} />{config.profile.location}</p>}
        {s.showBadges && visibleBadges.length > 0 && <div className="mt-6 flex justify-center gap-2">{visibleBadges.map((badge) => <span key={badge.id} title={badge.name} className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[.07] text-xs" style={{ color: badge.color, boxShadow: s.badgeGlow ? `0 0 18px ${badge.color}30` : undefined }}>{badge.iconUrl ? <Image src={badge.iconUrl} alt="" width={32} height={32} unoptimized className="h-full w-full object-cover" /> : <BadgeIcon name={badge.name} />}</span>)}</div>}
        {s.showSocials && visibleSocials.length > 0 && <div className="mt-7 flex flex-wrap justify-center gap-2.5">{visibleSocials.map((social) => { const Icon = socialIcons[social.platform] || ExternalLink; const href = social.displayMode === "link" ? safeSocialHref(social.value) : undefined; return <a key={social.id} href={href} target={href ? "_blank" : undefined} rel={href ? "noreferrer noopener" : undefined} aria-label={social.label} title={social.value} className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.09] bg-white/[.055] text-white/65 transition ${href ? "hover:-translate-y-1 hover:border-white/20 hover:bg-white/[.1] hover:text-white" : "cursor-default opacity-60"}`} style={{ color: s.iconColor, filter: s.socialGlow ? `drop-shadow(0 0 8px ${s.accentColor}44)` : undefined }}><Icon size={17} strokeWidth={1.8} /></a> })}</div>}
        {s.showViews && <div className="mt-7 flex items-center justify-center gap-2 text-xs text-white/35"><EyeIcon />{config.profile.views.toLocaleString()} profile views</div>}
        <div className="mt-7 text-[10px] uppercase tracking-[.23em] text-white/20">misa.lol</div>
      </div>
    </motion.div>}</AnimatePresence></div>
    {entered && ((audioEnabled && backgroundVideo.url) || (!audioEnabled && audio.url)) && <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/[.1] bg-black/25 p-1 backdrop-blur-md"><button type="button" onClick={toggleAudio} className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:bg-white/[.1] hover:text-white" aria-label={audioStarted ? "Pause audio" : "Play audio"}>{audioStarted ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}</button><button type="button" onClick={toggleMute} className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:bg-white/[.1] hover:text-white" aria-label={muted ? "Unmute audio" : "Mute audio"}>{muted ? <VolumeX size={13} /> : <Volume2 size={13} />}</button></div>}
    {!preview && <div className="absolute bottom-5 left-0 right-0 z-10 text-center text-[10px] tracking-[.18em] text-white/25">{audioStarted ? "now playing" : "misa.lol / " + config.profile.username}</div>}
  </div>;
}

function ProfileBackground({ config, videoRef, particles, muted, onVideoReady, onVideoError }: { config: ProfileConfig; videoRef: React.RefObject<HTMLVideoElement | null>; particles: Array<{ left: string; top: string; delay: string; size: number }>; muted: boolean; onVideoReady: () => void; onVideoError: () => void }) {
  const { background, backgroundVideo } = config.assets;
  const effect = config.settings.backgroundEffect;
  return <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: config.settings.backgroundColor }}><div className="absolute -inset-[10%] animate-drift" style={{ opacity: config.settings.backgroundOpacity / 100, backgroundImage: background?.url ? `url(${background.url})` : `radial-gradient(circle at 19% 10%, ${config.settings.accentColor}30, transparent 28%), radial-gradient(circle at 80% 75%, #3c205a70, transparent 32%), linear-gradient(135deg, #090a13, #140d25 48%, #07070a)`, backgroundSize: "cover", backgroundPosition: "center" }} />{backgroundVideo.url && <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" style={{ opacity: config.settings.backgroundOpacity / 100 }} src={backgroundVideo.url} autoPlay loop muted={muted} playsInline preload="metadata" onLoadedMetadata={onVideoReady} onLoadedData={onVideoReady} onPlaying={onVideoReady} onError={onVideoError} />}{effect === "Glow" && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_15%,rgba(0,0,0,.45)_78%)]" />}{effect === "Particles" && <div className="absolute inset-0">{particles.map((particle, i) => <span key={i} className="absolute rounded-full bg-white/35" style={{ left: particle.left, top: particle.top, width: particle.size, height: particle.size, animation: `drift ${7 + i % 5}s ease-in-out ${particle.delay} infinite` }} />)}</div>}{effect === "Stars" && <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,.8) 1px, transparent 1px)", backgroundSize: "67px 67px" }} />}</div>;
}

function detectVideoAudio(video: HTMLVideoElement): boolean | null {
  const candidate = video as HTMLVideoElement & { audioTracks?: { length: number }; mozHasAudio?: boolean; webkitAudioDecodedByteCount?: number };
  if (candidate.audioTracks && typeof candidate.audioTracks.length === "number") return candidate.audioTracks.length > 0;
  if (typeof candidate.mozHasAudio === "boolean") return candidate.mozHasAudio;
  try {
    const mediaVideo = candidate as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
    const stream = typeof mediaVideo.captureStream === "function" ? mediaVideo.captureStream() : typeof mediaVideo.mozCaptureStream === "function" ? mediaVideo.mozCaptureStream() : null;
    if (stream) {
      const tracks = stream.getAudioTracks();
      if (tracks.length > 0) return true;
    }
  } catch { /* Some browsers restrict captureStream until playback begins. */ }
  if (typeof candidate.webkitAudioDecodedByteCount === "number" && candidate.webkitAudioDecodedByteCount > 0) return true;
  return null;
}

function BadgeIcon({ name }: { name: string }) { return name === "Premium" ? <Sparkles size={14} fill="currentColor" /> : name === "OG" ? <Zap size={14} fill="currentColor" /> : <BadgeCheck size={15} />; }
function safeSocialHref(value: string) { try { const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`; const url = new URL(candidate); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined; } catch { return undefined; } }
function EyeIcon() { return <span className="relative flex h-3.5 w-5 items-center justify-center rounded-[50%] border border-current"><span className="h-1.5 w-1.5 rounded-full bg-current" /></span>; }
