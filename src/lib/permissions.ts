import type { Role } from "@/lib/types";

export function isStaff(role: Role | null | undefined) {
  return role === "moderator" || role === "admin";
}

export function canReplyToThread(role: Role | null | undefined, locked: boolean, deleted: boolean) {
  if (!role || deleted) return false;
  if (locked && !isStaff(role)) return false;
  return true;
}
