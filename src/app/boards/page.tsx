import type { Metadata } from "next";
import Link from "next/link";
import { PageWidth, TimeText } from "@/components/forum-bits";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { SITE } from "@/lib/constants";
import { listBoards } from "@/server/queries";

export const metadata: Metadata = { title: "版块", description: `${SITE.name}的讨论版块` };

export default async function BoardsPage() {
  const [boards, user] = await Promise.all([listBoards(), getCurrentUser()]);
  return (
    <PageWidth>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">版块</h1>
          <p className="text-sm text-muted-foreground">先选一个地方，再开口。</p>
        </div>
        {user?.role === "admin" ? (
          <Button asChild className="h-10"><Link href="/boards/new">新建版块</Link></Button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {boards.map((board) => (
          <article key={board.id} className="border-b px-4 py-4 last:border-b-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/boards/${board.slug}`} className="text-lg font-medium hover:text-primary">{board.name}</Link>
              <span className="flex items-center gap-3 text-sm text-muted-foreground">
                {board.threadCount} 个主题
                {user?.role === "admin" ? (
                  <Link href={`/boards/${board.slug}/edit`} className="text-primary hover:underline">编辑</Link>
                ) : null}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{board.description}</p>
            {board.lastThreadTitle && board.lastThreadId ? (
              <p className="mt-2 text-sm">
                最新：
                <Link href={`/threads/${board.lastThreadId}`} className="ml-1 hover:text-primary">{board.lastThreadTitle}</Link>
                {board.lastPostAt ? <span className="ml-2 text-muted-foreground"><TimeText value={board.lastPostAt} /></span> : null}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">还没有主题</p>
            )}
          </article>
        ))}
      </div>
    </PageWidth>
  );
}
