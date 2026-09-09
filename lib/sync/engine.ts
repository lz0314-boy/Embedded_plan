import { db } from "@/lib/db/database";
import type { LearningEvent, SyncDocumentState, SyncMutation, SyncState } from "@/lib/domain/types";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { captureExistingLocalDocuments, pendingMutations, rebuildEventProjections } from "./repository";
import { documentKey, sameValue, validateDocumentPayload } from "./validation";
import { SupabaseRemote } from "./supabase-remote";
import { isSyncRemoteError, SyncConflictError, SyncRemoteError, type RemoteDocument, type RemoteEvent, type SyncRemote, type SyncResult, type SyncRunReason } from "./types";

const PAGE_SIZE = 200;
const retryDelays = [5_000, 30_000, 120_000, 600_000, 3_600_000];
const eventTypes = new Set<LearningEvent["type"]>(["content_completed", "content_reopened", "bookmark_set", "review_rated", "quiz_submitted", "activity_recorded"]);

export function retryDelay(attempt: number, jitter = 0) {
  const base = retryDelays[Math.min(Math.max(attempt, 0), retryDelays.length - 1)];
  return Math.min(6 * 60 * 60 * 1000, Math.round(base + base * jitter));
}

export type SyncSnapshot = SyncResult & { lastRunAt: string | null };
export type SyncEngineOptions = {
  remoteFactory?: () => SyncRemote;
  configured?: () => boolean;
  getUserId?: () => Promise<string | null>;
  online?: () => boolean;
};

const initialSnapshot: SyncSnapshot = { state: "local-only", pushed: 0, pulled: 0, conflicts: 0, lastRunAt: null };

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

function localEvent(remote: RemoteEvent): LearningEvent {
  if (!eventTypes.has(remote.eventType as LearningEvent["type"])) throw new SyncRemoteError("远端事件类型无效", "validation");
  return { id: remote.id, type: remote.eventType as LearningEvent["type"], entityId: remote.entityId, payload: remote.payload, occurredAt: remote.occurredAt, deviceId: remote.deviceId };
}

function stateFromMutation(mutation: SyncMutation) {
  if (!mutation.payload || typeof mutation.payload !== "object") throw new SyncRemoteError("同步文档队列内容无效", "validation");
  const state = mutation.payload as SyncDocumentState;
  if (!state.remoteId || !state.documentType || !state.entityId) throw new SyncRemoteError("同步文档队列标识无效", "validation");
  validateDocumentPayload(state.documentType, state.payload);
  return state;
}

function sameRemoteDocument(state: SyncDocumentState, remote: RemoteDocument, userId: string) {
  return state.remoteId === remote.id && remote.userId === userId && state.documentType === remote.documentType && state.entityId === remote.entityId && state.version === remote.version && state.deviceId === remote.deviceId && state.clientUpdatedAt === remote.clientUpdatedAt && state.deletedAt === remote.deletedAt && sameValue(state.payload, remote.payload);
}

async function readCursor(id: "events" | "documents") {
  return (await db.syncCursors.get(id)) ?? { id, occurredAt: null, recordId: null };
}

async function markBlocked(mutation: SyncMutation, message: string, remote?: RemoteDocument) {
  await db.transaction("rw", [db.syncMutations, db.syncDocuments], async () => {
    const current = await db.syncMutations.get(mutation.mutationId);
    if (current?.createdAt !== mutation.createdAt) return;
    await db.syncMutations.update(mutation.mutationId, { status: "blocked", lastError: message });
    if (!remote || mutation.recordType === "event") return;
    const state = await db.syncDocuments.get(documentKey(mutation.recordType as SyncDocumentState["documentType"], mutation.recordId));
    if (!state) return;
    await db.syncDocuments.put({ ...state, conflict: { localPayload: state.payload, remotePayload: remote.payload, remoteVersion: remote.version, remoteId: remote.id, remoteDeviceId: remote.deviceId, remoteClientUpdatedAt: remote.clientUpdatedAt, remoteUpdatedAt: remote.serverUpdatedAt, remoteDeletedAt: remote.deletedAt } });
  });
}

