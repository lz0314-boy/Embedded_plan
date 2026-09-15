import manifest from "@/generated/content-index.json";

/** Lightweight metadata used by client-side planning; bodies stay out of the home bundle. */
export type ContentIndexItem = {
  id: string;
  type: "lesson" | "interview-question" | "quiz-question" | "code-lab";
  title: string;
  slug: string;
  pillar: "c" | "cortex-m" | "rt-thread" | "linux-bsp" | "linux-user";
  module: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  contentRole: "core" | "supporting" | "placeholder";
  estimatedMinutes: number;
  scope: string;
  status: "draft" | "reviewed" | "verified" | "deprecated";
  platforms?: string[];
  keywords?: string[];
  questionType?: "single-choice" | "multi-choice" | "true-false" | "short-answer";
  correctAnswer?: string | string[];
  scoringPoints?: string[];
  promptPreview?: string;
  answerPreview?: string;
};

export const contentIndex = manifest.content as ContentIndexItem[];
