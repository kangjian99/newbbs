import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { PageWidth } from "@/components/forum-bits";
import { adminSetupToken, getCurrentUser, hasAnyAdmin } from "@/lib/auth";
import { createCaptcha, createFormToken } from "@/lib/captcha";

export const metadata: Metadata = { title: "注册" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  const [captcha, formToken, adminExists] = await Promise.all([
    createCaptcha(),
    createFormToken(),
    hasAnyAdmin(),
  ]);
  if (adminExists && adminSetupToken()) {
    console.warn("[巷议] 已设置 ADMIN_SETUP_TOKEN，但库里已有管理员，注册页不会显示管理员口令。可用 npm run admin -- status 查看。");
  }
  const adminState = adminExists ? "ready" : adminSetupToken() ? "configured" : "missing";
  return (
    <PageWidth size="narrow">
      <h1 className="mb-1 text-2xl font-semibold">注册</h1>
      <p className="mb-6 text-sm text-muted-foreground">填完即可发言。验证码、蜜罐和频率限制用来挡住机器注册。</p>
      <RegisterForm captcha={captcha} formToken={formToken} adminState={adminState} />
    </PageWidth>
  );
}
