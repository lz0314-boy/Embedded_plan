"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RecordingControl } from "@/components/interview/recording-control";
import { contentCatalog, getContentById } from "@/lib/content/catalog";
import { db, nowIso } from "@/lib/db/database";
import type { InterviewAnswer, InterviewSession } from "@/lib/domain/types";
import { selfAssessmentDimensions, sessionScore } from "@/lib/interview/session";
import { localUrl } from "@/lib/pwa/config";
import { saveInterviewSession } from "@/lib/sync/repository";

export default function InterviewSessionPage() {
  const [session, setSession] = useState<InterviewSession>();
  const [message, setMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [response, setResponse] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const questionStartedAt = useRef(Date.now());

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("sid");
    if (!id) { queueMicrotask(() => setMessage("缺少会话 ID，请从模拟面试页重新开始。")); return; }
    void db.interviewSessions.get(id).then((value) => {
      if (!value) { setMessage("找不到本机会话。"); return; }
      setSession(value);
      questionStartedAt.current = Date.now();
      const answer = value.answers.find((item) => item.questionId === value.questionIds[value.currentIndex]);
      setAnswerState(answer);
    });
  }, []);

  useEffect(() => {
    if (!session || session.status !== "active") return;
    const timer = window.setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  const currentId = session?.questionIds[session.currentIndex];
  const current = currentId ? getContentById(currentId) : undefined;
  const remaining = session ? Math.max(0, session.totalMinutes * 60 - elapsed) : 0;
  const completedScore = useMemo(() => session ? sessionScore(session.answers) : null, [session]);

  function setAnswerState(answer?: InterviewAnswer) {
    setResponse(answer?.response ?? "");
    setFollowUp(answer?.followUp ?? "");
    setScores(answer?.selfScores ?? {});
  }

  async function persistAnswer(nextIndex = session?.currentIndex ?? 0) {
    if (!session || !current) return session;
    const answer: InterviewAnswer = { questionId: current.id, response, thoughtSeconds: Math.max(0, Math.floor((Date.now() - questionStartedAt.current) / 1000)), selfScores: scores, revealedAt: session.answers.find((item) => item.questionId === current.id)?.revealedAt ?? null, followUp };
    const answers = [...session.answers.filter((item) => item.questionId !== current.id), answer];
    const nextSession = { ...session, answers, currentIndex: nextIndex, updatedAt: nowIso() };
    await saveInterviewSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }

  async function reveal() {
    if (!session || !current) return;
    const existing = session.answers.find((item) => item.questionId === current.id);
    const answer: InterviewAnswer = { questionId: current.id, response, thoughtSeconds: Math.max(0, Math.floor((Date.now() - questionStartedAt.current) / 1000)), selfScores: scores, revealedAt: existing?.revealedAt ?? nowIso(), followUp };
    const nextSession = { ...session, answers: [...session.answers.filter((item) => item.questionId !== current.id), answer], updatedAt: nowIso() };
    await saveInterviewSession(nextSession);
    setSession(nextSession);
  }

  async function nextQuestion() {
    if (!session) return;
    if (session.currentIndex + 1 >= session.questionIds.length) {
      const saved = await persistAnswer(session.currentIndex);
      if (saved) {
        const completed = { ...saved, status: "completed" as const, endedAt: nowIso(), updatedAt: nowIso() };
        await saveInterviewSession(completed);
        setSession(completed);
      }
      return;
    }
    await persistAnswer(session.currentIndex + 1);
    questionStartedAt.current = Date.now();
    setAnswerState();
  }

  if (message) return <section className="panel"><p role="status">{message}</p><a className="button" href={localUrl("/interview/")}>返回模拟面试</a></section>;
  if (!session || !current) return <p className="muted">正在恢复本机会话…</p>;
  if (session.status === "completed") return <><div className="eyebrow">模拟面试完成</div><h1>复盘本次回答</h1><p className="muted">共 {session.questionIds.length} 题；自评平均分：{completedScore ?? "尚未评分"} / 5。录音仍只在本机。</p><div className="list">{session.answers.map((answer) => <article className="panel" key={answer.questionId}><h2 style={{ marginTop: 0 }}>{getContentById(answer.questionId)?.title ?? answer.questionId}</h2><p>{answer.response || "未填写文本回答。"}</p><p className="muted">思考 {answer.thoughtSeconds} 秒 · 评分 {Object.values(answer.selfScores).join(" / ") || "未评分"}</p></article>)}</div><a className="button" href={localUrl("/interview/")}>返回模拟面试</a></>;
  const currentAnswer = session.answers.find((item) => item.questionId === current.id);
  return <><div className="eyebrow">模拟面试 · {session.currentIndex + 1} / {session.questionIds.length}</div><div className="session-header"><div><h1>{current.title}</h1><p className="muted">{current.pillar} · {current.module} · {current.platforms.join(" / ")}</p></div><span className={remaining === 0 ? "status pending" : "status"} role="status">剩余 {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span></div><section className="panel interview-question"><p>{current.body}</p><div className="field"><label htmlFor="interview-response">你的回答</label><textarea id="interview-response" value={response} onChange={(event) => setResponse(event.target.value)} placeholder="先不看参考方向，按结构回答…" /></div>{session.allowFollowUps && <div className="field"><label htmlFor="interview-follow-up">追问或待补充点</label><textarea id="interview-follow-up" value={followUp} onChange={(event) => setFollowUp(event.target.value)} placeholder="记录面试官可能继续追问的地方…" /></div>}<div className="button-row"><button className="button" onClick={reveal}>{currentAnswer?.revealedAt ? "已展示参考方向" : "展示内容草稿"}</button><button className="button primary" onClick={nextQuestion}>{session.currentIndex + 1 === session.questionIds.length ? "完成会话" : "保存并下一题"}</button></div>{currentAnswer?.revealedAt && <section className="reference-answer"><h2>当前内容草稿</h2><p>{current.body}</p><p className="muted">该条目目前仍按内容状态显示为待核验，不把草稿当作已核验标准答案。</p></section>}<h2>自评维度</h2><div className="grid grid-3">{selfAssessmentDimensions.map((dimension) => <div className="field" key={dimension.id}><label htmlFor={`score-${dimension.id}`}>{dimension.label}</label><select id={`score-${dimension.id}`} value={scores[dimension.id] ?? ""} onChange={(event) => setScores({ ...scores, [dimension.id]: Number(event.target.value) })}><option value="">未评分</option><option value="1">1 - 未覆盖</option><option value="2">2 - 模糊</option><option value="3">3 - 基本正确</option><option value="4">4 - 清楚</option><option value="5">5 - 可追问</option></select></div>)}</div></section><RecordingControl sessionId={session.id} requested={session.recordingRequested} /></>;
}
