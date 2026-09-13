"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { db } from "@/lib/db/database";
import { checksumData, createBackupPackage } from "@/lib/domain/backup";
import { migrateBackup } from "@/lib/db/migrations";

type DataSummary = { progress: number; notes: number; bookmarks: number; questions: number; familiar: number; uncertain: number; unknown: number; updatedAt: string | null };

const emptySummary: DataSummary = { progress: 0, notes: 0, bookmarks: 0, questions: 0, familiar: 0, uncertain: 0, unknown: 0, updatedAt: null };

async function readSummary(): Promise<DataSummary> {
  const [progress, notes, bookmarks, marks] = await Promise.all([db.contentProgress.count(), db.notes.count(), db.bookmarks.count(), db.recallMarks.toArray()]);
  return { progress, notes, bookmarks, questions: marks.length, familiar: marks.filter((mark) => mark.label === "familiar").length, uncertain: marks.filter((mark) => mark.label === "uncertain").length, unknown: marks.filter((mark) => mark.label === "unknown").length, updatedAt: marks.map((mark) => mark.updatedAt).sort().at(-1) ?? null };
}

function downloadBackup(backup: unknown) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "embedded-learning-backup.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const [summary, setSummary] = useState<DataSummary>(emptySummary);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => { void readSummary().then(setSummary); }, []);

  async function exportBackup() {
    setWorking(true);
    try {
      const backup = await createBackupPackage();
      downloadBackup(backup);
      setMessage("JSON 备份已导出。请把文件保存到安全位置。");
    } catch (error) { setMessage(error instanceof Error ? `导出失败：${error.message}` : "导出失败"); }
    finally { setWorking(false); }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setWorking(true);
    try {
      const backup = migrateBackup(JSON.parse(await file.text()));
      const expected = await checksumData(backup.data);
      if (expected !== backup.checksum) throw new Error("校验和不匹配，文件可能已损坏");
      const data = backup.data;
      await db.transaction("rw", [db.settings, db.contentProgress, db.notes, db.bookmarks, db.reviewCards, db.recallMarks, db.quizAttempts, db.wrongQuestions, db.interviewSessions, db.codeDrafts, db.projectCases], async () => {
        await db.settings.bulkPut(data.settings);
        await db.contentProgress.bulkPut(data.contentProgress as never[]);
        await db.notes.bulkPut(data.notes as never[]);
        await db.bookmarks.bulkPut(data.bookmarks as never[]);
        await db.reviewCards.bulkPut(data.reviewCards as never[]);
        await db.recallMarks.bulkPut((data.recallMarks ?? []) as never[]);
        await db.quizAttempts.bulkPut(data.quizAttempts as never[]);
        await db.wrongQuestions.bulkPut(data.wrongQuestions as never[]);
        await db.interviewSessions.bulkPut((data.interviewSessions ?? []) as never[]);
        await db.codeDrafts.bulkPut((data.codeDrafts ?? []) as never[]);
        await db.projectCases.bulkPut((data.projectCases ?? []) as never[]);
      });
      setSummary(await readSummary());
      setMessage("备份已校验并合并到本机，现有内容没有被删除。");
    } catch (error) { setMessage(error instanceof Error ? `导入失败：${error.message}` : "导入失败：文件格式不受支持"); }
    finally { setWorking(false); }
  }

  return <>
    <div className="eyebrow">更多 · 数据管理</div>
    <h1>数据管理</h1>
    <p className="muted data-lead">学习不依赖登录或网络。课程进度、笔记、收藏和随机复习状态都保存在本机 IndexedDB；这里仅提供主动导出和导入 JSON 快照。</p>
    <section className="data-summary-grid" aria-label="本机学习数据概览">
      <div className="panel"><span className="muted">课程记录</span><strong>{summary.progress}</strong><small>已开始或完成</small></div>
      <div className="panel"><span className="muted">私人内容</span><strong>{summary.notes + summary.bookmarks}</strong><small>{summary.notes} 条笔记 · {summary.bookmarks} 个收藏</small></div>
      <div className="panel"><span className="muted">复习标记</span><strong>{summary.questions}</strong><small>熟悉 {summary.familiar} · 模糊 {summary.uncertain} · 不会 {summary.unknown}</small></div>
    </section>
    <section className="data-layout">
      <div className="panel"><h2>JSON 备份</h2><p className="muted">备份包含本机进度、笔记、收藏、测验记录、复习卡片和熟悉度标记。导入会合并已有记录，不会自动清空本机数据。</p><div className="button-row"><button className="button primary" onClick={() => void exportBackup()} disabled={working}>导出 JSON</button><label className="button">导入 JSON<input type="file" accept="application/json" onChange={(event) => void importBackup(event)} hidden disabled={working} /></label></div>{message && <p className="status-message" role="status">{message}</p>}</div>
      <div className="panel"><h2>本地优先</h2><ul className="data-list"><li>断网时仍可打开已经缓存的课程并记录学习状态。</li><li>随机复习的三种标签可以随时手动修改。</li><li>网络同步、账号和 Supabase 不是学习前置条件。</li></ul>{summary.updatedAt && <p className="muted">最近一次复习标记：{new Date(summary.updatedAt).toLocaleString()}</p>}</div>
    </section>
  </>;
}
