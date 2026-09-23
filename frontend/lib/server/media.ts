import "server-only";

import React from "react";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { safePublicUrl } from "./network-safety";

export const ASSET_KINDS = [
  "avatar",
  "banner",
  "background",
  "cursor",
  "backgroundVideo",
  "backgroundEffectVideo",
  "audio",
  "audioArtwork",
  "ogImage",
  "favicon",
  "customFont",
  "clickSound",
  "entryIcon",
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_KIND_TYPES: Record<string, string> = {
  avatar: "image",
  banner: "image",
  background: "image",
  cursor: "image",
  backgroundVideo: "video",
  backgroundEffectVideo: "video",
  audio: "audio",
  audioArtwork: "image",
  ogImage: "image",
  favicon: "image",
  customFont: "font",
  clickSound: "audio",
  entryIcon: "image",
};

const SAFE_ICON = /^data:image\/(?:png|jpeg|jpg|webp|gif|x-icon|vnd\.microsoft\.icon|svg\+xml);base64,/i;
const SAFE_VIDEO = /^data:video\/(?:mp4|webm|quicktime);base64,/i;
const SAFE_AUDIO = /^data:audio\/(?:mpeg|mp3|wav|ogg|mp4|x-m4a|aac|webm);base64,/i;
const SAFE_FONT =
  /^data:(?:font\/(?:woff2?|ttf|otf|opentype|sfnt)|application\/(?:font-woff2?|x-font-ttf|x-font-otf|x-font-woff|vnd\.ms-opentype));base64,/i;

const DATA_URL = /^data:([^;,]+);base64,([\s\S]+)$/i;

const MAX_ASSET = 40_000_000;
const MAX_VIDEO_ASSET = 145_000_000;
const MAX_FONT = 2_800_000;

export function configuredMediaHosts(): string[] {
  const raw = process.env.MEDIA_HOSTS || process.env.NEXT_PUBLIC_MEDIA_HOSTS || "r2.misa.lol";
  const hosts = new Set(raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean));
  // Keep FastAPI parity: upload responses use this configured public origin.
  for (const value of [process.env.R2_PUBLIC_BASE_URL, process.env.MISA_R2_PUBLIC_BASE_URL, process.env.MISA_SUPABASE_URL]) {
    try {
      const host = value ? new URL(value).hostname.toLowerCase() : "";
      if (host) hosts.add(host);
    } catch {
      // Invalid optional configuration cannot broaden the allowlist.
    }
  }
  return [...hosts];
}

export function decodeDataUrl(url: string): { bytes: Buffer; mime: string } | null {
  const match = DATA_URL.exec((url || "").trim());
  if (!match) return null;
  try {
    const bytes = Buffer.from(match[2], "base64");
    return { bytes, mime: match[1].toLowerCase() };
  } catch {
    return null;
  }
}

export function safeMediaUrl(value: unknown): string | null {
  return safePublicUrl(value, { allowedHosts: configuredMediaHosts(), httpsOnly: true });
}

export function safeAssetUrl(url: unknown, kind: string): string | null {
  const text = String(url || "").trim();
  if (!text) return null;
  if (text.startsWith("data:")) {
    const pattern =
      kind === "image"
        ? SAFE_ICON
        : kind === "video"
          ? SAFE_VIDEO
          : kind === "audio"
            ? SAFE_AUDIO
            : kind === "font"
              ? SAFE_FONT
              : null;
    if (!pattern) return null;
    const limit = kind === "font" ? MAX_FONT : kind === "video" ? MAX_VIDEO_ASSET : MAX_ASSET;
    return pattern.test(text) && text.length <= limit ? text : null;
  }
  return safeMediaUrl(text);
}

export function mediaResponse(url: string | null | undefined): NextResponse | null {
  if (!url) return null;
  const decoded = decodeDataUrl(url);
  if (decoded) {
    return new NextResponse(new Uint8Array(decoded.bytes), {
      status: 200,
      headers: {
        "Content-Type": decoded.mime,
        "Cache-Control": "no-store",
        "Accept-Ranges": "bytes",
      },
    });
  }
  try {
    const parsed = new URL(url);
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname &&
      !parsed.username &&
      !parsed.password
    ) {
      return NextResponse.redirect(url, { status: 302 });
    }
  } catch {
    return null;
  }
  return null;
}

function dataAudioResponse(request: Request, bytes: Buffer, mime: string): NextResponse {
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Type": mime,
  });
  const range = request.headers.get("range");
  if (!range) {
    headers.set("Content-Length", String(bytes.length));
    return new NextResponse(new Uint8Array(bytes), { status: 200, headers });
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  if (!match || (!match[1] && !match[2])) {
    headers.set("Content-Range", `bytes */${bytes.length}`);
    return new NextResponse(null, { status: 416, headers });
  }
  const suffixLength = match[1] ? null : Number(match[2]);
  const start = suffixLength === null ? Number(match[1]) : Math.max(0, bytes.length - suffixLength);
  const requestedEnd = match[2] && match[1] ? Number(match[2]) : bytes.length - 1;
  const end = Math.min(requestedEnd, bytes.length - 1);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= bytes.length || end < start) {
    headers.set("Content-Range", `bytes */${bytes.length}`);
    return new NextResponse(null, { status: 416, headers });
  }
  const chunk = bytes.subarray(start, end + 1);
  headers.set("Content-Length", String(chunk.length));
  headers.set("Content-Range", `bytes ${start}-${end}/${bytes.length}`);
  return new NextResponse(new Uint8Array(chunk), { status: 206, headers });
}

export async function publicAudio(request: Request, url: string | null | undefined): Promise<NextResponse | null> {
  const safe = safeAssetUrl(url, "audio");
  if (!safe) return null;
  const decoded = decodeDataUrl(safe);
  if (decoded) return dataAudioResponse(request, decoded.bytes, decoded.mime);

  try {
    const upstreamHeaders = new Headers({ Accept: "audio/*", "Accept-Encoding": "identity" });
    for (const name of ["range", "if-range", "if-none-match", "if-modified-since"]) {
      const value = request.headers.get(name);
      if (value) upstreamHeaders.set(name, value);
    }
    const upstream = await fetch(safe, {
      cache: "no-store",
      headers: upstreamHeaders,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    if (![200, 206, 304, 416].includes(upstream.status)) return null;

    const headers = new Headers();
    for (const name of ["accept-ranges", "content-length", "content-range", "content-type", "etag", "last-modified"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!headers.has("Content-Type")) headers.set("Content-Type", "audio/mpeg");
    if (!headers.has("Accept-Ranges")) headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=300, must-revalidate");
    headers.set("X-Content-Type-Options", "nosniff");
    return new NextResponse(upstream.status === 304 || upstream.status === 416 ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return null;
  }
}
export function publicMedia(url: string | null | undefined, kind: string): NextResponse | null {
  const safe = safeAssetUrl(url, kind);
  return safe ? mediaResponse(safe) : null;
}

export function fallbackFaviconResponse(initial: string, accent: string): Response {
  const glyph = (initial || "?").trim().slice(0, 1).toUpperCase() || "?";
  const bg = accent && /^#[0-9a-fA-F]{3,8}$/.test(accent) ? accent : "#9b87f5";
  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          color: "#ffffff",
          fontSize: 36,
          fontWeight: 700,
        },
      },
      glyph
    ),
    {
      width: 64,
      height: 64,
      headers: {
        "Cache-Control": "public, max-age=120",
      },
    }
  );
}
