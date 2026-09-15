"use client";

import Link from "@/components/static-link";
import { useEffect, useState } from "react";
import { contentIndex } from "@/lib/content/content-index";
import { db } from "@/lib/db/database";
import type { Note } from "@/lib/domain/types";

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  useEffect(() => { void db.notes.orderBy("updatedAt").reverse().toArray().then((values) => setNotes(values.filter((note) => !note.deletedAt))); }, []);
  return <><div className="eyebrow">私人数据</div><h1>我的笔记</h1><p className="muted">笔记只从本机 IndexedDB 读取；除非你在同步面板中明确启用，不会进入公开仓库或静态页面。</p>{notes.length ? <div className="list">{notes.map((note) => { const item = contentIndex.find((candidate) => candidate.id === note.contentId); return <article className="panel" key={note.id}><h2 style={{ marginTop: 0 }}>{item ? <Link href={`/learn/${item.slug}/`}>{item.title}</Link> : note.contentId}</h2><p style={{ whiteSpace: "pre-wrap" }}>{note.body}</p><p className="muted">更新于 {new Date(note.updatedAt).toLocaleString()}</p></article>; })}</div> : <section className="panel"><h2 style={{ marginTop: 0 }}>还没有私人笔记</h2><p className="muted">打开一篇课程，在正文下方记录自己的疑问、错点或实验结果。</p></section>}</>;
}
