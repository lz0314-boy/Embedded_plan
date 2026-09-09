import type { ContentRecord } from "@/lib/content/schema";
import type { InterviewDirection, InterviewDifficulty, InterviewPriority } from "@/lib/domain/types";

export type InterviewSelection = {
  direction: InterviewDirection;
  platform: string;
  module: string;
  difficulty: InterviewDifficulty;
  questionCount: number;
  totalMinutes: number;
  priority: InterviewPriority;
  seed: string;
};

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function selectInterviewQuestionIds(items: ContentRecord[], selection: InterviewSelection, weakQuestionIds: ReadonlySet<string>, completedQuestionIds: ReadonlySet<string>) {
  const candidates = items.filter((item) => {
    if (item.type !== "interview-question") return false;
    if (selection.direction !== "all" && item.pillar !== selection.direction) return false;
    if (selection.platform && !item.platforms.includes(selection.platform)) return false;
    if (selection.module && item.module !== selection.module) return false;
    if (selection.difficulty !== "any" && item.difficulty !== selection.difficulty) return false;
    return true;
  });
  const ordered = [...candidates].sort((left, right) => {
    if (selection.priority === "weak") {
      const weakOrder = Number(weakQuestionIds.has(right.id)) - Number(weakQuestionIds.has(left.id));
      if (weakOrder !== 0) return weakOrder;
    }
    if (selection.priority === "new") {
      const newOrder = Number(!completedQuestionIds.has(left.id)) - Number(!completedQuestionIds.has(right.id));
      if (newOrder !== 0) return newOrder;
    }
    return hash(`${selection.seed}:${left.id}`) - hash(`${selection.seed}:${right.id}`);
  });
  return ordered.slice(0, Math.min(selection.questionCount, ordered.length)).map((item) => item.id);
}

export const selfAssessmentDimensions = [
  { id: "mechanism", label: "核心机制" },
  { id: "boundary", label: "边界与限制" },
  { id: "verification", label: "验证或排障" },
] as const;

export function sessionScore(answers: { selfScores: Record<string, number> }[]) {
  const values = answers.flatMap((answer) => Object.values(answer.selfScores));
  if (!values.length) return null;
  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10;
}
