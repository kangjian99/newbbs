import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Highlight, PageWidth, Pagination, TimeText } from "@/components/forum-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { SEARCH_PAGE_SIZE } from "@/lib/constants";
import { firstParam, pageCount, parsePage, withQuery } from "@/lib/paging";
import { searchThreads } from "@/server/queries";

export const metadata: Metadata = { title: "搜索" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = firstParam(params.q).slice(0, 40);
  const page = parsePage(params.page);
  const user = await getCurrentUser();
  const data = q ? await searchThreads(q, page, SEARCH_PAGE_SIZE, { titleOnly: !user }) : null;
  const totalPages = data ? pageCount(data.total, SEARCH_PAGE_SIZE) : 1;
  return (
    <PageWidth size="medium">
      <h1 className="mb-4 text-2xl font-semibold">搜索</h1>
      <form action="/search" className="mb-6 flex gap-2">
        <Input name="q" defaultValue={q} placeholder={user ? "主题标题或发言" : "主题标题"} aria-label="关键词" className="h-10" maxLength={40} />
        <Button type="submit" className="h-10">搜索</Button>
      </form>
      {!user ? (
        <p className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          未登录只能按标题搜索。
          <Link href={`/login?next=${encodeURIComponent(q ? `/search?q=${q}` : "/search")}`} className="mx-1 text-primary underline-offset-4 hover:underline">登录</Link>
          后可以搜索发言内容。
        </p>
      ) : null}
      {!q ? (
        <EmptyState title="输入关键词">{user ? "会在主题标题和未隐藏的发言里查找，支持中文片段。" : "会在主题标题里查找，支持中文片段。"}</EmptyState>
      ) : data && data.results.length === 0 ? (
        <EmptyState title="没有匹配的主题">换一个更短的词试试。</EmptyState>
      ) : data ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">共 {data.total} 个主题</p>
          {data.results.map((result) => (
            <article key={result.id} className="rounded-xl border bg-card px-4 py-3">
              <p className="text-xs text-primary">{result.boardName}</p>
              <Link href={`/threads/${result.id}`} className="cjk text-base font-medium leading-7 hover:text-primary">
                <Highlight text={result.title} query={q} />
              </Link>
              {result.snippet ? (
                <p className="cjk mt-1 text-sm text-muted-foreground">
                  <Highlight text={result.snippet} query={q} />
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {result.replyCount} 条回复 · <TimeText value={result.lastPostAt} />
              </p>
            </article>
          ))}
          <Pagination page={page} totalPages={totalPages} hrefFor={(next) => withQuery("/search", { q, page: next === 1 ? undefined : next })} />
        </div>
      ) : null}
    </PageWidth>
  );
}
