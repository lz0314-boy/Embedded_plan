import Link from "@/components/static-link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoadmapModule, itemsForRoadmapModule, roadmapModules } from "@/lib/content/roadmap";
import { siteUrl } from "@/lib/site";

export function generateStaticParams() {
  return roadmapModules.map((module) => ({ module: module.id }));
}

function answerPreview(body: string) {
  const marker = /^##\s+(?:参考回答|参考答案)\s*$/m.exec(body);
  const answer = marker ? body.slice((marker.index ?? 0) + marker[0].length) : body;
  const nextHeading = /^##\s/m.exec(answer);
  return (nextHeading ? answer.slice(0, nextHeading.index) : answer)
    .replace(/```[\s\S]*?```/g, "代码示例见详情")
    .replace(/[`*_>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}

const difficultyLabels = { beginner: "入门", intermediate: "进阶", advanced: "高级" } as const;

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }): Promise<Metadata> {
  const { module: id } = await params;
  const moduleData = getRoadmapModule(id);
  if (!moduleData) return {};
  return {
    title: moduleData.title,
    description: moduleData.summary,
    alternates: { canonical: siteUrl(`/roadmap/${moduleData.id}/`) },
    robots: { index: true, follow: true },
    openGraph: { title: moduleData.title, description: moduleData.summary, type: "website", url: siteUrl(`/roadmap/${moduleData.id}/`) },
  };
}

export default async function RoadmapModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: id } = await params;
  const moduleData = getRoadmapModule(id);
  if (!moduleData) notFound();
  const items = itemsForRoadmapModule(moduleData);
  const lessons = items.filter((item) => item.type === "lesson");
  const interviews = items.filter((item) => item.type === "interview-question");
  const quizzes = items.filter((item) => item.type === "quiz-question");
  return <>
    <div className="module-breadcrumb"><Link href="/roadmap/">知识地图</Link><span>/</span><span>{moduleData.shortTitle}</span></div>
    <div className="eyebrow">专题索引 · {moduleData.shortTitle}</div>
    <h1>{moduleData.title}</h1>
    <p className="module-lead muted">{moduleData.summary} 本页按问题优先呈现，适合快速复习；需要完整推导时再打开对应课程。</p>
    <div className="topic-list module-topics" aria-label="专题范围">{moduleData.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
    <div className="module-stats" aria-label="内容统计"><div><strong>{interviews.length}</strong><span>面试问答</span></div><div><strong>{lessons.length}</strong><span>完整课程</span></div><div><strong>{quizzes.length}</strong><span>自测题</span></div></div>

    <section className="module-section">
      <div className="module-section-heading"><div><div className="eyebrow">快速复习</div><h2>高频面试问答</h2></div><Link className="button" href="/questions/">浏览全站题库</Link></div>
      {interviews.length ? <div className="module-question-list">{interviews.map((item, index) => <article className="panel module-question" key={item.id}><div className="module-question-index">{String(index + 1).padStart(2, "0")}</div><div className="module-question-body"><h3><Link href={`/learn/${item.slug}/`}>{item.title}</Link></h3><div className="question-card-meta"><span>{item.module}</span><span>{difficultyLabels[item.difficulty]}</span></div><p>{answerPreview(item.body) || "打开详情查看参考回答和评分点。"}{answerPreview(item.body).length >= 260 ? "…" : ""}</p><Link className="module-detail-link" href={`/learn/${item.slug}/`}>查看完整回答、追问与证据边界 →</Link></div></article>)}</div> : <div className="panel module-empty"><h3>该专题正在补充问答</h3><p className="muted">先从下方课程和自测开始，新增的高频问题会自动出现在这里。</p></div>}
    </section>

    <section className="module-section"><div className="module-section-heading"><div><div className="eyebrow">系统理解</div><h2>完整课程</h2></div></div>{lessons.length ? <div className="module-course-list">{lessons.map((item) => <Link className="module-course" href={`/learn/${item.slug}/`} key={item.id}><span><strong>{item.title}</strong><small>{item.module} · {difficultyLabels[item.difficulty]}</small></span><span className="module-course-arrow">→</span></Link>)}</div> : <p className="muted">暂无完整课程。</p>}</section>

    <section className="module-section"><div className="module-section-heading"><div><div className="eyebrow">检验掌握</div><h2>自测题</h2></div></div>{quizzes.length ? <div className="module-quiz-list">{quizzes.map((item) => <Link className="module-quiz" href={`/learn/${item.slug}/`} key={item.id}><span>{item.title}</span><small>{difficultyLabels[item.difficulty]} · {item.estimatedMinutes} 分钟</small></Link>)}</div> : <p className="muted">暂无自测题。</p>}</section>
  </>;
}
