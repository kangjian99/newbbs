import { z } from "zod";
import { DISPOSABLE_EMAIL_DOMAINS, REPORT_REASONS, RESERVED_SLUGS } from "@/lib/constants";

const reasonValues = REPORT_REASONS.map((item) => item.value) as [
  (typeof REPORT_REASONS)[number]["value"],
  ...(typeof REPORT_REASONS)[number]["value"][],
];

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "用户名至少 3 个字符")
      .max(20, "用户名最多 20 个字符")
      .regex(/^[A-Za-z0-9_]+$/, "用户名只能包含字母、数字和下划线"),
    email: z.string().trim().max(120, "邮箱过长").email("请输入有效的邮箱"),
    nickname: z.string().trim().min(1, "请填写昵称").max(16, "昵称最多 16 个字"),
    password: z.string().min(8, "密码至少 8 位").max(72, "密码最多 72 位"),
    confirmPassword: z.string(),
    captcha: z.string().trim().min(1, "请填写验证码"),
    captchaId: z.string().trim().min(8, "验证码已失效，请换一张"),
    formToken: z.string().trim().min(8, "页面已失效，请刷新后重试"),
    faxNumber: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  account: z.string().trim().min(1, "请输入用户名或邮箱").max(120, "账号过长"),
  password: z.string().min(1, "请输入密码").max(72, "密码过长"),
});

export const profileSchema = z.object({
  nickname: z.string().trim().min(1, "请填写昵称").max(16, "昵称最多 16 个字"),
  bio: z.string().trim().max(200, "简介最多 200 字"),
  avatarHue: z.coerce.number().int().min(0).max(360),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码").max(72),
    newPassword: z.string().min(8, "新密码至少 8 位").max(72, "新密码最多 72 位"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "两次输入的新密码不一致",
    path: ["confirmPassword"],
  });

export const threadSchema = z.object({
  boardId: z.string().trim().min(1, "请选择版块"),
  title: z.string().trim().min(2, "标题至少 2 个字").max(60, "标题最多 60 个字"),
  content: z.string().trim().min(1, "正文不能为空").max(8000, "正文最多 8000 字"),
});

export const postSchema = z.object({
  content: z.string().trim().min(1, "回复不能为空").max(8000, "回复最多 8000 字"),
  parentId: z.string().trim().min(1).optional().or(z.literal("")),
  title: z.string().trim().max(60, "标题最多 60 个字").optional().or(z.literal("")),
});

export const boardSchema = z.object({
  name: z.string().trim().min(2, "版块名至少 2 个字").max(20, "版块名最多 20 个字"),
  slug: z
    .string()
    .trim()
    .min(2, "地址至少 2 个字符")
    .max(32, "地址最多 32 个字符")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "地址只能使用小写字母、数字和连字符"),
  description: z.string().trim().max(200, "简介最多 200 字"),
  sortOrder: z.coerce.number().int().min(0, "排序不能为负").max(9999),
});

export const reportSchema = z.object({
  targetType: z.enum(["post", "thread"]),
  targetId: z.string().trim().min(1),
  reason: z.enum(reasonValues, { message: "请选择举报原因" }),
  detail: z.string().trim().max(500, "补充说明最多 500 字"),
});

export function fieldErrors(error: z.ZodError) {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !result[key]) result[key] = issue.message;
  }
  return result;
}

export function disposableEmail(email: string) {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

export function reservedSlug(slug: string) {
  return RESERVED_SLUGS.has(slug);
}

export function normalizeCaptchaAnswer(value: string) {
  return value
    .trim()
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/\s+/g, "");
}
