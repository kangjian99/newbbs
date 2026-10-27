import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageWidth, Pagination, TimeText, UserAvatar } from "@/components/forum-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEMBER_PAGE_SIZE, ROLE_LABEL } from "@/lib/constants";
import { firstParam, pageCount, parsePage, withQuery } from "@/lib/paging";
import { listMembers } from "@/server/queries";

export const metadata: Metadata = { title: "会员" };

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = firstParam(params.q).slice(0, 40);
  const page = parsePage(params.page);
  const { members, total } = await listMembers(q, page, MEMBER_PAGE_SIZE);
  const totalPages = pageCount(total, MEMBER_PAGE_SIZE);
  return (
    <PageWidth>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">会员</h1>
          <p className="text-sm text-muted-foreground">共 {total} 人</p>
        </div>
        <form action="/members" className="flex gap-2">
          <Input name="q" defaultValue={q} placeholder="昵称或用户名" aria-label="搜索会员" className="h-10 w-44" />
          <Button type="submit" variant="outline" className="h-10">查找</Button>
        </form>
      </div>
      {members.length === 0 ? (
        <EmptyState title="没有找到会员" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {members.map((member) => (
            <li key={member.id} className="rounded-xl border bg-card p-4">
              <Link href={`/members/${member.username}`} className="flex gap-3">
                <UserAvatar name={member.nickname} hue={member.avatarHue} size="lg" />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{member.nickname}</span>
                    {member.role !== "user" ? <Badge variant="secondary">{ROLE_LABEL[member.role]}</Badge> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">@{member.username}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {member.postCount} 条发言 · 加入于 <TimeText value={member.createdAt} />
                  </span>
                </span>
              </Link>
              {member.bio ? <p className="cjk mt-3 text-sm text-muted-foreground">{member.bio}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} totalPages={totalPages} hrefFor={(next) => withQuery("/members", { q: q || undefined, page: next === 1 ? undefined : next })} />
    </PageWidth>
  );
}
