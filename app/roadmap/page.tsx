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

export default function RoadmapPage() {
  return <><div className="eyebrow">路线</div><h1>知识地图</h1><p className="muted">从通用原理逐层进入 RT-Thread、Cortex-M、Linux BSP 和具体平台。ESP32 条目保持独立 scope，不按 Cortex-M3/M4 解释。</p><div className="grid grid-2" style={{ marginTop: 24 }}>{pillars.map(([id, title]) => { const items = contentCatalog.filter((item) => item.pillar === id); const lessons = items.filter((item) => item.type === "lesson"); return <section className="panel" key={id}><h2 style={{ marginTop: 0 }}>{title}</h2><p className="muted">{lessons.length} 篇课程 · {items.filter((item) => item.type === "interview-question").length} 道面试题 · {items.filter((item) => item.type === "quiz-question").length} 道测验 · {items.filter((item) => item.type === "code-lab").length} 个实验</p><div className="list">{lessons.map((item) => <div className="list-item" key={item.id}><Link href={`/learn/${item.slug}/`}><strong>{item.title}</strong></Link><div className="muted">{item.scope} · {item.status === "verified" ? "已核验" : "待核验"}</div></div>)}</div></section>; })}</div></>;
}
