import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageWidth, Pagination } from "@/components/forum-bits";
import { ThreadList } from "@/components/thread-list";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { THREAD_PAGE_SIZE } from "@/lib/constants";
import { formatCount } from "@/lib/format";
import { pageCount, parsePage, withQuery } from "@/lib/paging";
import { forumStats, listBoards, listThreads, updatesSince } from "@/server/queries";

export const metadata: Metadata = { title: "最新讨论" };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const user = await getCurrentUser();
  const unreadOnly = params.filter === "unread" && Boolean(user);
  const [{ threads, total }, boards, stats, fresh] = await Promise.all([
    listThreads({ viewerId: user?.id, unreadOnly, page, pageSize: THREAD_PAGE_SIZE, order: "latest" }),
    listBoards(),
    forumStats(),
    user ? updatesSince(user.prevVisitAt) : Promise.resolve(0),
  ]);
  const totalPages = pageCount(total, THREAD_PAGE_SIZE);
  return (
    <PageWidth>
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_250px]">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">最新讨论</h1>
              <p className="text-sm text-muted-foreground">按最后回复排序。未读主题前面有一枚圆点。</p>
            </div>
            <Button asChild className="h-10 px-4">
              <Link href={user ? "/threads/new" : "/login?next=/threads/new"}>发布主题</Link>
            </Button>
          </div>
          {user && fresh > 0 ? (
            <p className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              自你上次访问以来，有 {fresh} 个主题有了新回复。
            </p>
          ) : null}
          {user ? (
            <div className="mb-3 flex gap-2 text-sm">
              <Link href="/" className={!unreadOnly ? "font-medium text-primary" : "text-muted-foreground"}>全部</Link>
              <Link href="/?filter=unread" className={unreadOnly ? "font-medium text-primary" : "text-muted-foreground"}>未读</Link>
            </div>
          ) : null}
          {threads.length === 0 ? (
            <EmptyState title={unreadOnly ? "没有未读主题" : "还没有主题"}>
              {unreadOnly ? "你已经跟上了目前的讨论。" : "登录之后就可以发布第一篇。"}
            </EmptyState>
          ) : (
            <ThreadList threads={threads} showBoard />
          )}
          <Pagination page={page} totalPages={totalPages} hrefFor={(next) => withQuery("/", { page: next === 1 ? undefined : next, filter: unreadOnly ? "unread" : undefined })} />
        </section>
        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-medium">版块</h2>
              <Link href="/boards" className="text-sm text-primary">全部</Link>
            </div>
            <ul className="space-y-2">
              {boards.map((board) => (
                <li key={board.id}>
                  <Link href={`/boards/${board.slug}`} className="block leading-6 hover:text-primary">
                    <span className="font-medium">{board.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{board.threadCount} 个主题</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border bg-card p-4 text-sm leading-7">
            <h2 className="mb-1 font-medium">社区</h2>
            <p>{formatCount(stats.users)} 位会员</p>
            <p>{formatCount(stats.threads)} 个主题 · {formatCount(stats.posts)} 条发言</p>
            <p>今日新主题 {formatCount(stats.todayThreads)}</p>
          </div>
        </aside>
      </div>
    </PageWidth>
  );
}
