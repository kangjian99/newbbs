import "server-only";
import { ROOT_REPLY_PAGE_SIZE } from "@/lib/constants";
import { dbAll, dbGet, dialect } from "@/lib/db";
import { likeContains, previewText, shanghaiMidnight, snippetAround } from "@/lib/format";
import { canReplyToThread, isStaff } from "@/lib/permissions";
import type { BoardPostRole, BoardSummary, PostDTO, PublicUser, Role, ThreadSummary } from "@/lib/types";

type ThreadRow = {
  id: string;
  title: string;
  board_id: string;
  board_slug: string;
  board_name: string;
  author_username: string;
  author_nickname: string;
  author_hue: number;
  is_pinned: number;
  is_locked: number;
  reply_count: number;
  view_count: number;
  created_at: number;
  last_post_at: number;
  last_username: string | null;
  last_nickname: string | null;
  unread: number;
  preview_source: string | null;
};

function mapThread(row: ThreadRow): ThreadSummary {
  const preview = previewText(row.preview_source ?? "", 50, row.title);
  return {
    id: row.id,
    title: row.title,
    boardId: row.board_id,
    boardSlug: row.board_slug,
    boardName: row.board_name,
    authorUsername: row.author_username,
    authorNickname: row.author_nickname,
    authorHue: row.author_hue,
    isPinned: row.is_pinned === 1,
    isLocked: row.is_locked === 1,
    replyCount: Number(row.reply_count),
    viewCount: Number(row.view_count),
    createdAt: Number(row.created_at),
    lastPostAt: Number(row.last_post_at),
    lastUsername: row.last_username,
    lastNickname: row.last_nickname,
    unread: row.unread === 1,
    preview,
  };
}

const threadSelect = `
  SELECT
    t.id, t.title, t.board_id, t.is_pinned, t.is_locked, t.reply_count, t.view_count,
    t.created_at, t.last_post_at,
    b.slug AS board_slug, b.name AS board_name,
    au.username AS author_username, au.nickname AS author_nickname, au.avatar_hue AS author_hue,
    lu.username AS last_username, lu.nickname AS last_nickname,
    (
      SELECT substr(p.content, 1, 1000) FROM posts p
      WHERE p.thread_id = t.id AND p.is_op = 1 AND p.deleted_at IS NULL AND p.hidden_at IS NULL
    ) AS preview_source,
    CASE
      WHEN ? = '' THEN 0
      WHEN t.last_post_user_id = ? THEN 0
      WHEN t.last_post_at > COALESCE(tr.last_read_at, 0) THEN 1
      ELSE 0
    END AS unread
  FROM threads t
  JOIN boards b ON b.id = t.board_id
  JOIN users au ON au.id = t.author_id
  LEFT JOIN users lu ON lu.id = t.last_post_user_id
  LEFT JOIN thread_reads tr ON tr.thread_id = t.id AND tr.user_id = ?
`;

