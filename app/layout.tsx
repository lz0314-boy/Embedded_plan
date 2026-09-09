import type { Metadata, Viewport } from "next";
import { localUrl } from "@/lib/pwa/config";
import { siteOrigin } from "@/lib/site";
import { DesktopNavigation, MobileNavigation } from "@/components/navigation/main-navigation";
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

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#101214" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><a className="skip-link" href="#main-content">跳到主内容</a><div className="shell">
    <aside className="sidebar"><div className="brand">嵌入式复习站<small>本地优先 · 技术文档风格</small></div><DesktopNavigation /></aside>
    <main className="main" id="main-content"><PwaProvider>{children}</PwaProvider></main>
    <MobileNavigation />
  </div></body></html>;
}
