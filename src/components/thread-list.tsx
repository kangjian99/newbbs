import Link from "next/link";
import { Lock, Pin } from "lucide-react";
import { TimeText, UserAvatar } from "@/components/forum-bits";
import { Badge } from "@/components/ui/badge";
import type { ThreadSummary } from "@/lib/types";

export function ThreadList({ threads, showBoard = false }: { threads: ThreadSummary[]; showBoard?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {threads.map((thread) => (
        <article key={thread.id} className="flex gap-3 border-b px-3 py-3 last:border-b-0 hover:bg-muted/40">
          <UserAvatar name={thread.authorNickname} hue={thread.authorHue} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {thread.unread ? (
                <span className="inline-flex items-center gap-1 text-primary">
                  <span className="size-2 rounded-full bg-primary" />
                  <span className="sr-only">有新回复</span>
                </span>
              ) : null}
              {showBoard ? (
                <Link href={`/boards/${thread.boardSlug}`} className="text-primary">{thread.boardName}</Link>
              ) : null}
              {thread.isPinned ? (
                <Badge variant="secondary" className="gap-1"><Pin className="size-3" />置顶</Badge>
              ) : null}
              {thread.isLocked ? (
                <Badge variant="outline" className="gap-1"><Lock className="size-3" />锁定</Badge>
              ) : null}
            </div>
            <Link href={`/threads/${thread.id}`} className="cjk mt-0.5 block text-base font-medium leading-7 hover:text-primary">
              {thread.title}
            </Link>
            <p className="text-xs leading-5 text-muted-foreground">
              <Link href={`/members/${thread.authorUsername}`} className="hover:text-foreground">{thread.authorNickname}</Link>
              {" · "}
              <TimeText value={thread.createdAt} />
              {" · "}
              {thread.replyCount} 条回复
              {" · "}
              {thread.viewCount} 次阅读
              {thread.lastNickname ? (
                <>
                  {" · 最后回复 "}
                  <Link href={`/members/${thread.lastUsername}`} className="hover:text-foreground">{thread.lastNickname}</Link>
                  {" · "}
                  <TimeText value={thread.lastPostAt} />
                </>
              ) : null}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
