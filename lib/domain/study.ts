import { learningCatalog } from "@/lib/content/learning-catalog";
import { contentIndex } from "@/lib/content/content-index";
import type { ContentProgress, ReviewCard, Settings } from "./types";

export type DailyTask = {
  id: string;
  contentId: string;
  kind: "review" | "new";
  title: string;
  minutes: number;
};

export function buildDailyTasks(settings: Settings, progress: ContentProgress[], cards: ReviewCard[], now = new Date()): DailyTask[] {
  const budget = Math.max(0, Math.floor(settings.dailyMinutes));
  const sortedDue = cards
    .filter((card) => new Date(card.due) <= now)
    .filter((card) => contentIndex.some((item) => item.id === card.contentId && item.contentRole === "core" && item.status !== "deprecated"))
    .sort((left, right) => new Date(left.due).getTime() - new Date(right.due).getTime() || left.cardId.localeCompare(right.cardId));
  const seenDueContent = new Set<string>();
  const due = sortedDue.filter((card) => {
    if (seenDueContent.has(card.contentId)) return false;
    seenDueContent.add(card.contentId);
    return true;
  });
  const dueTasks = due.map((card) => ({
    id: `review-${card.cardId}`,
    contentId: card.contentId,
    kind: "review" as const,
    title: contentIndex.find((item) => item.id === card.contentId)?.title ?? "待复习内容",
    minutes: 5,
  }));
  const completed = new Set(progress.filter((item) => item.status === "completed").map((item) => item.contentId));
  const dueIds = new Set(due.map((card) => card.contentId));
  const newItems = learningCatalog
    .filter(
      (item) =>
        item.contentRole === "core" &&
        item.priority === "core" &&
        !completed.has(item.id) &&
        !dueIds.has(item.id) &&
        item.prerequisites.every((id) => completed.has(id)),
    )
    .map((item) => ({ id: `new-${item.id}`, contentId: item.id, kind: "new" as const, title: item.title, minutes: item.estimatedMinutes }));
  const maxTasks = budget >= 90 ? 5 : budget >= 60 ? 3 : budget > 0 ? 3 : 0;
  const tasks: DailyTask[] = [];
  let remaining = budget;
  for (const task of [...dueTasks, ...newItems]) {
    if (tasks.length >= maxTasks || remaining <= 0) break;
    const minutes = Math.min(task.minutes, remaining);
    if (minutes <= 0) continue;
    tasks.push({ ...task, minutes });
    remaining -= minutes;
  }
  return tasks;
}

export function weaknessScore(recentAccuracy: number, reviewFailureRate: number, overdueRatio: number, coverage: number) {
  return 0.45 * (1 - recentAccuracy) + 0.3 * reviewFailureRate + 0.15 * overdueRatio + 0.1 * (1 - coverage);
}
