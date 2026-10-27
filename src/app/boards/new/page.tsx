import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BoardForm } from "@/components/board-form";
import { PageWidth } from "@/components/forum-bits";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "新建版块" };

export default async function NewBoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/boards/new");
  if (user.role !== "admin") redirect("/boards");
  return (
    <PageWidth size="narrow">
      <h1 className="mb-1 text-2xl font-semibold">新建版块</h1>
      <p className="mb-6 text-sm text-muted-foreground">只有管理员可以创建版块。地址会用在链接里。</p>
      <BoardForm />
    </PageWidth>
  );
}
