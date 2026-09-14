"use client";

import { Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { audioArtworkUrl, playlistTracks, publicTrackUrls, trackTitle } from "@/lib/audio";
import { usePreviewPlayer } from "@/lib/preview-player";
import type { ProfileConfig } from "@/lib/types";

type RepeatMode = "off" | "all" | "one";

export function ProfileMusicPlayer({ config, preview = false, autoplay = false }: { config: ProfileConfig; preview?: boolean; autoplay?: boolean }) {
  const tracks = useMemo(() => playlistTracks(config.assets), [config.assets]);
  const trackKey = useMemo(() => tracks.map((item) => item.id).join("|"), [tracks]);
  const { requestedId, requestNonce, pauseNonce, notify } = usePreviewPlayer();
  const audioRef = useRef<HTMLAudioElement>(null);
  const playingRef = useRef(false);
  const srcRef = useRef("");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("all");
  const [shuffle, setShuffle] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [level, setLevel] = useState(config.assets.volume);
  const order = useMemo(() => {
    const ids = tracks.map((_, i) => i);
    if (!shuffle) return ids;
    return ids.map((value, i) => [value, (i * 17 + 11) % Math.max(ids.length, 1)] as const).sort((a, b) => a[1] - b[1]).map(([value]) => value);
  }, [tracks, shuffle]);
  const safeIndex = tracks.length ? Math.min(index, tracks.length - 1) : 0;
  const track = tracks[safeIndex];
  const src = track ? (preview ? track.audio.url || "" : publicTrackUrls(config.profile.username, track).audio) : "";
  const artwork = track ? audioArtworkUrl(config.assets, track) || (preview ? "" : publicTrackUrls(config.profile.username, track).artwork) : "";

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { notify(track?.id || null, playing); }, [notify, track?.id, playing]);
  useEffect(() => {
    setIndex((current) => (tracks.length ? Math.min(current, tracks.length - 1) : 0));
  }, [trackKey, tracks.length]);
  useEffect(() => { setLevel(config.assets.volume); }, [config.assets.volume]);
  useEffect(() => () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = level / 100;
    audio.muted = muted;
  }, [level, muted]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!src) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      srcRef.current = "";
      playingRef.current = false;
      setPlaying(false);
      return;
    }
    if (srcRef.current === src) {
      if (playingRef.current) {
        audio.currentTime = 0;
        void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
      return;
    }
    audio.pause();
    audio.currentTime = 0;
    srcRef.current = src;
    audio.src = src;
    audio.preload = "metadata";
    if (playingRef.current || (autoplay && !preview)) {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [src, autoplay, preview]);
  useEffect(() => {
    if (!requestNonce || !requestedId) return;
    const next = tracks.findIndex((item) => item.id === requestedId);
    if (next < 0) return;
    playingRef.current = true;
    setPlaying(true);
    setIndex(next);
  }, [requestNonce, requestedId, tracks]);
  useEffect(() => {
    if (!pauseNonce) return;
    audioRef.current?.pause();
    playingRef.current = false;
    setPlaying(false);
  }, [pauseNonce]);

  const playIndex = (nextIndex: number) => {
    if (!tracks.length) return;
    const next = (nextIndex + tracks.length) % tracks.length;
    playingRef.current = true;
    setPlaying(true);
    if (next === safeIndex) {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      return;
    }
    setIndex(next);
  };
  const step = (direction: 1 | -1) => {
    if (!tracks.length) return;
    const position = order.indexOf(safeIndex);
    playIndex(order[(position + direction + order.length) % order.length]);
  };
  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (!audio.src && src) audio.src = src;
      void audio.play().then(() => setPlaying(true)).catch(() => undefined);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };
  const ended = () => {
    if (repeat === "one") {
      audioRef.current!.currentTime = 0;
      void audioRef.current!.play();
      return;
    }
    const position = order.indexOf(safeIndex);
    if (position === order.length - 1 && repeat === "off") {
      setPlaying(false);
      playingRef.current = false;
      return;
    }
    step(1);
  };
  const keepOnCard = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  if (config.assets.audioEnabled || !track) return null;

  const swap = Boolean(config.settings.widgetColorSwap);
  const ink = config.settings.backgroundColor;
  const accent = config.settings.accentColor;
  const sliderAccent = swap ? ink : "#e11d48";

  return (
    <div
      className={`relative z-20 mt-6 rounded-2xl border p-3 text-left ${swap ? "" : "border-white/[.1] bg-black/25"}`}
      style={swap ? { backgroundColor: accent, color: ink, borderColor: `${ink}33` } : undefined}
      onClick={keepOnCard}
      onPointerDown={keepOnCard}
    >
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={ended}
      />
      <div className="flex items-center gap-3">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl ${swap ? "" : "bg-white/[.06]"}`} style={swap ? { backgroundColor: `${ink}1a` } : undefined}>
          {artwork ? <img src={artwork} alt="" className="h-full w-full object-cover" /> : <Volume2 size={18} className={swap ? "" : "text-white/40"} style={swap ? { color: ink } : undefined} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${swap ? "" : "text-white"}`}>{trackTitle(track)}</p>
          <p className={`mt-0.5 text-[11px] ${swap ? "" : "text-white/40"}`} style={swap ? { opacity: 0.66 } : undefined}>{safeIndex + 1} / {tracks.length}</p>
        </div>
      </div>
      <input
        aria-label="Seek"
        type="range"
        min={0}
        max={Math.max(1, Math.floor(duration))}
        value={Math.floor(currentTime)}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (audioRef.current) audioRef.current.currentTime = next;
          setCurrentTime(next);
        }}
        className={`mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full ${swap ? "" : "bg-white/[.12]"}`}
        style={{ accentColor: sliderAccent, backgroundColor: swap ? `${ink}22` : undefined }}
      />
      <div className={`mt-1 flex justify-between font-mono text-[10px] ${swap ? "" : "text-white/35"}`} style={swap ? { opacity: 0.55 } : undefined}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <IconButton label={shuffle ? "Disable shuffle" : "Shuffle"} active={shuffle} ink={swap ? ink : undefined} onClick={() => setShuffle((value) => !value)}><Shuffle size={14} /></IconButton>
          <IconButton label="Previous track" ink={swap ? ink : undefined} onClick={() => step(-1)}><SkipBack size={15} /></IconButton>
          <button type="button" onClick={toggle} className={`mx-1 flex h-10 w-10 items-center justify-center rounded-full ${swap ? "" : "bg-white/[.12] text-white hover:bg-white/[.18]"}`} style={swap ? { backgroundColor: `${ink}22`, color: ink } : undefined} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          </button>
          <IconButton label="Next track" ink={swap ? ink : undefined} onClick={() => step(1)}><SkipForward size={15} /></IconButton>
          <IconButton label={repeat === "one" ? "Repeat one" : repeat === "all" ? "Repeat all" : "Repeat off"} active={repeat !== "off"} ink={swap ? ink : undefined} onClick={() => setRepeat((value) => value === "off" ? "all" : value === "all" ? "one" : "off")}>
            <Repeat size={14} />
            {repeat === "one" && <span className="absolute -right-0.5 -top-0.5 text-[8px]">1</span>}
          </IconButton>
        </div>
        <div className="flex min-w-[120px] flex-1 items-center gap-1 sm:max-w-[160px]">
          <button type="button" onClick={() => setMuted((value) => !value)} className={`rounded-lg p-1.5 ${swap ? "" : "text-white/60 hover:bg-white/[.08] hover:text-white"}`} style={swap ? { color: ink } : undefined} aria-label={muted ? "Unmute" : "Mute"}>
            {muted || level === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <input aria-label="Volume" type="range" min={0} max={100} value={level} onChange={(event) => setLevel(Number(event.target.value))} className={`h-1.5 w-full cursor-pointer appearance-none rounded-full ${swap ? "" : "bg-white/[.12]"}`} style={{ accentColor: sliderAccent, backgroundColor: swap ? `${ink}22` : undefined }} />
        </div>
      </div>
    </div>
  );
}

function IconButton({ children, label, onClick, active = false, ink }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean; ink?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${ink ? "" : active ? "bg-[#e11d48]/20 text-[#fecdd3]" : "text-white/60 hover:bg-white/[.08] hover:text-white"}`}
      style={ink ? { color: ink, backgroundColor: active ? `${ink}22` : "transparent" } : undefined}
    >
      {children}
    </button>
  );
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
