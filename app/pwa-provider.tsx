"use client";

import { useEffect, useState } from "react";
import { registerWorker } from "@/lib/pwa/client";
import { initInstallPrompt } from "@/lib/pwa/install";
import { UpdateBanner } from "./update-banner";

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    initInstallPrompt();
    const changed = () => setOffline(!navigator.onLine);
    const runSync = (reason: "online" | "foreground" | "retry") => void import("@/lib/sync/engine").then(({ syncEngine }) => syncEngine.run(reason));
    const online = () => runSync("online");
    const foreground = () => { if (document.visibilityState === "visible") runSync("foreground"); };
    changed();
    window.addEventListener("online", changed);
    window.addEventListener("offline", changed);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", foreground);
    const retryTimer = window.setInterval(() => runSync("retry"), 60_000);
    if (process.env.NODE_ENV === "production") void registerWorker().catch(() => setError("离线资源暂不可用；本机数据不受影响，请联网后刷新重试。"));
    return () => { window.removeEventListener("online", changed); window.removeEventListener("offline", changed); window.removeEventListener("online", online); document.removeEventListener("visibilitychange", foreground); window.clearInterval(retryTimer); };
  }, []);
  return <>{offline && <p className="status" role="status">当前离线 · 本机数据仍可读写</p>}{error && <p role="status">{error}</p>}<UpdateBanner />{children}</>;
}
