import { db, ensureDeviceId, nowIso } from "@/lib/db/database";
import { rateReviewCard, Rating } from "@/lib/fsrs/adapter";
import type { Bookmark, CodeDraft, ContentProgress, InterviewSession, LearningEvent, Note, ProjectCase, QuizAttempt, ReviewCard, Settings, SyncDocumentState, SyncMutation, WrongQuestion } from "@/lib/domain/types";
import { documentKey, documentMutationId, eventMutationId, validateDocumentPayload } from "./validation";

function eventMutation(event: LearningEvent, createdAt: string): SyncMutation {
  return {
    mutationId: eventMutationId(event.id),
    kind: "event-insert",
    recordType: "event",
    recordId: event.id,
    baseVersion: null,
    payload: event,
    createdAt,
    attempts: 0,
    nextAttemptAt: createdAt,
    status: "pending",
    lastError: null,
  };
}

async function putEventInTransaction(event: LearningEvent, createdAt = nowIso()) {
  const value = { ...event, deviceId: event.deviceId ?? await ensureDeviceId() };
  await db.learningEvents.put(value);
  await db.syncMutations.put(eventMutation(value, createdAt));
  return value;
}

export async function recordLearningEvent(event: LearningEvent) {
  const deviceId = event.deviceId ?? await ensureDeviceId();
  return db.transaction("rw", [db.learningEvents, db.syncMutations], () => putEventInTransaction({ ...event, deviceId }));
}

async function putDocumentInTransaction(documentType: SyncDocumentState["documentType"], entityId: string, payload: unknown, deletedAt: string | null, deviceId: string) {
  const validatedPayload = validateDocumentPayload(documentType, payload);
  const key = documentKey(documentType, entityId);
  const mutationId = documentMutationId(documentType, entityId);
  const current = await db.syncDocuments.get(key);
  const existingMutation = await db.syncMutations.get(mutationId);
  const baseVersion = current?.baseVersion ?? null;
  const version = baseVersion === null ? 1 : baseVersion + 1;
  const updatedAt = nowIso();
  const state: SyncDocumentState = {
    key,
    documentType,
    entityId,
    remoteId: current?.remoteId ?? crypto.randomUUID(),
    version,
    baseVersion,
    payload: validatedPayload,
    deviceId,
    clientUpdatedAt: updatedAt,
    serverUpdatedAt: current?.serverUpdatedAt ?? null,
    deletedAt,
    conflict: current?.conflict,
  };
  const mutation: SyncMutation = {
    mutationId,
    kind: baseVersion === null ? "document-insert" : "document-update",
    recordType: documentType,
    recordId: entityId,
    baseVersion,
    payload: state,
    createdAt: updatedAt,
    attempts: current?.conflict ? existingMutation?.attempts ?? 0 : 0,
    nextAttemptAt: updatedAt,
    status: current?.conflict ? "blocked" : "pending",
    lastError: current?.conflict ? existingMutation?.lastError ?? "存在未解决冲突" : null,
  };
  await db.syncDocuments.put(state);
  await db.syncMutations.put(mutation);
  return state;
}

export async function saveSettings(value: Settings) {
  const deviceId = await ensureDeviceId();
  return db.transaction("rw", [db.settings, db.syncDocuments, db.syncMutations], async () => {
    await db.settings.put(value);
    return putDocumentInTransaction("settings", value.id, value, null, deviceId);
  });
}

export async function saveNote(value: Note) {
  const deviceId = await ensureDeviceId();
  return db.transaction("rw", [db.notes, db.syncDocuments, db.syncMutations], async () => {
    await db.notes.put(value);
    return putDocumentInTransaction("note", value.id, value, value.deletedAt, deviceId);
  });
}

export async function saveCodeDraft(value: CodeDraft) {
  const deviceId = await ensureDeviceId();
  return db.transaction("rw", [db.codeDrafts, db.syncDocuments, db.syncMutations], async () => {
    await db.codeDrafts.put(value);
    return putDocumentInTransaction("code_draft", value.id, value, value.deletedAt, deviceId);
  });
}

export async function saveInterviewSession(value: InterviewSession) {
  const deviceId = await ensureDeviceId();
  return db.transaction("rw", [db.interviewSessions, db.syncDocuments, db.syncMutations], async () => {
    await db.interviewSessions.put(value);
    return putDocumentInTransaction("interview_session", value.id, value, null, deviceId);
  });
}

