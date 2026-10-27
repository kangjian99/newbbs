import "server-only";
import { MAX_REPLY_DEPTH } from "@/lib/constants";
import { dbGet, dbRun, transaction, type Sql } from "@/lib/db";
import { ForumError } from "@/lib/errors";
import { excerpt } from "@/lib/format";
import { createId } from "@/lib/ids";
import { isStaff } from "@/lib/permissions";
import type { Role } from "@/lib/types";

async function withDb<T>(tx: Sql | undefined, fn: (db: Sql) => Promise<T>) {
  if (tx) return fn(tx);
  return transaction(fn);
}

async function recomputeThread(db: Sql, threadId: string, now: number) {
  const count = await db.get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM posts WHERE thread_id = ? AND deleted_at IS NULL AND is_op = 0",
    [threadId],
  );
  const last = await db.get<{ author_id: string; created_at: number }>(
    "SELECT author_id, created_at FROM posts WHERE thread_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
    [threadId],
  );
  await db.run(
    "UPDATE threads SET reply_count = ?, last_post_at = ?, last_post_user_id = ?, updated_at = ? WHERE id = ?",
    [Number(count?.c ?? 0), last?.created_at ?? now, last?.author_id ?? null, now, threadId],
  );
}

async function parentDepth(db: Sql, parentId: string) {
  let depth = 0;
  let current: string | null = parentId;
  while (current) {
    const row: { parent_id: string | null } | undefined = await db.get(
      "SELECT parent_id FROM posts WHERE id = ?",
      [current],
    );
    if (!row?.parent_id) break;
    depth += 1;
    current = row.parent_id;
    if (depth > 32) break;
  }
  return depth;
}

