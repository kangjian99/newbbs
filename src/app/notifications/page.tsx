import type { Metadata } from "next";
import { EmptyState, PageWidth, TimeText } from "@/components/forum-bits";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { markAllReadAction, openNotificationAction } from "@/server/actions/forum";
import { listNotifications } from "@/server/queries";

export const metadata: Metadata = { title: "通知" };

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const items = await listNotifications(user.id);
  const unread = items.filter((item) => !item.read).length;
  return (
    <PageWidth size="medium">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">通知</h1>
          <p className="text-sm text-muted-foreground">{unread > 0 ? `${unread} 条未读` : "没有未读通知"}</p>
        </div>
        {unread > 0 ? (
          <form action={markAllReadAction}>
            <Button type="submit" variant="outline">全部标为已读</Button>
          </form>
        ) : null}
      </div>
      {items.length === 0 ? (
        <EmptyState title="还没有通知">有人回复你的发言时，会显示在这里。</EmptyState>
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card">
          {items.map((item) => (
            <li key={item.id} className={item.read ? "border-b last:border-b-0" : "border-b bg-primary/5 last:border-b-0"}>
              <form action={openNotificationAction}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className="block w-full px-4 py-3 text-left">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{item.title}</span>
                    <TimeText value={item.createdAt} />
                  </span>
                  {item.body ? <span className="cjk mt-1 block text-sm text-muted-foreground">{item.body}</span> : null}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </PageWidth>
  );
}
