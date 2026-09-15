"use client";

import { useEffect, useState } from "react";
import { contentIndex } from "@/lib/content/content-index";
import { db, nowIso } from "@/lib/db/database";
import { selectInterviewQuestionIds, type InterviewSelection } from "@/lib/interview/session";
import type { InterviewDirection, InterviewDifficulty, InterviewPriority, InterviewSession } from "@/lib/domain/types";
import { localUrl } from "@/lib/pwa/config";
import { saveInterviewSession } from "@/lib/sync/repository";

const directions: { value: InterviewDirection; label: string }[] = [
  { value: "all", label: "全部主线" },
  { value: "c", label: "C 与计算机基础" },
  { value: "cortex-m", label: "Cortex-M" },
  { value: "rt-thread", label: "RT-Thread" },
  { value: "linux-bsp", label: "Linux BSP" },
  { value: "linux-user", label: "Linux 应用" },
];

export function InterviewConfig() {
  const [selection, setSelection] = useState<InterviewSelection>({ direction: "all", platform: "", module: "", difficulty: "any", questionCount: 3, totalMinutes: 15, priority: "new", seed: nowIso() });
  const [allowFollowUps, setAllowFollowUps] = useState(true);
  const [mixedProjects, setMixedProjects] = useState(false);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void db.interviewSessions.orderBy("updatedAt").reverse().limit(6).toArray().then(setSessions);
  }, []);

  async function startSession() {
    const [wrong, progress] = await Promise.all([db.wrongQuestions.where("status").equals("active").toArray(), db.contentProgress.toArray()]);
    const questionIds = selectInterviewQuestionIds(contentIndex, selection, new Set(wrong.map((item) => item.questionId)), new Set(progress.filter((item) => item.status === "completed").map((item) => item.contentId)));
    if (!questionIds.length) {
      setMessage("当前筛选没有可用题目，请放宽主线、平台或难度条件。");
      return;
    }
    const startedAt = nowIso();
    const session: InterviewSession = {
      id: crypto.randomUUID(),
      direction: selection.direction,
      platform: selection.platform,
      module: selection.module,
      difficulty: selection.difficulty,
      questionCount: questionIds.length,
      totalMinutes: selection.totalMinutes,
      allowFollowUps,
      mixedProjects,
      priority: selection.priority,
      questionIds,
      answers: [],
      currentIndex: 0,
      status: "active",
      startedAt,
      endedAt: null,
      createdAt: startedAt,
      updatedAt: startedAt,
    };
    await saveInterviewSession(session);
    window.location.assign(localUrl(`/interview/session/?sid=${session.id}`));
  }

  return <>
    <section className="panel" style={{ maxWidth: 760, marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>创建模拟面试</h2>
      <p className="muted">题目来源于公开题库；回答、自评和会话记录先写入本机 IndexedDB。本阶段只支持文字回答、计时、自评和追问，不提供录音功能。</p>
      <div className="grid grid-2">
        <div className="field"><label htmlFor="interview-direction">方向</label><select id="interview-direction" value={selection.direction} onChange={(event) => setSelection({ ...selection, direction: event.target.value as InterviewDirection })}>{directions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        <div className="field"><label htmlFor="interview-platform">平台筛选</label><select id="interview-platform" value={selection.platform} onChange={(event) => setSelection({ ...selection, platform: event.target.value })}><option value="">不限制</option><option value="standard-c">标准 C</option><option value="cortex-m3">Cortex-M3</option><option value="cortex-m4">Cortex-M4</option><option value="rt-thread">RT-Thread</option><option value="imx6ull">i.MX6ULL</option><option value="linux">Linux</option><option value="posix">POSIX</option></select></div>
        <div className="field"><label htmlFor="interview-module">模块筛选</label><input id="interview-module" value={selection.module} onChange={(event) => setSelection({ ...selection, module: event.target.value })} placeholder="留空表示全部模块" /></div>
        <div className="field"><label htmlFor="interview-difficulty">难度</label><select id="interview-difficulty" value={selection.difficulty} onChange={(event) => setSelection({ ...selection, difficulty: event.target.value as InterviewDifficulty })}><option value="any">不限制</option><option value="beginner">入门</option><option value="intermediate">中级</option><option value="advanced">进阶</option></select></div>
        <div className="field"><label htmlFor="interview-count">题数</label><select id="interview-count" value={selection.questionCount} onChange={(event) => setSelection({ ...selection, questionCount: Number(event.target.value) })}><option value="1">1 题</option><option value="3">3 题</option><option value="5">5 题</option><option value="8">8 题</option></select></div>
        <div className="field"><label htmlFor="interview-minutes">总时长</label><select id="interview-minutes" value={selection.totalMinutes} onChange={(event) => setSelection({ ...selection, totalMinutes: Number(event.target.value) })}><option value="5">5 分钟</option><option value="15">15 分钟</option><option value="30">30 分钟</option><option value="60">60 分钟</option></select></div>
        <div className="field"><label htmlFor="interview-priority">选题策略</label><select id="interview-priority" value={selection.priority} onChange={(event) => setSelection({ ...selection, priority: event.target.value as InterviewPriority })}><option value="new">新题优先</option><option value="weak">薄弱题优先</option><option value="random">确定性随机</option></select></div>
      </div>
      <div className="field"><label><input type="checkbox" checked={allowFollowUps} onChange={(event) => setAllowFollowUps(event.target.checked)} /> 允许记录追问</label><label><input type="checkbox" checked={mixedProjects} onChange={(event) => setMixedProjects(event.target.checked)} /> 混合项目题（当前无私人项目题时保持关闭）</label></div>
      <button className="button primary" onClick={startSession}>开始模拟面试</button>
      {message && <p className="muted" role="status">{message}</p>}
    </section>
    <section className="panel" style={{ maxWidth: 760, marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>最近会话</h2>
      {sessions.length ? <div className="list">{sessions.map((session) => <div className="list-item" key={session.id}><div><strong>{session.questionCount} 题 · {session.status === "completed" ? "已完成" : session.status === "active" ? "进行中" : "已放弃"}</strong><div className="muted">{new Date(session.startedAt).toLocaleString()} · {session.direction === "all" ? "全部主线" : session.direction}</div></div><a className="button" href={localUrl(`/interview/session/?sid=${session.id}`)}>打开</a></div>)}</div> : <p className="muted">还没有本机会话。</p>}
    </section>
  </>;
}
