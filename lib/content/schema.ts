import { z } from "zod";

export const contentTypes = [
  "lesson",
  "interview-question",
  "quiz-question",
  "code-lab",
] as const;

export const contentScopes = [
  "rtos-generic",
  "rt-thread",
  "cortex-m",
  "chip",
  "esp32",
  "linux-bsp",
  "linux-user",
  "alpha-board",
] as const;

export const contentRoles = ["core", "supporting", "placeholder"] as const;

export const contentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  type: z.enum(contentTypes),
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  pillar: z.enum(["c", "cortex-m", "rt-thread", "linux-bsp", "linux-user"]),
  module: z.string().min(1),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  priority: z.enum(["core", "supporting"]),
  /** Maturity/plan eligibility is separate from status. */
  contentRole: z.enum(contentRoles),
  estimatedMinutes: z.coerce.number().int().positive(),
  scope: z.enum(contentScopes),
  platforms: z.array(z.string()).min(1),
  prerequisites: z.array(z.string()),
  related: z.array(z.string()),
  sourceIds: z.array(z.string()).min(1),
  verifiedAt: z.string().nullable(),
  status: z.enum(["draft", "reviewed", "verified", "deprecated"]),
  keywords: z.array(z.string()).min(1),
  questionType: z.enum(["single-choice", "multi-choice", "true-false", "short-answer"]).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
  scoringPoints: z.array(z.string()).optional(),
});

export type ContentFrontmatter = z.infer<typeof contentSchema>;

export type ContentRecord = ContentFrontmatter & {
  body: string;
  html: string;
};

export type SourceRecord = {
  id: string;
  title: string;
  organization: string;
  url: string;
  versionOrCommit: string;
  accessedAt: string;
  platforms: string | string[];
  citationNote: string;
};
