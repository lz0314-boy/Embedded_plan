import Dexie, { type Table } from "dexie";
import type {
  Bookmark,
  CodeDraft,
  ContentProgress,
  InterviewSession,
  LearningEvent,
  Note,
  QuizAttempt,
  ProjectCase,
  ReviewCard,
  RecallMark,
  Settings,
  SyncCursor,
  SyncDocumentState,
  SyncMutation,
  WrongQuestion,
} from "@/lib/domain/types";

export type AppMeta = { key: string; value: string };

export class LearningDatabase extends Dexie {
  appMeta!: Table<AppMeta, string>;
  settings!: Table<Settings, string>;
  contentProgress!: Table<ContentProgress, string>;
  notes!: Table<Note, string>;
  bookmarks!: Table<Bookmark, string>;
  learningEvents!: Table<LearningEvent, string>;
  reviewCards!: Table<ReviewCard, string>;
  recallMarks!: Table<RecallMark, string>;
  quizAttempts!: Table<QuizAttempt, string>;
  wrongQuestions!: Table<WrongQuestion, string>;
  syncMutations!: Table<SyncMutation, string>;
  syncCursors!: Table<SyncCursor, string>;
  syncDocuments!: Table<SyncDocumentState, string>;
  interviewSessions!: Table<InterviewSession, string>;
  codeDrafts!: Table<CodeDraft, string>;
  projectCases!: Table<ProjectCase, string>;

  constructor() {
    super("embedded-learning-db");
    this.version(1).stores({
      appMeta: "key",
      settings: "id, updatedAt",
      contentProgress: "contentId, status, updatedAt",
      notes: "id, contentId, updatedAt",
      bookmarks: "contentId, createdAt",
      learningEvents: "id, type, entityId, occurredAt",
      reviewCards: "cardId, contentId, due, state",
      recallMarks: "contentId, label, updatedAt, lastReviewedAt",
      quizAttempts: "id, quizId, submittedAt",
      wrongQuestions: "questionId, status, updatedAt",
    });
    this.version(2).stores({
      appMeta: "key",
      settings: "id, updatedAt",
      contentProgress: "contentId, status, updatedAt",
      notes: "id, contentId, updatedAt",
      bookmarks: "contentId, createdAt",
      learningEvents: "id, type, entityId, occurredAt",
      reviewCards: "cardId, contentId, due, state",
      recallMarks: "contentId, label, updatedAt, lastReviewedAt",
      quizAttempts: "id, quizId, submittedAt",
      wrongQuestions: "questionId, status, updatedAt",
      syncMutations: "mutationId, [kind+recordType+recordId], status, nextAttemptAt, createdAt",
      syncCursors: "id",
      syncDocuments: "key, [documentType+entityId], remoteId, serverUpdatedAt",
    });
    this.version(3).stores({
      appMeta: "key",
      settings: "id, updatedAt",
      contentProgress: "contentId, status, updatedAt",
      notes: "id, contentId, updatedAt",
      bookmarks: "contentId, createdAt",
      learningEvents: "id, type, entityId, occurredAt",
      reviewCards: "cardId, contentId, due, state",
      recallMarks: "contentId, label, updatedAt, lastReviewedAt",
      quizAttempts: "id, quizId, submittedAt",
      wrongQuestions: "questionId, status, updatedAt",
      syncMutations: "mutationId, [kind+recordType+recordId], status, nextAttemptAt, createdAt",
      syncCursors: "id",
      syncDocuments: "key, [documentType+entityId], remoteId, serverUpdatedAt",
      interviewSessions: "id, status, startedAt, updatedAt",
      codeDrafts: "id, labId, updatedAt",
      recordings: "id, sessionId, createdAt",
    });
    this.version(4).stores({
      appMeta: "key",
      settings: "id, updatedAt",
      contentProgress: "contentId, status, updatedAt",
      notes: "id, contentId, updatedAt",
      bookmarks: "contentId, createdAt",
      learningEvents: "id, type, entityId, occurredAt",
      reviewCards: "cardId, contentId, due, state",
      recallMarks: "contentId, label, updatedAt, lastReviewedAt",
      quizAttempts: "id, quizId, submittedAt",
      wrongQuestions: "questionId, status, updatedAt",
      syncMutations: "mutationId, [kind+recordType+recordId], status, nextAttemptAt, createdAt",
      syncCursors: "id",
      syncDocuments: "key, [documentType+entityId], remoteId, serverUpdatedAt",
      interviewSessions: "id, status, startedAt, updatedAt",
      codeDrafts: "id, labId, updatedAt",
      recordings: "id, sessionId, createdAt",
      projectCases: "id, updatedAt, syncEnabled",
    });
    this.version(5).stores({
      appMeta: "key",
      settings: "id, updatedAt",
      contentProgress: "contentId, status, updatedAt",
      notes: "id, contentId, updatedAt",
      bookmarks: "contentId, createdAt",
      learningEvents: "id, type, entityId, occurredAt",
      reviewCards: "cardId, contentId, due, state",
      recallMarks: "contentId, label, updatedAt, lastReviewedAt",
      quizAttempts: "id, quizId, submittedAt",
      wrongQuestions: "questionId, status, updatedAt",
      syncMutations: "mutationId, [kind+recordType+recordId], status, nextAttemptAt, createdAt",
      syncCursors: "id",
      syncDocuments: "key, [documentType+entityId], remoteId, serverUpdatedAt",
      interviewSessions: "id, status, startedAt, updatedAt",
      codeDrafts: "id, labId, updatedAt",
      projectCases: "id, updatedAt, syncEnabled",
      // Explicitly remove the legacy recordings table and its data.
      recordings: null,
    }).upgrade((tx) => tx.table("interviewSessions").toCollection().modify((session: Record<string, unknown>) => {
      delete session.recordingRequested;
    }));
    this.version(6).stores({
      appMeta: "key",
      settings: "id, updatedAt",
      contentProgress: "contentId, status, updatedAt",
      notes: "id, contentId, updatedAt",
      bookmarks: "contentId, createdAt",
      learningEvents: "id, type, entityId, occurredAt",
      reviewCards: "cardId, contentId, due, state",
      recallMarks: "contentId, label, updatedAt, lastReviewedAt",
      quizAttempts: "id, quizId, submittedAt",
      wrongQuestions: "questionId, status, updatedAt",
      syncMutations: "mutationId, [kind+recordType+recordId], status, nextAttemptAt, createdAt",
      syncCursors: "id",
      syncDocuments: "key, [documentType+entityId], remoteId, serverUpdatedAt",
      interviewSessions: "id, status, startedAt, updatedAt",
      codeDrafts: "id, labId, updatedAt",
      projectCases: "id, updatedAt, syncEnabled",
    });
  }
}

export const db = new LearningDatabase();

export const nowIso = () => new Date().toISOString();

let deviceIdPromise: Promise<string> | undefined;

export function ensureDeviceId() {
  deviceIdPromise ??= db.appMeta.get("deviceId").then(async (value) => {
    if (value?.value) return value.value;
    const deviceId = crypto.randomUUID();
    await db.appMeta.put({ key: "deviceId", value: deviceId });
    return deviceId;
  });
  return deviceIdPromise;
}

export async function ensureDefaultSettings(): Promise<Settings> {
  const current = await db.settings.get("default");
  if (current) return current;
  const now = nowIso();
  const settings: Settings = {
    id: "default",
    dailyMinutes: 60,
    targetDate: null,
    focus: "balanced",
    selfAssessment: "new",
    notificationsEnabled: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.settings.put(settings);
  return settings;
}
