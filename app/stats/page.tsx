"use client";

import { useEffect, useState } from "react";
import { contentCatalog } from "@/lib/content/catalog";
import { db } from "@/lib/db/database";

export default function StatsPage() {
  const [completed, setCompleted] = useState(0); const [attempts, setAttempts] = useState(0); const [wrong, setWrong] = useState(0);
  useEffect(() => { Promise.all([db.contentProgress.where("status").equals("completed").count(), db.quizAttempts.count(), db.wrongQuestions.where("status").equals("active").count()]).then(([a, b, c]) => { setCompleted(a); setAttempts(b); setWrong(c); }); }, []);
  const lessons = contentCatalog.filter((item) => item.type === "lesson").length;
  return <><div className="eyebrow">统计</div><h1>学习统计</h1><p className="muted">只展示本机投影，不生成无法解释的能力认证分数。</p><div className="grid grid-3" style={{ marginTop: 24 }}><div className="panel"><div className="muted">核心主题覆盖</div><div className="stat">{completed}/{lessons}</div></div><div className="panel"><div className="muted">已提交测验</div><div className="stat">{attempts}</div></div><div className="panel"><div className="muted">当前错题</div><div className="stat">{wrong}</div></div></div><section className="panel" style={{ marginTop: 24, maxWidth: 760 }}><h2 style={{ marginTop: 0 }}>解释方式</h2><p className="muted">后续会按支柱和模块展示近 30 天正确率、到期积压、易错概念与面试表达自评；阶段 1 不虚构不存在的历史数据。</p></section></>;
}
