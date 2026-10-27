import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ForumError } from "@/lib/errors";
import type { ActionState } from "@/lib/types";

export function fail(error: unknown): ActionState {
  unstable_rethrow(error);
  if (error instanceof ForumError) return { error: error.message };
  console.error(error);
  return { error: "操作没有完成，请稍后再试。" };
}