async function scheduleRetry(mutation: SyncMutation, message: string) {
  await db.transaction("rw", db.syncMutations, async () => {
    const current = await db.syncMutations.get(mutation.mutationId);
    if (current?.createdAt !== mutation.createdAt) return;
    await db.syncMutations.update(mutation.mutationId, {
      attempts: mutation.attempts + 1,
      nextAttemptAt: new Date(Date.now() + retryDelay(mutation.attempts, Math.random() * 0.2)).toISOString(),
      lastError: message,
    });
  });
}

async function finishDocumentMutation(mutation: SyncMutation, remote: RemoteDocument) {
  await db.transaction("rw", [db.syncMutations, db.syncDocuments], async () => {
    const currentMutation = await db.syncMutations.get(mutation.mutationId);
    const currentState = await db.syncDocuments.get(documentKey(remote.documentType, remote.entityId));
    if (!currentState) return;
    if (currentMutation?.createdAt === mutation.createdAt) {
      await db.syncMutations.delete(mutation.mutationId);
      await db.syncDocuments.put({ ...currentState, remoteId: remote.id, version: remote.version, baseVersion: remote.version, payload: remote.payload, deviceId: remote.deviceId, clientUpdatedAt: remote.clientUpdatedAt, serverUpdatedAt: remote.serverUpdatedAt, deletedAt: remote.deletedAt, conflict: undefined });
      return;
    }
    if (!currentMutation) return;
    const nextState: SyncDocumentState = { ...currentState, remoteId: remote.id, version: remote.version + 1, baseVersion: remote.version, serverUpdatedAt: remote.serverUpdatedAt, conflict: undefined };
    await db.syncDocuments.put(nextState);
    await db.syncMutations.put({ ...currentMutation, kind: "document-update", baseVersion: remote.version, payload: nextState, attempts: 0, nextAttemptAt: new Date().toISOString(), status: "pending", lastError: null });
  });
}

async function applyRemoteEvent(remote: RemoteEvent) {
  const value = localEvent(remote);
  const existing = await db.learningEvents.get(value.id);
  if (existing) {
    if (!sameValue(existing, value)) throw new SyncRemoteError("同一事件 UUID 的本地内容与远端不一致", "validation");
    return;
  }
  await db.learningEvents.put(value);
}

async function writeRemoteProjection(remote: RemoteDocument) {
  const payload = validateDocumentPayload(remote.documentType, remote.payload);
  if (remote.documentType === "settings") await db.settings.put(payload as never);
  if (remote.documentType === "note") await db.notes.put(payload as never);
  if (remote.documentType === "code_draft") await db.codeDrafts.put(payload as never);
  if (remote.documentType === "interview_session") await db.interviewSessions.put(payload as never);
  if (remote.documentType === "project_case") await db.projectCases.put(payload as never);
  await db.syncDocuments.put({ key: documentKey(remote.documentType, remote.entityId), documentType: remote.documentType, entityId: remote.entityId, remoteId: remote.id, version: remote.version, baseVersion: remote.version, payload, deviceId: remote.deviceId, clientUpdatedAt: remote.clientUpdatedAt, serverUpdatedAt: remote.serverUpdatedAt, deletedAt: remote.deletedAt, conflict: undefined });
}

