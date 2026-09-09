"use client";

import { useEffect, useRef, useState } from "react";
import { db, nowIso } from "@/lib/db/database";
import { useUpdateGuard } from "@/lib/pwa/update-guard";

type ExistingNote = { id: string; createdAt: string };

export function LearnActions({ contentId }: { contentId: string }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const noteRef = useRef(note);
  const savedNoteRef = useRef("");
  const existingNoteRef = useRef<ExistingNote | undefined>(undefined);
  const loadedRef = useRef(false);
  const loadingRef = useRef(Promise.resolve());
  const pendingRef = useRef<Promise<void> | undefined>(undefined);

  useEffect(() => {
    let active = true;
    loadedRef.current = false;
    const loading = Promise.all([db.bookmarks.get(contentId), db.notes.where("contentId").equals(contentId).first()]).then(([bookmark, existing]) => {
      if (!active) return;
      const body = existing?.body ?? "";
      setBookmarked(Boolean(bookmark));
      setNote(body);
      noteRef.current = body;
      savedNoteRef.current = body;
      existingNoteRef.current = existing ? { id: existing.id, createdAt: existing.createdAt } : undefined;
      loadedRef.current = true;
      setLoaded(true);
    });
    loadingRef.current = loading.then(() => undefined);
    void loading;
    return () => { active = false; };
  }, [contentId]);

  async function track(operation: Promise<void>) {
    pendingRef.current = operation;
    try { await operation; } finally { if (pendingRef.current === operation) pendingRef.current = undefined; }
  }

  async function toggleBookmark() {
    await track((async () => {
      const { setBookmark } = await import("@/lib/sync/repository");
      await setBookmark(contentId, !bookmarked);
      setBookmarked(!bookmarked);
      setMessage("收藏状态已保存到本机。");
    })());
  }

  async function saveNote() {
    await track((async () => {
      if (!loadedRef.current) return;
      const body = noteRef.current;
      const existing = existingNoteRef.current;
      if (!existing && body.trim() === "") {
        savedNoteRef.current = body;
        setMessage("空笔记未创建。");
        return;
      }
      const value = { id: existing?.id ?? crypto.randomUUID(), contentId, body, createdAt: existing?.createdAt ?? nowIso(), updatedAt: nowIso(), deletedAt: null };
      const { saveNote: saveNoteLocal } = await import("@/lib/sync/repository");
      await saveNoteLocal(value);
      existingNoteRef.current = { id: value.id, createdAt: value.createdAt };
      savedNoteRef.current = body;
      setMessage("笔记已保存到本机 IndexedDB。");
    })());
  }

  useUpdateGuard(async () => {
    await loadingRef.current;
    if (pendingRef.current) await pendingRef.current;
    if (loadedRef.current && noteRef.current !== savedNoteRef.current) await saveNote();
  });

  if (!loaded) return <section className="panel" style={{ maxWidth: 760, margin: "22px 0" }}><p className="muted">正在恢复本机笔记…</p></section>;
  return <section className="panel" style={{ maxWidth: 760, margin: "22px 0" }}><div className="button-row"><button className="button" onClick={toggleBookmark}>{bookmarked ? "取消收藏" : "收藏"}</button><button className="button primary" onClick={saveNote}>保存笔记</button></div><div className="field" style={{ marginTop: 14, marginBottom: 0 }}><label htmlFor="private-note">私人笔记（不进入公开内容仓库）</label><textarea id="private-note" value={note} onChange={(event) => { noteRef.current = event.target.value; setNote(event.target.value); }} placeholder="记录自己的疑问、错点或实验结果…" /></div>{message && <p role="status" className="muted">{message}</p>}</section>;
}
