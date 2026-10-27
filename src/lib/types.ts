export type Role = "user" | "moderator" | "admin";

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  nickname: string;
  bio: string;
  avatarHue: number;
  role: Role;
  mustChangePassword: boolean;
  createdAt: number;
  prevVisitAt: number;
};

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: string;
  refreshCaptcha?: boolean;
} | null;

export type BoardSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  threadCount: number;
  lastThreadId: string | null;
  lastThreadTitle: string | null;
  lastPostAt: number | null;
};

export type ThreadSummary = {
  id: string;
  title: string;
  boardId: string;
  boardSlug: string;
  boardName: string;
  authorUsername: string;
  authorNickname: string;
  authorHue: number;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  viewCount: number;
  createdAt: number;
  lastPostAt: number;
  lastUsername: string | null;
  lastNickname: string | null;
  unread: boolean;
  preview: string;
};

export type PostDTO = {
  id: string;
  parentId: string | null;
  authorId: string;
  username: string;
  nickname: string;
  avatarHue: number;
  role: Role;
  content: string;
  createdAt: number;
  editedAt: number | null;
  isOp: boolean;
  floor: number;
  deleted: boolean;
  hidden: boolean;
  hiddenReason: string;
  canViewBody: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canHide: boolean;
  canRestore: boolean;
  canReply: boolean;
  canReport: boolean;
  parentNickname: string | null;
};
