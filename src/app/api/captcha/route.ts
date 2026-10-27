import { NextResponse } from "next/server";
import { createCaptcha } from "@/lib/captcha";
import { isLocalIp, recordAttempt, tooMany } from "@/lib/rate-limit";
import { clientIp, sameOrigin } from "@/lib/request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "来源不被接受" }, { status: 403 });
  const ip = await clientIp();
  const limit = isLocalIp(ip) ? 200 : 60;
  if (await tooMany("captcha", `ip:${ip}`, limit, 60 * 60_000)) {
    return NextResponse.json({ error: "验证码获取过于频繁" }, { status: 429 });
  }
  await recordAttempt("captcha", `ip:${ip}`);
  const captcha = await createCaptcha();
  return NextResponse.json(captcha);
}