async function notify(
  db: Sql,
  input: { userId: string; actorId: string; type: string; title: string; body: string; href: string; createdAt: number },
) {
  if (input.userId === input.actorId) return;
  await db.run(
    `INSERT INTO notifications (id, user_id, actor_id, type, title, body, href, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [createId(), input.userId, input.actorId, input.type, input.title, input.body, input.href, input.createdAt],
  );
}

async function markRead(db: Sql, userId: string, threadId: string, at: number) {
  await db.run(
    `INSERT INTO thread_reads (user_id, thread_id, last_read_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id, thread_id) DO UPDATE SET last_read_at = CASE
       WHEN excluded.last_read_at > thread_reads.last_read_at THEN excluded.last_read_at
       ELSE thread_reads.last_read_at
     END`,
    [userId, threadId, at],
  );
}

export async function markThreadRead(userId: string, threadId: string) {
  await dbRun(
    `INSERT INTO thread_reads (user_id, thread_id, last_read_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id, thread_id) DO UPDATE SET last_read_at = CASE
       WHEN excluded.last_read_at > thread_reads.last_read_at THEN excluded.last_read_at
       ELSE thread_reads.last_read_at
     END`,
    [userId, threadId, Date.now()],
  );
}

export async function incrementView(threadId: string) {
  await dbRun("UPDATE threads SET view_count = view_count + 1 WHERE id = ? AND deleted_at IS NULL", [threadId]);
}

export async function createThread(
  input: {
    id?: string;
    postId?: string;
    authorId: string;
    boardId: string;
    title: string;
    content: string;
    createdAt?: number;
  },
  tx?: Sql,
) {
  return withDb(tx, async (db) => {
    const board = await db.get("SELECT id FROM boards WHERE id = ?", [input.boardId]);
    if (!board) throw new ForumError("版块不存在");
    const now = input.createdAt ?? Date.now();
    const threadId = input.id ?? createId();
    const postId = input.postId ?? createId();
    await db.run(
      `INSERT INTO threads (
        id, board_id, author_id, title, created_at, updated_at, last_post_at, last_post_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [threadId, input.boardId, input.authorId, input.title, now, now, now, input.authorId],
    );
    await db.run(
      `INSERT INTO posts (id, thread_id, author_id, content, is_op, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [postId, threadId, input.authorId, input.content, now, now],
    );
    await markRead(db, input.authorId, threadId, now);
    return { threadId, postId };
  });
}

export async function createReply(
  input: {
    id?: string;
    threadId: string;
    authorId: string;
    parentId?: string | null;
    content: string;
    createdAt?: number;
    notify?: boolean;
  },
  tx?: Sql,
) {
  return withDb(tx, async (db) => {
    const thread = await db.get<{
      id: string;
      title: string;
      author_id: string;
      is_locked: number;
      deleted_at: number | null;
    }>("SELECT id, title, author_id, is_locked, deleted_at FROM threads WHERE id = ?", [input.threadId]);
    if (!thread || thread.deleted_at) throw new ForumError("主题不存在或已删除");
    const actor = await db.get<{ role: Role; nickname: string }>("SELECT role, nickname FROM users WHERE id = ?", [input.authorId]);
    if (!actor) throw new ForumError("请先登录");
    if (thread.is_locked === 1 && !isStaff(actor.role)) throw new ForumError("主题已锁定，不能再回复");
    let parentId = input.parentId || null;
    if (!parentId) {
      const op = await db.get<{ id: string }>("SELECT id FROM posts WHERE thread_id = ? AND is_op = 1", [input.threadId]);
      parentId = op?.id ?? null;
    }
    if (!parentId) throw new ForumError("找不到要回复的发言");
    const parent = await db.get<{
      id: string;
      thread_id: string;
      author_id: string;
      is_op: number;
      deleted_at: number | null;
      hidden_at: number | null;
    }>("SELECT id, thread_id, author_id, is_op, deleted_at, hidden_at FROM posts WHERE id = ?", [parentId]);
    if (!parent || parent.thread_id !== input.threadId) throw new ForumError("要回复的发言不在这个主题里");
    if (parent.deleted_at) throw new ForumError("原发言已删除，不能再回复");
    if (parent.hidden_at && parent.is_op !== 1 && !isStaff(actor.role)) throw new ForumError("原发言已被隐藏，不能再回复");
    if ((await parentDepth(db, parent.id)) + 1 > MAX_REPLY_DEPTH) {
      throw new ForumError("回复嵌套已达上限，请改回复更上层的发言");
    }
    const now = input.createdAt ?? Date.now();
    const postId = input.id ?? createId();
    await db.run(
      `INSERT INTO posts (id, thread_id, author_id, parent_id, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [postId, input.threadId, input.authorId, parent.id, input.content, now, now],
    );
    await recomputeThread(db, input.threadId, now);
    await markRead(db, input.authorId, input.threadId, now);
    if (input.notify !== false) {
      const href = `/threads/${input.threadId}#post-${postId}`;
      const preview = excerpt(input.content, 80);
      await notify(db, {
        userId: parent.author_id,
        actorId: input.authorId,
        type: "reply",
        title: `${actor.nickname} 回复了你`,
        body: preview,
        href,
        createdAt: now,
      });
      if (thread.author_id !== parent.author_id) {
        await notify(db, {
          userId: thread.author_id,
          actorId: input.authorId,
          type: "reply_thread",
          title: `${actor.nickname} 回复了你的主题`,
          body: `《${thread.title}》${preview}`,
          href,
          createdAt: now,
        });
      }
    }
    return { postId };
  });
}

