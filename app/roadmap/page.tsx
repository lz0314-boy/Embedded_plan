import Link from "@/components/static-link";
import type { Metadata } from "next";
import { itemsForRoadmapModule, roadmapModules } from "@/lib/content/roadmap";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "知识地图与学习路线",
  description: "围绕 C99、嵌入式协议、Cortex-M3、RT-Thread、Linux 和 AI 辅助编程组织的学习地图。",
  alternates: { canonical: siteUrl("/roadmap/") },
  robots: { index: true, follow: true },
  openGraph: { title: "知识地图与学习路线", description: "嵌入式软件面试与调试知识地图。", type: "website" },
};

export default function RoadmapPage() {
  return <>
    <div className="eyebrow">学习地图</div>
    <h1>从 C99 到 Linux BSP 的六条主线</h1>
    <p className="muted roadmap-intro">路线按依赖关系组织，题库、课程和随机复习共用同一套知识标签。这里展示学习范围与已经可以打开的内容，不把空壳占位条目伪装成课程。</p>
    <div className="roadmap-grid roadmap-grid-six">
      {roadmapModules.map((module, index) => {
        const items = itemsForRoadmapModule(module);
        const lessons = items.filter((item) => item.type === "lesson");
        const questions = items.filter((item) => item.type === "interview-question" || item.type === "quiz-question");
        return <section className="panel roadmap-card" id={module.id} key={module.id}>
          <div className="roadmap-card-header"><span className="roadmap-step">{index + 1}</span><div className="roadmap-counts"><strong>{lessons.length}</strong> 篇课程 · <strong>{questions.length}</strong> 道题</div></div>
          <h2><Link href={`/roadmap/${module.id}/`}>{module.title}</Link></h2>
          <p className="roadmap-card-summary">{module.summary}</p>
          <div className="topic-list" aria-label={`${module.title}主题范围`}>{module.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
          {lessons.length ? <div className="roadmap-card-list">{lessons.slice(0, 6).map((item) => <Link href={`/learn/${item.slug}/`} key={item.id}><span>{item.title}</span><small>{item.estimatedMinutes} 分钟</small></Link>)}<Link className="roadmap-more" href={`/roadmap/${module.id}/`}>进入模块，浏览全部问答 →</Link></div> : <p className="roadmap-empty">该方向暂时没有可展示内容，请从模块页查看主题范围。</p>}
        </section>;
      })}
    </div>
  </>;
}
