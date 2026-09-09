"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { localUrl, basePath } from "@/lib/pwa/config";

type NavigationItem = { href: string; label: string };

const learningLinks: NavigationItem[] = [
  { href: "/", label: "今日学习" },
  { href: "/roadmap/", label: "知识地图" },
  { href: "/questions/", label: "面试题库" },
  { href: "/quiz/", label: "章节测验" },
  { href: "/review/", label: "到期复习" },
];

const toolLinks: NavigationItem[] = [
  { href: "/labs/", label: "代码实验" },
  { href: "/interview/", label: "模拟面试" },
  { href: "/notes/", label: "我的笔记" },
  { href: "/stats/", label: "学习统计" },
  { href: "/projects/", label: "项目经历" },
];

const systemLinks: NavigationItem[] = [
  { href: "/settings/", label: "设置与数据" },
  { href: "/offline/", label: "离线状态" },
];

const mobilePrimaryLinks: NavigationItem[] = [
  { href: "/", label: "今日" },
  { href: "/roadmap/", label: "路线" },
  { href: "/questions/", label: "题库" },
  { href: "/review/", label: "复习" },
];

const mobileMoreLinks = [learningLinks[3], ...toolLinks, ...systemLinks];

function normalizePath(path: string) {
  const withoutBase = basePath && path.startsWith(basePath) ? path.slice(basePath.length) : path;
  const normalized = withoutBase.replace(/\/+$/, "");
  return normalized || "/";
}

function isCurrentPath(pathname: string, href: string) {
  const current = normalizePath(pathname);
  const target = normalizePath(href);
  return target === "/" ? current === "/" : current === target || current.startsWith(`${target}/`);
}

function NavigationLink({ item, onNavigate, mobile = false }: { item: NavigationItem; onNavigate?: () => void; mobile?: boolean }) {
  const pathname = usePathname() ?? "/";
  const current = isCurrentPath(pathname, item.href);
  return <a className={mobile ? "mobile-nav-link" : "nav-link"} href={localUrl(item.href)} aria-current={current ? "page" : undefined} onClick={onNavigate}>{item.label}</a>;
}

function NavigationSearch({ id }: { id: string }) {
  return <form className="nav-search" action={localUrl("/questions/")} method="get">
    <label htmlFor={id}>快速搜索</label>
    <input id={id} name="q" type="search" autoComplete="off" placeholder="搜索题目或概念…" />
  </form>;
}

export function DesktopNavigation() {
  return <nav className="desktop-navigation" aria-label="主导航">
    <NavigationSearch id="desktop-site-search" />
    <div className="nav-section"><div className="nav-section-title">学习</div>{learningLinks.map((item) => <NavigationLink item={item} key={item.href} />)}</div>
    <div className="nav-section"><div className="nav-section-title">工具</div>{toolLinks.map((item) => <NavigationLink item={item} key={item.href} />)}</div>
    <div className="nav-section"><div className="nav-section-title">系统</div>{systemLinks.map((item) => <NavigationLink item={item} key={item.href} />)}</div>
  </nav>;
}

export function MobileNavigation() {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const moreActive = mobileMoreLinks.some((item) => isCurrentPath(pathname, item.href));

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMoreOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  return <>
    <nav className="mobile-nav" aria-label="移动端导航">
      {mobilePrimaryLinks.map((item) => <NavigationLink item={item} key={item.href} mobile onNavigate={() => setMoreOpen(false)} />)}
      <button className={`mobile-more-trigger${moreActive ? " active" : ""}`} type="button" aria-expanded={moreOpen} aria-controls="mobile-more-menu" onClick={() => setMoreOpen((value) => !value)}>更多</button>
    </nav>
    {moreOpen && <div className="mobile-more-menu" id="mobile-more-menu">
      <div className="mobile-more-header"><strong>更多功能</strong><button className="button" type="button" onClick={() => setMoreOpen(false)}>关闭</button></div>
      <NavigationSearch id="mobile-site-search" />
      <div className="mobile-more-links">{mobileMoreLinks.map((item) => <NavigationLink item={item} key={item.href} mobile onNavigate={() => setMoreOpen(false)} />)}</div>
    </div>}
  </>;
}
