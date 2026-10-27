import "server-only";
import { headers } from "next/headers";

function trustedProxyHops() {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  return Number.isInteger(hops) && hops >= 1 ? Math.min(hops, 10) : 1;
}

// Proxies append to X-Forwarded-For, so only the entries added by our own proxies (counted from the
// right) are trustworthy; anything to their left may be forged by the client.
export async function clientIp() {
  const incoming = await headers();
  const entries = (incoming.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const raw = entries.length > 0
    ? entries[Math.max(0, entries.length - trustedProxyHops())]
    : incoming.get("x-real-ip")?.trim();
  return raw?.slice(0, 64) || "unknown";
}

export function safeNext(value: unknown, fallback = "/") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("://") || value.includes("\\")) return fallback;
  return value;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
