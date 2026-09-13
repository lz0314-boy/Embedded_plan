"use client";

import Link from "@/components/static-link";
import { useEffect, useMemo, useState } from "react";
import { contentCatalog, getContentById } from "@/lib/content/catalog";
import { db, nowIso } from "@/lib/db/database";
import type { ContentRecord } from "@/lib/content/schema";
import type { RecallLabel, RecallMark } from "@/lib/domain/types";

type Filter = "all" | "unmarked" | RecallLabel;

const labelText: Record<RecallLabel, string> = { familiar: "熟悉", uncertain: "模糊", unknown: "不会" };
const labelDescription: Record<RecallLabel, string> = { familiar: "可以直接说出结论和关键边界", uncertain: "知道方向，但回答还不稳定", unknown: "暂时答不上来，需要马上回顾" };

function promptText(item: ContentRecord) {
  const answerStart = item.body.search(/^(?:##\s+参考回答|参考答案：|答案：)/m);
  const source = answerStart >= 0 ? item.body.slice(0, answerStart) : item.body;
  return source.replace(/^#.*$/gm, "").replace(/```[\s\S]*?```/g, "代码片段请在答案中展开").replace(/[`*_>#-]/g, "").replace(/\s+/g, " ").trim().slice(0, 520);
}

function questionPool() {
  return contentCatalog.filter((item) => (item.type === "interview-question" || item.type === "quiz-question") && item.contentRole !== "placeholder" && item.status !== "deprecated");
}

export default function ReviewPage() {
  const pool = useMemo(() => questionPool(), []);
  const [marks, setMarks] = useState<RecallMark[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [ready, setReady] = useState(false);

  useEffect(() => { db.recallMarks.toArray().then((value) => { setMarks(value); setReady(true); }); }, []);

  const current = pool[index % Math.max(pool.length, 1)];
  const marksById = useMemo(() => new Map(marks.map((mark) => [mark.contentId, mark])), [marks]);
  const visibleMarks = useMemo(() => marks.filter((mark) => filter === "all" || mark.label === filter), [filter, marks]);
  const markedIds = new Set(marks.map((mark) => mark.contentId));
  const filteredItems = filter === "unmarked" ? pool.filter((item) => !markedIds.has(item.id)) : filter === "all" ? pool : pool.filter((item) => marksById.get(item.id)?.label === filter);
  const counts = { familiar: marks.filter((mark) => mark.label === "familiar").length, uncertain: marks.filter((mark) => mark.label === "uncertain").length, unknown: marks.filter((mark) => mark.label === "unknown").length, unmarked: Math.max(0, pool.length - marks.length) };
  const markListItems = (() => {
    if (filter === "unmarked") return filteredItems.slice(0, 12).map((item) => ({ item, mark: undefined }));
    if (filter === "all") return [...visibleMarks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 12).map((mark) => ({ item: getContentById(mark.contentId), mark }));
    return filteredItems.slice(0, 12).map((item) => ({ item, mark: marksById.get(item.id) }));
  })();

  async function saveMark(contentId: string, label: RecallLabel) {
    const currentTime = nowIso();
    const value: RecallMark = { contentId, label, updatedAt: currentTime, lastReviewedAt: currentTime };
    await db.recallMarks.put(value);
    setMarks((previous) => [...previous.filter((mark) => mark.contentId !== contentId), value]);
    return value;
  }

  async function choose(label: RecallLabel) {
    if (!current) return;
    await saveMark(current.id, label);
    if (label === "familiar") nextCard();
    else setRevealed(true);
  }

  function nextCard() {
    if (!pool.length) return;
    setIndex((previous) => pool.length === 1 ? previous : (previous + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length);
    setRevealed(false);
  }

  async function changeLabel(contentId: string, label: RecallLabel) { await saveMark(contentId, label); }

  if (!ready) return <p className="muted">正在恢复本机复习状态…</p>;
  return <>
    <div className="eyebrow">主动回忆</div>
    <h1>随机复习</h1>
    <p className="muted">先看问题再作答。选择“熟悉”直接进入下一题；选择“模糊”或“不会”后展开完整参考答案。熟悉度可以随时在下方手动调整。</p>
    <div className="recall-layout">
      <section className="panel recall-card" aria-live="polite">
        {current ? <>
          <div className="recall-card-top"><span className="status">第 {index + 1} / {pool.length} 张</span><span className="muted">{current.module} · {current.difficulty === "beginner" ? "入门" : current.difficulty === "advanced" ? "高级" : "进阶"}</span></div>
          <h2>{current.title}</h2>
          <p className="recall-prompt">{promptText(current) || "请先用自己的话回答这道题，再选择熟悉程度。"}</p>
          <div className="recall-choice-grid">{(Object.keys(labelText) as RecallLabel[]).map((label) => <button className={`recall-choice ${label}`} key={label} onClick={() => void choose(label)}><strong>{labelText[label]}</strong><span>{labelDescription[label]}</span></button>)}</div>
          {revealed && <div className="recall-answer"><div className="recall-answer-heading"><h3>参考答案</h3><button className="button" onClick={nextCard}>下一张</button></div><div className="content-body" dangerouslySetInnerHTML={{ __html: current.html }} /></div>}
        </> : <><h2>暂无可复习题目</h2><p className="muted">题库正在建设中，完成的非占位题目会自动进入这里。</p><Link className="button primary" href="/roadmap/">查看知识地图</Link></>}
      </section>

      <aside className="recall-sidebar">
        <section className="panel"><h2>当前状态</h2><div className="recall-stat-grid"><button className={filter === "familiar" ? "active" : ""} onClick={() => setFilter("familiar")}><span className="recall-dot familiar" />熟悉<strong>{counts.familiar}</strong></button><button className={filter === "uncertain" ? "active" : ""} onClick={() => setFilter("uncertain")}><span className="recall-dot uncertain" />模糊<strong>{counts.uncertain}</strong></button><button className={filter === "unknown" ? "active" : ""} onClick={() => setFilter("unknown")}><span className="recall-dot unknown" />不会<strong>{counts.unknown}</strong></button><button className={filter === "unmarked" ? "active" : ""} onClick={() => setFilter("unmarked")}><span className="recall-dot unmarked" />未标记<strong>{counts.unmarked}</strong></button></div><button className={`recall-all-filter ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>查看全部 {pool.length} 道题</button></section>
        <section className="panel"><h2>{filter === "all" ? "最近标记" : `${filter === "unmarked" ? "未标记" : labelText[filter]}题目`}</h2>{markListItems.length ? <div className="recall-mark-list">{markListItems.map(({ item, mark }) => { if (!item) return null; return <div className="recall-mark-row" key={item.id}><Link href={`/learn/${item.slug}/`}>{item.title}</Link><select aria-label={`${item.title}熟悉度`} value={mark?.label ?? ""} onChange={(event) => { if (event.target.value) void changeLabel(item.id, event.target.value as RecallLabel); }}><option value="">未标记</option><option value="familiar">熟悉</option><option value="uncertain">模糊</option><option value="unknown">不会</option></select></div>; })}</div> : <p className="muted">还没有符合条件的题目。</p>}</section>
        <section className="panel recall-help"><h2>怎么用</h2><ol><li>先在心里回答，再选择熟悉程度。</li><li>模糊和不会会展开完整参考答案。</li><li>在右侧列表随时改标签，统计会立即更新。</li></ol></section>
      </aside>
    </div>
  </>;
}
