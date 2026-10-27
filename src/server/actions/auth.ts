"use server";

import { redirect } from "next/navigation";
import { fail } from "@/lib/action";
import {
  adminSetupToken,
  createSession,
  destroySession,
  findUserByAccount,
  findUserById,
  getCurrentUser,
  hasAnyAdmin,
  matchesAdminSetupToken,
  revokeOtherSessions,
} from "@/lib/auth";
import { consumeCaptcha, consumeFormToken } from "@/lib/captcha";
import { dbGet, dbRun } from "@/lib/db";
import { createId } from "@/lib/ids";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { countAttempts, isLocalIp, recordAttempt, tooMany } from "@/lib/rate-limit";
import { clientIp, safeNext } from "@/lib/request";
import type { ActionState } from "@/lib/types";
import {
  disposableEmail,
  fieldErrors,
  loginSchema,
  passwordChangeSchema,
  profileSchema,
  registerSchema,
} from "@/lib/validators";
import { markAllThreadsRead } from "@/server/writes";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const parsed = loginSchema.safeParse({
      account: formData.get("account"),
      password: formData.get("password"),
    });
    if (!parsed.success) return { error: "请检查输入", fieldErrors: fieldErrors(parsed.error) };
    const ip = await clientIp();
    const accountKey = parsed.data.account.toLowerCase();
    const windowMs = 15 * 60_000;
    if (
      (await tooMany("login", `ip:${ip}`, 20, windowMs)) ||
      (await tooMany("login", `ipacct:${ip}:${accountKey}`, 8, windowMs))
    ) {
      return { error: "尝试过于频繁，请稍后再试。" };
    }
    // A hard per-account limit would let anyone lock a victim out, so account-wide failures only add delay.
    const accountFailures = await countAttempts("login", `acct:${accountKey}`, windowMs);
    const delay = accountFailures >= 10 ? Math.min(3_000, 350 + (accountFailures - 9) * 250) : 350;
    const user = await findUserByAccount(parsed.data.account);
    const matched = await verifyPassword(parsed.data.password, user?.password_hash ?? null);
    if (!user || !matched) {
      await recordAttempt("login", `ip:${ip}`);
      await recordAttempt("login", `ipacct:${ip}:${accountKey}`);
      await recordAttempt("login", `acct:${accountKey}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return { error: "用户名或密码不正确" };
    }
    await createSession(user.id, { rotateVisit: true });
    redirect(safeNext(formData.get("next")));
  } catch (error) {
    return fail(error);
  }
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const parsed = registerSchema.safeParse({
      username: formData.get("username"),
      email: formData.get("email"),
      nickname: formData.get("nickname"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
      captcha: formData.get("captcha"),
      captchaId: formData.get("captchaId"),
      formToken: formData.get("formToken"),
      faxNumber: formData.get("faxNumber"),
      adminToken: formData.get("adminToken") ?? undefined,
    });
    if (!parsed.success) return { error: "请检查输入", fieldErrors: fieldErrors(parsed.error) };
    const data = parsed.data;
    const ip = await clientIp();
    const limit = isLocalIp(ip) ? 40 : 5;
    if (await tooMany("register", `ip:${ip}`, limit, 60 * 60_000)) {
      return { error: "注册过于频繁，请稍后再试。" };
    }
    await recordAttempt("register", `ip:${ip}`);
    if ((data.faxNumber ?? "").trim()) {
      await consumeFormToken(data.formToken);
      await consumeCaptcha(data.captchaId, data.captcha);
      return { error: "注册未通过校验，请重试。", refreshCaptcha: true };
    }
    const token = await consumeFormToken(data.formToken);
    if (token === "fast") return { error: "提交太快了，请确认信息后再试。" };
    if (token !== "ok") return { error: "页面停留太久或已失效，请刷新后重新注册。", refreshCaptcha: true };
    const captchaOk = await consumeCaptcha(data.captchaId, data.captcha);
    if (!captchaOk) return { error: "验证码不正确或已过期，请换一张。", refreshCaptcha: true };

    const username = data.username.toLowerCase();
    const email = data.email.toLowerCase();
    if (disposableEmail(email)) return { error: "请使用常用邮箱，暂不接受一次性邮箱。" };
    const weakness = passwordProblem(data.password, username);
    if (weakness) return { error: weakness, fieldErrors: { password: weakness } };
    const nameTaken = await dbGet("SELECT id FROM users WHERE username = ?", [username]);
    if (nameTaken) return { error: "这个用户名已被使用", fieldErrors: { username: "这个用户名已被使用" } };
    const emailTaken = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
    if (emailTaken) return { error: "这个邮箱已注册", fieldErrors: { email: "这个邮箱已注册" } };

    let role: "admin" | "user" = "user";
    const adminToken = (data.adminToken ?? "").trim();
    if (adminToken) {
      if (!adminSetupToken() || (await hasAnyAdmin()) || !matchesAdminSetupToken(adminToken)) {
        return { error: "管理员口令无效", fieldErrors: { adminToken: "管理员口令无效" } };
      }
      role = "admin";
    }

    const now = Date.now();
    const id = createId();
    const passwordHash = await hashPassword(data.password);
    try {
      await dbRun(
        `INSERT INTO users (
          id, username, email, password_hash, nickname, bio, avatar_hue, role,
          created_at, last_seen_at, last_visit_at, prev_visit_at
        ) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)`,
        [id, username, email, passwordHash, data.nickname, Math.floor(Math.random() * 360), role, now, now, now, now],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/unique|duplicate/i.test(message)) return { error: "用户名或邮箱刚刚已被注册，请换一个" };
      throw error;
    }
    await markAllThreadsRead(id);
    await createSession(id);
    redirect("/");
  } catch (error) {
    return fail(error);
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) redirect("/login?next=/me");
    const parsed = profileSchema.safeParse({
      nickname: formData.get("nickname"),
      bio: formData.get("bio"),
      avatarHue: formData.get("avatarHue"),
    });
    if (!parsed.success) return { error: "请检查输入", fieldErrors: fieldErrors(parsed.error) };
    await dbRun("UPDATE users SET nickname = ?, bio = ?, avatar_hue = ? WHERE id = ?", [
      parsed.data.nickname,
      parsed.data.bio,
      parsed.data.avatarHue,
      user.id,
    ]);
    return { ok: "资料已保存" };
  } catch (error) {
    return fail(error);
  }
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) redirect("/login?next=/me");
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) return { error: "请检查输入", fieldErrors: fieldErrors(parsed.error) };
    const weakness = passwordProblem(parsed.data.newPassword, user.username);
    if (weakness) return { error: weakness, fieldErrors: { newPassword: weakness } };
    const row = await findUserById(user.id);
    const matched = await verifyPassword(parsed.data.currentPassword, row?.password_hash ?? null);
    if (!row || !matched) return { error: "当前密码不正确", fieldErrors: { currentPassword: "当前密码不正确" } };
    await dbRun("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?", [
      await hashPassword(parsed.data.newPassword),
      user.id,
    ]);
    await revokeOtherSessions(user.id);
    return { ok: "密码已更新，其他设备上的登录已退出" };
  } catch (error) {
    return fail(error);
  }
}
