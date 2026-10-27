import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dbGet, dbRun } from "@/lib/db";
import { createId, randomToken, sha256 } from "@/lib/ids";
import { isStaff } from "@/lib/permissions";
import type { PublicUser, Role } from "@/lib/types";

const COOKIE = "xiangyi_session";
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

type UserRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  nickname: string;
  bio: string;
  avatar_hue: number;
  role: Role;
  must_change_password: number;
  created_at: number;
  last_seen_at: number;
  last_visit_at: number;
  prev_visit_at: number;
};

export function adminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
}

export function toPublic(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    nickname: row.nickname,
    bio: row.bio,
    avatarHue: row.avatar_hue,
    role: row.role,
    mustChangePassword: row.must_change_password === 1,
    createdAt: row.created_at,
    prevVisitAt: row.prev_visit_at,
  };
}

export async function findUserByAccount(account: string) {
  const key = account.trim().toLowerCase();
  return dbGet<UserRow>("SELECT * FROM users WHERE username = ? OR email = ?", [key, key]);
}

export async function findUserById(id: string) {
  return dbGet<UserRow>("SELECT * FROM users WHERE id = ?", [id]);
}

async function promoteIfConfigured(row: UserRow) {
  const email = adminEmail();
  if (!email || row.email !== email || row.role !== "user") return row;
  await dbRun("UPDATE users SET role = 'admin' WHERE id = ?", [row.id]);
  return { ...row, role: "admin" as const };
}

export async function createSession(userId: string, options?: { rotateVisit?: boolean }) {
  if (options?.rotateVisit) {
    const now = Date.now();
    await dbRun(
      "UPDATE users SET prev_visit_at = last_visit_at, last_visit_at = ?, last_seen_at = ? WHERE id = ?",
      [now, now, userId],
    );
  }
  const token = randomToken();
  const now = Date.now();
  await dbRun(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    [createId(), userId, sha256(token), now + SESSION_MS, now],
  );
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await dbRun("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
  jar.delete(COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = await dbGet<UserRow>(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [sha256(token), Date.now()],
  );
  if (!row) return null;
  const promoted = await promoteIfConfigured(row);
  if (Date.now() - promoted.last_seen_at > 120_000) {
    await dbRun("UPDATE users SET last_seen_at = ? WHERE id = ?", [Date.now(), promoted.id]);
  }
  return toPublic(promoted);
}

export async function requireUser(nextPath: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/moderation");
  if (!isStaff(user.role)) redirect("/");
  return user;
}

export async function countUnreadNotifications(userId: string) {
  const row = await dbGet<{ c: number }>(
    "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL",
    [userId],
  );
  return Number(row?.c ?? 0);
}

export async function hasDemoAdmin() {
  const row = await dbGet<{ must_change_password: number }>(
    "SELECT must_change_password FROM users WHERE username = ?",
    ["admin"],
  );
  return row?.must_change_password === 1;
}

export async function hasAnyAdmin() {
  const row = await dbGet<{ id: string }>("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  return Boolean(row);
}