export async function saveProjectCase(value: ProjectCase) {
  const deviceId = await ensureDeviceId();
  return db.transaction("rw", [db.projectCases, db.syncDocuments, db.syncMutations], async () => {
    await db.projectCases.put(value);
    const existing = await db.syncDocuments.get(documentKey("project_case", value.id));
    if (!value.syncEnabled && !existing) return value;
    return putDocumentInTransaction("project_case", value.id, value, value.syncEnabled ? value.deletedAt : existing?.deletedAt ?? nowIso(), deviceId);
  });
}

export async function setBookmark(contentId: string, bookmarked: boolean) {
  const deviceId = await ensureDeviceId();
  const occurredAt = nowIso();
  return db.transaction("rw", [db.bookmarks, db.learningEvents, db.syncMutations], async () => {
    const value: Bookmark = { contentId, createdAt: occurredAt };
    if (bookmarked) await db.bookmarks.put(value);
    else await db.bookmarks.delete(contentId);
    await putEventInTransaction({ id: crypto.randomUUID(), type: "bookmark_set", entityId: contentId, payload: { bookmarked }, occurredAt, deviceId }, occurredAt);
  });
}

export async function completeContent(contentId: string) {
  const deviceId = await ensureDeviceId();
  const occurredAt = nowIso();
  const progress: ContentProgress = { contentId, status: "completed", position: 1, updatedAt: occurredAt };
  // Reading completion is not a memory rating. FSRS is changed only by an
  // explicit recall/self-rating action.
  return db.transaction("rw", [db.contentProgress, db.learningEvents, db.syncMutations], async () => {
    await db.contentProgress.put(progress);
    await putEventInTransaction({ id: crypto.randomUUID(), type: "content_completed", entityId: contentId, payload: {}, occurredAt, deviceId }, occurredAt);
    return { progress };
  });
}

export async function submitQuiz(value: QuizAttempt) {
  const deviceId = await ensureDeviceId();
  const occurredAt = value.submittedAt;
  return db.transaction("rw", [db.quizAttempts, db.wrongQuestions, db.learningEvents, db.syncMutations], async () => {
    await db.quizAttempts.put(value);
    const existing = await db.wrongQuestions.get(value.quizId);
    if (value.correct === true) {
      if (existing) await db.wrongQuestions.put({ ...existing, status: "recovered", updatedAt: occurredAt });
    } else if (value.correct === false) {
      const wrong: WrongQuestion = { questionId: value.quizId, status: "active", failureCount: (existing?.failureCount ?? 0) + 1, updatedAt: occurredAt };
      await db.wrongQuestions.put(wrong);
    }
    await putEventInTransaction({ id: crypto.randomUUID(), type: "quiz_submitted", entityId: value.quizId, payload: { attemptId: value.id, selected: value.selected, correct: value.correct, durationSeconds: value.durationSeconds }, occurredAt, deviceId }, occurredAt);
  });
}

/** Apply FSRS after the learner explicitly rates recall difficulty. */
export async function rateQuizMemory(contentId: string, rating: Rating) {
  const deviceId = await ensureDeviceId();
  const occurredAt = nowIso();
  const current = await db.reviewCards.where("contentId").equals(contentId).first();
  const card = rateReviewCard(current, rating, new Date(occurredAt));
  card.contentId = contentId;
  return db.transaction("rw", [db.reviewCards, db.learningEvents, db.syncMutations], async () => {
    await db.reviewCards.put(card);
    await putEventInTransaction({ id: crypto.randomUUID(), type: "review_rated", entityId: card.cardId, payload: { contentId, rating }, occurredAt, deviceId }, occurredAt);
    return card;
  });
}

export async function rateReview(value: ReviewCard, rating: Rating) {
  const deviceId = await ensureDeviceId();
  const occurredAt = nowIso();
  const updated = rateReviewCard(value, rating, new Date(occurredAt));
  updated.contentId = value.contentId;
  return db.transaction("rw", [db.reviewCards, db.learningEvents, db.syncMutations], async () => {
    await db.reviewCards.put(updated);
    await putEventInTransaction({ id: crypto.randomUUID(), type: "review_rated", entityId: value.cardId, payload: { contentId: value.contentId, rating }, occurredAt, deviceId }, occurredAt);
    return updated;
  });
}

