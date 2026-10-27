"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail } from "@/lib/action";
import { getCurrentUser } from "@/lib/auth";
import { ForumError } from "@/lib/errors";
import { deriveTitle } from "@/lib/format";
import { isStaff } from "@/lib/permissions";
import { recordAttempt, tooMany } from "@/lib/rate-limit";
import { safeNext } from "@/lib/request";
import type { ActionState, Role } from "@/lib/types";
import {
  banSchema,
  boardSchema,
  boardUpdateSchema,
  fieldErrors,
  postSchema,
  reportSchema,
  reservedSlug,
  roleSchema,
  threadSchema,
} from "@/lib/validators";
import { pageForPost } from "@/server/queries";
import {
  createBoard,
  createReply,
  createReport,
  createThread,
  deleteBoard,
  markAllNotificationsRead,
  markNotificationRead,
  moveThread,
  resolveReport,
  restorePost,
  restoreThread,
  setPostHidden,
  setThreadFlag,
  setUserBanned,
  setUserRole,
  softDeletePost,
  softDeleteThread,
  updateBoard,
  updatePost,
} from "@/server/writes";

function refresh() {
  revalidatePath("/", "layout");
}

const HOUR = 60 * 60_000;

const LIMITS = {
  thread: { limit: 10, message: "发帖太频繁了，请稍后再试。" },
  reply: { limit: 60, message: "回复太频繁了，请稍后再试。" },
  report: { limit: 20, message: "举报太频繁了，请稍后再试。" },
} as const;

async function throttle(user: { id: string; role: Role }, kind: keyof typeof LIMITS) {
  if (isStaff(user.role)) return;
  const rule = LIMITS[kind];
  if (await tooMany(kind, `user:${user.id}`, rule.limit, HOUR)) throw new ForumError(rule.message);
}

async function viewer() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function createThreadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await viewer();
    const parsed = threadSchema.safeParse({
      boardId: formData.get("boardId"),
      title: formData.get("title"),
      content: formData.get("content"),
    });
    if (!parsed.success) return { error: "请检查输入", fieldErrors: fieldErrors(parsed.error) };
    await throttle(user, "thread");
    const created = await createThread({
      ...parsed.data,
      title: parsed.data.title || deriveTitle(parsed.data.content),
      authorId: user.id,
    });
    await recordAttempt("thread", `user:${user.id}`);
    refresh();
    redirect(`/threads/${created.threadId}`);
  } catch (error) {
    return fail(error);
  }
}

export async function replyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await viewer();
    const threadId = String(formData.get("threadId") ?? "");
    const parentId = String(formData.get("parentId") ?? "");
    const parsed = postSchema.safeParse({ content: formData.get("content"), parentId, title: "" });
    if (!parsed.success) return { error: "请检查输入", fieldErrors: fieldErrors(parsed.error) };
    await throttle(user, "reply");
    const created = await createReply({
      threadId,
      authorId: user.id,
      parentId: parentId || null,
      content: parsed.data.content,
    });
    await recordAttempt("reply", `user:${user.id}`);
    const page = await pageForPost(threadId, created.postId);
    refresh();
    redirect(`/threads/${threadId}?page=${page}#post-${created.postId}`);
  } catch (error) {
    return fail(error);
  }
}

export async function editPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await viewer();
    const postId = String(formData.get("postId") ?? "");
    const threadId = String(formData.get("threadId") ?? "");
    const parsed = postSchema.safeParse({
      content: formData.get("content"),
      title: formData.get("title") ?? "",
    });
    if (!parsed.success) return { error: "请检查输入", fieldErrors: fieldErrors(parsed.error) };
    const title = typeof parsed.data.title === "string" ? parsed.data.title.trim() : "";
    if (title && title.length < 2) return { error: "标题至少 2 个字", fieldErrors: { title: "标题至少 2 个字" } };
    await updatePost({ postId, actorId: user.id, content: parsed.data.content, title });
    const page = await pageForPost(threadId, postId);
    refresh();
    redirect(`/threads/${threadId}?page=${page}#post-${postId}`);
  } catch (error) {
    return fail(error);
  }
}

export async function deletePostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await viewer();
    const result = await softDeletePost({ postId: String(formData.get("postId") ?? ""), actorId: user.id });
    refresh();
    redirect(result.removedThread ? "/" : `/threads/${result.threadId}`);
  } catch (error) {
    return fail(error);
  }
}

export async function restorePostAction(formData: FormData) {
  const user = await viewer();
  const result = await restorePost({ postId: String(formData.get("postId") ?? ""), actorId: user.id });
  refresh();
  redirect(`/threads/${result.threadId}#post-${String(formData.get("postId") ?? "")}`);
}

export async function hidePostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await viewer();
    const hidden = formData.get("hidden") === "1";
    const result = await setPostHidden({
      postId: String(formData.get("postId") ?? ""),
      actorId: user.id,
      hidden,
      reason: String(formData.get("reason") ?? ""),
    });
    refresh();
    redirect(`/threads/${result.threadId}#post-${String(formData.get("postId") ?? "")}`);
  } catch (error) {
    return fail(error);
  }
}

export async function reportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await viewer();
    const parsed = reportSchema.safeParse({
      targetType: formData.get("targetType"),
      targetId: formData.get("targetId"),
      reason: formData.get("reason"),
      detail: formData.get("detail") ?? "",
    });
    if (!parsed.success) return { error: "请检查输入", fieldErrors: fieldErrors(parsed.error) };
    await throttle(user, "report");
    await createReport({ ...parsed.data, reporterId: user.id });
    await recordAttempt("report", `user:${user.id}`);
    refresh();
    return { ok: "已提交举报，版主会在审核队列里看到。" };
  } catch (error) {
    return fail(error);
  }
}

