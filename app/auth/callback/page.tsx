"use client";

import { useEffect, useState } from "react";
import { localUrl } from "@/lib/pwa/config";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("正在完成登录…");

  useEffect(() => {
    const client = getSupabaseClient();
    const code = new URLSearchParams(window.location.search).get("code");
    if (!client || !code) {
      queueMicrotask(() => setMessage("登录回调无效，请返回设置页重试。"));
      return;
    }
    void client.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setMessage(`登录回调失败：${error.message}`);
      else window.location.assign(localUrl("/settings/"));
    });
  }, []);

  return <section className="panel" style={{ maxWidth: 680 }}><h1>账号登录</h1><p className="muted" role="status">{message}</p></section>;
}