export async function captureExistingLocalDocuments() {
  const deviceId = await ensureDeviceId();
  const events = await db.learningEvents.toArray();
  for (const event of events) {
    const mutationId = eventMutationId(event.id);
    if (await db.syncMutations.get(mutationId)) continue;
    await db.transaction("rw", [db.learningEvents, db.syncMutations], async () => {
      const value = { ...event, deviceId: event.deviceId ?? deviceId };
      await db.learningEvents.put(value);
      await db.syncMutations.put(eventMutation(value, value.occurredAt));
    });
  }
  const settings = await db.settings.toArray();
  const notes = await db.notes.toArray();
  const codeDrafts = await db.codeDrafts.toArray();
  const interviewSessions = await db.interviewSessions.toArray();
  const projectCases = await db.projectCases.toArray();
  for (const value of settings) {
    if (!await db.syncDocuments.get(documentKey("settings", value.id))) {
      await db.transaction("rw", [db.syncDocuments, db.syncMutations], () => putDocumentInTransaction("settings", value.id, value, null, deviceId));
    }
  }
  for (const value of notes) {
    if (!await db.syncDocuments.get(documentKey("note", value.id))) {
      await db.transaction("rw", [db.syncDocuments, db.syncMutations], () => putDocumentInTransaction("note", value.id, value, value.deletedAt, deviceId));
    }
  }
  for (const value of codeDrafts) {
    if (!await db.syncDocuments.get(documentKey("code_draft", value.id))) {
      await db.transaction("rw", [db.syncDocuments, db.syncMutations], () => putDocumentInTransaction("code_draft", value.id, value, value.deletedAt, deviceId));
    }
  }
  for (const value of interviewSessions) {
    if (!await db.syncDocuments.get(documentKey("interview_session", value.id))) {
      await db.transaction("rw", [db.syncDocuments, db.syncMutations], () => putDocumentInTransaction("interview_session", value.id, value, null, deviceId));
    }
  }
  for (const value of projectCases) {
    if (!value.syncEnabled || await db.syncDocuments.get(documentKey("project_case", value.id))) continue;
    await db.transaction("rw", [db.syncDocuments, db.syncMutations], () => putDocumentInTransaction("project_case", value.id, value, value.deletedAt, deviceId));
  }
}

export async function pendingMutations() {
  return db.syncMutations.where("status").equals("pending").sortBy("createdAt");
}

export type ConflictChoice = "keep-local" | "keep-remote" | "save-copy";

async function writeRemoteDocumentToLocal(state: SyncDocumentState, payload: unknown, deletedAt: string | null, deviceId: string, serverUpdatedAt: string, version: number, remoteId: string, clientUpdatedAt: string) {
  const validatedPayload = validateDocumentPayload(state.documentType, payload);
  if (state.documentType === "settings") await db.settings.put(validatedPayload as never);
  if (state.documentType === "note") await db.notes.put(validatedPayload as never);
  if (state.documentType === "code_draft") await db.codeDrafts.put(validatedPayload as never);
  if (state.documentType === "interview_session") await db.interviewSessions.put(validatedPayload as never);
  if (state.documentType === "project_case") await db.projectCases.put(validatedPayload as never);
  await db.syncDocuments.put({ key: state.key, documentType: state.documentType, entityId: state.entityId, remoteId, version, baseVersion: version, payload: validatedPayload, deviceId, clientUpdatedAt, serverUpdatedAt, deletedAt, conflict: undefined });
}

export async function listConflicts() {
  const states = await db.syncDocuments.toArray();
  return states.filter((state) => Boolean(state.conflict));
}

export async function resolveConflict(key: string, choice: ConflictChoice) {
  const state = await db.syncDocuments.get(key);
  if (!state?.conflict) throw new Error("找不到待处理的文档冲突");
  const conflict = state.conflict;
  if (choice === "keep-remote") {
    await db.transaction("rw", [db.settings, db.notes, db.codeDrafts, db.interviewSessions, db.projectCases, db.syncDocuments, db.syncMutations], async () => {
      await writeRemoteDocumentToLocal(state, conflict.remotePayload, conflict.remoteDeletedAt, conflict.remoteDeviceId, conflict.remoteUpdatedAt, conflict.remoteVersion, conflict.remoteId, conflict.remoteClientUpdatedAt);
      await db.syncMutations.delete(documentMutationId(state.documentType, state.entityId));
    });
    return;
  }
  if (choice === "keep-local") {
    const updatedAt = nowIso();
    const nextState: SyncDocumentState = { ...state, remoteId: conflict.remoteId, version: conflict.remoteVersion + 1, baseVersion: conflict.remoteVersion, clientUpdatedAt: updatedAt, serverUpdatedAt: conflict.remoteUpdatedAt, conflict: undefined };
    await db.transaction("rw", [db.syncDocuments, db.syncMutations], async () => {
      await db.syncDocuments.put(nextState);
      await db.syncMutations.put({ mutationId: documentMutationId(state.documentType, state.entityId), kind: "document-update", recordType: state.documentType, recordId: state.entityId, baseVersion: conflict.remoteVersion, payload: nextState, createdAt: updatedAt, attempts: 0, nextAttemptAt: updatedAt, status: "pending", lastError: null });
    });
    return;
  }
  if (state.documentType === "note") {
    const source = state.payload as Note;
    const copy: Note = { ...source, id: crypto.randomUUID(), createdAt: nowIso(), updatedAt: nowIso(), deletedAt: null };
    const deviceId = await ensureDeviceId();
    await db.transaction("rw", [db.notes, db.syncDocuments, db.syncMutations], async () => {
      await db.notes.put(copy);
      await putDocumentInTransaction("note", copy.id, copy, null, deviceId);
    });
    return;
  }
  if (state.documentType !== "project_case") throw new Error("只有笔记和项目经历冲突支持另存为副本");
  const source = state.payload as ProjectCase;
  const copy: ProjectCase = { ...source, id: crypto.randomUUID(), title: source.title ? `${source.title}（副本）` : "项目经历副本", createdAt: nowIso(), updatedAt: nowIso(), syncEnabled: false, deletedAt: null };
  await db.transaction("rw", db.projectCases, async () => {
    await db.projectCases.put(copy);
  });
}

