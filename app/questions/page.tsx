"use client";

import Link from "@/components/static-link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { contentCatalog, labelStatus } from "@/lib/content/catalog";

const PAGE_SIZE = 20;

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
  const questions = useMemo(() => contentCatalog.filter((item) => item.type === "interview-question" && `${item.title} ${item.keywords.join(" ")} ${item.platforms.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [query]);
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
  return <><div className="eyebrow">题库</div><h1>面试题库</h1><p className="muted">按关键词查找短答案、深入解释、平台边界和来源状态。当前共 {questions.length} 道匹配题目。</p><div className="field" style={{ maxWidth: 560, marginTop: 24 }}><label htmlFor="question-search">搜索问题、平台或源码符号</label><input id="question-search" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="例如 PendSV、fork、设备树" /></div><div className="list question-results">{visibleQuestions.map((item) => { const verified = item.status === "verified" && Boolean(item.verifiedAt); return <article className="panel" key={item.id}><div className={`status ${verified ? "verified" : "pending"}`}>{labelStatus(item.status, item.verifiedAt)}</div><h2 style={{ margin: "10px 0 6px" }}><Link href={`/learn/${item.slug}/`}>{item.title}</Link></h2><p className="muted">{item.pillar} · {item.module} · {item.platforms.join(" / ")}</p><p>{item.body}</p></article>; })}</div><div className="button-row pagination"><button className="button" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>上一页</button><span className="muted">第 {currentPage + 1} / {pageCount} 页</span><button className="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>下一页</button></div></>;
}
