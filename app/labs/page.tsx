import Link from "@/components/static-link";
import type { Metadata } from "next";
import { contentCatalog } from "@/lib/content/catalog";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "代码与分析实验",
  description: "面向标准 C 的可终止浏览器实验，以及 Cortex-M、RT-Thread、ESP32 和 Linux BSP 的分析练习。",
  alternates: { canonical: siteUrl("/labs/") },
  robots: { index: true, follow: true },
  openGraph: { title: "代码与分析实验", description: "嵌入式软件代码与分析实验目录。", type: "website" },
};

export default function LabsPage() {
  return <><div className="eyebrow">实验</div><h1>代码与分析实验</h1><p className="muted">标准 C 练习可在满足浏览器隔离条件时按需启动 Worker/WASI；Cortex-M、RT-Thread、Linux BSP 和 i.MX6ULL 条目只做阅读、推演和保存，不伪装成硬件仿真。</p><div className="list" style={{ marginTop: 24 }}>{contentCatalog.filter((item) => item.type === "code-lab").map((item) => <article className="panel" key={item.id}><h2 style={{ margin: "0 0 8px" }}><Link href={`/labs/${item.slug}/`}>{item.title}</Link></h2><p className="muted">{item.scope} · {item.platforms.join(" / ")} · {item.estimatedMinutes} 分钟</p><p>{item.body}</p></article>)}</div></>;
}
