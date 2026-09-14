"use client";

import { AtSign, BadgeCheck, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { ProfileMusicPlayer } from "@/components/profile/ProfileMusicPlayer";
import { ProfileSections } from "@/components/profile/ProfileSections";
import { ProfileWidgets } from "@/components/profile/ProfileWidgets";
import { SocialLinks } from "@/components/socials/SocialLinks";
import { badgePaint, hasVerifiedBadge } from "@/lib/badges";
import { avatarRadius, formatJoinDate } from "@/lib/profile-layout";
import { useAuth } from "@/lib/auth-store";
import { playlistTracks, resolvedAudioSource } from "@/lib/audio";
import { useDiscordLive } from "@/lib/discord-live";
import type { ProfileConfig } from "@/lib/types";
import { bioLines, nameTracking, typeMs, typeSize, usernameEffectClass } from "@/lib/typography";

function useCardDiscord(config: ProfileConfig) {
  const live = useDiscordLive()?.state?.card;
  const username = useAuth().user?.username;
  if (config.discord?.avatar || config.discord?.decoration || config.discord?.guildTag) return config.discord;
  if (username && username === config.profile.username) return live;
  return undefined;
}

export function ProfileAvatar({ config, className = "" }: { config: ProfileConfig; className?: string }) {
  const radius = avatarRadius(config.settings.avatarShape);
  const showBorder = config.settings.showAvatarBorder !== false;
  const discord = useCardDiscord(config);
  const src = discord?.avatar || config.assets.avatar.url;
  const outerClass = "relative mx-auto " + (showBorder ? "p-1 " : "p-0 ") + (className.includes("h-") ? className : "h-24 w-24 " + className);
  const innerClass = "flex h-full w-full items-center justify-center overflow-hidden " + (showBorder ? "border-4 border-[#15151d] bg-gradient-to-br from-[#6358a3] via-[#282442] to-[#0d0d13]" : "border-0 bg-transparent") + " text-3xl font-semibold text-white";
  return (
    <div className={outerClass} style={{ borderRadius: radius, background: showBorder ? "linear-gradient(135deg, " + config.settings.accentColor + ", #ffffff55, " + config.settings.accentColor + "22)" : "transparent" }}>
      <div className={innerClass} style={{ borderRadius: radius }}>
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : config.profile.displayName.slice(0, 1)}
      </div>
      {discord?.decoration && <img src={discord.decoration} alt="" className="pointer-events-none absolute inset-[-18%] z-[3] h-[136%] w-[136%] max-w-none" />}
    </div>
  );
}
export function ProfileBanner({ config }: { config: ProfileConfig }) {
  const src = config.assets.banner?.url;
  if (!src) return null;
  const radius = config.settings.bannerShape === "square" ? "0px" : config.settings.bannerShape === "pill" ? "999px" : "18px";
  const height = profileLayoutIsSleek(config) ? 148 : 112;
  return <div className="overflow-hidden" style={{ borderRadius: radius, height }}><img src={src} alt="" className="h-full w-full object-cover" /></div>;
}

export function ProfileIdentity({ config, align = "center" }: { config: ProfileConfig; align?: "left" | "center" | "right" }) {
  const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const guild = useCardDiscord(config)?.guildTag;
  return (
    <div style={{ textAlign: align }}>
      <div className={`flex items-center gap-2 ${justify}`}>
        {config.settings.showDisplayName !== false && <ProfileDisplayName config={config} />}
        {guild?.tag && guild.badge && <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-white/90"><img src={guild.badge} alt="" className="h-4 w-4 rounded-sm object-cover" />{guild.tag}</span>}
        {hasVerifiedBadge(config.badges) && <span className="text-[#fb7185]" title="Verified"><BadgeCheck size={19} fill="currentColor" strokeWidth={1.4} /></span>}
      </div>
      <p className="mt-1 text-xs text-white/35">@{config.profile.username}</p>
    </div>
  );
}

export function ProfileDisplayName({ config }: { config: ProfileConfig }) {
  const s = config.settings;
  const name = config.profile.displayName;
  const effect = s.usernameEffect;
  const [typed, setTyped] = useState(effect === "Typewriter" ? "" : name);
  useEffect(() => {
    if (effect !== "Typewriter") { setTyped(name); return; }
    setTyped("");
    if (effect === "Typewriter") {
      let index = 0;
      const timer = window.setInterval(() => {
        index += 1;
        setTyped(name.slice(0, index));
        if (index >= name.length) window.clearInterval(timer);
      }, 38);
      return () => window.clearInterval(timer);
    }
    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      setTyped(name.split("").map((ch, index) => {
        if (ch === " " || index < Math.floor(step / 2)) return name[index] || "";
        return glyphs[Math.floor(Math.random() * glyphs.length)];
      }).join(""));
      if (step > name.length * 2 + 4) window.clearInterval(timer);
    }, 40);
    return () => window.clearInterval(timer);
  }, [name, effect]);
  const usernameColor = s.usernameColor || s.textColor || "#ffffff";
  const effectColor = s.usernameEffectColor || s.accentColor || "#e11d48";
  const gradientEffect = effect === "Gradient" || effect === "Typewriter" || effect === "Shimmer" || effect === "Rainbow";
  const effectClass = usernameEffectClass(effect);
  const rainbow = effect === "Rainbow" ? { backgroundImage: "linear-gradient(90deg, " + usernameColor + ", " + effectColor + ", #ffd166, " + usernameColor + ")", backgroundSize: "200% 100%" } : {};
  const outlineShadow = effect === "Outline"
    ? "-1px -1px 0 " + effectColor + ", 1px -1px 0 " + effectColor + ", -1px 1px 0 " + effectColor + ", 1px 1px 0 " + effectColor
    : undefined;
  return (
    <h1
      className={`font-semibold ${effectClass}`}
      style={{
        fontSize: typeSize(s.fontSize) + 8,
        letterSpacing: nameTracking(s.letterSpacing),
        color: gradientEffect ? undefined : effect === "Outline" ? "transparent" : usernameColor,
        textShadow: outlineShadow || (s.usernameGlow || effect === "Glow" || effect === "Neon" ? "0 0 24px " + effectColor + "aa" : undefined),
        ["--username-color" as string]: usernameColor,
        ["--effect-color" as string]: effectColor,
        ...rainbow,
      }}
    >
      {typed || name}
    </h1>
  );
}

