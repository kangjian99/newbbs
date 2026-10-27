export type MediaSource =
  | { kind: "image"; src: string }
  | { kind: "video"; src: string }
  | { kind: "embed"; src: string; title: string };

const VIDEO_FILE = /\.(mp4|webm|ogv|m4v|mov)$/i;
const YOUTUBE_ID = /^[\w-]{11}$/;
const BILIBILI_ID = /^(BV[0-9A-Za-z]{10}|av\d+)$/;

export function parseHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function youtubeId(url: URL) {
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") return url.pathname.split("/")[1] ?? "";
  if (host === "youtube.com") {
    if (url.pathname === "/watch") return url.searchParams.get("v") ?? "";
    const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/);
    return match?.[1] ?? "";
  }
  return "";
}

function bilibiliId(url: URL) {
  if (url.hostname.replace(/^www\.|^m\./, "") !== "bilibili.com") return "";
  return url.pathname.match(/^\/video\/([^/]+)/)?.[1] ?? "";
}

export function classifyMedia(value: string): MediaSource | null {
  const url = parseHttpUrl(value);
  if (!url) return null;
  const youtube = youtubeId(url);
  if (YOUTUBE_ID.test(youtube)) {
    return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${youtube}`, title: "YouTube 视频" };
  }
  const bilibili = bilibiliId(url);
  if (BILIBILI_ID.test(bilibili)) {
    const key = bilibili.startsWith("BV") ? `bvid=${bilibili}` : `aid=${bilibili.slice(2)}`;
    const page = Number(url.searchParams.get("p"));
    const part = Number.isInteger(page) && page > 0 ? page : 1;
    return {
      kind: "embed",
      src: `https://player.bilibili.com/player.html?${key}&page=${part}&high_quality=1&danmaku=0&autoplay=0`,
      title: "哔哩哔哩视频",
    };
  }
  if (VIDEO_FILE.test(url.pathname)) return { kind: "video", src: url.toString() };
  return { kind: "image", src: url.toString() };
}

export function isEmbeddableVideo(value: string) {
  const media = classifyMedia(value);
  return media?.kind === "video" || media?.kind === "embed";
}

export function markdownUrl(value: string) {
  return value.trim().replace(/[\s()<>]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}
