import type { Metadata } from "next";
import { Composer } from "@/components/composer";
import { Crumbs, PageWidth } from "@/components/forum-bits";
import { requireUser } from "@/lib/auth";
import { canPostInBoard } from "@/lib/permissions";
import { firstParam } from "@/lib/paging";
import { createThreadAction } from "@/server/actions/forum";
import { listBoards } from "@/server/queries";

export const metadata: Metadata = { title: "发布主题" };

export default async function NewThreadPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const user = await requireUser("/threads/new");
  const params = await searchParams;
  const boards = (await listBoards()).filter((board) => canPostInBoard(user.role, board.postRole));
  const wanted = firstParam(params.board);
  const initial = boards.find((board) => board.slug === wanted)?.id ?? boards[0]?.id;
  return (
    <PageWidth size="medium">
      <Crumbs items={[{ href: "/", label: "首页" }, { label: "发布主题" }]} />
      <h1 className="mb-4 text-2xl font-semibold">发布主题</h1>
      {boards.length === 0 ? (
        <p className="rounded-lg border px-3 py-3 text-sm">目前没有你可以发布主题的版块。</p>
      ) : (
        <Composer
          action={createThreadAction}
          submitLabel="发布"
          showTitle
          boards={boards.map((board) => ({ id: board.id, name: board.name }))}
          initialBoardId={initial}
          placeholder="先写结论，再写过程。"
        />
      )}
    </PageWidth>
  );
}