export async function updatePost(input: { postId: string; actorId: string; content: string; title?: string }) {
  await transaction(async (db) => {
    const post = await db.get<{
      id: string;
      thread_id: string;
      author_id: string;
      is_op: number;
      deleted_at: number | null;
      hidden_at: number | null;
    }>("SELECT id, thread_id, author_id, is_op, deleted_at, hidden_at FROM posts WHERE id = ?", [input.postId]);
    if (!post || post.deleted_at) throw new ForumError("发言不存在或已删除");
    if (post.author_id !== input.actorId) throw new ForumError("只能编辑自己的发言");
    const thread = await db.get<{ is_locked: number; deleted_at: number | null }>(
      "SELECT is_locked, deleted_at FROM threads WHERE id = ?",
      [post.thread_id],
    );
    const actor = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.actorId]);
    if (!thread || thread.deleted_at) throw new ForumError("主题已删除");
    if (thread.is_locked === 1 && !isStaff(actor?.role)) throw new ForumError("主题已锁定，不能编辑");
    if (post.hidden_at && !isStaff(actor?.role)) throw new ForumError("发言已被隐藏，不能编辑");
    const now = Date.now();
    await db.run("UPDATE posts SET content = ?, updated_at = ?, edited_at = ? WHERE id = ?", [
      input.content,
      now,
      now,
      post.id,
    ]);
    if (post.is_op === 1 && input.title && input.title.trim()) {
      await db.run("UPDATE threads SET title = ?, updated_at = ? WHERE id = ?", [
        input.title.trim(),
        now,
        post.thread_id,
      ]);
    }
  });
}

export async function softDeletePost(input: { postId: string; actorId: string }, tx?: Sql) {
  return withDb(tx, async (db) => {
    const post = await db.get<{
      id: string;
      thread_id: string;
      author_id: string;
      is_op: number;
      deleted_at: number | null;
    }>("SELECT id, thread_id, author_id, is_op, deleted_at FROM posts WHERE id = ?", [input.postId]);
    if (!post || post.deleted_at) throw new ForumError("发言不存在或已删除");
    const actor = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.actorId]);
    if (post.author_id !== input.actorId && !isStaff(actor?.role)) throw new ForumError("不能删除这条发言");
    const now = Date.now();
    await db.run("UPDATE posts SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, post.id]);
    if (post.is_op === 1) {
      await db.run("UPDATE threads SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, post.thread_id]);
    }
    await recomputeThread(db, post.thread_id, now);
    return { threadId: post.thread_id, removedThread: post.is_op === 1 };
  });
}

export async function restorePost(input: { postId: string; actorId: string }) {
  return transaction(async (db) => {
    const actor = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.actorId]);
    if (!isStaff(actor?.role)) throw new ForumError("没有管理权限");
    const post = await db.get<{ id: string; thread_id: string; is_op: number }>(
      "SELECT id, thread_id, is_op FROM posts WHERE id = ?",
      [input.postId],
    );
    if (!post) throw new ForumError("发言不存在");
    const now = Date.now();
    await db.run("UPDATE posts SET deleted_at = NULL, updated_at = ? WHERE id = ?", [now, post.id]);
    if (post.is_op === 1) {
      await db.run("UPDATE threads SET deleted_at = NULL, updated_at = ? WHERE id = ?", [now, post.thread_id]);
    }
    await recomputeThread(db, post.thread_id, now);
    return { threadId: post.thread_id };
  });
}

export async function setPostHidden(
  input: { postId: string; actorId: string; hidden: boolean; reason?: string },
  tx?: Sql,
) {
  return withDb(tx, async (db) => {
    const actor = await db.get<{ role: Role; nickname: string }>("SELECT role, nickname FROM users WHERE id = ?", [input.actorId]);
    if (!isStaff(actor?.role)) throw new ForumError("没有管理权限");
    const post = await db.get<{ id: string; thread_id: string; author_id: string; deleted_at: number | null }>(
      "SELECT id, thread_id, author_id, deleted_at FROM posts WHERE id = ?",
      [input.postId],
    );
    if (!post || post.deleted_at) throw new ForumError("发言不存在或已删除");
    const now = Date.now();
    if (input.hidden) {
      const reason = (input.reason ?? "").trim().slice(0, 80);
      await db.run(
        "UPDATE posts SET hidden_at = ?, hidden_by = ?, hidden_reason = ?, updated_at = ? WHERE id = ?",
        [now, input.actorId, reason, now, post.id],
      );
      await notify(db, {
        userId: post.author_id,
        actorId: input.actorId,
        type: "hidden",
        title: "你的发言已被隐藏",
        body: reason || "版主未填写原因",
        href: `/threads/${post.thread_id}#post-${post.id}`,
        createdAt: now,
      });
    } else {
      await db.run(
        "UPDATE posts SET hidden_at = NULL, hidden_by = NULL, hidden_reason = '', updated_at = ? WHERE id = ?",
        [now, post.id],
      );
    }
    return { threadId: post.thread_id };
  });
}

