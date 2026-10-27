"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { changePasswordAction, loginAction, registerAction, updateProfileAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/types";

function Errors({ state }: { state: ActionState }) {
  if (!state?.error) return null;
  return <p className="text-sm text-destructive">{state.error}</p>;
}

export function LoginForm({ next, showDemo }: { next?: string; showDemo: boolean }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="space-y-1.5">
        <Label htmlFor="account">用户名或邮箱</Label>
        <Input id="account" name="account" required autoComplete="username" className="h-10" />
        {state?.fieldErrors?.account ? <p className="text-sm text-destructive">{state.fieldErrors.account}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">密码</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" className="h-10" />
        {state?.fieldErrors?.password ? <p className="text-sm text-destructive">{state.fieldErrors.password}</p> : null}
      </div>
      <Errors state={state} />
      <Button type="submit" disabled={pending} className="h-10 w-full">
        {pending ? "登录中…" : "登录"}
      </Button>
      <p className="text-sm text-muted-foreground">
        还没有账号？ <Link href="/register" className="text-primary">注册</Link>
      </p>
      {showDemo ? (
        <div className="rounded-lg border bg-muted/50 p-3 text-sm leading-6">
          <p className="font-medium">本地演示账号</p>
          <p>管理员 admin / admin123456</p>
          <p>版主 lin / demo123456</p>
          <p>会员 he / demo123456</p>
          <p className="mt-1 text-muted-foreground">初始密码只用于演示。公网使用前请在个人资料里修改。</p>
        </div>
      ) : null}
    </form>
  );
}

export function RegisterForm({
  captcha,
  formToken,
  adminState,
}: {
  captcha: { id: string; svg: string };
  formToken: string;
  adminState: "ready" | "configured" | "missing";
}) {
  const [state, action, pending] = useActionState(registerAction, null);
  const [challenge, setChallenge] = useState(captcha);

  async function refreshCaptcha() {
    const response = await fetch("/api/captcha", { method: "POST" });
    if (!response.ok) return;
    const next = (await response.json()) as { id: string; svg: string };
    setChallenge(next);
  }

  useEffect(() => {
    if (state?.refreshCaptcha) void refreshCaptcha();
  }, [state]);

  return (
    <form action={action} className="relative space-y-4">
      <input type="hidden" name="formToken" value={formToken} />
      <input type="hidden" name="captchaId" value={challenge.id} />
      <div className="hp-field" aria-hidden="true">
        <label htmlFor="faxNumber">传真</label>
        <input id="faxNumber" name="faxNumber" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="username">用户名</Label>
        <Input id="username" name="username" required minLength={3} maxLength={20} autoComplete="username" className="h-10" placeholder="字母、数字或下划线" />
        {state?.fieldErrors?.username ? <p className="text-sm text-destructive">{state.fieldErrors.username}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nickname">昵称</Label>
        <Input id="nickname" name="nickname" required maxLength={16} className="h-10" placeholder="显示在发言旁边" />
        {state?.fieldErrors?.nickname ? <p className="text-sm text-destructive">{state.fieldErrors.nickname}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">邮箱</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" className="h-10" />
        {state?.fieldErrors?.email ? <p className="text-sm text-destructive">{state.fieldErrors.email}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">密码</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="h-10" />
        <ul className="list-disc pl-4 text-xs leading-5 text-muted-foreground">
          <li>至少 8 位，并且同时包含字母和数字</li>
          <li>不能包含用户名，也不要使用常见密码</li>
        </ul>
        {state?.fieldErrors?.password ? <p className="text-sm text-destructive">{state.fieldErrors.password}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">确认密码</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" className="h-10" />
        {state?.fieldErrors?.confirmPassword ? <p className="text-sm text-destructive">{state.fieldErrors.confirmPassword}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="captcha">验证码</Label>
        <div className="flex items-center gap-3">
          <div className="overflow-hidden rounded-lg border" dangerouslySetInnerHTML={{ __html: challenge.svg }} />
          <Button type="button" variant="outline" onClick={() => void refreshCaptcha()}>换一张</Button>
        </div>
        <Input id="captcha" name="captcha" required inputMode="numeric" autoComplete="off" className="h-10" placeholder="图中加法的结果" />
        {state?.fieldErrors?.captcha ? <p className="text-sm text-destructive">{state.fieldErrors.captcha}</p> : null}
      </div>
      <Errors state={state} />
      <Button type="submit" disabled={pending} className="h-10 w-full">
        {pending ? "提交中…" : "注册"}
      </Button>
      {adminState === "missing" ? (
        <p className="text-sm text-muted-foreground">当前还没有管理员。请先在环境变量 ADMIN_EMAIL 里填写邮箱，再用该邮箱注册，这个账号会成为管理员。</p>
      ) : null}
      {adminState === "configured" ? (
        <p className="text-sm text-muted-foreground">环境变量 ADMIN_EMAIL 已配置。用该邮箱注册的账号会成为管理员。</p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        已有账号？ <Link href="/login" className="text-primary">登录</Link>
      </p>
    </form>
  );
}

export function ProfileForm({ nickname, bio, avatarHue }: { nickname: string; bio: string; avatarHue: number }) {
  const [state, action, pending] = useActionState(updateProfileAction, null);
  const [hue, setHue] = useState(avatarHue);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="nickname">昵称</Label>
        <Input id="nickname" name="nickname" required maxLength={16} defaultValue={nickname} className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bio">简介</Label>
        <Textarea id="bio" name="bio" maxLength={200} defaultValue={bio} className="min-h-28" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="avatarHue">头像颜色</Label>
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: `hsl(${hue} 42% 34%)` }}>
            {nickname.slice(0, 1)}
          </span>
          <input id="avatarHue" name="avatarHue" type="range" min={0} max={360} value={hue} onChange={(event) => setHue(Number(event.target.value))} className="w-full" />
        </div>
      </div>
      {state?.ok ? <p className="text-sm text-primary">{state.ok}</p> : null}
      <Errors state={state} />
      <Button type="submit" disabled={pending} className="h-10">{pending ? "保存中…" : "保存资料"}</Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">当前密码</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">新密码</Label>
        <Input id="newPassword" name="newPassword" type="password" required autoComplete="new-password" className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">确认新密码</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" className="h-10" />
      </div>
      {state?.ok ? <p className="text-sm text-primary">{state.ok}</p> : null}
      <Errors state={state} />
      <Button type="submit" disabled={pending} className="h-10">{pending ? "更新中…" : "更新密码"}</Button>
    </form>
  );
}
