import type { Metadata } from "next";
import { PasswordForm, ProfileForm } from "@/components/auth-forms";
import { PageWidth, UserAvatar } from "@/components/forum-bits";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/constants";

export const metadata: Metadata = { title: "个人资料" };

export default async function MePage() {
  const user = await requireUser("/me");
  return (
    <PageWidth size="medium">
      <h1 className="mb-6 text-2xl font-semibold">个人资料</h1>
      <div className="grid gap-8 md:grid-cols-2">
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={user.nickname} hue={user.avatarHue} size="lg" />
            <div className="text-sm text-muted-foreground">
              <p>@{user.username}</p>
              <p>{user.email}</p>
              <p>{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
          <ProfileForm nickname={user.nickname} bio={user.bio} avatarHue={user.avatarHue} />
        </section>
        <section>
          <h2 className="mb-3 font-medium">修改密码</h2>
          <PasswordForm />
        </section>
      </div>
    </PageWidth>
  );
}