export async function listThreads(options: {
  boardId?: string;
  viewerId?: string | null;
  unreadOnly?: boolean;
  page: number;
  pageSize: number;
  order: "latest" | "board";
}) {
  const viewer = options.viewerId ?? "";
  const where = ["t.deleted_at IS NULL"];
  const params: unknown[] = [viewer, viewer, viewer];
  if (options.boardId) {
    where.push("t.board_id = ?");
    params.push(options.boardId);
  }
  if (options.unreadOnly && viewer) {
    where.push("(t.last_post_user_id IS NULL OR t.last_post_user_id <> ?)");
    where.push("t.last_post_at > COALESCE(tr.last_read_at, 0)");
    params.push(viewer);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const orderSql = options.order === "board"
    ? "ORDER BY t.is_pinned DESC, t.last_post_at DESC"
    : "ORDER BY t.last_post_at DESC";
  const totalRow = await dbGet<{ c: number }>(
    `SELECT COUNT(*) AS c FROM threads t
     LEFT JOIN thread_reads tr ON tr.thread_id = t.id AND tr.user_id = ?
     ${whereSql}`,
    [viewer, ...params.slice(3)],
  );
  const total = Number(totalRow?.c ?? 0);
  const offset = (options.page - 1) * options.pageSize;
  const rows = await dbAll<ThreadRow>(
    `${threadSelect} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
    [...params, options.pageSize, offset],
  );
  return { threads: rows.map(mapThread), total };
}

export async function listBoards() {
  const rows = await dbAll<{
    id: string;
    slug: string;
    name: string;
    description: string;
    sort_order: number;
    post_role: BoardPostRole;
    thread_count: number;
    last_thread_id: string | null;
    last_thread_title: string | null;
    last_post_at: number | null;
  }>(
    `SELECT b.id, b.slug, b.name, b.description, b.sort_order, b.post_role,
      (SELECT COUNT(*) FROM threads t WHERE t.board_id = b.id AND t.deleted_at IS NULL) AS thread_count,
      (SELECT t.id FROM threads t WHERE t.board_id = b.id AND t.deleted_at IS NULL ORDER BY t.last_post_at DESC LIMIT 1) AS last_thread_id,
      (SELECT t.title FROM threads t WHERE t.board_id = b.id AND t.deleted_at IS NULL ORDER BY t.last_post_at DESC LIMIT 1) AS last_thread_title,
      (SELECT t.last_post_at FROM threads t WHERE t.board_id = b.id AND t.deleted_at IS NULL ORDER BY t.last_post_at DESC LIMIT 1) AS last_post_at
     FROM boards b
     ORDER BY b.sort_order ASC, b.created_at ASC`,
  );
  return rows.map((row): BoardSummary => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    postRole: row.post_role,
    threadCount: Number(row.thread_count),
    lastThreadId: row.last_thread_id,
    lastThreadTitle: row.last_thread_title,
    lastPostAt: row.last_post_at == null ? null : Number(row.last_post_at),
  }));
}

export async function boardBySlug(slug: string) {
  return dbGet<{ id: string; slug: string; name: string; description: string; sort_order: number; post_role: BoardPostRole }>(
    "SELECT id, slug, name, description, sort_order, post_role FROM boards WHERE slug = ?",
    [slug],
  );
}

export async function forumStats() {
  const row = await dbGet<{ users: number; threads: number; posts: number; today_threads: number }>(
    `SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM threads WHERE deleted_at IS NULL) AS threads,
      (SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL) AS posts,
      (SELECT COUNT(*) FROM threads WHERE deleted_at IS NULL AND created_at >= ?) AS today_threads`,
    [shanghaiMidnight()],
  );
  return {
    users: Number(row?.users ?? 0),
    threads: Number(row?.threads ?? 0),
    posts: Number(row?.posts ?? 0),
    todayThreads: Number(row?.today_threads ?? 0),
  };
}

export async function updatesSince(timestamp: number) {
  const row = await dbGet<{ c: number }>(
    "SELECT COUNT(*) AS c FROM threads WHERE deleted_at IS NULL AND last_post_at > ?",
    [timestamp],
  );
  return Number(row?.c ?? 0);
}

type PostRow = {
  id: string;
  thread_id: string;
  parent_id: string | null;
  author_id: string;
  content: string;
  is_op: number;
  created_at: number;
  edited_at: number | null;
  deleted_at: number | null;
  hidden_at: number | null;
  hidden_reason: string;
  username: string;
  nickname: string;
  avatar_hue: number;
  role: Role;
  parent_nickname: string | null;
};

function canViewBody(row: PostRow, viewer: PublicUser | null) {
  if (!row.deleted_at && !row.hidden_at) return true;
  if (row.deleted_at) return isStaff(viewer?.role);
  return isStaff(viewer?.role) || viewer?.id === row.author_id;
}

export async function getThread(id: string) {
  return dbGet<{
    id: string;
    board_id: string;
    author_id: string;
    title: string;
    is_pinned: number;
    is_locked: number;
    view_count: number;
    reply_count: number;
    created_at: number;
    deleted_at: number | null;
    board_slug: string;
    board_name: string;
  }>(
    `SELECT t.id, t.board_id, t.author_id, t.title, t.is_pinned, t.is_locked, t.view_count,
            t.reply_count, t.created_at, t.deleted_at, b.slug AS board_slug, b.name AS board_name
     FROM threads t JOIN boards b ON b.id = t.board_id
     WHERE t.id = ?`,
    [id],
  );
}

export async function threadDiscussion(threadId: string, page: number, viewer: PublicUser | null) {
  const rows = await dbAll<PostRow>(
    `SELECT p.id, p.thread_id, p.parent_id, p.author_id, p.content, p.is_op, p.created_at,
            p.edited_at, p.deleted_at, p.hidden_at, p.hidden_reason,
            u.username, u.nickname, u.avatar_hue, u.role,
            pu.nickname AS parent_nickname
     FROM posts p
     JOIN users u ON u.id = p.author_id
     LEFT JOIN posts parent ON parent.id = p.parent_id
     LEFT JOIN users pu ON pu.id = parent.author_id
     WHERE p.thread_id = ?
     ORDER BY p.created_at ASC`,
    [threadId],
  );
  const thread = await getThread(threadId);
  if (!thread) return null;
  const locked = thread.is_locked === 1;
  const threadDeleted = thread.deleted_at != null;
  const op = rows.find((row) => row.is_op === 1);
  const children = new Map<string, PostRow[]>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    const list = children.get(row.parent_id) ?? [];
    list.push(row);
    children.set(row.parent_id, list);
  }
  const roots = op ? (children.get(op.id) ?? []) : rows.filter((row) => row.is_op !== 1);
  const totalRoots = roots.length;
  const totalPages = Math.max(1, Math.ceil(totalRoots / ROOT_REPLY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = roots.slice((safePage - 1) * ROOT_REPLY_PAGE_SIZE, safePage * ROOT_REPLY_PAGE_SIZE);
  const include = new Set<string>();
  if (op) include.add(op.id);
  const walk = (row: PostRow) => {
    include.add(row.id);
    for (const child of children.get(row.id) ?? []) walk(child);
  };
  slice.forEach(walk);
  const floorOf = new Map(rows.map((row, index) => [row.id, index + 1]));
  const posts = rows.filter((row) => include.has(row.id)).map((row): PostDTO => {
    const visible = canViewBody(row, viewer);
    const staff = isStaff(viewer?.role);
    const deleted = row.deleted_at != null;
    const hidden = row.hidden_at != null;
    return {
      id: row.id,
      parentId: row.parent_id,
      authorId: row.author_id,
      username: row.username,
      nickname: row.nickname,
      avatarHue: row.avatar_hue,
      role: row.role,
      content: visible ? row.content : "",
      createdAt: Number(row.created_at),
      editedAt: row.edited_at == null ? null : Number(row.edited_at),
      isOp: row.is_op === 1,
      floor: floorOf.get(row.id) ?? 1,
      deleted,
      hidden,
      hiddenReason: row.hidden_reason,
      canViewBody: visible,
      canEdit: Boolean(viewer && viewer.id === row.author_id && !deleted && !threadDeleted && (!hidden || staff) && (!locked || staff)),
      canDelete: Boolean(viewer && !deleted && (viewer.id === row.author_id || staff)),
      canHide: Boolean(staff && !deleted),
      canRestore: Boolean(staff && deleted),
      canReply: Boolean(viewer && canReplyToThread(viewer.role, locked, threadDeleted) && !deleted && (!hidden || row.is_op === 1 || staff)),
      canReport: Boolean(viewer && viewer.id !== row.author_id && !deleted),
      parentNickname: row.parent_nickname,
    };
  });
  return { posts, page: safePage, totalPages, totalRoots };
}

export async function pageForPost(threadId: string, postId: string) {
  const rows = await dbAll<{ id: string; parent_id: string | null; is_op: number }>(
    "SELECT id, parent_id, is_op FROM posts WHERE thread_id = ? ORDER BY created_at ASC",
    [threadId],
  );
  const op = rows.find((row) => row.is_op === 1);
  if (!op || postId === op.id) return 1;
  const byId = new Map(rows.map((row) => [row.id, row]));
  let current = byId.get(postId);
  if (!current) return 1;
  while (current.parent_id && current.parent_id !== op.id) {
    const parent = byId.get(current.parent_id);
    if (!parent) break;
    current = parent;
  }
  const roots = rows.filter((row) => row.parent_id === op.id);
  const index = roots.findIndex((row) => row.id === current?.id);
  if (index < 0) return 1;
  return Math.floor(index / ROOT_REPLY_PAGE_SIZE) + 1;
}

export async function searchThreads(query: string, page: number, pageSize: number) {
  const like = likeContains(query);
  const op = dialect() === "postgres" ? "ILIKE" : "LIKE";
  const where = `t.deleted_at IS NULL AND (
    t.title ${op} ? ESCAPE '!'
    OR EXISTS (
      SELECT 1 FROM posts p
      WHERE p.thread_id = t.id AND p.deleted_at IS NULL AND p.hidden_at IS NULL AND p.content ${op} ? ESCAPE '!'
    )
  )`;
  const totalRow = await dbGet<{ c: number }>(`SELECT COUNT(*) AS c FROM threads t WHERE ${where}`, [like, like]);
  const total = Number(totalRow?.c ?? 0);
  const rows = await dbAll<{ id: string; title: string; board_name: string; board_slug: string; last_post_at: number; reply_count: number }>(
    `SELECT t.id, t.title, b.name AS board_name, b.slug AS board_slug, t.last_post_at, t.reply_count
     FROM threads t JOIN boards b ON b.id = t.board_id
     WHERE ${where}
     ORDER BY t.last_post_at DESC
     LIMIT ? OFFSET ?`,
    [like, like, pageSize, (page - 1) * pageSize],
  );
  const results = [];
  for (const row of rows) {
    const match = await dbGet<{ content: string }>(
      `SELECT content FROM posts
       WHERE thread_id = ? AND deleted_at IS NULL AND hidden_at IS NULL AND content ${op} ? ESCAPE '!'
       ORDER BY created_at ASC LIMIT 1`,
      [row.id, like],
    );
    const fallback = match
      ? null
      : await dbGet<{ content: string }>(
          "SELECT content FROM posts WHERE thread_id = ? AND is_op = 1 AND deleted_at IS NULL AND hidden_at IS NULL",
          [row.id],
        );
    results.push({
      id: row.id,
      title: row.title,
      boardName: row.board_name,
      boardSlug: row.board_slug,
      lastPostAt: Number(row.last_post_at),
      replyCount: Number(row.reply_count),
      snippet: snippetAround(match?.content ?? fallback?.content ?? "", query),
    });
  }
  return { results, total };
}

export async function listMembers(query: string, page: number, pageSize: number) {
  const like = query ? likeContains(query.toLowerCase()) : "";
  const where = query ? "WHERE username LIKE ? ESCAPE '!' OR lower(nickname) LIKE ? ESCAPE '!'" : "";
  const params = query ? [like, like] : [];
  const totalRow = await dbGet<{ c: number }>(`SELECT COUNT(*) AS c FROM users ${where}`, params);
  const rows = await dbAll<{
    id: string;
    username: string;
    nickname: string;
    bio: string;
    avatar_hue: number;
    role: Role;
    created_at: number;
    banned_at: number | null;
    post_count: number;
  }>(
    `SELECT id, username, nickname, bio, avatar_hue, role, created_at, banned_at,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = users.id AND p.deleted_at IS NULL) AS post_count
     FROM users ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return {
    total: Number(totalRow?.c ?? 0),
    members: rows.map((row) => ({
      id: row.id,
      username: row.username,
      nickname: row.nickname,
      bio: row.bio,
      avatarHue: row.avatar_hue,
      role: row.role,
      createdAt: Number(row.created_at),
      banned: row.banned_at != null,
      postCount: Number(row.post_count),
    })),
  };
}