export async function setThreadFlag(input: { threadId: string; actorId: string; flag: "pin" | "lock"; value: boolean }) {
  await transaction(async (db) => {
    const actor = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.actorId]);
    if (!isStaff(actor?.role)) throw new ForumError("没有管理权限");
    const column = input.flag === "pin" ? "is_pinned" : "is_locked";
    const updated = await db.run(
      `UPDATE threads SET ${column} = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [input.value ? 1 : 0, Date.now(), input.threadId],
    );
    if (updated.changes === 0) throw new ForumError("主题不存在或已删除");
  });
}

export async function moveThread(input: { threadId: string; actorId: string; boardId: string }) {
  await transaction(async (db) => {
    const actor = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.actorId]);
    if (!isStaff(actor?.role)) throw new ForumError("没有管理权限");
    const board = await db.get("SELECT id FROM boards WHERE id = ?", [input.boardId]);
    if (!board) throw new ForumError("目标版块不存在");
    const updated = await db.run(
      "UPDATE threads SET board_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
      [input.boardId, Date.now(), input.threadId],
    );
    if (updated.changes === 0) throw new ForumError("主题不存在或已删除");
  });
}

export async function softDeleteThread(input: { threadId: string; actorId: string }, tx?: Sql) {
  return withDb(tx, async (db) => {
    const actor = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.actorId]);
    if (!isStaff(actor?.role)) throw new ForumError("没有管理权限");
    const now = Date.now();
    const updated = await db.run("UPDATE threads SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL", [
      now,
      now,
      input.threadId,
    ]);
    if (updated.changes === 0) throw new ForumError("主题不存在或已删除");
    await db.run("UPDATE posts SET deleted_at = ? WHERE thread_id = ? AND is_op = 1 AND deleted_at IS NULL", [
      now,
      input.threadId,
    ]);
  });
}

export async function restoreThread(input: { threadId: string; actorId: string }) {
  await transaction(async (db) => {
    const actor = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.actorId]);
    if (!isStaff(actor?.role)) throw new ForumError("没有管理权限");
    const now = Date.now();
    await db.run("UPDATE threads SET deleted_at = NULL, updated_at = ? WHERE id = ?", [now, input.threadId]);
    await db.run("UPDATE posts SET deleted_at = NULL, updated_at = ? WHERE thread_id = ? AND is_op = 1", [now, input.threadId]);
    await recomputeThread(db, input.threadId, now);
  });
}

export async function createBoard(input: {
  actorId: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}) {
  await transaction(async (db) => {
    const actor = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.actorId]);
    if (actor?.role !== "admin") throw new ForumError("只有管理员可以新建版块");
    const exists = await db.get("SELECT id FROM boards WHERE slug = ?", [input.slug]);
    if (exists) throw new ForumError("这个地址已被使用");
    await db.run(
      "INSERT INTO boards (id, slug, name, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [createId(), input.slug, input.name, input.description, input.sortOrder, Date.now()],
    );
  });
}

export async function updateBoard(input: {
  actorId: string;
  boardId: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}) {
  await transaction(async (db) => {
    const actor = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.actorId]);
    if (actor?.role !== "admin") throw new ForumError("只有管理员可以修改版块");
    const board = await db.get("SELECT id FROM boards WHERE id = ?", [input.boardId]);
    if (!board) throw new ForumError("版块不存在");
    const clash = await db.get("SELECT id FROM boards WHERE slug = ? AND id <> ?", [input.slug, input.boardId]);
    if (clash) throw new ForumError("这个地址已被其他版块使用");
    await db.run("UPDATE boards SET name = ?, slug = ?, description = ?, sort_order = ? WHERE id = ?", [
      input.name,
      input.slug,
      input.description,
      input.sortOrder,
      input.boardId,
    ]);
  });
}

export async function deleteBoard(input: { actorId: string; boardId: string }) {
  await transaction(async (db) => {
    const actor = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.actorId]);
    if (actor?.role !== "admin") throw new ForumError("只有管理员可以删除版块");
    const board = await db.get("SELECT id FROM boards WHERE id = ?", [input.boardId]);
    if (!board) throw new ForumError("版块不存在");
    const active = await db.get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM threads WHERE board_id = ? AND deleted_at IS NULL",
      [input.boardId],
    );
    if (Number(active?.c ?? 0) > 0) {
      throw new ForumError(`版块里还有 ${Number(active?.c)} 个主题，请先把它们移到其他版块或删除`);
    }
    await db.run("DELETE FROM threads WHERE board_id = ?", [input.boardId]);
    await db.run("DELETE FROM boards WHERE id = ?", [input.boardId]);
  });
}

export async function setUserRole(input: { actorId: string; userId: string; role: Role }) {
  await transaction(async (db) => {
    const actor = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.actorId]);
    if (actor?.role !== "admin") throw new ForumError("只有管理员可以调整角色");
    if (input.userId === input.actorId) throw new ForumError("不能修改自己的角色");
    const target = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.userId]);
    if (!target) throw new ForumError("会员不存在");
    if (target.role === input.role) return;
    await db.run("UPDATE users SET role = ? WHERE id = ?", [input.role, input.userId]);
    const label = { user: "普通会员", moderator: "版主", admin: "管理员" }[input.role];
    await notify(db, {
      userId: input.userId,
      actorId: input.actorId,
      type: "role",
      title: `你的角色已调整为${label}`,
      body: "",
      href: "/me",
      createdAt: Date.now(),
    });
  });
}

export async function setUserBanned(input: { actorId: string; userId: string; banned: boolean; reason?: string }) {
  await transaction(async (db) => {
    const actor = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.actorId]);
    if (actor?.role !== "admin") throw new ForumError("只有管理员可以封禁账号");
    if (input.userId === input.actorId) throw new ForumError("不能封禁自己");
    const target = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.userId]);
    if (!target) throw new ForumError("会员不存在");
    if (input.banned) {
      if (target.role === "admin") throw new ForumError("不能封禁管理员，请先把他降为普通会员");
      await db.run("UPDATE users SET banned_at = ?, ban_reason = ? WHERE id = ?", [
        Date.now(),
        (input.reason ?? "").trim().slice(0, 80),
        input.userId,
      ]);
      await db.run("DELETE FROM sessions WHERE user_id = ?", [input.userId]);
    } else {
      await db.run("UPDATE users SET banned_at = NULL, ban_reason = '' WHERE id = ?", [input.userId]);
    }
  });
}

export async function createReport(
  input: { reporterId: string; targetType: "post" | "thread"; targetId: string; reason: string; detail: string; createdAt?: number },
  tx?: Sql,
) {
  return withDb(tx, async (db) => {
    const now = input.createdAt ?? Date.now();
    let ownerId = "";
    let href = "/moderation";
    let label = "内容";
    if (input.targetType === "post") {
      const post = await db.get<{ id: string; author_id: string; thread_id: string; content: string; deleted_at: number | null }>(
        "SELECT id, author_id, thread_id, content, deleted_at FROM posts WHERE id = ?",
        [input.targetId],
      );
      if (!post || post.deleted_at) throw new ForumError("要举报的发言不存在");
      if (post.author_id === input.reporterId) throw new ForumError("不能举报自己的发言");
      ownerId = post.author_id;
      href = `/threads/${post.thread_id}#post-${post.id}`;
      label = excerpt(post.content, 60);
    } else {
      const thread = await db.get<{ id: string; author_id: string; title: string; deleted_at: number | null }>(
        "SELECT id, author_id, title, deleted_at FROM threads WHERE id = ?",
        [input.targetId],
      );
      if (!thread || thread.deleted_at) throw new ForumError("要举报的主题不存在");
      if (thread.author_id === input.reporterId) throw new ForumError("不能举报自己的主题");
      ownerId = thread.author_id;
      href = `/threads/${thread.id}`;
      label = thread.title;
    }
    const open = await db.get(
      "SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open'",
      [input.reporterId, input.targetType, input.targetId],
    );
    if (open) throw new ForumError("你已经举报过这条内容，请等待处理");
    const reportId = createId();
    await db.run(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [reportId, input.reporterId, input.targetType, input.targetId, input.reason, input.detail, now],
    );
    const staff = await db.all<{ id: string }>("SELECT id FROM users WHERE role IN ('moderator', 'admin')");
    for (const person of staff) {
      await notify(db, {
        userId: person.id,
        actorId: input.reporterId,
        type: "report",
        title: "有新的举报待处理",
        body: label,
        href: "/moderation",
        createdAt: now,
      });
    }
    return { reportId, ownerId, href };
  });
}

