import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { PageWidth } from "@/components/forum-bits";
import { getCurrentUser, hasDemoAdmin } from "@/lib/auth";
import { firstParam } from "@/lib/paging";
import { safeNext } from "@/lib/request";

export const metadata: Metadata = { title: "登录" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const next = safeNext(firstParam(params.next), "");
  if (user) redirect(next || "/");
  const showDemo = await hasDemoAdmin();
  return (
    <PageWidth size="narrow">
      <h1 className="mb-1 text-2xl font-semibold">登录</h1>
      <p className="mb-6 text-sm text-muted-foreground">用用户名或邮箱进入巷议。</p>
      <LoginForm next={next || undefined} showDemo={showDemo} />
    </PageWidth>
  );
}
