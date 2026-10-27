const SHANGHAI = "Asia/Shanghai";

export function formatDateTime(ms: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: SHANGHAI,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
}

export function formatDate(ms: number, now = Date.now()) {
  const year = yearInShanghai(ms);
  const current = yearInShanghai(now);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: SHANGHAI,
    year: year === current ? undefined : "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(ms));
}

export function formatRelative(ms: number, now = Date.now()) {
  const diff = now - ms;
  if (diff < 0) return formatDateTime(ms);
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return formatDate(ms, now);
}

export function shanghaiMidnight(now = Date.now()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
  return new Date(`${day}T00:00:00+08:00`).getTime();
}

function yearInShanghai(ms: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI,
    year: "numeric",
  }).format(new Date(ms));
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function excerpt(text: string, limit = 90) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  return `${flat.slice(0, limit)}…`;
}

export function plainText(markdown: string) {
  return markdown
    .replace(/```[^\n]*\n?/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^[ \t]*(?:#{1,6}|>+|[-*+]|\d+\.)[ \t]+/gm, "")
    .replace(/[*_`~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function previewText(markdown: string, limit = 50) {
  const chars = Array.from(plainText(markdown));
  if (chars.length <= limit) return chars.join("");
  return `${chars.slice(0, limit).join("")}…`;
}

export function snippetAround(text: string, query: string, radius = 42) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!query) return excerpt(flat, radius * 2);
  const index = flat.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return excerpt(flat, radius * 2);
  const start = Math.max(0, index - radius);
  const end = Math.min(flat.length, index + query.length + radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

export function likeContains(value: string) {
  return `%${value.replace(/[!%_]/g, (char) => `!${char}`)}%`;
}

export function floorLabel(floor: number) {
  return floor === 1 ? "楼主" : `${floor} 楼`;
}

export function reasonLabel(value: string) {
  const found = {
    spam: "垃圾广告",
    abuse: "人身攻击",
    illegal: "违法违规",
    offtopic: "与版块无关",
    other: "其他",
  }[value];
  return found ?? value;
}
