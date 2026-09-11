"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPreSyncSnapshot } from "@/lib/domain/backup";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { syncEngine } from "@/lib/sync/engine";
import { listConflicts, resolveConflict, type ConflictChoice } from "@/lib/sync/repository";
import type { SyncDocumentState } from "@/lib/domain/types";

const statusLabels = {
  "local-only": "仅本机",
  syncing: "正在同步",
  synced: "已同步",
  "offline-pending": "离线待同步",
  "auth-expired": "登录失效",
  conflict: "存在冲突",
  "remote-unavailable": "远端不可用",
} as const;

const subscribe = (listener: () => void) => syncEngine.subscribe(listener);
const getSnapshot = () => syncEngine.getSnapshot();

export function SyncPanel() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [conflicts, setConflicts] = useState<SyncDocumentState[]>([]);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (active) setUserEmail(data.session?.user.email ?? undefined);
      if (active && data.session) void syncEngine.run("login");
    });
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user.email ?? undefined);
      if (event === "SIGNED_IN") void syncEngine.run("login");
      if (event === "SIGNED_OUT") syncEngine.resetForLogout();
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    void listConflicts().then(setConflicts);
  }, [snapshot.state, userEmail]);

  async function signIn() {
    const client = getSupabaseClient();
    if (!client || !email || !password) return;
    setBusy(true);
    setMessage("");
    try {
      await createPreSyncSnapshot();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword("");
      setMessage("已登录；正在合并本机数据和云端副本。首次同步不会用空云端覆盖本机数据。");
      await syncEngine.run("login");
    } catch (error) {
      setMessage(error instanceof Error ? `登录失败：${error.message}` : "登录失败：未知错误");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const client = getSupabaseClient();
    if (!client) return;
    setBusy(true);
    const { error } = await client.auth.signOut();
    setBusy(false);
    setMessage(error ? `退出失败：${error.message}` : "已退出；本机学习数据仍保留。");
  }

  async function syncNow() {
    setBusy(true);
    const result = await syncEngine.run("manual");
    setBusy(false);
    setMessage(`同步完成：上传 ${result.pushed} 项，拉取 ${result.pulled} 项，冲突 ${result.conflicts} 项。`);
  }

  async function resolve(key: string, choice: ConflictChoice) {
    setBusy(true);
    try {
      await resolveConflict(key, choice);
      setConflicts(await listConflicts());
      setMessage("冲突选择已保存到本机；可再次点击立即同步。");
    } catch (error) {
      setMessage(error instanceof Error ? `冲突处理失败：${error.message}` : "冲突处理失败：未知错误");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) return <section className="panel" style={{ maxWidth: 680, marginTop: 24 }}><h2 style={{ marginTop: 0 }}>账号与同步</h2><p className="muted">当前未配置 Supabase，平台保持仅本机模式。学习、笔记、测验和复习不受影响。</p><p className="muted">部署时只配置 Project URL 和公开客户端密钥；浏览器不会读取服务器端密钥。</p></section>;

  return <section className="panel" style={{ maxWidth: 680, marginTop: 24 }}>
    <h2 style={{ marginTop: 0 }}>账号与同步</h2>
    <p className="muted">IndexedDB 是本机事实来源，Supabase 只做可选异步同步。未明确选择同步的项目经历不会上传。</p>
    <p className="status" role="status">同步状态：{statusLabels[snapshot.state]}{snapshot.lastRunAt ? ` · ${new Date(snapshot.lastRunAt).toLocaleString()}` : ""}</p>
    {userEmail ? <><p>当前账号：{userEmail}</p><div className="button-row"><button className="button primary" onClick={syncNow} disabled={busy}>{busy ? "处理中…" : "立即同步"}</button><button className="button" onClick={signOut} disabled={busy}>退出登录</button></div></> : <><div className="field"><label htmlFor="sync-email">邮箱</label><input id="sync-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></div><div className="field"><label htmlFor="sync-password">密码</label><input id="sync-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div><div className="button-row"><button className="button primary" onClick={signIn} disabled={busy}>{busy ? "处理中…" : "登录并同步"}</button></div><p className="muted">个人使用阶段建议在 Supabase Dashboard 创建唯一账号并关闭公开注册；本页面不提供公开注册。</p></>}
    {message && <p role="status" className="muted">{message}</p>}
    {conflicts.length > 0 && <div style={{ marginTop: 20 }}><h3>待处理冲突</h3>{conflicts.map((conflict) => <div className="panel" key={conflict.key}><p><strong>{conflict.documentType}</strong> · {conflict.entityId} · 远端版本 {conflict.conflict?.remoteVersion}</p><div className="button-row"><button className="button" onClick={() => resolve(conflict.key, "keep-local")} disabled={busy}>保留本地</button><button className="button" onClick={() => resolve(conflict.key, "keep-remote")} disabled={busy}>保留远端</button>{(conflict.documentType === "note" || conflict.documentType === "project_case") && <button className="button" onClick={() => resolve(conflict.key, "save-copy")} disabled={busy}>另存本机副本</button>}</div></div>)}</div>}
  </section>;
}
