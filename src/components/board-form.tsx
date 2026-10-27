"use client";

import { useActionState } from "react";
import { createBoardAction } from "@/server/actions/forum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function BoardForm() {
  const [state, action, pending] = useActionState(createBoardAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">名称</Label>
        <Input id="name" name="name" required minLength={2} maxLength={20} className="h-10" placeholder="例如：城南来信" />
        {state?.fieldErrors?.name ? <p className="text-sm text-destructive">{state.fieldErrors.name}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">地址</Label>
        <Input id="slug" name="slug" required minLength={2} maxLength={32} className="h-10" placeholder="south-letter" />
        <p className="text-xs text-muted-foreground">小写字母、数字和连字符，例如 tech。</p>
        {state?.fieldErrors?.slug ? <p className="text-sm text-destructive">{state.fieldErrors.slug}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">简介</Label>
        <Textarea id="description" name="description" maxLength={200} className="min-h-24" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sortOrder">排序</Label>
        <Input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={10} className="h-10" />
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="h-10">{pending ? "创建中…" : "创建版块"}</Button>
    </form>
  );
}
