import type { Metadata, Viewport } from "next";
import Link from "@/components/static-link";
import { localUrl } from "@/lib/pwa/config";
import { siteOrigin } from "@/lib/site";
import "./globals.css";
import { PwaProvider } from "./pwa-provider";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: { default: "嵌入式复习站", template: "%s · 嵌入式复习站" },
  description: "本地优先的嵌入式软件系统化学习平台",
  openGraph: { type: "website", locale: "zh_CN", siteName: "嵌入式复习站" },
  manifest: localUrl("/manifest.webmanifest"),
  icons: { icon: localUrl("/icons/icon-192.svg"), apple: localUrl("/icons/icon-192.png") },
};

export const viewport: Viewport = { themeColor: "#171a1d" };

const links = [
  ["今日", "/"], ["知识地图", "/roadmap/"], ["题库", "/questions/"], ["实验", "/labs/"], ["面试", "/interview/"], ["项目", "/projects/"], ["复习", "/review/"], ["设置", "/settings/"],
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><a className="skip-link" href="#main-content">跳到主内容</a><div className="shell">
    <aside className="sidebar"><div className="brand">嵌入式复习站<small>本地优先 · 技术文档风格</small></div><nav className="nav" aria-label="主导航">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav></aside>
    <main className="main" id="main-content"><PwaProvider>{children}</PwaProvider></main>
    <nav className="mobile-nav" aria-label="移动端导航">{links.slice(0, 6).map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
  </div></body></html>;
}
