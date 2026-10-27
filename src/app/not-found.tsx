import Link from "next/link";
import { PageWidth } from "@/components/forum-bits";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageWidth size="narrow">
      <h1 className="text-2xl font-semibold">没有找到这个页面</h1>
      <p className="mt-2 text-sm text-muted-foreground">主题、版块或会员可能已不存在。</p>
      <Button asChild className="mt-6 h-10">
        <Link href="/">回首页</Link>
      </Button>
    </PageWidth>
  );
}
