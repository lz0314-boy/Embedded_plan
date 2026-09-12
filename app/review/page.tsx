"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db/database";
import { contentCatalog } from "@/lib/content/catalog";
import { Rating } from "@/lib/fsrs/adapter";
import { rateReview } from "@/lib/sync/repository";
import type { ReviewCard } from "@/lib/domain/types";

export default function ReviewPage() {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  useEffect(() => { db.reviewCards.toArray().then(setCards); }, []);
  async function rate(card: ReviewCard, rating: Rating) {
    const updated = await rateReview(card, rating); setCards((current) => current.map((item) => item.cardId === card.cardId ? updated : item));
  }
  return <><div className="eyebrow">复习</div><h1>到期复习</h1><p className="muted">评分使用 `ts-fsrs` 适配层；学习记录先写入本机。只有你明确选择回忆难度后，才会更新复习卡片。</p>{cards.length ? <div className="review-grid">{cards.map((card) => <article className="panel" key={card.cardId}><h2 style={{ marginTop: 0 }}>{contentCatalog.find((item) => item.id === card.contentId)?.title ?? card.contentId}</h2><div className="button-row"><button className="button" onClick={() => rate(card, Rating.Again)}>忘记</button><button className="button" onClick={() => rate(card, Rating.Hard)}>困难</button><button className="button primary" onClick={() => rate(card, Rating.Good)}>掌握</button><button className="button" onClick={() => rate(card, Rating.Easy)}>简单</button></div></article>)}</div> : <section className="panel"><h2 style={{ marginTop: 0 }}>暂无到期卡片</h2><p className="muted">完成内容或测验后，阶段 1 会逐步建立复习卡片。</p></section>}</>;
}
