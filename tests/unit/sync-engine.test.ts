import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/database";
import type { Note } from "@/lib/domain/types";
import { emptyProjectCase } from "@/lib/projects/follow-ups";
import { recordLearningEvent, resolveConflict, saveNote, saveProjectCase } from "@/lib/sync/repository";
import { SyncEngine } from "@/lib/sync/engine";
import type { RemoteDocument, RemoteDocumentInput, RemoteDocumentUpdate, RemoteEvent, RemoteEventInput, RemoteInsertDocumentResult, RemoteInsertEventResult, RemotePage, RemoteUpdateDocumentResult, SyncRemote } from "@/lib/sync/types";

const userId = "11111111-1111-4111-8111-111111111111";

class FakeRemote implements SyncRemote {
  readonly events = new Map<string, RemoteEvent>();
  readonly documents = new Map<string, RemoteDocument>();
  private clock = 0;

  private timestamp() {
    this.clock += 1;
    return new Date(Date.UTC(2026, 8, 9, 0, 0, this.clock)).toISOString();
  }

  async insertEvent(input: RemoteEventInput): Promise<RemoteInsertEventResult> {
    const existing = this.events.get(input.id);
    if (existing) return { kind: "duplicate", event: existing };
    const event = { ...input, createdAt: this.timestamp() };
    this.events.set(event.id, event);
    return { kind: "inserted", event };
  }

  async insertDocument(input: RemoteDocumentInput): Promise<RemoteInsertDocumentResult> {
    const existing = [...this.documents.values()].find((document) => document.userId === input.userId && document.documentType === input.documentType && document.entityId === input.entityId);
    if (existing) return { kind: "existing", document: existing };
    const document = { ...input, serverUpdatedAt: this.timestamp() };
    this.documents.set(document.id, document);
    return { kind: "inserted", document };
  }

  async updateDocument(input: RemoteDocumentUpdate): Promise<RemoteUpdateDocumentResult> {
    const current = this.documents.get(input.id);
    if (!current || current.version !== input.baseVersion) return { kind: "conflict", document: current };
    const document = { ...current, payload: input.payload, version: input.nextVersion, deviceId: input.deviceId, clientUpdatedAt: input.clientUpdatedAt, serverUpdatedAt: this.timestamp(), deletedAt: input.deletedAt };
    this.documents.set(document.id, document);
    return { kind: "updated", document };
  }

  async listEvents(remoteUserId: string, cursor: { occurredAt: string | null; recordId: string | null }, limit: number): Promise<RemotePage<RemoteEvent>> {
    const rows = [...this.events.values()].filter((event) => event.userId === remoteUserId).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)).filter((event) => !cursor.occurredAt || event.createdAt > cursor.occurredAt || event.createdAt === cursor.occurredAt && event.id > cursor.recordId!);
    return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
  }

  async listDocuments(remoteUserId: string, cursor: { occurredAt: string | null; recordId: string | null }, limit: number): Promise<RemotePage<RemoteDocument>> {
    const rows = [...this.documents.values()].filter((document) => document.userId === remoteUserId).sort((left, right) => left.serverUpdatedAt.localeCompare(right.serverUpdatedAt) || left.id.localeCompare(right.id)).filter((document) => !cursor.occurredAt || document.serverUpdatedAt > cursor.occurredAt || document.serverUpdatedAt === cursor.occurredAt && document.id > cursor.recordId!);
    return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
  }
}

function makeNote(id: string, body: string): Note {
  return { id, contentId: "c-memory-model", body, createdAt: "2026-09-09T00:00:00.000Z", updatedAt: "2026-09-09T00:00:00.000Z", deletedAt: null };
}

async function makeEngine(remote: FakeRemote, online = true) {
  return new SyncEngine({ remoteFactory: () => remote, configured: () => true, getUserId: async () => userId, online: () => online });
}

