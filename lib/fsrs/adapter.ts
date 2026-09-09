import { createEmptyCard, fsrs, generatorParameters, Rating, type Card } from "ts-fsrs";
import type { ReviewCard } from "@/lib/domain/types";

const algorithmVersion = "ts-fsrs@5.4.2";
const scheduler = fsrs(generatorParameters());

export function rateReviewCard(existing: ReviewCard | undefined, rating: Rating, now = new Date()): ReviewCard {
  const source: Card = existing
    ? {
        due: new Date(existing.due),
        stability: existing.stability,
        difficulty: existing.difficulty,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: existing.reps,
        lapses: existing.lapses,
        state: existing.state as Card["state"],
        last_review: new Date(existing.due),
      }
    : createEmptyCard(now);
  const result = scheduler.next(source, now, rating as Exclude<Rating, Rating.Manual>).card;
  return {
    cardId: existing?.cardId ?? crypto.randomUUID(),
    contentId: existing?.contentId ?? "",
    due: result.due.toISOString(),
    state: result.state,
    stability: result.stability,
    difficulty: result.difficulty,
    reps: result.reps,
    lapses: result.lapses,
    algorithmVersion,
  };
}

export { Rating };
