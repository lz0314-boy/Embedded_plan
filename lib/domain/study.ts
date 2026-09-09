import { learningCatalog } from "@/lib/content/learning-catalog";
import type { ContentProgress, ReviewCard, Settings } from "./types";

export type DailyTask = {
  id: string;
  contentId: string;
  kind: "review" | "new";
  title: string;
  minutes: number;
};

export function buildDailyTasks(settings: Settings, progress: ContentProgress[], cards: ReviewCard[], now = new Date()): DailyTask[] {
  const due = cards.filter((card) => new Date(card.due) <= now).slice(0, 3);
  const dueTasks = due.map((card) => ({
    id: `review-${card.cardId}`,
    contentId: card.contentId,
    kind: "review" as const,
    title: learningCatalog.find((item) => item.id === card.contentId)?.title ?? "待复习内容",
    minutes: 5,
  }));
  const completed = new Set(progress.filter((item) => item.status === "completed").map((item) => item.contentId));
  const newItems = learningCatalog
    .filter((item) => item.priority === "core" && !completed.has(item.id))
    .slice(0, settings.dailyMinutes >= 60 ? 2 : 1)
    .map((item) => ({ id: `new-${item.id}`, contentId: item.id, kind: "new" as const, title: item.title, minutes: item.estimatedMinutes }));
  return [...dueTasks, ...newItems].slice(0, settings.dailyMinutes >= 90 ? 5 : 3);
}

export function weaknessScore(recentAccuracy: number, reviewFailureRate: number, overdueRatio: number, coverage: number) {
  return 0.45 * (1 - recentAccuracy) + 0.3 * reviewFailureRate + 0.15 * overdueRatio + 0.1 * (1 - coverage);
}
