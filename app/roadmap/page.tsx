import Link from "@/components/static-link";
import type { Metadata } from "next";
import { contentCatalog } from "@/lib/content/catalog";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "知识地图与学习路线",
  description: "按 C、Cortex-M、RT-Thread、Linux BSP 和 Linux 应用组织的嵌入式学习路线。",
  alternates: { canonical: siteUrl("/roadmap/") },
  robots: { index: true, follow: true },
  openGraph: { title: "知识地图与学习路线", description: "嵌入式软件系统化学习路线。", type: "website" },
};

const pillars = [
  ["c", "C 语言与计算机基础"], ["cortex-m", "Cortex-M 与 MCU"], ["rt-thread", "RT-Thread 与 RTOS 内核"], ["linux-bsp", "i.MX6ULL Linux BSP"], ["linux-user", "Linux 应用与工程面试"],
] as const;

function lessonStatus(item: (typeof contentCatalog)[number]) {
  if (item.contentRole === "placeholder") return { label: "路线占位 · 后续编写", className: "pending" };
  if (item.status === "verified" && item.verifiedAt) return { label: "已核验", className: "verified" };
  if (item.status === "reviewed") return { label: "已审阅 · 待核验", className: "pending" };
  return { label: "草稿 · 可学习", className: "pending" };
}

export default function RoadmapPage() {
  return <><div className="eyebrow">路线</div><h1>知识地图</h1><p className="muted">从通用原理逐层进入 RT-Thread、Cortex-M、Linux BSP 和具体平台。ESP32 条目保持独立 scope，不按 Cortex-M3/M4 解释。</p><p className="muted roadmap-status-guide"><span className="status verified">已核验</span> 表示声明范围内已有可追溯证据；<span className="status pending">草稿 · 可学习</span> 仍可阅读、做题和记录进度；<span className="status pending">路线占位</span> 仅用于显示后续规划，不进入今日学习计划。</p><div className="grid grid-2" style={{ marginTop: 24 }}>{pillars.map(([id, title]) => { const items = contentCatalog.filter((item) => item.pillar === id); const lessons = items.filter((item) => item.type === "lesson"); const learnableLessons = lessons.filter((item) => item.contentRole !== "placeholder"); const placeholders = lessons.filter((item) => item.contentRole === "placeholder"); return <section className="panel" key={id}><h2 style={{ marginTop: 0 }}>{title}</h2><p className="muted">{learnableLessons.length} 篇可学习课程{placeholders.length ? ` · ${placeholders.length} 篇路线占位` : ""} · {items.filter((item) => item.type === "interview-question").length} 道面试题 · {items.filter((item) => item.type === "quiz-question").length} 道测验 · {items.filter((item) => item.type === "code-lab").length} 个实验</p><div className="list">{learnableLessons.map((item) => { const state = lessonStatus(item); return <div className="list-item" key={item.id}><Link href={`/learn/${item.slug}/`}><strong>{item.title}</strong></Link><div className="muted">{item.scope} · <span className={`status ${state.className}`}>{state.label}</span></div></div>; })}</div>{placeholders.length ? <details className="roadmap-placeholders"><summary>展开 {placeholders.length} 个路线占位</summary><div className="list">{placeholders.map((item) => { const state = lessonStatus(item); return <div className="list-item" key={item.id}><Link href={`/learn/${item.slug}/`}><strong>{item.title}</strong></Link><div className="muted">{item.scope} · <span className={`status ${state.className}`}>{state.label}</span></div></div>; })}</div></details> : null}</section>; })}</div></>;
}
