export const uploadLimits: Record<string, number> = {
  avatar: 25_000_000, background: 40_000_000, banner: 25_000_000, ogImage: 25_000_000, favicon: 5_000_000,
  cursor: 5_000_000, backgroundVideo: 110_000_000, backgroundEffectVideo: 110_000_000, audio: 40_000_000,
  audioArtwork: 15_000_000, clickSound: 400_000, customFont: 2_000_000, cover: 3_000_000, socialIcon: 512_000, entryIcon: 5_000_000,
};
const types: Record<string, string> = { png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", webp:"image/webp", gif:"image/gif", ico:"image/x-icon", mp4:"video/mp4", webm:"video/webm", mov:"video/quicktime", mp3:"audio/mpeg", wav:"audio/wav", ogg:"audio/ogg", m4a:"audio/mp4", aac:"audio/aac", flac:"audio/flac", woff:"font/woff", woff2:"font/woff2", ttf:"font/ttf", otf:"font/otf" };
const aliases: Record<string,string> = { "image/jpg":"image/jpeg", "image/vnd.microsoft.icon":"image/x-icon", "audio/mp3":"audio/mpeg", "audio/x-wav":"audio/wav", "audio/x-m4a":"audio/mp4", "audio/x-flac":"audio/flac", "application/font-woff":"font/woff", "application/font-woff2":"font/woff2", "application/x-font-ttf":"font/ttf", "application/x-font-otf":"font/otf" };
export function uploadMime(kind: string, name: string, mime: string): string | null {
  if (!Object.hasOwn(uploadLimits, kind)) return null;
  const extension = name.split(".").pop()?.toLowerCase() || "";
  let expected = types[extension];
  if ((kind === "audio" || kind === "clickSound") && extension === "webm") expected = "audio/webm";
  const actual = mime === "application/octet-stream" || !mime ? expected : aliases[mime.toLowerCase()] || mime.toLowerCase();
  const category = kind === "customFont" ? "font/" : ["audio","clickSound"].includes(kind) ? "audio/" : ["backgroundVideo","backgroundEffectVideo"].includes(kind) ? "video/" : "image/";
  return expected && actual === expected && actual.startsWith(category) ? actual : null;
}
export function validUploadBytes(mime: string, bytes: Uint8Array) {
  const b = Buffer.from(bytes), text = (start:number,end:number) => b.subarray(start,end).toString("ascii");
  if (b.length < 12) return false;
  switch (mime) {
    case "image/png": return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    case "image/jpeg": return b[0]===255 && b[1]===216 && b[2]===255;
    case "image/gif": return ["GIF87a","GIF89a"].includes(text(0,6));
    case "image/webp": return text(0,4)==="RIFF" && text(8,12)==="WEBP";
    case "image/x-icon": return b.subarray(0,4).equals(Buffer.from([0,0,1,0]));
    case "video/mp4": case "video/quicktime": case "audio/mp4": return text(4,8)==="ftyp";
    case "video/webm": case "audio/webm": return b.subarray(0,4).equals(Buffer.from([26,69,223,163]));
    case "audio/mpeg": return text(0,3)==="ID3" || (b[0]===255 && (b[1]&224)===224);
    case "audio/aac": return b[0]===255 && (b[1]&246)===240;
    case "audio/wav": return text(0,4)==="RIFF" && text(8,12)==="WAVE";
    case "audio/ogg": return text(0,4)==="OggS";
    case "audio/flac": return text(0,4)==="fLaC";
    case "font/woff": return text(0,4)==="wOFF";
    case "font/woff2": return text(0,4)==="wOF2";
    case "font/otf": return text(0,4)==="OTTO";
    case "font/ttf": return b.subarray(0,4).equals(Buffer.from([0,1,0,0]));
    default: return false;
  }
}
