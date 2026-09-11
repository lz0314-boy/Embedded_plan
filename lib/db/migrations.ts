import type { BackupData, BackupPackage } from "@/lib/domain/backup";
import { z } from "zod";
import { validateDocumentPayload } from "@/lib/sync/validation";

const contentProgressSchema = z.object({
  contentId: z.string().min(1),
  status: z.enum(["not-started", "in-progress", "completed"]),
  position: z.number().finite().min(0).max(1),
  updatedAt: z.string(),
}).strict();

const bookmarkSchema = z.object({ contentId: z.string().min(1), createdAt: z.string() }).strict();

const reviewCardSchema = z.object({
  cardId: z.string().min(1),
  contentId: z.string().min(1),
  due: z.string(),
  state: z.number().int(),
  stability: z.number().finite().nonnegative(),
  difficulty: z.number().finite(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  algorithmVersion: z.string().min(1),
}).strict();

const quizAttemptSchema = z.object({
  id: z.string().min(1),
  quizId: z.string().min(1),
  selected: z.string(),
  correct: z.boolean().nullable(),
  submittedAt: z.string(),
  durationSeconds: z.number().finite().nonnegative(),
}).strict();

const wrongQuestionSchema = z.object({
  questionId: z.string().min(1),
  status: z.enum(["active", "recovered"]),
  failureCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
}).strict();

function parseRecords(data: BackupData) {
  try {
    data.settings.forEach((value) => validateDocumentPayload("settings", value));
    data.contentProgress.forEach((value) => contentProgressSchema.parse(value));
    data.notes.forEach((value) => validateDocumentPayload("note", value));
    data.bookmarks.forEach((value) => bookmarkSchema.parse(value));
    data.reviewCards.forEach((value) => reviewCardSchema.parse(value));
    data.quizAttempts.forEach((value) => quizAttemptSchema.parse(value));
    data.wrongQuestions.forEach((value) => wrongQuestionSchema.parse(value));
    (data.interviewSessions ?? []).forEach((value) => validateDocumentPayload("interview_session", value));
    (data.codeDrafts ?? []).forEach((value) => validateDocumentPayload("code_draft", value));
    (data.projectCases ?? []).forEach((value) => validateDocumentPayload("project_case", value));
  } catch {
    throw new Error("备份记录校验失败，未写入本机数据");
  }
}

export function migrateBackup(input: unknown): BackupPackage {
  if (!input || typeof input !== "object") throw new Error("备份必须是 JSON 对象");
  const candidate = input as Partial<BackupPackage>;
  if (candidate.format !== "embedded-learning-backup" || candidate.schemaVersion !== 1 || !candidate.data) throw new Error("不支持的备份格式或 schema 版本");
  const data = candidate.data as BackupData;
  for (const key of ["settings", "contentProgress", "notes", "bookmarks", "reviewCards", "quizAttempts", "wrongQuestions"] as const) if (!Array.isArray(data[key])) throw new Error(`备份字段无效：${key}`);
  if (data.interviewSessions !== undefined && !Array.isArray(data.interviewSessions)) throw new Error("备份字段无效：interviewSessions");
  if (data.codeDrafts !== undefined && !Array.isArray(data.codeDrafts)) throw new Error("备份字段无效：codeDrafts");
  if (data.projectCases !== undefined && !Array.isArray(data.projectCases)) throw new Error("备份字段无效：projectCases");
  parseRecords(data);
  return { format: candidate.format, schemaVersion: 1, exportedAt: String(candidate.exportedAt), contentVersion: String(candidate.contentVersion), checksum: String(candidate.checksum), data };
}
