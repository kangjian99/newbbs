import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock, Pin } from "lucide-react";
import { Crumbs, PageWidth, Pagination } from "@/components/forum-bits";
import { ReportThread } from "@/components/report-thread";
import { StaffToolbar } from "@/components/staff-toolbar";
import { ThreadDiscussion } from "@/components/thread-discussion";
import { ThreadVisit } from "@/components/thread-visit";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { canPostInBoard, canReplyToThread, isStaff } from "@/lib/permissions";
import { parsePage, withQuery } from "@/lib/paging";
import { getThread, listBoards, threadDiscussion } from "@/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const thread = await getThread(id);
  if (!thread || thread.deleted_at) return { title: "主题" };
  return { title: thread.title, description: `${thread.board_name} · ${thread.title}` };
}

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/threads/${id}`)}`);
  const thread = await getThread(id);
  if (!thread || (thread.deleted_at && !isStaff(user?.role))) notFound();
  const page = parsePage(query.page);
  const discussion = await threadDiscussion(id, page, user);
  if (!discussion) notFound();
  const boards = isStaff(user?.role) ? await listBoards() : [];
  const locked = thread.is_locked === 1;
  const deleted = thread.deleted_at != null;
  const canReply = canReplyToThread(user?.role, locked, deleted);
  return (
    <PageWidth size="medium">
      <ThreadVisit id={thread.id} />
      <Crumbs
        items={[
          { href: "/", label: "首页" },
          { href: `/boards/${thread.board_slug}`, label: thread.board_name },
          { label: thread.title },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="cjk text-2xl font-semibold leading-snug">{thread.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {thread.is_pinned === 1 ? <Badge variant="secondary" className="gap-1"><Pin className="size-3" />置顶</Badge> : null}
            {locked ? <Badge variant="outline" className="gap-1"><Lock className="size-3" />锁定</Badge> : null}
            {deleted ? <Badge variant="destructive">已删除</Badge> : null}
            <span>{thread.reply_count} 条回复</span>
            <span>{thread.view_count} 次阅读</span>
          </div>
        </div>
        {user && user.id !== thread.author_id && !deleted ? <ReportThread threadId={thread.id} /> : null}
      </div>
      {isStaff(user?.role) ? (
        <div className="mb-6">
          <StaffToolbar
            threadId={thread.id}
            boardId={thread.board_id}
            pinned={thread.is_pinned === 1}
            locked={locked}
            deleted={deleted}
            title={thread.title}
            replyCount={discussion.liveReplies}
            boards={boards
              .filter((board) => board.id === thread.board_id || canPostInBoard(user?.role, board.postRole))
              .map((board) => ({ id: board.id, name: board.name }))}
          />
        </div>
      ) : null}
      <p className="mb-4 text-sm text-muted-foreground">
        回复按楼中楼嵌套。本页按对楼主的直接回复分页，第 {discussion.page} / {discussion.totalPages} 页，共 {discussion.totalRoots} 条主回复。
      </p>
      <ThreadDiscussion threadId={thread.id} threadTitle={thread.title} posts={discussion.posts} />
      <Pagination
        page={discussion.page}
        totalPages={discussion.totalPages}
        hrefFor={(next) => withQuery(`/threads/${thread.id}`, { page: next === 1 ? undefined : next })}
      />
      <div className="mt-8">
        {deleted ? null : locked && !canReply ? (
          <p className="rounded-lg border px-3 py-3 text-sm">本主题已锁定，不能再回复。</p>
        ) : canReply ? null : (
          <p className="rounded-lg border px-3 py-3 text-sm">
            <Link href={`/login?next=/threads/${thread.id}`} className="text-primary">登录</Link>
            后即可回复。
          </p>
        )}
      </div>
    </PageWidth>
  );
}
