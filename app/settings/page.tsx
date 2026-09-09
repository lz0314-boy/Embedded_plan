"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { db, ensureDefaultSettings, nowIso } from "@/lib/db/database";
import { checksumData, type BackupData } from "@/lib/domain/backup";
import { migrateBackup } from "@/lib/db/migrations";
import type { Settings } from "@/lib/domain/types";
import { saveSettings } from "@/lib/sync/repository";
import { useUpdateGuard } from "@/lib/pwa/update-guard";
import { OfflineManager } from "@/components/pwa/offline-manager";
import { SyncPanel } from "@/components/sync/sync-panel";

function settingsChanged(current: Settings, saved: Settings) {
  return current.dailyMinutes !== saved.dailyMinutes || current.targetDate !== saved.targetDate || current.focus !== saved.focus || current.selfAssessment !== saved.selfAssessment || current.notificationsEnabled !== saved.notificationsEnabled;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>();
  const [message, setMessage] = useState("");
  const settingsRef = useRef(settings);
  const savedSettingsRef = useRef<Settings | undefined>(undefined);
  const loadedRef = useRef(false);
  const pendingRef = useRef<Promise<unknown> | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void ensureDefaultSettings().then((value) => {
      if (!active) return;
      savedSettingsRef.current = value;
      settingsRef.current = value;
      setSettings(value);
      loadedRef.current = true;
    });
    return () => { active = false; };
  }, []);

  async function track<T>(operation: Promise<T>) {
    pendingRef.current = operation;
    try { return await operation; } finally { if (pendingRef.current === operation) pendingRef.current = undefined; }
  }

  function updateSettings(value: Settings) {
    settingsRef.current = value;
    setSettings(value);
  }

  async function save() {
    const current = settingsRef.current;
    if (!current) return;
    await track((async () => {
      const updated = { ...current, updatedAt: nowIso() };
      await saveSettings(updated);
      savedSettingsRef.current = updated;
      settingsRef.current = updated;
      updateSettings(updated);
      setMessage("设置已保存到本机 IndexedDB。");
    })());
  }

  useUpdateGuard(async () => {
    if (pendingRef.current) await pendingRef.current;
    const current = settingsRef.current;
    const saved = savedSettingsRef.current;
    if (loadedRef.current && current && saved && settingsChanged(current, saved)) await save();
  });

  async function exportBackup() {
    await track((async () => {
      const data: BackupData = { settings: await db.settings.toArray(), contentProgress: await db.contentProgress.toArray(), notes: await db.notes.toArray(), bookmarks: await db.bookmarks.toArray(), reviewCards: await db.reviewCards.toArray(), quizAttempts: await db.quizAttempts.toArray(), wrongQuestions: await db.wrongQuestions.toArray(), interviewSessions: await db.interviewSessions.toArray(), codeDrafts: await db.codeDrafts.toArray(), projectCases: await db.projectCases.toArray() };
      const checksum = await checksumData(data); const backup = { format: "embedded-learning-backup", schemaVersion: 1, exportedAt: nowIso(), contentVersion: "local-uncommitted", checksum, data }; const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "embedded-learning-backup.json"; anchor.click(); URL.revokeObjectURL(url); setMessage("已生成 JSON 备份；录音不会进入备份。");
    })());
  }
  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    await track((async () => {
      try {
        const backup = migrateBackup(JSON.parse(await file.text()));
        const expected = await checksumData(backup.data); if (expected !== backup.checksum) throw new Error("校验和不匹配");
        await db.transaction("rw", [db.settings, db.contentProgress, db.notes, db.bookmarks, db.reviewCards, db.quizAttempts, db.wrongQuestions, db.interviewSessions, db.codeDrafts, db.projectCases], async () => { await db.settings.bulkPut(backup.data.settings); await db.contentProgress.bulkPut(backup.data.contentProgress as never[]); await db.notes.bulkPut(backup.data.notes as never[]); await db.bookmarks.bulkPut(backup.data.bookmarks as never[]); await db.reviewCards.bulkPut(backup.data.reviewCards as never[]); await db.quizAttempts.bulkPut(backup.data.quizAttempts as never[]); await db.wrongQuestions.bulkPut(backup.data.wrongQuestions as never[]); await db.interviewSessions.bulkPut((backup.data.interviewSessions ?? []) as never[]); await db.codeDrafts.bulkPut((backup.data.codeDrafts ?? []) as never[]); await db.projectCases.bulkPut((backup.data.projectCases ?? []) as never[]); });
        const imported = backup.data.settings.find((value): value is Settings => Boolean(value && typeof value === "object" && "id" in value && value.id === "default"));
        if (imported) { savedSettingsRef.current = imported; updateSettings(imported); }
        setMessage("备份已校验并合并到本机。");
      } catch (error) { setMessage(error instanceof Error ? `导入失败：${error.message}` : "导入失败：未知错误"); }
    })());
    event.target.value = "";
  }
  if (!settings) return <p className="muted">正在恢复本机设置…</p>;
  return <>
    <div className="eyebrow">设置</div>
    <h1>学习设置与数据</h1>
    <p className="muted">不登录也能完整学习。远端账号和同步是可选能力，本机 IndexedDB 始终优先。</p>
    <section className="panel" style={{ maxWidth: 680, marginTop: 24 }}>
      <div className="field"><label htmlFor="daily-minutes">每日学习时长</label><select id="daily-minutes" value={settings.dailyMinutes} onChange={(event) => updateSettings({ ...settings, dailyMinutes: Number(event.target.value) })}><option value="30">30 分钟</option><option value="60">60 分钟</option><option value="90">90 分钟</option></select></div>
      <div className="field"><label htmlFor="focus">当前重点</label><select id="focus" value={settings.focus} onChange={(event) => updateSettings({ ...settings, focus: event.target.value as Settings["focus"] })}><option value="balanced">均衡</option><option value="mcu-rt-thread">MCU / RT-Thread</option><option value="linux-bsp">Linux BSP</option><option value="linux-user">Linux 应用</option></select></div>
      <div className="field"><label htmlFor="assessment">自评基础</label><select id="assessment" value={settings.selfAssessment} onChange={(event) => updateSettings({ ...settings, selfAssessment: event.target.value as Settings["selfAssessment"] })}><option value="new">陌生</option><option value="familiar">了解</option><option value="project">做过项目</option><option value="interview">准备面试</option></select></div>
      <div className="button-row"><button className="button primary" onClick={save}>保存设置</button><button className="button" onClick={exportBackup}>导出 JSON 备份</button><label className="button">导入 JSON<input type="file" accept="application/json" onChange={importBackup} hidden /></label></div>
      {message && <p role="status" className="muted">{message}</p>}
    </section>
    <SyncPanel />
    <OfflineManager />
  </>;
}