export async function memberProfile(username: string) {
  const user = await dbGet<{
    id: string;
    username: string;
    nickname: string;
    bio: string;
    avatar_hue: number;
    role: Role;
    created_at: number;
    banned_at: number | null;
    ban_reason: string;
  }>(
    "SELECT id, username, nickname, bio, avatar_hue, role, created_at, banned_at, ban_reason FROM users WHERE username = ?",
    [username.toLowerCase()],
  );
  if (!user) return null;
  const counts = await dbGet<{ posts: number; threads: number }>(
    `SELECT
      (SELECT COUNT(*) FROM posts WHERE author_id = ? AND deleted_at IS NULL) AS posts,
      (SELECT COUNT(*) FROM threads WHERE author_id = ? AND deleted_at IS NULL) AS threads`,
    [user.id, user.id],
  );
  const threads = await dbAll<{ id: string; title: string; last_post_at: number; reply_count: number; board_name: string }>(
    `SELECT t.id, t.title, t.last_post_at, t.reply_count, b.name AS board_name
     FROM threads t JOIN boards b ON b.id = t.board_id
     WHERE t.author_id = ? AND t.deleted_at IS NULL
     ORDER BY t.created_at DESC LIMIT 8`,
    [user.id],
  );
  const replies = await dbAll<{ id: string; content: string; created_at: number; thread_id: string; thread_title: string }>(
    `SELECT p.id, p.content, p.created_at, t.id AS thread_id, t.title AS thread_title
     FROM posts p JOIN threads t ON t.id = p.thread_id
     WHERE p.author_id = ? AND p.is_op = 0 AND p.deleted_at IS NULL AND p.hidden_at IS NULL AND t.deleted_at IS NULL
     ORDER BY p.created_at DESC LIMIT 8`,
    [user.id],
  );
  return {
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      bio: user.bio,
      avatarHue: user.avatar_hue,
      role: user.role,
      createdAt: Number(user.created_at),
      banned: user.banned_at != null,
      banReason: user.ban_reason,
    },
    postCount: Number(counts?.posts ?? 0),
    threadCount: Number(counts?.threads ?? 0),
    threads: threads.map((row) => ({
      id: row.id,
      title: row.title,
      lastPostAt: Number(row.last_post_at),
      replyCount: Number(row.reply_count),
      boardName: row.board_name,
    })),
    replies: replies.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: Number(row.created_at),
      threadId: row.thread_id,
      threadTitle: row.thread_title,
    })),
  };
}

