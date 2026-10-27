"use client";

import { useActionState } from "react";
import { reportAction } from "@/server/actions/forum";
import { REPORT_REASONS } from "@/lib/constants";
import { NativeSelect } from "@/components/forum-bits";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReportThread({ threadId }: { threadId: string }) {
  const [state, action, pending] = useActionState(reportAction, null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">举报主题</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>举报这个主题</DialogTitle>
          <DialogDescription>版主会在审核队列里处理。</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="targetType" value="thread" />
          <input type="hidden" name="targetId" value={threadId} />
          <div className="space-y-1.5">
            <Label htmlFor="thread-reason">原因</Label>
            <NativeSelect id="thread-reason" name="reason" defaultValue="offtopic">
              {REPORT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>{reason.label}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="thread-detail">补充说明</Label>
            <Textarea id="thread-detail" name="detail" maxLength={500} />
          </div>
          {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state?.ok ? <p className="text-sm text-primary">{state.ok}</p> : null}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">取消</Button></DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "提交中…" : "提交举报"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
