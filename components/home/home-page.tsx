"use client";

import Link from "@/components/static-link";
import { useEffect, useMemo, useState } from "react";
import { learningCatalog } from "@/lib/content/learning-catalog";
import { db, ensureDefaultSettings } from "@/lib/db/database";
import { buildDailyTasks, weaknessScore } from "@/lib/domain/study";
import type { ContentProgress, ReviewCard, Settings } from "@/lib/domain/types";

export function HomePage() {
  const [settings, setSettings] = useState<Settings>();
  const [progress, setProgress] = useState<ContentProgress[]>([]);
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { Promise.all([ensureDefaultSettings(), db.contentProgress.toArray(), db.reviewCards.toArray()]).then(([value, nextProgress, nextCards]) => { setSettings(value); setProgress(nextProgress); setCards(nextCards); setReady(true); }); }, []);
  const tasks = useMemo(() => settings ? buildDailyTasks(settings, progress, cards) : [], [settings, progress, cards]);
  const lessons = learningCatalog;
  const completed = progress.filter((item) => item.status === "completed").length;
  const score = weaknessScore(.8, .2, cards.filter((card) => new Date(card.due) < new Date()).length / Math.max(cards.length, 1), completed / Math.max(lessons.length, 1));
  async function markComplete(contentId: string) {
    const { completeContent } = await import("@/lib/sync/repository");
    const { progress: next, card } = await completeContent(contentId);
    setProgress((current) => [...current.filter((item) => item.contentId !== contentId), next]);
    setCards((current) => [...current.filter((item) => item.contentId !== contentId), card]);
  }
  if (!ready) return <p className="muted">正在从本机数据库恢复学习状态…</p>;
  return <>
    <div className="eyebrow">今日学习</div><h1>继续你的嵌入式学习闭环</h1><p className="muted">不登录也能学习。数据先写入本机 IndexedDB；配置并登录后才会尝试可选云同步。</p>
    <section className="grid grid-3" aria-label="学习概览"><div className="panel"><div className="muted">今日任务</div><div className="stat">{tasks.length}</div><div className="muted">预计 {tasks.reduce((sum, task) => sum + task.minutes, 0)} 分钟</div></div><div className="panel"><div className="muted">核心内容完成</div><div className="stat">{completed}/{lessons.length}</div><div className="muted">进度保存在本机</div></div><div className="panel"><div className="muted">薄弱项信号</div><div className="stat">{Math.round(score * 100)}%</div><div className="muted">可解释分数，非能力认证</div></div></section>
    <section className="panel" style={{ marginTop: 24 }}><h2 style={{ marginTop: 0 }}>今天先做什么</h2>{tasks.length ? tasks.map((task) => <div className="task" key={task.id}><div><strong>{task.title}</strong><div className="muted">{task.kind === "review" ? "到期复习" : "新主题"} · {task.minutes} 分钟</div></div><div className="button-row"><Link className="button" href={`/learn/${learningCatalog.find((item) => item.id === task.contentId)?.slug ?? ""}/`}>打开</Link>{task.kind === "new" && <button className="button primary" onClick={() => markComplete(task.contentId)}>完成阅读</button>}</div></div>) : <p className="muted">今天没有生成任务。可以从知识地图开始。</p>}</section>
    <section className="grid grid-2" style={{ marginTop: 24 }}><div className="panel"><h3>学习边界</h3><p className="muted">RTOS 通用机制、RT-Thread、Cortex-M、具体芯片和 ESP32 分开描述。ALPHA 板级参数未取得匹配官方资料前保持待核验。</p></div><div className="panel"><h3>本机数据</h3><p className="muted">设置、进度、笔记、收藏、测验和复习状态不会进入公开内容仓库。请在设置页定期导出 JSON 备份。</p><Link className="button" href="/settings/">打开设置</Link></div></section>
  </>;
}
