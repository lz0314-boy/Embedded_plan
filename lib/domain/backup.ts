import type { Settings } from "./types";
import { db } from "@/lib/db/database";

export type BackupData = {
  settings: Settings[];
  contentProgress: unknown[];
  notes: unknown[];
  bookmarks: unknown[];
  reviewCards: unknown[];
  recallMarks?: unknown[];
  quizAttempts: unknown[];
  wrongQuestions: unknown[];
  interviewSessions?: unknown[];
  codeDrafts?: unknown[];
  projectCases?: unknown[];
};

export type BackupPackage = {
  format: "embedded-learning-backup";
  schemaVersion: 1;
  exportedAt: string;
  contentVersion: string;
  checksum: string;
  data: BackupData;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, stableValue(nested)]));
  }
  return value;
}

function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

export async function checksumData(data: BackupData) {
  const bytes = new TextEncoder().encode(stableJson(data));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function collectBackupData(): Promise<BackupData> {
  return {
    settings: await db.settings.toArray(),
    contentProgress: await db.contentProgress.toArray(),
    notes: await db.notes.toArray(),
    bookmarks: await db.bookmarks.toArray(),
    reviewCards: await db.reviewCards.toArray(),
    recallMarks: await db.recallMarks.toArray(),
    quizAttempts: await db.quizAttempts.toArray(),
    wrongQuestions: await db.wrongQuestions.toArray(),
    interviewSessions: await db.interviewSessions.toArray(),
    codeDrafts: await db.codeDrafts.toArray(),
    projectCases: await db.projectCases.toArray(),
  };
}

export async function createBackupPackage(contentVersion = "local-uncommitted") {
  const data = await collectBackupData();
  return { format: "embedded-learning-backup" as const, schemaVersion: 1 as const, exportedAt: new Date().toISOString(), contentVersion, checksum: await checksumData(data), data };
}

export async function createPreSyncSnapshot() {
  const marker = await db.appMeta.get("pre-sync-backup");
  if (marker) return false;
  const backup = await createBackupPackage();
  await db.appMeta.put({ key: "pre-sync-backup", value: JSON.stringify(backup) });
  return true;
}