export function ProfileBio({ config, align = "center" }: { config: ProfileConfig; align?: "left" | "center" | "right" }) {
  const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const lines = bioLines(config.profile.description);
  const [typed, setTyped] = useState(config.settings.bioTypewriter ? "" : config.profile.description);
  useEffect(() => {
    if (!config.settings.bioTypewriter || lines.length === 0) {
      setTyped(config.profile.description);
      return;
    }
    let line = 0;
    let index = 0;
    let deleting = false;
    let timer = 0;
    const typeSpeed = typeMs(config.settings.bioTypeMs, 55);
    const deleteSpeed = typeMs(config.settings.bioDeleteMs, 35);
    const pause = Math.max(400, Math.min(4000, Number(config.settings.bioPauseMs) || 1200));
    const tick = () => {
      const current = lines[line] || "";
      if (!deleting) {
        index += 1;
        setTyped(current.slice(0, index));
        if (index >= current.length) {
          deleting = lines.length > 1;
          timer = window.setTimeout(tick, lines.length > 1 ? pause : 999999);
          return;
        }
        timer = window.setTimeout(tick, typeSpeed);
        return;
      }
      index -= 1;
      setTyped(current.slice(0, Math.max(0, index)));
      if (index <= 0) {
        deleting = false;
        line = (line + 1) % lines.length;
        timer = window.setTimeout(tick, typeSpeed);
        return;
      }
      timer = window.setTimeout(tick, deleteSpeed);
    };
    timer = window.setTimeout(tick, typeSpeed);
    return () => window.clearTimeout(timer);
  }, [config.profile.description, config.settings.bioTypewriter, config.settings.bioTypeMs, config.settings.bioDeleteMs, config.settings.bioPauseMs]);
  return (
    <>
      {config.profile.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/65">{config.settings.bioTypewriter ? typed : config.profile.description}</p>}
      {config.profile.location && <p className={`mt-3 flex items-center gap-1.5 text-xs text-white/40 ${justify}`}><AtSign size={12} />{config.profile.location}</p>}
    </>
  );
}

export function ProfileBadges({ config, className = "mt-6" }: { config: ProfileConfig; className?: string }) {
  const visible = config.badges.filter((badge) => badge.owned && badge.enabled);
  if (!config.settings.showBadges || visible.length === 0) return null;
  const justify = config.settings.socialAlign === "left" ? "justify-start" : config.settings.socialAlign === "right" ? "justify-end" : "justify-center";
  return (
    <div className={`${className} flex flex-wrap gap-2 ${justify}`}>
      {visible.map((badge) => (
        <span
          key={badge.id}
          title={badge.name}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[.07] text-xs"
          style={badgePaint(badge, config.settings)}
        >
          <BadgeIcon name={badge.name} icon={badge.icon} />
        </span>
      ))}
    </div>
  );
}

export function ProfileMeta({ config, align = "center" }: { config: ProfileConfig; align?: "left" | "center" | "right" }) {
  const joined = formatJoinDate(config.profile.joinedAt);
  const showViews = config.settings.showViews;
  const showJoin = config.settings.showJoinDate && joined;
  const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  if (!showViews && !showJoin) return null;
  return (
    <div className={`mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/35 ${justify}`}>
      {showViews && <span className="inline-flex items-center gap-2"><EyeIcon />{config.profile.views.toLocaleString()} profile views</span>}
      {showJoin && <span>{joined}</span>}
    </div>
  );
}

export function ProfileModules({ config, preview, align = "center" }: { config: ProfileConfig; preview: boolean; align?: "left" | "center" | "right" }) {
  // Enabled selects the background video's audio; disabled selects the
  // separately uploaded profile audio.
  const hasPlaylist = playlistTracks(config.assets).length > 0 && resolvedAudioSource(config.assets) !== "video";
  return (
    <div style={{ textAlign: align }}>
      <ProfileBio config={config} align={align} />
      <ProfileBadges config={config} />
      <SocialLinks config={config} />
      <ProfileWidgets config={config} preview={preview} />
      <ProfileSections config={config} preview={preview} />
      {hasPlaylist && <ProfileMusicPlayer config={config} preview={preview} autoplay={!preview} />}
      <ProfileMeta config={config} align={align} />
    </div>
  );
}

function profileLayoutIsSleek(config: ProfileConfig) {
  return config.settings.layout === "Sleek";
}

function BadgeIcon({ name, icon }: { name: string; icon?: string }) {
  if (icon) return <img src={icon} alt="" className="h-3.5 w-3.5 object-contain" />;
  return name === "Premium" ? <Sparkles size={14} fill="currentColor" /> : name === "OG" ? <Zap size={14} fill="currentColor" /> : <BadgeCheck size={15} />;
}

function EyeIcon() {
  return <span className="relative flex h-3.5 w-5 items-center justify-center rounded-[50%] border border-current"><span className="h-1.5 w-1.5 rounded-full bg-current" /></span>;
}
