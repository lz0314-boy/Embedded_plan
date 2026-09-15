"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { contentIndex } from "@/lib/content/content-index";
import { fetchContentDetail, type ContentDetail } from "@/lib/content/client-details";
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

function quizPrompt(body: string) {
  return body.split(/^参考答案：/m)[0].split(/^答案：/m)[0].trim();
}

function quizReference(body: string) {
  return body.match(/^(?:参考答案|答案)：([\s\S]*)$/m)?.[1]?.trim() ?? "提交后请对照题目评分点复盘。";
}

export default function QuizPage() {
  const quiz = useMemo(() => contentIndex.filter((item) => item.type === "quiz-question" && item.contentRole !== "placeholder").slice(0, 5), []);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [selfRating, setSelfRating] = useState<RecallRating>();
  const [detail, setDetail] = useState<ContentDetail>();
  const [detailError, setDetailError] = useState("");
  const [detailErrorId, setDetailErrorId] = useState("");
  const current = quiz[index];
  const currentId = current?.id;
  const currentDetail = detail?.id === current?.id ? detail : undefined;
  const visibleDetailError = detailErrorId === currentId ? detailError : "";
  const detailLoading = Boolean(current && !currentDetail && !visibleDetailError);
  useEffect(() => {
    let active = true;
    if (!currentId) return () => { active = false; };
    void fetchContentDetail(currentId).then((value) => { if (active) setDetail(value); }).catch((error) => { if (active) { setDetailErrorId(currentId); setDetailError(error instanceof Error ? error.message : "题目详情加载失败"); } });
    return () => { active = false; };
  }, [currentId]);
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
  if (finished) return <><div className="eyebrow">章节测验</div><h1>本次结果：{score}/{quiz.length}</h1><p className="muted">答题记录已保存到本机；客观题只按明确答案键判分，简答题需要你按评分点自评。</p></>;
  const objective = Boolean(current.questionType && current.correctAnswer && current.questionType !== "short-answer");
  return <><div className="eyebrow">章节测验</div><h1>主动回忆</h1><p className="muted">第 {index + 1} / {quiz.length} 题。先回答再查看参考答案；简答题按评分点自评，客观题只按明确答案键判分。</p><div className="quiz-layout"><section className="panel quiz-question"><h2 style={{ marginTop: 0 }}>{current.title}</h2>{detailLoading && <p className="muted" role="status">正在加载题目…</p>}{visibleDetailError && <p className="muted" role="alert">{visibleDetailError}</p>}{currentDetail && <p className="quiz-prompt">{quizPrompt(currentDetail.body)}</p>}<div className="field"><label htmlFor="quiz-answer">你的答案或理由</label><textarea id="quiz-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={submitted || !currentDetail} /></div><div className="button-row">{!submitted ? <button className="button primary" onClick={submit} disabled={!answer.trim() || !currentDetail}>提交</button> : <button className="button primary" onClick={next}>{index + 1 === quiz.length ? "查看结果" : "下一题"}</button>}</div>{submitted && currentDetail && <><div className="quiz-reference"><h3>参考答案</h3><p>{quizReference(currentDetail.body)}</p></div><p role="status" className="muted">{objective ? (gradeObjectiveAnswer(current, answer) ? "答案匹配题目答案键。" : "答案未匹配题目答案键。") : "简答题不因答案非空判对，请按评分点进行主动回忆自评。"}</p>{current.scoringPoints?.length ? <div className="recall-points"><strong>评分点（请自评）</strong><ul>{current.scoringPoints.map((point) => <li key={point}>{point}</li>)}</ul></div> : null}<div className="recall-rating" aria-label="主动回忆难度"><strong>这次回忆难度</strong><div className="button-row">{recallRatings.map((item) => <button key={item.id} className={`button ${selfRating === item.id ? "primary" : ""}`} onClick={() => void rate(item.id)} title={item.description}>{item.label}</button>)}</div></div></>}</section><aside className="quiz-sidebar"><section className="panel"><h2>本次测验</h2><div className="quiz-progress"><span style={{ width: `${((index + 1) / quiz.length) * 100}%` }} /></div><p className="muted">已进行 {index + 1} / {quiz.length} 题</p></section><section className="panel"><h2>答题提示</h2><ol><li>先写出结论，再说明理由。</li><li>遇到平台问题，标出适用边界。</li><li>提交后对照参考答案，选择回忆难度。</li></ol></section></aside></div></>;
}
