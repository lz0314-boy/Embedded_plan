"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db, nowIso } from "@/lib/db/database";
import type { Recording } from "@/lib/domain/types";

export function RecordingControl({ sessionId, requested }: { sessionId: string; requested: boolean }) {
  const [recording, setRecording] = useState(false);
  const [supported] = useState<boolean>(() => typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia));
  const [message, setMessage] = useState("");
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  useEffect(() => {
    void db.recordings.where("sessionId").equals(sessionId).toArray().then(setRecordings);
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      recorderRef.current?.state === "recording" && recorderRef.current.stop();
    };
  }, [sessionId]);

  async function start() {
    if (!supported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((value) => MediaRecorder.isTypeSupported(value)) ?? "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const value: Recording = { id: crypto.randomUUID(), sessionId, mimeType: blob.type, blob, durationSeconds: Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)), byteLength: blob.size, createdAt: nowIso() };
        void db.recordings.put(value).then(async () => { setRecordings(await db.recordings.where("sessionId").equals(sessionId).toArray()); setMessage("录音已保存到本机 IndexedDB，永不自动同步。"); });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = undefined;
        recorderRef.current = undefined;
      };
      recorder.start();
      setRecording(true);
      setMessage("正在录音；结束后才会写入本机。");
    } catch (error) {
      setMessage(error instanceof Error ? `录音未开始：${error.message}` : "录音未开始：浏览器拒绝或不支持麦克风。");
    }
  }

  function stop() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      setRecording(false);
    }
  }

  if (!requested) return <p className="muted">本次会话未启用录音。文本回答和计时仍会保存。</p>;
  return <section className="panel" style={{ marginTop: 18 }}><h3>本地录音</h3><p className="muted">录音只写入 IndexedDB，不会进入 JSON 备份或 Supabase；请按需单独保管。</p>{supported === false && <p className="status pending">当前浏览器不支持 MediaRecorder，已降级为计时和文本回答。</p>}<div className="button-row">{!recording ? <button className="button" onClick={start} disabled={supported !== true}>开始录音</button> : <button className="button primary" onClick={stop}>结束录音</button>}</div>{message && <p className="muted" role="status">{message}</p>}{recordings.length > 0 && <div className="list">{recordings.map((item) => <RecordingItem key={item.id} value={item} />)}</div>}</section>;
}

function RecordingItem({ value }: { value: Recording }) {
  const url = useMemo(() => typeof window === "undefined" ? "" : URL.createObjectURL(value.blob), [value]);
  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);
  return <div className="list-item"><div className="muted">{new Date(value.createdAt).toLocaleString()} · {value.durationSeconds} 秒 · {Math.ceil(value.byteLength / 1024)} KiB</div>{url && <audio controls src={url} preload="metadata" />}</div>;
}
