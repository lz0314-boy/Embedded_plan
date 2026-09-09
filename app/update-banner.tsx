"use client";

import { useEffect, useState } from "react";
import { registerWorker, workerMessage } from "@/lib/pwa/client";
import { saveBeforeUpdate } from "@/lib/pwa/update-guard";

export function UpdateBanner() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let disposed = false;
    const cleanup: (() => void)[] = [];
    void registerWorker().then((value) => {
      if (disposed) return;
      setRegistration(value);
      const check = () => setAvailable(Boolean(value.waiting && navigator.serviceWorker.controller));
      check();
      const found = () => {
        const worker = value.installing;
        if (!worker) return;
        const changed = () => { if (worker.state === "installed") check(); };
        worker.addEventListener("statechange", changed);
        cleanup.push(() => worker.removeEventListener("statechange", changed));
      };
      found();
      value.addEventListener("updatefound", found);
      const update = () => { if (navigator.onLine) void value.update().catch(() => undefined); };
      window.addEventListener("online", update);
      cleanup.push(() => { value.removeEventListener("updatefound", found); window.removeEventListener("online", update); });
    }).catch(() => undefined);
    return () => { disposed = true; cleanup.forEach((run) => run()); };
  }, []);
  if (!available) return null;
  async function applyUpdate() {
    if (!registration?.waiting || busy) return;
    setBusy(true);
    setError("");
    try {
      await workerMessage(registration.waiting, { type: "PREPARE_UPDATE" });
      await saveBeforeUpdate();
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { cleanup(); reject(new Error("更新激活超时，页面未刷新，请稍后重试")); }, 20000);
        const cleanup = () => { clearTimeout(timeout); navigator.serviceWorker.removeEventListener("controllerchange", activated); };
        const activated = () => { cleanup(); resolve(); };
        navigator.serviceWorker.addEventListener("controllerchange", activated);
        void workerMessage(registration.waiting!, { type: "ACTIVATE_UPDATE" }).catch((reason) => { cleanup(); reject(reason); });
      });
      window.location.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "更新失败，页面未刷新"); setBusy(false); }
  }
  return <div className="update-banner" role="status"><div>新版本已准备好。先保存本地草稿，再确认更新；不会自动刷新。{error && <p role="alert">{error}</p>}</div><button className="button primary" disabled={busy} onClick={applyUpdate}>{busy ? "保存并更新中…" : "保存并更新"}</button></div>;
}
