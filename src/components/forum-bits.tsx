import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelative, floorLabel } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

export function PageWidth({
  children,
  size = "wide",
}: {
  children: ReactNode;
  size?: "wide" | "medium" | "narrow";
}) {
  const width = size === "narrow" ? "max-w-md" : size === "medium" ? "max-w-3xl" : "max-w-5xl";
  return <div className={cn("mx-auto w-full px-4 py-6", width)}>{children}</div>;
}

export function UserAvatar({
  name,
  hue,
  size = "default",
}: {
  name: string;
  hue: number;
  size?: "sm" | "default" | "lg";
}) {
  return (
    <Avatar size={size}>
      <AvatarFallback className="font-medium text-white" style={{ backgroundColor: `hsl(${hue} 42% 34%)` }}>
        {name.slice(0, 1) || "人"}
      </AvatarFallback>
    </Avatar>
  );
}

export function TimeText({ value }: { value: number }) {
  return (
    <time dateTime={new Date(value).toISOString()} title={formatDateTime(value)}>
      {formatRelative(value)}
    </time>
  );
}

export function Floor({ value }: { value: number }) {
  return <span className="text-muted-foreground">{floorLabel(value)}</span>;
}

export function Crumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {items.map((item, index) => (
          <span key={`${item.label}-${index}`} className="contents">
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || !text.includes(query)) return <>{text}</>;
  const parts = text.split(query);
  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 ? (
            <mark className="rounded bg-amber-200/80 px-0.5 text-foreground">{query}</mark>
          ) : null}
        </span>
      ))}
    </>
  );
}

export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}

function pageItems(page: number, total: number): Array<number | "gap"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const items: Array<number | "gap"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) items.push("gap");
  for (let current = start; current <= end; current += 1) items.push(current);
  if (end < total - 1) items.push("gap");
  items.push(total);
  return items;
}

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="分页" className="flex flex-col items-center gap-3 pt-5 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button variant="outline" asChild>
            <Link href={hrefFor(page - 1)}>上一页</Link>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            上一页
          </Button>
        )}
        {page < totalPages ? (
          <Button variant="outline" asChild>
            <Link href={hrefFor(page + 1)}>下一页</Link>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            下一页
          </Button>
        )}
      </div>
      <ol className="flex flex-wrap items-center justify-center gap-1">
        {pageItems(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={item}>
              {item === page ? (
                <span aria-current="page" className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-primary px-2 text-sm text-primary-foreground">
                  {item}
                </span>
              ) : (
                <Link href={hrefFor(item)} className="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm hover:bg-muted">
                  {item}
                </Link>
              )}
            </li>
          ),
        )}
      </ol>
      <p className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</p>
    </nav>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed px-4 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children ? <div className="mt-2 text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}