function eventSort(left: LearningEvent, right: LearningEvent) {
  return left.occurredAt.localeCompare(right.occurredAt) || (left.deviceId ?? "").localeCompare(right.deviceId ?? "") || left.id.localeCompare(right.id);
}

function numericRating(value: unknown): Rating | undefined {
  if (value === Rating.Again || value === Rating.Hard || value === Rating.Good || value === Rating.Easy) return value;
  return undefined;
}

export async function rebuildEventProjections() {
  const events = (await db.learningEvents.toArray()).sort(eventSort);
  const bookmarks = new Map<string, Bookmark>();
  const progress = new Map<string, ContentProgress>();
  const cards = new Map<string, ReviewCard>();
  const attempts = new Map<string, QuizAttempt>();
  const wrongQuestions = new Map<string, WrongQuestion>();
  for (const event of events) {
    if (event.type === "bookmark_set") {
      if (event.payload.bookmarked === true) bookmarks.set(event.entityId, { contentId: event.entityId, createdAt: event.occurredAt });
      else bookmarks.delete(event.entityId);
    }
    if (event.type === "content_completed") {
      progress.set(event.entityId, { contentId: event.entityId, status: "completed", position: 1, updatedAt: event.occurredAt });
      // Completion is progress only; do not synthesize an FSRS Good rating.
    }
    if (event.type === "review_rated") {
      const rating = numericRating(event.payload.rating);
      const contentId = typeof event.payload.contentId === "string" ? event.payload.contentId : cards.get(event.entityId)?.contentId;
      if (rating !== undefined && contentId) {
        const existing = cards.get(contentId);
        const card = rateReviewCard(existing, rating, new Date(event.occurredAt));
        card.cardId = existing?.cardId ?? contentId;
        card.contentId = contentId;
        cards.set(contentId, card);
      }
    }
    if (event.type === "quiz_submitted" && typeof event.payload.attemptId === "string" && typeof event.payload.selected === "string" && (typeof event.payload.correct === "boolean" || event.payload.correct === null)) {
      const attempt: QuizAttempt = { id: event.payload.attemptId, quizId: event.entityId, selected: event.payload.selected, correct: event.payload.correct as boolean | null, submittedAt: event.occurredAt, durationSeconds: typeof event.payload.durationSeconds === "number" ? event.payload.durationSeconds : 0 };
      attempts.set(attempt.id, attempt);
      const previous = wrongQuestions.get(event.entityId);
      if (attempt.correct === true) {
        if (previous) wrongQuestions.set(event.entityId, { ...previous, status: "recovered", updatedAt: event.occurredAt });
      } else if (attempt.correct === false) {
        wrongQuestions.set(event.entityId, { questionId: event.entityId, status: "active", failureCount: (previous?.failureCount ?? 0) + 1, updatedAt: event.occurredAt });
      }
    }
  }
  await db.transaction("rw", [db.bookmarks, db.contentProgress, db.reviewCards, db.quizAttempts, db.wrongQuestions], async () => {
    await db.bookmarks.clear();
    await db.contentProgress.clear();
    await db.reviewCards.clear();
    await db.quizAttempts.clear();
    await db.wrongQuestions.clear();
    await db.bookmarks.bulkPut([...bookmarks.values()]);
    for (const value of progress.values()) await db.contentProgress.put(value);
    for (const value of cards.values()) await db.reviewCards.put(value);
    for (const value of attempts.values()) await db.quizAttempts.put(value);
    for (const value of wrongQuestions.values()) await db.wrongQuestions.put(value);
  });
}
