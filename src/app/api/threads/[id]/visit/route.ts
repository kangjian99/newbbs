import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { dbGet } from "@/lib/db";
import { sameOrigin } from "@/lib/request";
import { incrementView, markThreadRead } from "@/server/writes";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const { id } = await context.params;
  const thread = await dbGet<{ id: string; deleted_at: number | null }>(
    "SELECT id, deleted_at FROM threads WHERE id = ?",
    [id],
  );
  if (!thread || thread.deleted_at) return NextResponse.json({ ok: false }, { status: 404 });
  const jar = await cookies();
  const seen = new Set((jar.get("xiangyi_views")?.value ?? "").split(",").filter(Boolean));
  if (!seen.has(id)) {
    await incrementView(id);
    seen.add(id);
    jar.set("xiangyi_views", [...seen].slice(-80).join(","), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  }
  const user = await getCurrentUser();
  if (user) await markThreadRead(user.id, id);
  return NextResponse.json({ ok: true });
}