export async function resolveReport(
  input: {
    reportId: string;
    actorId: string;
    action: "dismiss" | "hide" | "delete";
    note: string;
  },
  tx?: Sql,
) {
  await withDb(tx, async (db) => {
    const actor = await db.get<{ role: Role }>("SELECT role FROM users WHERE id = ?", [input.actorId]);
    if (!isStaff(actor?.role)) throw new ForumError("没有管理权限");
    const report = await db.get<{
      id: string;
      target_type: "post" | "thread";
      target_id: string;
      status: string;
      reporter_id: string;
    }>("SELECT id, target_type, target_id, status, reporter_id FROM reports WHERE id = ?", [input.reportId]);
    if (!report || report.status !== "open") throw new ForumError("举报不存在或已处理");
    const now = Date.now();
    if (input.action === "hide") {
      if (report.target_type !== "post") throw new ForumError("主题不能隐藏，请选择删除或驳回");
      await setPostHidden(
        { postId: report.target_id, actorId: input.actorId, hidden: true, reason: input.note || "举报成立" },
        db,
      );
    }
    if (input.action === "delete") {
      if (report.target_type === "post") {
        await softDeletePost({ postId: report.target_id, actorId: input.actorId }, db);
      } else {
        await softDeleteThread({ threadId: report.target_id, actorId: input.actorId }, db);
      }
    }
    await db.run(
      `UPDATE reports SET status = ?, resolved_by = ?, resolved_at = ?, resolution_note = ? WHERE id = ?`,
      [input.action === "dismiss" ? "dismissed" : "resolved", input.actorId, now, input.note.slice(0, 200), report.id],
    );
    await notify(db, {
      userId: report.reporter_id,
      actorId: input.actorId,
      type: "report_result",
      title: input.action === "dismiss" ? "举报已驳回" : "举报已处理",
      body: input.note || "版主已查看这条举报",
      href: "/moderation",
      createdAt: now,
    });
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const row = await dbGet<{ href: string }>("SELECT href FROM notifications WHERE id = ? AND user_id = ?", [
    notificationId,
    userId,
  ]);
  if (!row) throw new ForumError("通知不存在");
  await dbRun("UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL", [Date.now(), notificationId]);
  return row.href;
}

export async function markAllNotificationsRead(userId: string) {
  await dbRun("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", [Date.now(), userId]);
}

export async function markAllThreadsRead(userId: string, tx?: Sql) {
  await withDb(tx, async (db) => {
    await db.run(
      `INSERT INTO thread_reads (user_id, thread_id, last_read_at)
       SELECT ?, id, last_post_at FROM threads WHERE deleted_at IS NULL
       ON CONFLICT (user_id, thread_id) DO UPDATE SET last_read_at = excluded.last_read_at`,
      [userId],
    );
  });
}
