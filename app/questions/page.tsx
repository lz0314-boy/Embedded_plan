"use client";

import Link from "@/components/static-link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { contentCatalog } from "@/lib/content/catalog";

const PAGE_SIZE = 20;
const difficultyLabels = { beginner: "入门", intermediate: "进阶", advanced: "高级" } as const;

function answerPreview(body: string) {
  const marker = /^##\s+参考回答\s*$/m.exec(body);
  const answer = marker ? body.slice((marker.index ?? 0) + marker[0].length) : body;
  const nextHeading = /^##\s/m.exec(answer);
  const section = nextHeading ? answer.slice(0, nextHeading.index) : answer;
  return section.replace(/```[\s\S]*?```/g, "代码示例见题目详情").replace(/[`*_>#-]/g, "").replace(/\s+/g, " ").trim().slice(0, 190);
}

export default function QuestionsPage() {
  const query = useSyncExternalStore(
    (listener) => { window.addEventListener("popstate", listener); return () => window.removeEventListener("popstate", listener); },
    () => new URLSearchParams(window.location.search).get("q") ?? "",
    () => "",
  );
  const [page, setPage] = useState(0);
  useEffect(() => {
    const syncRobots = () => {
      const metas = [...document.head.querySelectorAll('meta[name="robots"]')];
      const content = query ? "noindex,follow" : "index,follow";
      const [first, ...duplicates] = metas;
      if (first) first.setAttribute("content", content);
      else { const meta = document.createElement("meta"); meta.name = "robots"; meta.content = content; document.head.append(meta); }
      duplicates.forEach((meta) => meta.remove());
    };
    const observer = new MutationObserver(syncRobots);
    observer.observe(document.head, { childList: true, subtree: true });
    syncRobots();
    return () => observer.disconnect();
  }, [query]);
  const questions = useMemo(() => contentCatalog.filter((item) => item.type === "interview-question" && item.contentRole !== "placeholder" && `${item.title} ${item.keywords.join(" ")} ${item.platforms.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const pageCount = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleQuestions = questions.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  function changeQuery(value: string) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("q", value); else url.searchParams.delete("q");
    window.history.replaceState({}, "", url);
    window.dispatchEvent(new Event("popstate"));
    setPage(0);
  }
  return <>
    <div className="eyebrow">主动回忆</div>
    <h1>嵌入式面试题库</h1>
    <p className="muted">当前收录 {questions.length} 道可直接练习的题目。每道题都有参考回答、评分点和边界说明；点击进入详情后，再合上答案做一次主动回忆。</p>
    <div className="field" style={{ maxWidth: 640, marginTop: 24 }}><label htmlFor="question-search">搜索问题、平台或源码符号</label><input id="question-search" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="例如 PendSV、fork、设备树" /></div>
    {visibleQuestions.length ? <div className="question-grid">{visibleQuestions.map((item) => <article className="panel question-card" key={item.id}>
      <h2><Link href={`/learn/${item.slug}/`}>{item.title}</Link></h2>
      <p className="question-card-meta"><span>{item.module}</span><span>{difficultyLabels[item.difficulty]}</span><span>{item.estimatedMinutes} 分钟</span></p>
      <p className="question-card-answer"><strong>参考回答：</strong>{answerPreview(item.body)}{item.body.length > 190 ? "…" : ""}</p>
      <div className="question-card-action"><Link className="button primary" href={`/learn/${item.slug}/`}>开始回忆</Link></div>
    </article>)}</div> : <section className="panel question-empty"><h2 style={{ marginTop: 0 }}>没有匹配题目</h2><p className="muted">换一个关键词试试，例如 C99、HardFault、IPC 或 eMMC。</p></section>}
    <div className="button-row pagination"><button className="button" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>上一页</button><span className="muted">第 {currentPage + 1} / {pageCount} 页</span><button className="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>下一页</button></div>
  </>;
}
