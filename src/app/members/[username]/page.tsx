import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminMemberPanel } from "@/components/admin-member-panel";
import { Crumbs, PageWidth, TimeText, UserAvatar } from "@/components/forum-bits";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/constants";
import { excerpt, formatDate } from "@/lib/format";
import { memberProfile } from "@/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const profile = await memberProfile(username);
  if (!profile) return { title: "会员不存在" };
  return { title: profile.user.nickname, description: profile.user.bio || `${profile.user.nickname} 的主页` };
}

export default async function MemberPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await memberProfile(username);
  if (!profile) notFound();
  const { user } = profile;
  const viewer = await getCurrentUser();
  const canAdminister = viewer?.role === "admin" && viewer.id !== user.id;
  return (
    <PageWidth size="medium">
      <Crumbs items={[{ href: "/", label: "首页" }, { href: "/members", label: "会员" }, { label: user.nickname }]} />
      <header className="mb-8 flex gap-4">
        <UserAvatar name={user.nickname} hue={user.avatarHue} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold">{user.nickname}</h1>
          <p className="text-sm text-muted-foreground">@{user.username}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>
            {user.banned ? <Badge variant="destructive">已封禁</Badge> : null}
            <span className="text-muted-foreground">加入于 {formatDate(user.createdAt)}</span>
          </div>
          {user.bio ? <p className="cjk mt-3 max-w-xl text-sm leading-7">{user.bio}</p> : null}
          <p className="mt-2 text-sm text-muted-foreground">{profile.threadCount} 个主题 · {profile.postCount} 条发言</p>
        </div>
      </header>
      {canAdminister ? (
        <AdminMemberPanel userId={user.id} role={user.role} banned={user.banned} banReason={user.banReason} />
      ) : null}
      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3 font-medium">最近主题</h2>
          {profile.threads.length === 0 ? <p className="text-sm text-muted-foreground">还没有主题</p> : (
            <ul className="space-y-3">
              {profile.threads.map((thread) => (
                <li key={thread.id}>
                  <Link href={`/threads/${thread.id}`} className="font-medium hover:text-primary">{thread.title}</Link>
                  <p className="text-xs text-muted-foreground">{thread.boardName} · {thread.replyCount} 条回复 · <TimeText value={thread.lastPostAt} /></p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 font-medium">最近回复</h2>
          {profile.replies.length === 0 ? <p className="text-sm text-muted-foreground">还没有回复</p> : (
            <ul className="space-y-3">
              {profile.replies.map((reply) => (
                <li key={reply.id}>
                  <Link href={`/threads/${reply.threadId}#post-${reply.id}`} className="text-sm font-medium hover:text-primary">{reply.threadTitle}</Link>
                  <p className="cjk text-sm text-muted-foreground">{excerpt(reply.content, 70)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageWidth>
  );
}