async function applyRemoteDocument(remote: RemoteDocument) {
  await db.transaction("rw", [db.settings, db.notes, db.codeDrafts, db.interviewSessions, db.projectCases, db.syncDocuments, db.syncMutations], async () => {
    const key = documentKey(remote.documentType, remote.entityId);
    const current = await db.syncDocuments.get(key);
    const mutation = await db.syncMutations.get(`document:${key}`);
    if (!current) {
      await writeRemoteProjection(remote);
      return;
    }
    if (mutation?.status === "blocked") return;
    if (mutation) {
      if (sameRemoteDocument(current, remote, remote.userId) && remote.version === (current.baseVersion ?? 0) + 1) {
        await db.syncMutations.delete(mutation.mutationId);
        await db.syncDocuments.put({ ...current, remoteId: remote.id, version: remote.version, baseVersion: remote.version, payload: remote.payload, deviceId: remote.deviceId, clientUpdatedAt: remote.clientUpdatedAt, serverUpdatedAt: remote.serverUpdatedAt, deletedAt: remote.deletedAt, conflict: undefined });
      } else {
        await db.syncMutations.update(mutation.mutationId, { status: "blocked", lastError: "拉取到与本地待上传版本不一致的远端文档" });
        await db.syncDocuments.put({ ...current, conflict: { localPayload: current.payload, remotePayload: remote.payload, remoteVersion: remote.version, remoteId: remote.id, remoteDeviceId: remote.deviceId, remoteClientUpdatedAt: remote.clientUpdatedAt, remoteUpdatedAt: remote.serverUpdatedAt, remoteDeletedAt: remote.deletedAt } });
      }
      return;
    }
    if (current.remoteId !== remote.id || current.baseVersion === null) {
      await db.syncDocuments.put({ ...current, conflict: { localPayload: current.payload, remotePayload: remote.payload, remoteVersion: remote.version, remoteId: remote.id, remoteDeviceId: remote.deviceId, remoteClientUpdatedAt: remote.clientUpdatedAt, remoteUpdatedAt: remote.serverUpdatedAt, remoteDeletedAt: remote.deletedAt } });
      return;
    }
    if (remote.version === current.version && sameValue(current.payload, remote.payload)) {
      await db.syncDocuments.put({ ...current, serverUpdatedAt: remote.serverUpdatedAt });
      return;
    }
    if (remote.version > current.version) {
      await writeRemoteProjection(remote);
      return;
    }
    if (remote.version < current.baseVersion) return;
    await db.syncDocuments.put({ ...current, conflict: { localPayload: current.payload, remotePayload: remote.payload, remoteVersion: remote.version, remoteId: remote.id, remoteDeviceId: remote.deviceId, remoteClientUpdatedAt: remote.clientUpdatedAt, remoteUpdatedAt: remote.serverUpdatedAt, remoteDeletedAt: remote.deletedAt } });
  });
}

async function pushMutation(remote: SyncRemote, userId: string, mutation: SyncMutation) {
  if (mutation.kind === "event-insert") {
    if (!mutation.payload || typeof mutation.payload !== "object") throw new SyncRemoteError("事件队列内容无效", "validation");
    const event = mutation.payload as LearningEvent;
    if (!event.deviceId) throw new SyncRemoteError("事件缺少设备标识", "validation");
    await remote.insertEvent({ id: event.id, userId, eventType: event.type, entityId: event.entityId, payload: event.payload, occurredAt: event.occurredAt, deviceId: event.deviceId });
    await db.syncMutations.delete(mutation.mutationId);
    return;
  }
  const state = stateFromMutation(mutation);
  if (mutation.kind === "document-insert") {
    const result = await remote.insertDocument({ id: state.remoteId, userId, documentType: state.documentType, entityId: state.entityId, payload: state.payload, version: 1, deviceId: state.deviceId, clientUpdatedAt: state.clientUpdatedAt, deletedAt: state.deletedAt });
    if (result.kind === "existing" && !sameRemoteDocument(state, result.document, userId)) throw new SyncConflictError("远端已有不同版本的同一文档", result.document);
    await finishDocumentMutation(mutation, result.document);
    return;
  }
  if (state.baseVersion === null) throw new SyncRemoteError("文档更新缺少 baseVersion", "validation");
  const result = await remote.updateDocument({ id: state.remoteId, userId, documentType: state.documentType, payload: state.payload, baseVersion: state.baseVersion, nextVersion: state.baseVersion + 1, deviceId: state.deviceId, clientUpdatedAt: state.clientUpdatedAt, deletedAt: state.deletedAt });
  if (result.kind === "conflict") throw new SyncConflictError("远端文档版本已变化", result.document);
  await finishDocumentMutation(mutation, result.document);
}

export class SyncEngine {
  private readonly remoteFactory: () => SyncRemote;
  private readonly configured: () => boolean;
  private readonly getUserId: () => Promise<string | null>;
  private readonly online: () => boolean;
  private running: Promise<SyncResult> | undefined;
  private snapshot: SyncSnapshot = initialSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor(options: SyncEngineOptions = {}) {
    this.remoteFactory = options.remoteFactory ?? (() => new SupabaseRemote());
    this.configured = options.configured ?? isSupabaseConfigured;
    this.getUserId = options.getUserId ?? (async () => {
      const client = getSupabaseClient();
      if (!client) return null;
      const result = await client.auth.getSession();
      if (result.error) throw new SyncRemoteError(result.error.message, result.error.status === 401 ? "auth" : "remote", result.error.status);
      return result.data.session?.user.id ?? null;
    });
    this.online = options.online ?? isOnline;
  }