describe("local-first sync engine", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("writes locally before uploading and makes repeated event upload idempotent", async () => {
    const remote = new FakeRemote();
    const note = makeNote("11111111-1111-4111-8111-111111111101", "first");
    await saveNote(note);
    expect(await db.notes.get(note.id)).toMatchObject({ body: "first" });
    expect(await db.syncMutations.count()).toBe(1);
    const engine = await makeEngine(remote);
    expect((await engine.run("manual")).state).toBe("synced");
    expect(remote.documents.size).toBe(1);
    const event = { id: "11111111-1111-4111-8111-111111111201", type: "activity_recorded" as const, entityId: "session-1", payload: { source: "test" }, occurredAt: "2026-09-09T00:01:00.000Z" };
    await recordLearningEvent(event);
    await engine.run("manual");
    await engine.run("manual");
    expect(remote.events.size).toBe(1);
    expect(await db.syncMutations.count()).toBe(0);
  });

  it("keeps local data and queue when offline", async () => {
    const remote = new FakeRemote();
    const note = makeNote("11111111-1111-4111-8111-111111111102", "offline");
    await saveNote(note);
    const engine = await makeEngine(remote, false);
    expect((await engine.run("manual")).state).toBe("offline-pending");
    expect(await db.notes.get(note.id)).toMatchObject({ body: "offline" });
    expect(remote.documents.size).toBe(0);
  });

  it("keeps project cases local until explicit opt-in and tombstones opt-out", async () => {
    const remote = new FakeRemote();
    const project = { ...emptyProjectCase("2026-09-09T00:00:00.000Z", "11111111-1111-4111-8111-111111111104"), title: "真实项目" };
    await saveProjectCase(project);
    expect(await db.projectCases.get(project.id)).toMatchObject({ title: "真实项目", syncEnabled: false });
    expect(await db.syncMutations.count()).toBe(0);

    await saveProjectCase({ ...project, syncEnabled: true, updatedAt: "2026-09-09T00:01:00.000Z" });
    expect(await db.syncMutations.get(`document:project_case:${project.id}`)).toBeDefined();
    const engine = await makeEngine(remote);
    await engine.run("manual");
    expect([...remote.documents.values()][0]).toMatchObject({ documentType: "project_case", deletedAt: null });

    await saveProjectCase({ ...project, syncEnabled: false, updatedAt: "2026-09-09T00:02:00.000Z" });
    await engine.run("manual");
    expect([...remote.documents.values()][0].deletedAt).not.toBeNull();
    expect(await db.projectCases.get(project.id)).toMatchObject({ syncEnabled: false, deletedAt: null });
  });

  it("applies a valid remote project case to the local projection", async () => {
    const remote = new FakeRemote();
    const project = { ...emptyProjectCase("2026-09-09T00:00:00.000Z", "11111111-1111-4111-8111-111111111105"), title: "跨设备项目", syncEnabled: true };
    const remoteId = "11111111-1111-4111-8111-111111111205";
    remote.documents.set(remoteId, { id: remoteId, userId, documentType: "project_case", entityId: project.id, payload: project, version: 1, deviceId: userId, clientUpdatedAt: project.updatedAt, serverUpdatedAt: "2026-09-09T00:01:00.000Z", deletedAt: null });
    const engine = await makeEngine(remote);
    expect((await engine.run("manual")).pulled).toBe(1);
    expect(await db.projectCases.get(project.id)).toMatchObject({ title: "跨设备项目", syncEnabled: true });
  });

  it("blocks a stale document update and resolves it without silent overwrite", async () => {
    const remote = new FakeRemote();
    const note = makeNote("11111111-1111-4111-8111-111111111103", "base");
    await saveNote(note);
    const engine = await makeEngine(remote);
    await engine.run("manual");
    const remoteDocument = [...remote.documents.values()][0];
    remote.documents.set(remoteDocument.id, { ...remoteDocument, version: 2, payload: { ...remoteDocument.payload as Note, body: "other-device" }, serverUpdatedAt: "2026-09-09T00:02:00.000Z" });
    await saveNote({ ...note, body: "local-device", updatedAt: "2026-09-09T00:03:00.000Z" });
    const result = await engine.run("manual");
    expect(result.state).toBe("conflict");
    expect(await db.notes.get(note.id)).toMatchObject({ body: "local-device" });
    expect((await db.syncDocuments.get(`note:${note.id}`))?.conflict?.remoteVersion).toBe(2);
    await resolveConflict(`note:${note.id}`, "keep-remote");
    expect(await db.notes.get(note.id)).toMatchObject({ body: "other-device" });
    expect(await db.syncMutations.get(`document:note:${note.id}`)).toBeUndefined();
  });

  it("advances the compound cursor only after processing each page", async () => {
    const remote = new FakeRemote();
    for (let index = 0; index < 201; index += 1) {
      const id = `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`;
      remote.events.set(id, { id, userId, eventType: "activity_recorded", entityId: `event-${index}`, payload: {}, occurredAt: new Date(Date.UTC(2026, 8, 9, 0, 0, index)).toISOString(), deviceId: userId, createdAt: new Date(Date.UTC(2026, 8, 9, 0, 0, index)).toISOString() });
    }
    const engine = await makeEngine(remote);
    const result = await engine.run("manual");
    expect(result.pulled).toBe(201);
    expect(await db.learningEvents.count()).toBe(201);
    expect((await db.syncCursors.get("events"))?.recordId).toBe("11111111-1111-4111-8111-000000000201");
  });
});
