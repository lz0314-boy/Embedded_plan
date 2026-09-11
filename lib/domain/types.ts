export type StudyFocus = "balanced" | "mcu-rt-thread" | "linux-bsp" | "linux-user";
export type SelfAssessment = "new" | "familiar" | "project" | "interview";

export type Settings = {
  id: "default";
  dailyMinutes: number;
  targetDate: string | null;
  focus: StudyFocus;
  selfAssessment: SelfAssessment;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ContentProgress = {
  contentId: string;
  status: "not-started" | "in-progress" | "completed";
  position: number;
  updatedAt: string;
};

export type Note = {
  id: string;
  contentId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Bookmark = { contentId: string; createdAt: string };

export type LearningEvent = {
  id: string;
  type: "content_completed" | "content_reopened" | "bookmark_set" | "review_rated" | "quiz_submitted" | "activity_recorded";
  entityId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  deviceId?: string;
};

export type ReviewCard = {
  cardId: string;
  contentId: string;
  due: string;
  state: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  algorithmVersion: string;
};

export type QuizAttempt = {
  id: string;
  quizId: string;
  selected: string;
  /** null for a short-answer self-assessment that has no objective key. */
  correct: boolean | null;
  submittedAt: string;
  durationSeconds: number;
};

export type WrongQuestion = {
  questionId: string;
  status: "active" | "recovered";
  failureCount: number;
  updatedAt: string;
};

export type SyncState = "local-only" | "syncing" | "synced" | "offline-pending" | "auth-expired" | "conflict" | "remote-unavailable";

export type SyncMutationKind = "event-insert" | "document-insert" | "document-update";

export type SyncMutationStatus = "pending" | "blocked";

export type SyncDocumentType = "settings" | "note" | "code_draft" | "interview_session" | "project_case";

export type InterviewDirection = "all" | "c" | "cortex-m" | "rt-thread" | "linux-bsp" | "linux-user";
export type InterviewPriority = "new" | "weak" | "random";
export type InterviewDifficulty = "any" | "beginner" | "intermediate" | "advanced";

export type InterviewAnswer = {
  questionId: string;
  response: string;
  thoughtSeconds: number;
  selfScores: Record<string, number>;
  revealedAt: string | null;
  followUp: string;
};

export type InterviewSession = {
  id: string;
  direction: InterviewDirection;
  platform: string;
  module: string;
  difficulty: InterviewDifficulty;
  questionCount: number;
  totalMinutes: number;
  allowFollowUps: boolean;
  mixedProjects: boolean;
  priority: InterviewPriority;
  questionIds: string[];
  answers: InterviewAnswer[];
  currentIndex: number;
  status: "active" | "completed" | "abandoned";
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CodeRunSummary = {
  status: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  recordedAt: string;
};

export type CodeDraft = {
  id: string;
  labId: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  lastRun: CodeRunSummary | null;
  deletedAt: string | null;
};

export type ProjectCase = {
  id: string;
  title: string;
  context: string;
  role: string;
  goals: string;
  constraints: string;
  actions: string;
  results: string;
  lessons: string;
  technologies: string[];
  knowledgeLinks: string[];
  syncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type SyncMutation = {
  mutationId: string;
  kind: SyncMutationKind;
  recordType: string;
  recordId: string;
  baseVersion: number | null;
  payload: unknown;
  createdAt: string;
  attempts: number;
  nextAttemptAt: string;
  status: SyncMutationStatus;
  lastError: string | null;
};

export type SyncCursor = { id: "events" | "documents"; occurredAt: string | null; recordId: string | null };

export type SyncConflict = {
  localPayload: unknown;
  remotePayload: unknown;
  remoteVersion: number;
  remoteId: string;
  remoteDeviceId: string;
  remoteClientUpdatedAt: string;
  remoteUpdatedAt: string;
  remoteDeletedAt: string | null;
};

export type SyncDocumentState = {
  key: string;
  documentType: SyncDocumentType;
  entityId: string;
  remoteId: string;
  version: number;
  baseVersion: number | null;
  payload: unknown;
  deviceId: string;
  clientUpdatedAt: string;
  serverUpdatedAt: string | null;
  deletedAt: string | null;
  conflict?: SyncConflict;
};
