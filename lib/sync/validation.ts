import { z } from "zod";
import type { CodeDraft, InterviewSession, Note, ProjectCase, Settings, SyncDocumentType } from "@/lib/domain/types";
import { SyncRemoteError } from "./types";

export const MAX_DOCUMENT_BYTES = 256 * 1024;

const settingsSchema = z.object({
  id: z.literal("default"),
  dailyMinutes: z.number().finite(),
  targetDate: z.string().nullable(),
  focus: z.enum(["balanced", "mcu-rt-thread", "linux-bsp", "linux-user"]),
  selfAssessment: z.enum(["new", "familiar", "project", "interview"]),
  notificationsEnabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();

const noteSchema = z.object({
  // Notes created by older local-only builds used stable non-UUID IDs; keep
  // those records importable while still requiring a non-empty key.
  id: z.string().min(1),
  contentId: z.string().min(1),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
}).strict();

const codeRunSummarySchema = z.object({
  status: z.string().min(1),
  exitCode: z.number().int().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number().finite().nonnegative(),
  recordedAt: z.string(),
}).strict();

const codeDraftSchema = z.object({
  id: z.string().uuid(),
  labId: z.string().min(1),
  source: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastRun: codeRunSummarySchema.nullable(),
  deletedAt: z.string().nullable(),
}).strict();

const interviewAnswerSchema = z.object({
  questionId: z.string().min(1),
  response: z.string(),
  thoughtSeconds: z.number().int().nonnegative(),
  selfScores: z.record(z.string(), z.number().int().min(0).max(5)),
  revealedAt: z.string().nullable(),
  followUp: z.string(),
}).strict();

const interviewSessionSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["all", "c", "cortex-m", "rt-thread", "linux-bsp", "linux-user"]),
  platform: z.string(),
  module: z.string(),
  difficulty: z.enum(["any", "beginner", "intermediate", "advanced"]),
  questionCount: z.number().int().positive().max(50),
  totalMinutes: z.number().int().positive().max(240),
  allowFollowUps: z.boolean(),
  mixedProjects: z.boolean(),
  priority: z.enum(["new", "weak", "random"]),
  questionIds: z.array(z.string().min(1)).min(1).max(50),
  answers: z.array(interviewAnswerSchema).max(50),
  currentIndex: z.number().int().min(0).max(50),
  status: z.enum(["active", "completed", "abandoned"]),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();

const projectCaseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(200),
  context: z.string().max(20_000),
  role: z.string().max(10_000),
  goals: z.string().max(10_000),
  constraints: z.string().max(10_000),
  actions: z.string().max(20_000),
  results: z.string().max(20_000),
  lessons: z.string().max(20_000),
  technologies: z.array(z.string().min(1).max(100)).max(30),
  knowledgeLinks: z.array(z.string().min(1).max(200)).max(50),
  syncEnabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
}).strict();

function serializedSize(value: unknown) {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new SyncRemoteError("同步文档不是可序列化 JSON", "validation");
  }
  if (serialized === undefined) throw new SyncRemoteError("同步文档不能为空", "validation");
  return new TextEncoder().encode(serialized).byteLength;
}

export function validateDocumentPayload(documentType: SyncDocumentType, payload: unknown): unknown {
  if (serializedSize(payload) > MAX_DOCUMENT_BYTES) {
    throw new SyncRemoteError("同步文档超过 256 KiB 限制", "validation");
  }
  try {
    if (documentType === "settings") return settingsSchema.parse(payload) as Settings;
    if (documentType === "note") return noteSchema.parse(payload) as Note;
    if (documentType === "code_draft") return codeDraftSchema.parse(payload) as CodeDraft;
    if (documentType === "interview_session") return interviewSessionSchema.parse(payload) as InterviewSession;
    if (documentType === "project_case") return projectCaseSchema.parse(payload) as ProjectCase;
  } catch {
    throw new SyncRemoteError(`${documentType} 文档格式无效`, "validation");
  }
  return payload;
}

export function documentKey(documentType: SyncDocumentType, entityId: string) {
  return `${documentType}:${entityId}`;
}

export function documentMutationId(documentType: SyncDocumentType, entityId: string) {
  return `document:${documentKey(documentType, entityId)}`;
}

export function eventMutationId(eventId: string) {
  return `event:${eventId}`;
}

export function stableValue(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableValue(entry)}`).join(",")}}`;
}

export function sameValue(left: unknown, right: unknown) {
  return stableValue(left) === stableValue(right);
}
