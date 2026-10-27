import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BoardForm, DeleteBoardForm } from "@/components/board-form";
import { Crumbs, PageWidth } from "@/components/forum-bits";
import { getCurrentUser } from "@/lib/auth";
import { boardBySlug } from "@/server/queries";

export const metadata: Metadata = { title: "编辑版块" };

export default async function EditBoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/boards/${slug}/edit`)}`);
  if (user.role !== "admin") redirect("/boards");
  const board = await boardBySlug(slug);
  if (!board) notFound();
  return (
    <PageWidth size="narrow">
      <Crumbs items={[{ href: "/boards", label: "版块" }, { href: `/boards/${board.slug}`, label: board.name }, { label: "编辑" }]} />
      <h1 className="mb-1 text-2xl font-semibold">编辑版块</h1>
      <p className="mb-6 text-sm text-muted-foreground">只有管理员可以修改版块。</p>
      <BoardForm
        board={{ id: board.id, slug: board.slug, name: board.name, description: board.description, sortOrder: Number(board.sort_order) }}
      />
      <div className="mt-10">
        <DeleteBoardForm boardId={board.id} boardName={board.name} />
      </div>
    </PageWidth>
  );
}
