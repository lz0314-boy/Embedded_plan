import Link from "@/components/static-link";
import type { Metadata } from "next";
import { contentCatalog } from "@/lib/content/catalog";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "知识地图与学习路线",
  description: "按 C99、Cortex-M、RT-Thread、Linux 用户态和 Linux BSP 组织的嵌入式学习路线。",
  alternates: { canonical: siteUrl("/roadmap/") },
  robots: { index: true, follow: true },
  openGraph: { title: "知识地图与学习路线", description: "嵌入式软件系统化学习路线。", type: "website" },
};

const pillars = [
  ["c", "C99 与计算机基础", "先把对象、内存、指针和调试边界讲清楚。"],
  ["cortex-m", "Cortex-M 启动与异常", "从复位、向量表到异常现场和上下文切换。"],
  ["rt-thread", "RT-Thread 与 RTOS", "围绕调度、线程状态和 IPC 建立可解释模型。"],
  ["linux-user", "Linux 用户态", "进程、I/O、系统调用与用户态调试方法。"],
  ["linux-bsp", "Linux BSP 与 eMMC", "结合 i.MX6ULL 资料，沿 eMMC 启动链定位问题。"],
] as const;

export default function RoadmapPage() {
  return <>
    <div className="eyebrow">学习路线</div>
    <h1>从 C99 到 Linux BSP</h1>
    <p className="muted roadmap-intro">路线按依赖关系排列。每个模块只展示已经写成、可以打开学习的课程；先理解通用机制，再进入具体架构和板级证据。</p>
    <div className="roadmap-grid">
      {pillars.map(([id, title, summary], index) => {
        const items = contentCatalog.filter((item) => item.pillar === id && item.contentRole !== "placeholder");
        const lessons = items.filter((item) => item.type === "lesson");
        const questions = items.filter((item) => item.type === "interview-question");
        const quizzes = items.filter((item) => item.type === "quiz-question");
        return <section className="panel roadmap-card" key={id}>
          <div className="roadmap-card-header"><span className="roadmap-step" aria-label={`第 ${index + 1} 阶段`}>{index + 1}</span><span className="muted">{lessons.length} 篇课程</span></div>
          <h2>{title}</h2>
          <p className="roadmap-card-summary">{summary}</p>
          {lessons.length ? <ul className="roadmap-card-list">{lessons.map((item) => <li key={item.id}><Link href={`/learn/${item.slug}/`}><span>{item.title}</span><small>{item.estimatedMinutes} 分钟</small></Link></li>)}</ul> : <p className="muted">该阶段的课程正在整理，先从前一阶段开始。</p>}
          <p className="roadmap-next">配套：{questions.length} 道面试题 · {quizzes.length} 道自测</p>
        </section>;
      })}
    </div>
    <section className="panel roadmap-branch"><h2>ESP32 独立架构分支</h2><p className="muted">ESP32 按 Xtensa / RISC-V 与 ESP-IDF 的资料单独组织，不套用 Cortex-M 的启动、异常或上下文切换结论。进入该分支前，先完成上面的通用基础。</p></section>
  </>;
}
