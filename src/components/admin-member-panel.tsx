"use client";

import { useActionState } from "react";
import { setUserBannedAction, setUserRoleAction } from "@/server/actions/forum";
import { NativeSelect } from "@/components/forum-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABEL } from "@/lib/constants";
import type { Role } from "@/lib/types";

export function AdminMemberPanel({
  userId,
  role,
  banned,
  banReason,
}: {
  userId: string;
  role: Role;
  banned: boolean;
  banReason: string;
}) {
  const [roleState, roleAction, rolePending] = useActionState(setUserRoleAction, null);
  const [banState, banAction, banPending] = useActionState(setUserBannedAction, null);
  return (
    <section className="mb-8 space-y-4 rounded-lg border bg-muted/30 p-4">
      <h2 className="text-sm font-medium">管理员操作</h2>
      <form action={roleAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <NativeSelect name="role" defaultValue={role} aria-label="角色" className="h-9 w-32">
          {(Object.keys(ROLE_LABEL) as Role[]).map((value) => (
            <option key={value} value={value}>{ROLE_LABEL[value]}</option>
          ))}
        </NativeSelect>
        <Button type="submit" size="sm" variant="outline" disabled={rolePending}>{rolePending ? "保存中…" : "调整角色"}</Button>
        {roleState?.ok ? <span className="text-sm text-primary">{roleState.ok}</span> : null}
        {roleState?.error ? <span className="text-sm text-destructive">{roleState.error}</span> : null}
      </form>
      <form action={banAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="banned" value={banned ? "0" : "1"} />
        {banned ? (
          <>
            <span className="text-sm text-destructive">已封禁{banReason ? `：${banReason}` : ""}</span>
            <Button type="submit" size="sm" variant="outline" disabled={banPending}>{banPending ? "处理中…" : "解除封禁"}</Button>
          </>
        ) : (
          <>
            <Input name="reason" maxLength={80} placeholder="封禁原因（选填）" aria-label="封禁原因" className="h-9 w-56" />
            <Button type="submit" size="sm" variant="destructive" disabled={banPending}>{banPending ? "处理中…" : "封禁账号"}</Button>
          </>
        )}
        {banState?.ok ? <span className="text-sm text-primary">{banState.ok}</span> : null}
        {banState?.error ? <span className="text-sm text-destructive">{banState.error}</span> : null}
      </form>
      <p className="text-xs leading-5 text-muted-foreground">
        封禁后对方所有设备上的登录立即退出，无法再登录，已发的内容保留。不能封禁管理员和自己；管理员需要先降为普通会员。
      </p>
    </section>
  );
}
