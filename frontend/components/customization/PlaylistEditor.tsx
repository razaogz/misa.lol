"use client";

import { ChevronDown, ChevronUp, Image as ImageIcon, Pause, Play, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, TextInput } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { fileTitle, loadPlaylistLimits, newTrackId, playlistTracks, trackTitle } from "@/lib/audio";
import { readAudioTags } from "@/lib/id3";
import { IMAGE_ACCEPT } from "@/lib/image-edit";
import { usePreviewPlayer } from "@/lib/preview-player";
import { assetFromFile } from "@/lib/profile-store";
import type { AudioTrack, ProfileAsset, ProfileConfig } from "@/lib/types";

export function PlaylistEditor({ config, onChange }: { config: ProfileConfig; onChange: (tracks: AudioTrack[]) => void }) {
  const t = useT();
  const tracks = playlistTracks(config.assets);
  const [limits, setLimits] = useState({ maxTracks: 8, maxTrackBytes: 8_000_000, maxArtworkBytes: 3_000_000 });
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { void loadPlaylistLimits().then(setLimits); }, []);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...tracks];
    for (const file of Array.from(files)) {
      if (next.length >= limits.maxTracks) { window.alert(t("customize.playlistMax", { count: limits.maxTracks })); break; }
      if (file.size > limits.maxTrackBytes) { window.alert(t("customize.playlistFileTooLarge", { name: file.name, mb: Math.round(limits.maxTrackBytes / 1_000_000) })); continue; }
      const audio = await assetFromFile(file);
      const tags = await readAudioTags(file);
      next.push({
        id: newTrackId(),
        title: tags.title || fileTitle(file.name),
        audio,
        artwork: tags.artwork || { url: null },
      });
    }
    onChange(next);
  };

  const update = (id: string, patch: Partial<AudioTrack>) => onChange(tracks.map((track) => track.id === id ? { ...track, ...patch } : track));
  const move = (index: number, direction: -1 | 1) => {
    const next = [...tracks];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange(next);
  };

  return (
    <section className="rounded-2xl border border-white/[.07] bg-white/[.02] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-200">{t("customize.tracks", undefined, "Tracks")}</p>
          <p className="mt-1 text-xs text-zinc-600">{t("customize.playlistMeta", { count: tracks.length, max: limits.maxTracks, mb: Math.round(limits.maxTrackBytes / 1_000_000) })}</p>
        </div>
        <input ref={input} className="hidden" type="file" accept="audio/*" multiple onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} />
        <Button variant="subtle" className="h-9 min-h-0 px-3 text-xs" onClick={() => input.current?.click()} disabled={tracks.length >= limits.maxTracks}><Upload size={13} />{t("customize.addTracks")}</Button>
      </div>
      <div className="mt-3 space-y-3">
        {tracks.length === 0 && <p className="rounded-xl bg-black/20 px-3 py-4 text-center text-xs text-zinc-500">{t("customize.playlistEmpty")}</p>}
        {tracks.map((track, index) => (
          <TrackRow
            key={track.id}
            track={track}
            index={index}
            total={tracks.length}
            maxArtworkBytes={limits.maxArtworkBytes}
            onTitle={(title) => update(track.id, { title })}
            onArtwork={(artwork) => update(track.id, { artwork })}
            onMove={move}
            onRemove={() => onChange(tracks.filter((item) => item.id !== track.id))}
          />
        ))}
      </div>
    </section>
  );
}

function TrackRow({ track, index, total, maxArtworkBytes, onTitle, onArtwork, onMove, onRemove }: { track: AudioTrack; index: number; total: number; maxArtworkBytes: number; onTitle: (title: string) => void; onArtwork: (artwork: ProfileAsset) => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: () => void }) {
  const t = useT();
  const artInput = useRef<HTMLInputElement>(null);
  const player = usePreviewPlayer();
  const playing = player.activeId === track.id && player.playing;
  const uploadArt = async (file: File) => {
    if (file.size > maxArtworkBytes) { window.alert(t("customize.artTooLarge", { mb: Math.round(maxArtworkBytes / 1_000_000) })); return; }
    onArtwork(await assetFromFile(file));
  };
  return (
    <div className="rounded-xl border border-white/[.06] bg-black/15 p-3">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 pt-1">
          <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} className="rounded-md p-1 text-zinc-500 hover:bg-white/[.06] hover:text-white disabled:opacity-30" aria-label="Move up"><ChevronUp size={14} /></button>
          <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1} className="rounded-md p-1 text-zinc-500 hover:bg-white/[.06] hover:text-white disabled:opacity-30" aria-label="Move down"><ChevronDown size={14} /></button>
        </div>
        <button type="button" onClick={() => artInput.current?.click()} className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[.06]" aria-label="Upload cover artwork">
          {track.artwork?.url ? <img src={track.artwork.url} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={16} className="text-zinc-500" />}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <TextInput value={track.title} onChange={onTitle} placeholder={trackTitle(track)} />
          <p className="truncate text-[11px] text-zinc-600">{track.audio.name || t("customize.audioFile")} · {t("customize.playsOnPreview")}</p>
        </div>
        <button type="button" onClick={() => playing ? player.requestPause() : player.requestPlay(track.id)} className="mt-1 rounded-lg p-2 text-zinc-400 hover:bg-white/[.06] hover:text-white" aria-label={playing ? "Pause preview card" : "Play on preview card"}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
        <button type="button" onClick={onRemove} className="mt-1 rounded-lg p-2 text-zinc-600 hover:bg-white/[.06] hover:text-red-300" aria-label="Remove track"><Trash2 size={14} /></button>
      </div>
      <input ref={artInput} className="hidden" type="file" accept={IMAGE_ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadArt(file); event.target.value = ""; }} />
    </div>
  );
}
