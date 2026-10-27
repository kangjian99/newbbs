import bcrypt from "bcryptjs";
import { COMMON_PASSWORDS } from "@/lib/constants";

const DUMMY_HASH = "$2b$10$GAkZrtJ/tc1QTh2y00ECX.D/8a2zLFwPmm17cDp.9N1XWxe37jh5u";

export function hashPassword(password: string) {
  return bcrypt.hashSync(password, 10);
}

export async function verifyPassword(password: string, hash: string | null) {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}

export function passwordProblem(password: string, username: string) {
  if (password.length < 8) return "密码至少 8 位";
  if (password.length > 72) return "密码最多 72 位";
  if (!/[A-Za-z\u4e00-\u9fff]/.test(password) || !/[0-9]/.test(password)) {
    return "密码需要同时包含字母和数字";
  }
  if (/^(.)\1+$/.test(password)) return "密码不能为同一个字符重复";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "这个密码太常见，请另选一个";
  const name = username.trim().toLowerCase();
  if (name && password.toLowerCase().includes(name)) return "密码不能包含用户名";
  return null;
}
