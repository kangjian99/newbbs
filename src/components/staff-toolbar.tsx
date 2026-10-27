import {
  deleteThreadAction,
  moveThreadAction,
  restoreThreadAction,
  toggleLockAction,
  togglePinAction,
} from "@/server/actions/forum";
import { NativeSelect } from "@/components/forum-bits";
import { Button } from "@/components/ui/button";

export function StaffToolbar({
  threadId,
  boardId,
  pinned,
  locked,
  deleted,
  boards,
}: {
  threadId: string;
  boardId: string;
  pinned: boolean;
  locked: boolean;
  deleted: boolean;
  boards: Array<{ id: string; name: string }>;
}) {
  if (deleted) {
    return (
      <form action={restoreThreadAction} className="rounded-lg border border-dashed p-3">
        <input type="hidden" name="threadId" value={threadId} />
        <p className="mb-2 text-sm">这个主题已删除，普通会员看不到。</p>
        <Button type="submit" size="sm" variant="outline">恢复主题</Button>
      </form>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <p className="text-sm font-medium">管理</p>
      <form action={togglePinAction}>
        <input type="hidden" name="threadId" value={threadId} />
        <input type="hidden" name="value" value={pinned ? "0" : "1"} />
        <Button type="submit" size="sm" variant="outline">{pinned ? "取消置顶" : "置顶"}</Button>
      </form>
      <form action={toggleLockAction}>
        <input type="hidden" name="threadId" value={threadId} />
        <input type="hidden" name="value" value={locked ? "0" : "1"} />
        <Button type="submit" size="sm" variant="outline">{locked ? "解锁" : "锁定"}</Button>
      </form>
      <form action={moveThreadAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="threadId" value={threadId} />
        <NativeSelect name="boardId" defaultValue={boardId} aria-label="移动到版块" className="h-8 w-36">
          {boards.map((board) => (
            <option key={board.id} value={board.id}>{board.name}</option>
          ))}
        </NativeSelect>
        <Button type="submit" size="sm" variant="outline">移动</Button>
      </form>
      <form action={deleteThreadAction}>
        <input type="hidden" name="threadId" value={threadId} />
        <Button type="submit" size="sm" variant="destructive">删除主题</Button>
      </form>
    </div>
  );
}
