import Link from "next/link";
import { Bell } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicUser } from "@/lib/types";

const links = [
  { href: "/", label: "首页" },
  { href: "/boards", label: "版块" },
  { href: "/members", label: "会员" },
  { href: "/search", label: "搜索" },
];

export function SiteHeader({ user, unread }: { user: PublicUser | null; unread: number }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
        跳到内容
      </a>
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="shrink-0 text-xl tracking-[0.2em] text-primary">
          巷议
        </Link>
        <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
          {links.slice(0, 3).map((link) => (
            <Link key={link.href} href={link.href} className="rounded-md px-2.5 py-1.5 text-sm hover:bg-muted">
              {link.label}
            </Link>
          ))}
        </nav>
        <form action="/search" className="ml-auto hidden md:block">
          <Input name="q" placeholder="搜索主题与发言" aria-label="搜索" className="h-9 w-44 lg:w-64" />
        </form>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          {user ? (
            <>
              <Button variant="ghost" size="icon" className="relative" asChild>
                <Link href="/notifications" aria-label={unread > 0 ? `通知，${unread} 条未读` : "通知"}>
                  <Bell />
                  {unread > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none text-primary-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </Link>
              </Button>
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">登录</Link>
              </Button>
              <Button asChild className="h-9 px-3">
                <Link href="/register">注册</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      <nav aria-label="移动端导航" className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="shrink-0 rounded-full px-3 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter({ dialect }: { dialect: string }) {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>巷议 · 把话说清楚，也把话说完。</p>
        <p>时间按北京时间显示 · {dialect}</p>
      </div>
    </footer>
  );
}

export function PasswordBanner() {
  return (
    <div className="border-b bg-amber-100/90">
      <p className="mx-auto max-w-5xl px-4 py-2 text-sm">
        你正在使用演示账号的初始密码。公开使用前请先
        <Link href="/me" className="mx-1 text-primary underline underline-offset-4">
          修改密码
        </Link>
        。
      </p>
    </div>
  );
}
