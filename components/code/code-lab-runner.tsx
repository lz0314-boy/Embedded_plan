"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { db, nowIso } from "@/lib/db/database";
import type { CodeDraft } from "@/lib/domain/types";
import { cRunner, getBrowserRunnerAvailability } from "@/lib/runner/client";
import { RUNNER_COMPILER_DOWNLOAD_BYTES, type CRunResult } from "@/lib/runner/protocol";
import { saveCodeDraft } from "@/lib/sync/repository";
import { codeLabDefinitions } from "@/lib/labs/catalog";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((module) => module.default), { ssr: false, loading: () => <p className="muted">正在按需加载 Monaco…</p> });

const statusLabels: Record<CRunResult["status"], string> = {
  completed: "运行完成",
  failed: "程序返回非零状态",
  "compile-error": "编译或执行器错误",
  timeout: "超时，Worker 已终止",
  "output-limit": "输出超限，Worker 已终止",
  terminated: "已终止",
  unavailable: "当前环境降级",
  "invalid-input": "输入无效",
};

export function CodeLabRunner({ labId }: { labId: string }) {
  const definition = codeLabDefinitions[labId];
  const [source, setSource] = useState(definition?.starterCode ?? "");
  const [loaded, setLoaded] = useState(false);
  const [editorMode, setEditorMode] = useState<"textarea" | "monaco">("textarea");
  const [result, setResult] = useState<CRunResult>();
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const runnerRef = useRef(cRunner);
  const draftRef = useRef<CodeDraft | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void db.codeDrafts.where("labId").equals(labId).first().then((draft) => {
      if (!active) return;
      if (draft) { draftRef.current = draft; setSource(draft.source); setResult(draft.lastRun ? { status: draft.lastRun.status as CRunResult["status"], exitCode: draft.lastRun.exitCode, stdout: draft.lastRun.stdout, stderr: draft.lastRun.stderr, durationMs: draft.lastRun.durationMs, message: "" } : undefined); }
      setLoaded(true);
    });
    return () => { active = false; };
  }, [labId]);

  async function saveDraft(nextResult?: CRunResult) {
    if (!loaded || !definition) return;
    const current = draftRef.current;
    const value: CodeDraft = { id: current?.id ?? crypto.randomUUID(), labId, source, createdAt: current?.createdAt ?? nowIso(), updatedAt: nowIso(), lastRun: nextResult ? { status: nextResult.status, exitCode: nextResult.exitCode, stdout: nextResult.stdout, stderr: nextResult.stderr, durationMs: nextResult.durationMs, recordedAt: nowIso() } : current?.lastRun ?? null, deletedAt: null };
    await saveCodeDraft(value);
    draftRef.current = value;
    setMessage("代码草稿已保存到本机 IndexedDB。");
  }

  async function run() {
    if (!definition?.starterCode) return;
    setRunning(true);
    setMessage("");
    const nextResult = await runnerRef.current.run(source, definition.stdin ?? "");
    setResult(nextResult);
    await saveDraft(nextResult);
    if (nextResult.status === "timeout" || nextResult.status === "output-limit" || nextResult.status === "terminated") setPrepared(false);
    setRunning(false);
  }

  async function prepareRunner() {
    setPreparing(true);
    setMessage("正在下载并准备标准 C 编译器资源；此时尚未执行用户代码。");
    const preparation = await runnerRef.current.prepare();
    setPreparing(false);
    if (preparation.status === "ready") {
      setPrepared(true);
      const downloadedMiB = (preparation.assetBytes / 1024 / 1024).toFixed(1);
      setMessage(`C runner 已准备完成${preparation.assetBytes ? `（本次读取 ${downloadedMiB} MiB）` : ""}。`);
    } else {
      setPrepared(false);
      setMessage(preparation.message);
    }
  }

  function availabilityMessage() {
    const availability = getBrowserRunnerAvailability();
    if (availability.available) return prepared ? "当前环境支持 Worker + WebAssembly + cross-origin isolation，C runner 已准备完成。" : `当前环境满足运行条件；首次准备需读取约 ${(RUNNER_COMPILER_DOWNLOAD_BYTES / 1024 / 1024).toFixed(1)} MiB 编译器资源。`;
    return availability.reason === "isolation" ? "当前静态预览没有启用 cross-origin isolation；按设计降级为编辑、保存和参考方向。发布平台需单独验证 COOP/COEP，不能把此结果当作嵌入式硬件验证。" : "当前设备或浏览器不满足 C/WASI runner 条件，已降级为编辑和保存。";
  }

  if (!definition) return null;
  if (definition.mode === "analysis") return <section className="panel lab-boundary"><p className="muted">{definition.boundary}</p></section>;
  return <section className="panel code-runner"><div className="runner-header"><div><h2 style={{ marginTop: 0 }}>标准 C 实验</h2><p className="muted">{definition.boundary}</p></div><span className="status">动态 Worker / WASI</span></div><p className="muted">{availabilityMessage()}</p><div className="button-row"><button className="button" onClick={() => setEditorMode(editorMode === "textarea" ? "monaco" : "textarea")}>{editorMode === "textarea" ? "加载 Monaco 编辑器" : "使用轻量编辑器"}</button><button className="button" onClick={() => void saveDraft()} disabled={!loaded}>保存草稿</button>{!prepared && <button className="button primary" onClick={() => void prepareRunner()} disabled={preparing || !getBrowserRunnerAvailability().available}>{preparing ? "准备中…" : "准备 C runner（约 13.5 MiB）"}</button>}<button className="button primary" onClick={() => void run()} disabled={running || !prepared || !getBrowserRunnerAvailability().available}>{running ? "运行中…" : "运行 C"}</button>{running && <button className="button" onClick={() => runnerRef.current.terminate()}>强制终止</button>}</div><div className="code-editor-shell">{editorMode === "monaco" ? <MonacoEditor height="360px" defaultLanguage="c" theme="vs-dark" value={source} onChange={(value) => setSource(value ?? "")} options={{ minimap: { enabled: false }, wordWrap: "on", automaticLayout: true, ariaLabel: "C 代码编辑器" }} /> : <textarea className="code-textarea" aria-label="C 代码编辑器" value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} />}</div>{message && <p className="muted" role="status">{message}</p>}{result && <div className={`runner-result ${result.status}`}><strong>{statusLabels[result.status]}</strong><span className="muted">{result.durationMs} ms{result.exitCode === null ? "" : ` · exit ${result.exitCode}`}</span>{result.message && <p>{result.message}</p>}{result.stdout && <pre>{result.stdout}</pre>}{result.stderr && <pre>{result.stderr}</pre>}</div>}</section>;
}
