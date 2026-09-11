"use client";

import { useCallback, useEffect, useState } from "react";
import { activeWorker, workerMessage } from "@/lib/pwa/client";
import type { OfflinePackage, WorkerStatus } from "@/lib/pwa/config";
import { isStandalone, promptInstall, subscribeInstallPrompt } from "@/lib/pwa/install";

const workerTimeout = 180000;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "离线管理操作失败";
}

export function OfflineManager() {
  const [status, setStatus] = useState<WorkerStatus>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [storage, setStorage] = useState<{ usage: number; quota: number }>();
  const [persisted, setPersisted] = useState<boolean>();
  const [installAvailable, setInstallAvailable] = useState(false);

  const readStorage = useCallback(async () => {
    if (!navigator.storage?.estimate) return;
    const estimate = await navigator.storage.estimate();
    if (typeof estimate.usage === "number" && typeof estimate.quota === "number") setStorage({ usage: estimate.usage, quota: estimate.quota });
    if (navigator.storage.persisted) setPersisted(await navigator.storage.persisted());
  }, []);

  const readStatus = useCallback(async () => {
    const worker = await activeWorker();
    const next = await workerMessage<WorkerStatus>(worker, { type: "STATUS" });
    setStatus(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      await Promise.all([readStatus(), readStorage()]);
      setMessage("");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, [readStatus, readStorage]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    const unsubscribe = subscribeInstallPrompt(setInstallAvailable);
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [refresh]);

  async function packageAction(item: OfflinePackage, type: "DOWNLOAD_PACKAGE" | "DELETE_PACKAGE") {
    if (busy) return;
    setBusy(`${type}:${item.id}`);
    setMessage("");
    try {
      const worker = await activeWorker();
      await workerMessage(worker, { type, id: item.id }, workerTimeout);
      await readStatus();
      await readStorage();
      setMessage(type === "DELETE_PACKAGE" ? `已移除“${item.title}”离线包。` : `已下载“${item.title}”离线包。`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function clearContentCache() {
    if (busy) return;
    setBusy("clear");
    setMessage("");
    try {
      const worker = await activeWorker();
      await workerMessage(worker, { type: "CLEAR_CONTENT_CACHE" });
      await readStatus();
      setMessage("已清理访问过的内容缓存；本机学习数据和已下载离线包未受影响。");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function persistStorage() {
    if (!navigator.storage?.persist) return;
    setBusy("persist");
    try {
      const granted = await navigator.storage.persist();
      setPersisted(granted);
      setMessage(granted ? "浏览器已允许尽量保留本机数据。" : "浏览器未授予持久化存储；请定期导出 JSON 备份。");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function install() {
    setBusy("install");
    try {
      const accepted = await promptInstall();
      setMessage(accepted ? "已提交安装请求。" : "安装请求未确认。请使用浏览器菜单中的安装选项。");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  const installed = new Map((status?.installed ?? []).map((item) => [item.id, item]));
  return <section className="offline-manager" aria-labelledby="offline-manager-title">
    <div className="eyebrow">本机能力</div>
    <h2 id="offline-manager-title">离线包与存储</h2>
    <p className="muted">离线包只包含公开课程 HTML。笔记、进度、测验和项目经历继续保存在 IndexedDB，不会进入 Cache Storage。</p>
    {status ? <>
      <p className="version-line">应用版本：{status.index.appVersion} · 内容版本：{status.index.contentVersion}</p>
      <div className="offline-packages" role="list" aria-label="可下载的离线包">
        {status.index.packages.map((item) => {
          const current = installed.get(item.id);
          const outdated = current && current.version !== status.index.contentVersion;
          const action = current && !outdated ? "DELETE_PACKAGE" : "DOWNLOAD_PACKAGE";
          const actionLabel = current && !outdated ? "移除" : outdated ? "更新" : "下载";
          return <div className="offline-package" role="listitem" key={item.id}><div><strong>{item.title}</strong><div className="muted">{formatBytes(item.bytes)} · {current ? outdated ? "已有旧版本" : "已下载" : "未下载"}</div></div><button className={action === "DOWNLOAD_PACKAGE" ? "button primary" : "button"} disabled={Boolean(busy)} onClick={() => packageAction(item, action)}>{busy === `${action}:${item.id}` ? "处理中…" : actionLabel}</button></div>;
        })}
      </div>
      <div className="button-row offline-actions"><button className="button" disabled={Boolean(busy)} onClick={clearContentCache}>{busy === "clear" ? "清理中…" : "清理访问过的内容缓存"}</button>{installAvailable && !isStandalone() && <button className="button" disabled={Boolean(busy)} onClick={install}>{busy === "install" ? "安装中…" : "安装到设备"}</button>}</div>
      <div className="storage-summary"><strong>浏览器存储</strong><span>{storage ? `${formatBytes(storage.usage)} / ${formatBytes(storage.quota)} 已使用` : "暂不可估算"}</span><span>{persisted === true ? "持久化已启用" : persisted === false ? "尚未启用持久化" : "持久化状态未知"}</span>{persisted === false && <button className="button" disabled={Boolean(busy)} onClick={persistStorage}>{busy === "persist" ? "申请中…" : "申请持久化存储"}</button>}</div>
    </> : <p className="muted">正在读取离线状态…</p>}
    {message && <p className="status-message" role="status" aria-live="polite">{message}</p>}
    <p className="muted backup-reminder">浏览器清理站点数据可能删除 IndexedDB。请在本页定期导出 JSON 备份；备份文件也应放在私人位置。</p>
  </section>;
}