export async function listNotifications(userId: string) {
  const rows = await dbAll<{
    id: string;
    title: string;
    body: string;
    href: string;
    created_at: number;
    read_at: number | null;
    actor_nickname: string | null;
  }>(
    `SELECT n.id, n.title, n.body, n.href, n.created_at, n.read_at, u.nickname AS actor_nickname
     FROM notifications n
     LEFT JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = ?
     ORDER BY n.created_at DESC
     LIMIT 50`,
    [userId],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    href: row.href,
    createdAt: Number(row.created_at),
    read: row.read_at != null,
    actorNickname: row.actor_nickname,
  }));
}

export async function listReports(status: "open" | "closed", page: number, pageSize: number) {
  const where = status === "open" ? "r.status = 'open'" : "r.status <> 'open'";
  const totalRow = await dbGet<{ c: number }>(`SELECT COUNT(*) AS c FROM reports r WHERE ${where}`);
  const rows = await dbAll<{
    id: string;
    target_type: "post" | "thread";
    target_id: string;
    reason: string;
    detail: string;
    status: string;
    created_at: number;
    resolution_note: string;
    reporter_nickname: string;
    reporter_username: string;
    post_content: string | null;
    post_thread_id: string | null;
    post_thread_title: string | null;
    thread_title: string | null;
  }>(
    `SELECT r.id, r.target_type, r.target_id, r.reason, r.detail, r.status, r.created_at, r.resolution_note,
            u.nickname AS reporter_nickname, u.username AS reporter_username,
            p.content AS post_content, p.thread_id AS post_thread_id, pt.title AS post_thread_title,
            tt.title AS thread_title
     FROM reports r
     JOIN users u ON u.id = r.reporter_id
     LEFT JOIN posts p ON r.target_type = 'post' AND p.id = r.target_id
     LEFT JOIN threads pt ON pt.id = p.thread_id
     LEFT JOIN threads tt ON r.target_type = 'thread' AND tt.id = r.target_id
     WHERE ${where}
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`,
    [pageSize, (page - 1) * pageSize],
  );
  return {
    total: Number(totalRow?.c ?? 0),
    reports: rows.map((row) => ({
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      reason: row.reason,
      detail: row.detail,
      status: row.status,
      createdAt: Number(row.created_at),
      resolutionNote: row.resolution_note,
      reporterNickname: row.reporter_nickname,
      reporterUsername: row.reporter_username,
      excerpt: (row.post_content ?? row.thread_title ?? row.post_thread_title ?? "内容已不存在").slice(0, 140),
      href: row.target_type === "post" && row.post_thread_id
        ? `/threads/${row.post_thread_id}#post-${row.target_id}`
        : row.target_type === "thread"
          ? `/threads/${row.target_id}`
          : "/moderation",
      subject: row.post_thread_title ?? row.thread_title ?? "目标已不存在",
    })),
  };
}
