"use client";

import Link from "next/link";
import { logoutAction } from "@/server/actions/auth";
import { UserAvatar } from "@/components/forum-bits";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PublicUser } from "@/lib/types";

export function UserMenu({ user }: { user: PublicUser }) {
  return (
    <>
      <form id="logout-form" action={logoutAction} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 gap-2 px-1.5" aria-label="账户菜单">
            <UserAvatar name={user.nickname} hue={user.avatarHue} size="sm" />
            <span className="hidden max-w-24 truncate sm:inline">{user.nickname}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="truncate">{user.nickname}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/me">个人资料</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/notifications">通知</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/members/${user.username}`}>我的主页</Link>
          </DropdownMenuItem>
          {user.role !== "user" ? (
            <DropdownMenuItem asChild>
              <Link href="/moderation">审核队列</Link>
            </DropdownMenuItem>
          ) : null}
          {user.role === "admin" ? (
            <DropdownMenuItem asChild>
              <Link href="/boards/new">新建版块</Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <button type="submit" form="logout-form" className="w-full text-left">
              退出登录
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
