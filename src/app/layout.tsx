import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PasswordBanner, SiteFooter, SiteHeader } from "@/components/site-header";
import { countUnreadNotifications, getCurrentUser } from "@/lib/auth";
import { SITE } from "@/lib/constants";
import { dialectLabel } from "@/lib/db";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await getCurrentUser();
  const unread = user ? await countUnreadNotifications(user.id) : 0;
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <SiteHeader user={user} unread={unread} />
        {user?.mustChangePassword ? <PasswordBanner /> : null}
        <div id="main" className="min-h-[calc(100vh-8rem)]">{children}</div>
        <SiteFooter dialect={dialectLabel()} />
      </body>
    </html>
  );
}
