import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crumbs, EmptyState, PageWidth, Pagination } from "@/components/forum-bits";
import { ThreadList } from "@/components/thread-list";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { THREAD_PAGE_SIZE } from "@/lib/constants";
import { pageCount, parsePage, withQuery } from "@/lib/paging";
import { boardBySlug, listThreads } from "@/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const board = await boardBySlug(slug);
  if (!board) return { title: "版块不存在" };
  return { title: board.name, description: board.description };
}

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const board = await boardBySlug(slug);
  if (!board) notFound();
  const page = parsePage(query.page);
  const user = await getCurrentUser();
  const { threads, total } = await listThreads({
    boardId: board.id,
    viewerId: user?.id,
    page,
    pageSize: THREAD_PAGE_SIZE,
    order: "board",
  });
  const totalPages = pageCount(total, THREAD_PAGE_SIZE);
  return (
    <PageWidth>
      <Crumbs items={[{ href: "/", label: "首页" }, { href: "/boards", label: "版块" }, { label: board.name }]} />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{board.name}</h1>
          <p className="text-sm text-muted-foreground">{board.description}</p>
        </div>
        <div className="flex gap-2">
          {user?.role === "admin" ? (
            <Button asChild variant="outline" className="h-10"><Link href={`/boards/${board.slug}/edit`}>编辑版块</Link></Button>
          ) : null}
        <Button asChild className="h-10">
          <Link href={user ? `/threads/new?board=${board.slug}` : `/login?next=${encodeURIComponent(`/threads/new?board=${board.slug}`)}`}>发布主题</Link>
        </Button>
        </div>
      </div>
      {threads.length === 0 ? (
        <EmptyState title="这个版块还没有主题">来写第一篇。</EmptyState>
      ) : (
        <ThreadList threads={threads} />
      )}
      <Pagination
        page={Math.min(page, totalPages)}
        totalPages={totalPages}
        hrefFor={(next) => withQuery(`/boards/${board.slug}`, { page: next === 1 ? undefined : next })}
      />
    </PageWidth>
  );
}
