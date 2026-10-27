import "server-only";
import { headers } from "next/headers";

export async function clientIp() {
  const incoming = await headers();
  const forwarded = incoming.get("x-forwarded-for");
  const raw = forwarded?.split(",")[0]?.trim() || incoming.get("x-real-ip") || "local";
  return raw.slice(0, 64) || "local";
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
