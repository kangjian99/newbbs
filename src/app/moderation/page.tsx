import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageWidth, Pagination, TimeText } from "@/components/forum-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireStaff } from "@/lib/auth";
import { REPORT_PAGE_SIZE } from "@/lib/constants";
import { reasonLabel } from "@/lib/format";
import { pageCount, parsePage, withQuery } from "@/lib/paging";
import { resolveReportAction } from "@/server/actions/forum";
import { listReports } from "@/server/queries";

export const metadata: Metadata = { title: "审核队列" };

const statusLabel: Record<string, string> = {
  open: "待处理",
  resolved: "已处理",
  dismissed: "已驳回",
};

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tab?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const tab = params.tab === "closed" ? "closed" : "open";
  const page = parsePage(params.page);
  const { reports, total } = await listReports(tab, page, REPORT_PAGE_SIZE);
  const totalPages = pageCount(total, REPORT_PAGE_SIZE);
  return (
    <PageWidth>
      <h1 className="text-2xl font-semibold">审核队列</h1>
      <p className="mb-4 text-sm text-muted-foreground">处理举报。隐藏会留下原文给作者和管理人员，删除是软删除。</p>
      <div className="mb-4 flex gap-3 text-sm">
        <Link href="/moderation" className={tab === "open" ? "font-medium text-primary" : "text-muted-foreground"}>待处理</Link>
        <Link href="/moderation?tab=closed" className={tab === "closed" ? "font-medium text-primary" : "text-muted-foreground"}>已处理</Link>
      </div>
      {reports.length === 0 ? (
        <EmptyState title={tab === "open" ? "没有待处理的举报" : "还没有处理记录"} />
      ) : (
        <ul className="space-y-4">
          {reports.map((report) => (
            <li key={report.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{reasonLabel(report.reason)} · {statusLabel[report.status] ?? report.status}</p>
                <TimeText value={report.createdAt} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.reporterNickname} 举报了「{report.subject}」
              </p>
              <p className="cjk mt-2 text-sm">{report.excerpt}</p>
              {report.detail ? <p className="mt-1 text-sm text-muted-foreground">补充：{report.detail}</p> : null}
              {report.resolutionNote ? <p className="mt-1 text-sm">处理说明：{report.resolutionNote}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={report.href}>查看</Link>
                </Button>
                {report.status === "open" ? (
                  <form action={resolveReportAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="next" value="/moderation" />
                    <Input name="note" placeholder="处理说明，可选" className="h-8 w-48" maxLength={200} />
                    <Button type="submit" name="action" value="dismiss" size="sm" variant="outline">驳回</Button>
                    {report.targetType === "post" ? (
                      <Button type="submit" name="action" value="hide" size="sm" variant="outline">隐藏</Button>
                    ) : null}
                    <Button type="submit" name="action" value="delete" size="sm" variant="destructive">删除</Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(next) => withQuery("/moderation", { tab: tab === "closed" ? "closed" : undefined, page: next === 1 ? undefined : next })}
      />
    </PageWidth>
  );
}
