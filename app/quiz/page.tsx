"use client";

import { useMemo, useState } from "react";
import { contentCatalog } from "@/lib/content/catalog";
import { nowIso } from "@/lib/db/database";
import { gradeObjectiveAnswer, recallRatings, type RecallRating } from "@/lib/domain/quiz";
import { Rating } from "@/lib/fsrs/adapter";
import { rateQuizMemory, submitQuiz } from "@/lib/sync/repository";
import { useUpdateGuard } from "@/lib/pwa/update-guard";

const ratingToFsrs: Record<RecallRating, Rating> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export default function QuizPage() {
  const quiz = useMemo(() => contentCatalog.filter((item) => item.type === "quiz-question" && item.contentRole !== "placeholder").slice(0, 5), []);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [selfRating, setSelfRating] = useState<RecallRating>();
  const current = quiz[index];
  useUpdateGuard(async () => { if (!finished) throw new Error("请先完成本次测验再更新"); });

  async function submit() {
    if (!current || submitted || !answer.trim()) return;
    const correct = gradeObjectiveAnswer(current, answer);
    await submitQuiz({ id: crypto.randomUUID(), quizId: current.id, selected: answer, correct, submittedAt: nowIso(), durationSeconds: 0 });
    if (correct === true) setScore((value) => value + 1);
    setSubmitted(true);
  }

  async function rate(rating: RecallRating) {
    if (!current) return;
    await rateQuizMemory(current.id, ratingToFsrs[rating]);
    setSelfRating(rating);
  }

  function next() {
    if (index + 1 >= quiz.length) setFinished(true);
    else { setIndex((value) => value + 1); setAnswer(""); setSubmitted(false); setSelfRating(undefined); }
  }

  if (!quiz.length) return <><div className="eyebrow">章节测验</div><h1>暂无可用测验</h1><p className="muted">待建设占位题不会进入默认测验。</p></>;
  if (finished) return <><div className="eyebrow">测验完成</div><h1>本次结果：{score}/{quiz.length}</h1><p className="muted">答题记录已保存到本机；客观题只按明确答案键判分，简答题需要你按评分点自评。</p></>;
  const objective = Boolean(current.questionType && current.correctAnswer && current.questionType !== "short-answer");
  return <><div className="eyebrow">章节测验</div><h1>主动回忆</h1><p className="muted">第 {index + 1} / {quiz.length} 题。内容状态不影响学习入口；状态只表示编辑和证据覆盖程度。</p><section className="panel" style={{ maxWidth: 760, marginTop: 24 }}><h2 style={{ marginTop: 0 }}>{current.title}</h2><p>{current.body}</p><div className="field"><label htmlFor="quiz-answer">你的答案或理由</label><textarea id="quiz-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={submitted} /></div><div className="button-row">{!submitted ? <button className="button primary" onClick={submit} disabled={!answer.trim()}>提交</button> : <button className="button primary" onClick={next}>{index + 1 === quiz.length ? "查看结果" : "下一题"}</button>}</div>{submitted && <><p role="status" className="muted">{objective ? (gradeObjectiveAnswer(current, answer) ? "答案匹配题目答案键。" : "答案未匹配题目答案键。") : "简答题不因答案非空判对，请按评分点进行主动回忆自评。"}</p>{!objective && current.scoringPoints?.length ? <div className="recall-points"><strong>评分点（请自评）</strong><ul>{current.scoringPoints.map((point) => <li key={point}>{point}</li>)}</ul></div> : null}<div className="recall-rating" aria-label="主动回忆难度"><strong>这次回忆难度</strong><div className="button-row">{recallRatings.map((item) => <button key={item.id} className={`button ${selfRating === item.id ? "primary" : ""}`} onClick={() => void rate(item.id)} title={item.description}>{item.label}</button>)}</div></div></>}</section></>;
}