  getSnapshot() {
    return this.snapshot;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  resetForLogout() {
    this.setSnapshot({ ...initialSnapshot });
  }

  private setSnapshot(value: SyncSnapshot) {
    this.snapshot = value;
    for (const listener of this.listeners) listener();
  }

  async run(reason: SyncRunReason): Promise<SyncResult> {
    if (this.running) return this.running;
    this.running = this.runInternal(reason).finally(() => { this.running = undefined; });
    return this.running;
  }

  private async runInternal(_reason: SyncRunReason): Promise<SyncResult> {
    if (!this.configured()) return this.updateResult({ state: "local-only", pushed: 0, pulled: 0, conflicts: 0 });
    if (!this.online()) {
      const pending = await db.syncMutations.where("status").equals("pending").count();
      return this.updateResult({ state: pending ? "offline-pending" : "local-only", pushed: 0, pulled: 0, conflicts: 0 });
    }
    let userId: string | null;
    try {
      userId = await this.getUserId();
    } catch (error) {
      return this.updateResult({ state: isSyncRemoteError(error) && error.kind === "auth" ? "auth-expired" : "remote-unavailable", pushed: 0, pulled: 0, conflicts: 0 });
    }
    if (!userId) return this.updateResult({ state: "local-only", pushed: 0, pulled: 0, conflicts: 0 });
    this.setSnapshot({ ...this.snapshot, state: "syncing" });
    const remote = this.remoteFactory();
    let pushed = 0;
    let pulled = 0;
    let conflicts = 0;
    try {
      await captureExistingLocalDocuments();
      const queued = await pendingMutations();
      for (const mutation of queued.filter((item) => item.status === "pending" && new Date(item.nextAttemptAt).getTime() <= Date.now())) {
        try {
          await pushMutation(remote, userId, mutation);
          pushed += 1;
        } catch (error) {
          if (error instanceof SyncConflictError || (isSyncRemoteError(error) && error.kind === "validation")) {
            await markBlocked(mutation, error.message, error instanceof SyncConflictError ? error.document : undefined);
            conflicts += 1;
            continue;
          }
          if (isSyncRemoteError(error) && error.kind === "auth") {
            return this.updateResult({ state: "auth-expired", pushed, pulled, conflicts });
          }
          await scheduleRetry(mutation, error instanceof Error ? error.message : "远端不可用");
          return this.updateResult({ state: "remote-unavailable", pushed, pulled, conflicts });
        }
      }
      for (const cursorKind of ["events", "documents"] as const) {
        let cursor = await readCursor(cursorKind);
        while (true) {
          const page = cursorKind === "events" ? await remote.listEvents(userId, cursor, PAGE_SIZE) : await remote.listDocuments(userId, cursor, PAGE_SIZE);
          for (const row of page.rows) {
            if (cursorKind === "events") await applyRemoteEvent(row as RemoteEvent);
            else await applyRemoteDocument(row as RemoteDocument);
            pulled += 1;
          }
          if (!page.rows.length) break;
          const last = page.rows[page.rows.length - 1];
          cursor = { id: cursorKind, occurredAt: cursorKind === "events" ? (last as RemoteEvent).createdAt : (last as RemoteDocument).serverUpdatedAt, recordId: last.id };
          await db.syncCursors.put(cursor);
          if (!page.hasMore) break;
        }
        if (cursorKind === "events") await rebuildEventProjections();
      }
    } catch (error) {
      if (isSyncRemoteError(error) && error.kind === "auth") return this.updateResult({ state: "auth-expired", pushed, pulled, conflicts });
      return this.updateResult({ state: "remote-unavailable", pushed, pulled, conflicts });
    }
    const blocked = await db.syncMutations.where("status").equals("blocked").count();
    const pending = await db.syncMutations.where("status").equals("pending").count();
    return this.updateResult({ state: conflicts || blocked ? "conflict" : pending ? "offline-pending" : "synced", pushed, pulled, conflicts });
  }

  private updateResult(result: SyncResult): SyncResult {
    this.setSnapshot({ ...result, lastRunAt: new Date().toISOString() });
    return result;
  }
}

export const syncEngine = new SyncEngine();
