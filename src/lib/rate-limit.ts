import "server-only";
import { dbGet, dbRun } from "@/lib/db";
import { createId } from "@/lib/ids";

export function isLocalIp(ip: string) {
  if (process.env.NODE_ENV === "production") return false;
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

export async function countAttempts(action: string, key: string, windowMs: number) {
  const row = await dbGet<{ c: number }>(
    "SELECT COUNT(*) AS c FROM auth_attempts WHERE action = ? AND key = ? AND created_at > ?",
    [action, key, Date.now() - windowMs],
  );
  return Number(row?.c ?? 0);
}

export async function tooMany(action: string, key: string, limit: number, windowMs: number) {
  return (await countAttempts(action, key, windowMs)) >= limit;
}

export async function recordAttempt(action: string, key: string) {
  await dbRun("INSERT INTO auth_attempts (id, action, key, created_at) VALUES (?, ?, ?, ?)", [
    createId(),
    action,
    key,
    Date.now(),
  ]);
  if (Math.random() < 0.2) {
    await dbRun("DELETE FROM auth_attempts WHERE created_at < ?", [Date.now() - 86_400_000]);
  }
}
