"use client";

import { useMemo, useState } from "react";
import { contentCatalog } from "@/lib/content/catalog";
import { nowIso } from "@/lib/db/database";
import { submitQuiz } from "@/lib/sync/repository";
import { useUpdateGuard } from "@/lib/pwa/update-guard";

export default function QuizPage() {
  const quiz = useMemo(() => contentCatalog.filter((item) => item.type === "quiz-question").slice(0, 5), []);
  const [index, setIndex] = useState(0); const [answer, setAnswer] = useState(""); const [submitted, setSubmitted] = useState(false); const [score, setScore] = useState(0); const [finished, setFinished] = useState(false);
  const current = quiz[index];
  useUpdateGuard(async () => { if (!finished) throw new Error("请先完成本次测验再更新"); });
  async function submit() { if (!current || submitted) return; const correct = answer.trim().length > 0; await submitQuiz({ id: crypto.randomUUID(), quizId: current.id, selected: answer, correct, submittedAt: nowIso(), durationSeconds: 0 }); setScore((value) => value + (correct ? 1 : 0)); setSubmitted(true); }
  function next() { if (index + 1 >= quiz.length) setFinished(true); else { setIndex((value) => value + 1); setAnswer(""); setSubmitted(false); } }
  if (finished) return <><div className="eyebrow">测验完成</div><h1>本次结果：{score}/{quiz.length}</h1><p className="muted">答题记录已保存到本机；错误题目进入错题投影。</p></>;
  return <><div className="eyebrow">章节测验</div><h1>主动回忆</h1><p className="muted">第 {index + 1} / {quiz.length} 题。当前黄金样本仍显示待核验，测验结果只代表本次自测。</p><section className="panel" style={{ maxWidth: 760, marginTop: 24 }}><h2 style={{ marginTop: 0 }}>{current.title}</h2><p>{current.body}</p><div className="field"><label htmlFor="quiz-answer">你的答案或理由</label><textarea id="quiz-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={submitted} /></div><div className="button-row">{!submitted ? <button className="button primary" onClick={submit}>提交</button> : <button className="button primary" onClick={next}>{index + 1 === quiz.length ? "查看结果" : "下一题"}</button>}</div>{submitted && <p role="status" className="muted">已记录。阶段 1 暂以是否提交作为自评入口，后续可扩展结构化评分点。</p>}</section></>;
}