export async function togglePinAction(formData: FormData) {
  const user = await viewer();
  await setThreadFlag({
    threadId: String(formData.get("threadId") ?? ""),
    actorId: user.id,
    flag: "pin",
    value: formData.get("value") === "1",
  });
  refresh();
  redirect(`/threads/${String(formData.get("threadId") ?? "")}`);
}

export async function toggleLockAction(formData: FormData) {
  const user = await viewer();
  await setThreadFlag({
    threadId: String(formData.get("threadId") ?? ""),
    actorId: user.id,
    flag: "lock",
    value: formData.get("value") === "1",
  });
  refresh();
  redirect(`/threads/${String(formData.get("threadId") ?? "")}`);
}

export async function moveThreadAction(formData: FormData) {
  const user = await viewer();
  const threadId = String(formData.get("threadId") ?? "");
  await moveThread({ threadId, actorId: user.id, boardId: String(formData.get("boardId") ?? "") });
  refresh();
  redirect(`/threads/${threadId}`);
}

export async function deleteThreadAction(formData: FormData) {
  const user = await viewer();
  await softDeleteThread({ threadId: String(formData.get("threadId") ?? ""), actorId: user.id });
  refresh();
  redirect("/");
}

export async function restoreThreadAction(formData: FormData) {
  const user = await viewer();
  const threadId = String(formData.get("threadId") ?? "");
  await restoreThread({ threadId, actorId: user.id });
  refresh();
  redirect(`/threads/${threadId}`);
}

export async function createBoardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await viewer();
    if (user.role !== "admin") return { error: "只有管理员可以新建版块" };
    const parsed = boardSchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      description: formData.get("description") ?? "",
      sortOrder: formData.get("sortOrder") ?? 0,
      postRole: formData.get("postRole") ?? "user",
    });
    if (!parsed.success) return { error: "请检查输入", fieldErrors: fieldErrors(parsed.error) };
    if (reservedSlug(parsed.data.slug)) return { error: "这个地址是保留字", fieldErrors: { slug: "这个地址是保留字" } };
    await createBoard({ ...parsed.data, actorId: user.id });
    refresh();
    redirect(`/boards/${parsed.data.slug}`);
  } catch (error) {
    return fail(error);
  }
}

export async function updateBoardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await viewer();
    if (user.role !== "admin") return { error: "只有管理员可以修改版块" };
    const parsed = boardUpdateSchema.safeParse({
      boardId: formData.get("boardId"),
      name: formData.get("name"),
      slug: formData.get("slug"),
      description: formData.get("description") ?? "",
      sortOrder: formData.get("sortOrder") ?? 0,
      postRole: formData.get("postRole") ?? "user",
    });
    if (!parsed.success) return { error: "请检查输入", fieldErrors: fieldErrors(parsed.error) };
    if (reservedSlug(parsed.data.slug)) return { error: "这个地址是保留字", fieldErrors: { slug: "这个地址是保留字" } };
    await updateBoard({ ...parsed.data, actorId: user.id });
    refresh();
    redirect(`/boards/${parsed.data.slug}`);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteBoardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await viewer();
    await deleteBoard({ actorId: user.id, boardId: String(formData.get("boardId") ?? "") });
    refresh();
    redirect("/boards");
  } catch (error) {
    return fail(error);
  }
}

export async function setUserRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await viewer();
    const parsed = roleSchema.safeParse({ userId: formData.get("userId"), role: formData.get("role") });
    if (!parsed.success) return { error: "请检查输入", fieldErrors: fieldErrors(parsed.error) };
    await setUserRole({ actorId: user.id, ...parsed.data });
    refresh();
    return { ok: "角色已更新" };
  } catch (error) {
    return fail(error);
  }
}

export async function setUserBannedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await viewer();
    const parsed = banSchema.safeParse({
      userId: formData.get("userId"),
      banned: formData.get("banned"),
      reason: formData.get("reason") ?? "",
    });
    if (!parsed.success) return { error: "请检查输入", fieldErrors: fieldErrors(parsed.error) };
    await setUserBanned({
      actorId: user.id,
      userId: parsed.data.userId,
      banned: parsed.data.banned === "1",
      reason: parsed.data.reason,
    });
    refresh();
    return { ok: parsed.data.banned === "1" ? "账号已封禁，对方的登录已全部退出" : "已解除封禁" };
  } catch (error) {
    return fail(error);
  }
}

export async function resolveReportAction(formData: FormData) {
  const user = await viewer();
  if (!isStaff(user.role)) redirect("/");
  const action = String(formData.get("action") ?? "");
  if (action !== "dismiss" && action !== "hide" && action !== "delete") {
    redirect("/moderation");
  }
  await resolveReport({
    reportId: String(formData.get("reportId") ?? ""),
    actorId: user.id,
    action,
    note: String(formData.get("note") ?? ""),
  });
  refresh();
  redirect(safeNext(formData.get("next"), "/moderation"));
}

export async function openNotificationAction(formData: FormData) {
  const user = await viewer();
  const href = await markNotificationRead(user.id, String(formData.get("id") ?? ""));
  refresh();
  redirect(href.startsWith("/") && !href.startsWith("//") ? href : "/notifications");
}

export async function markAllReadAction() {
  const user = await viewer();
  await markAllNotificationsRead(user.id);
  refresh();
  redirect("/notifications");
}
