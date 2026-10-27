"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">页面出错了</h1>
      <p className="mt-2 text-sm text-muted-foreground">请稍后再试。如果刚配置数据库，先确认 DATABASE_URL 可以连通。</p>
      <Button type="button" onClick={reset} className="mt-6 h-10">重试</Button>
    </div>
  );
}
