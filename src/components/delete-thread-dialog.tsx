"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteThreadAction } from "@/server/actions/forum";

export function DeleteThreadDialog({ threadId, title, replyCount }: { threadId: string; title: string; replyCount: number }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="destructive">删除主题</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>管理操作：删除整个主题？</DialogTitle>
          <DialogDescription>
            你正在删除「{title}」。
            {replyCount > 0 ? `其中 ${replyCount} 条回复也会一起从普通会员面前消失。` : ""}
            管理人员可以在主题页恢复。
          </DialogDescription>
        </DialogHeader>
        <form action={deleteThreadAction}>
          <input type="hidden" name="threadId" value={threadId} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">取消</Button>
            </DialogClose>
            <Button type="submit" variant="destructive">确认删除</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
