import type { BoardPostRole, Role } from "@/lib/types";

export function isStaff(role: Role | null | undefined) {
  return role === "moderator" || role === "admin";
}

export function canReplyToThread(role: Role | null | undefined, locked: boolean, deleted: boolean) {
  if (!role || deleted) return false;
  if (locked && !isStaff(role)) return false;
  return true;
}

export function canPostInBoard(role: Role | null | undefined, postRole: BoardPostRole | string) {
  if (!role) return false;
  if (role === "admin") return true;
  if (role === "moderator") return postRole !== "admin";
  return postRole === "user";
}
