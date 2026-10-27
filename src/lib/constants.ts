import type { Role } from "@/lib/types";

export const SITE = {
  name: "北地巷议",
  description: "一处安静、清楚的中文讨论区。按版块发帖，回复可以层层嵌套。",
  url: "https://xiangyi.local",
};

export const THREAD_PAGE_SIZE = 10;
export const PREVIEW_LENGTH = { guest: 50, member: 100 } as const;
export const ROOT_REPLY_PAGE_SIZE = 5;
export const MEMBER_PAGE_SIZE = 24;
export const SEARCH_PAGE_SIZE = 10;
export const REPORT_PAGE_SIZE = 20;
export const MAX_REPLY_DEPTH = 8;

export const BOARD_POST_ROLES = [
  { value: "user", label: "全体会员" },
  { value: "moderator", label: "版主和管理员" },
  { value: "admin", label: "仅管理员" },
] as const;

export const ROLE_LABEL: Record<Role, string> = {
  user: "会员",
  moderator: "版主",
  admin: "管理员",
};

export const REPORT_REASONS = [
  { value: "spam", label: "垃圾广告" },
  { value: "abuse", label: "人身攻击" },
  { value: "illegal", label: "违法违规" },
  { value: "offtopic", label: "与版块无关" },
  { value: "other", label: "其他" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export const RESERVED_SLUGS = new Set(["new", "edit", "api"]);

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "10minutemail.com",
  "yopmail.com",
  "trashmail.com",
  "tempmail.com",
  "temp-mail.org",
  "discard.email",
  "sharklasers.com",
  "getnada.com",
  "maildrop.cc",
  "fakeinbox.com",
  "dispostable.com",
  "mailnesia.com",
  "tempr.email",
  "moakt.com",
  "emailondeck.com",
]);

export const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwertyui",
  "admin123",
  "admin123456",
  "iloveyou",
  "abc12345",
  "11111111",
  "00000000",
  "letmein1",
  "welcome1",
  "demo123456",
]);

export const DEMO_ADMIN = {
  username: "admin",
  password: "admin123456",
  email: "admin@xiangyi.local",
};

export const DEMO_PASSWORD = "demo123456";
