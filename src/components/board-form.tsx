"use client";

import { useActionState } from "react";
import { createBoardAction, deleteBoardAction, updateBoardAction } from "@/server/actions/forum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type BoardValues = { id: string; slug: string; name: string; description: string; sortOrder: number };

export function BoardForm({ board }: { board?: BoardValues }) {
  const [state, action, pending] = useActionState(board ? updateBoardAction : createBoardAction, null);
  return (
    <form action={action} className="space-y-4">
      {board ? <input type="hidden" name="boardId" value={board.id} /> : null}
      <div className="space-y-1.5">
        <Label htmlFor="name">名称</Label>
        <Input id="name" name="name" required minLength={2} maxLength={20} defaultValue={board?.name} className="h-10" placeholder="例如：城南来信" />
        {state?.fieldErrors?.name ? <p className="text-sm text-destructive">{state.fieldErrors.name}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">地址</Label>
        <Input id="slug" name="slug" required minLength={2} maxLength={32} defaultValue={board?.slug} className="h-10" placeholder="south-letter" />
        <p className="text-xs text-muted-foreground">
          小写字母、数字和连字符，例如 tech。{board ? "修改地址后，旧的版块链接会失效。" : ""}
        </p>
        {state?.fieldErrors?.slug ? <p className="text-sm text-destructive">{state.fieldErrors.slug}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">简介</Label>
        <Textarea id="description" name="description" maxLength={200} defaultValue={board?.description} className="min-h-24" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sortOrder">排序</Label>
        <Input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={board?.sortOrder ?? 10} className="h-10" />
        <p className="text-xs text-muted-foreground">数字越小越靠前。</p>
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="h-10">{board ? (pending ? "保存中…" : "保存修改") : pending ? "创建中…" : "创建版块"}</Button>
    </form>
  );
}

export function DeleteBoardForm({ boardId, boardName }: { boardId: string; boardName: string }) {
  const [state, action, pending] = useActionState(deleteBoardAction, null);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`确定删除版块“${boardName}”吗？此操作不能撤销。`)) event.preventDefault();
      }}
      className="space-y-3 rounded-lg border border-destructive/40 p-4"
    >
      <input type="hidden" name="boardId" value={boardId} />
      <h2 className="font-medium text-destructive">删除版块</h2>
      <p className="text-sm text-muted-foreground">
        只有版块里没有主题时才能删除。已被删除的主题会一并彻底清除。请先把仍在使用的主题移到其他版块。
      </p>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" variant="destructive" disabled={pending}>{pending ? "删除中…" : "删除这个版块"}</Button>
    </form>
  );
}
