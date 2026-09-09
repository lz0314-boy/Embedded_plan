import { getSupabaseClient } from "@/lib/supabase/client";
import { z } from "zod";
import { validateDocumentPayload } from "./validation";
import { sameValue } from "./validation";
import type {
  RemoteDocument,
  RemoteDocumentInput,
  RemoteDocumentUpdate,
  RemoteEvent,
  RemoteEventInput,
  RemoteInsertDocumentResult,
  RemoteInsertEventResult,
  RemotePage,
  RemoteUpdateDocumentResult,
  SyncRemote,
} from "./types";
import { SyncRemoteError } from "./types";

const eventColumns = "id,user_id,event_type,entity_id,payload,occurred_at,device_id,created_at";
const documentColumns = "id,user_id,document_type,entity_id,payload,version,device_id,client_updated_at,server_updated_at,deleted_at";

const eventRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  event_type: z.string().min(1),
  entity_id: z.string(),
  payload: z.record(z.string(), z.unknown()),
  occurred_at: z.string(),
  device_id: z.string().uuid(),
  created_at: z.string(),
});

const documentRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  document_type: z.enum(["settings", "note", "code_draft", "interview_session", "project_case"]),
  entity_id: z.string(),
  payload: z.unknown(),
  version: z.number().int().positive(),
  device_id: z.string().uuid(),
  client_updated_at: z.string(),
  server_updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type SupabaseErrorLike = { code?: string; message?: string; status?: number; details?: string };

function errorMessage(error: SupabaseErrorLike) {
  return error.message || error.details || "Supabase 请求失败";
}

function throwRemoteError(error: SupabaseErrorLike): never {
  const status = error.status;
  const kind = status === 401 || error.code === "PGRST301" ? "auth" : error.code === "23514" || error.code === "P0001" ? "validation" : "remote";
  throw new SyncRemoteError(errorMessage(error), kind, status);
}

function clientOrThrow() {
  const client = getSupabaseClient();
  if (!client) throw new SyncRemoteError("Supabase 未配置", "remote");
  return client;
}

function parseEvent(row: unknown): RemoteEvent {
  const result = eventRowSchema.safeParse(row);
  if (!result.success) throw new SyncRemoteError("远端事件响应格式无效", "validation");
  const value = result.data;
  return { id: value.id, userId: value.user_id, eventType: value.event_type, entityId: value.entity_id, payload: value.payload, occurredAt: value.occurred_at, deviceId: value.device_id, createdAt: value.created_at };
}

function parseDocument(row: unknown): RemoteDocument {
  const result = documentRowSchema.safeParse(row);
  if (!result.success) throw new SyncRemoteError("远端文档响应格式无效", "validation");
  const value = result.data;
  validateDocumentPayload(value.document_type, value.payload);
  if (value.document_type === "settings" && (value.payload as { id?: unknown }).id !== value.entity_id) throw new SyncRemoteError("远端设置文档标识不一致", "validation");
  if (value.document_type === "note" && (value.payload as { id?: unknown }).id !== value.entity_id) throw new SyncRemoteError("远端笔记文档标识不一致", "validation");
  if ((value.document_type === "code_draft" || value.document_type === "interview_session" || value.document_type === "project_case") && (value.payload as { id?: unknown }).id !== value.entity_id) throw new SyncRemoteError("远端文档标识不一致", "validation");
  return { id: value.id, userId: value.user_id, documentType: value.document_type, entityId: value.entity_id, payload: value.payload, version: value.version, deviceId: value.device_id, clientUpdatedAt: value.client_updated_at, serverUpdatedAt: value.server_updated_at, deletedAt: value.deleted_at };
}

function sameEvent(input: RemoteEventInput, remote: RemoteEvent) {
  return input.id === remote.id && input.userId === remote.userId && input.eventType === remote.eventType && input.entityId === remote.entityId && input.occurredAt === remote.occurredAt && input.deviceId === remote.deviceId && sameValue(input.payload, remote.payload);
}

export class SupabaseRemote implements SyncRemote {
  async insertEvent(input: RemoteEventInput): Promise<RemoteInsertEventResult> {
    const client = clientOrThrow();
    const { data, error } = await client.from("user_events").insert({ id: input.id, user_id: input.userId, event_type: input.eventType, entity_id: input.entityId, payload: input.payload, occurred_at: input.occurredAt, device_id: input.deviceId }).select(eventColumns).single();
    if (!error) return { kind: "inserted", event: parseEvent(data) };
    if (error.code !== "23505") throwRemoteError(error);
    const duplicate = await client.from("user_events").select(eventColumns).eq("id", input.id).eq("user_id", input.userId).maybeSingle();
    if (duplicate.error) throwRemoteError(duplicate.error);
    if (!duplicate.data) throw new SyncRemoteError("事件冲突记录不可读取", "validation");
    const event = parseEvent(duplicate.data);
    if (!sameEvent(input, event)) throw new SyncRemoteError("同一事件 UUID 对应了不同内容", "validation");
    return { kind: "duplicate", event };
  }

  async insertDocument(input: RemoteDocumentInput): Promise<RemoteInsertDocumentResult> {
    const client = clientOrThrow();
    validateDocumentPayload(input.documentType, input.payload);
    const { data, error } = await client.from("user_documents").insert({ id: input.id, user_id: input.userId, document_type: input.documentType, entity_id: input.entityId, payload: input.payload, version: input.version, device_id: input.deviceId, client_updated_at: input.clientUpdatedAt, deleted_at: input.deletedAt }).select(documentColumns).single();
    if (!error) return { kind: "inserted", document: parseDocument(data) };
    if (error.code !== "23505") throwRemoteError(error);
    const existing = await client.from("user_documents").select(documentColumns).eq("user_id", input.userId).eq("document_type", input.documentType).eq("entity_id", input.entityId).maybeSingle();
    if (existing.error) throwRemoteError(existing.error);
    if (!existing.data) throw new SyncRemoteError("文档冲突记录不可读取", "validation");
    return { kind: "existing", document: parseDocument(existing.data) };
  }

  async updateDocument(input: RemoteDocumentUpdate): Promise<RemoteUpdateDocumentResult> {
    const client = clientOrThrow();
    validateDocumentPayload(input.documentType, input.payload);
    const { data, error } = await client.from("user_documents").update({ payload: input.payload, version: input.nextVersion, device_id: input.deviceId, client_updated_at: input.clientUpdatedAt, deleted_at: input.deletedAt }).eq("id", input.id).eq("user_id", input.userId).eq("version", input.baseVersion).select(documentColumns);
    if (error) {
      if (error.code === "P0001" || error.code === "23514") throwRemoteError(error);
      throwRemoteError(error);
    }
    if (data?.length) return { kind: "updated", document: parseDocument(data[0]) };
    const current = await client.from("user_documents").select(documentColumns).eq("id", input.id).eq("user_id", input.userId).maybeSingle();
    if (current.error) throwRemoteError(current.error);
    return { kind: "conflict", document: current.data ? parseDocument(current.data) : undefined };
  }

  async listEvents(userId: string, cursor: { occurredAt: string | null; recordId: string | null }, limit: number): Promise<RemotePage<RemoteEvent>> {
    const client = clientOrThrow();
    let query = client.from("user_events").select(eventColumns).eq("user_id", userId);
    if (cursor.occurredAt && cursor.recordId) query = query.or(`created_at.gt.${cursor.occurredAt},and(created_at.eq.${cursor.occurredAt},id.gt.${cursor.recordId})`);
    const { data, error } = await query.order("created_at", { ascending: true }).order("id", { ascending: true }).limit(limit);
    if (error) throwRemoteError(error);
    const rows = (data ?? []).map(parseEvent);
    return { rows, hasMore: rows.length === limit };
  }

  async listDocuments(userId: string, cursor: { occurredAt: string | null; recordId: string | null }, limit: number): Promise<RemotePage<RemoteDocument>> {
    const client = clientOrThrow();
    let query = client.from("user_documents").select(documentColumns).eq("user_id", userId);
    if (cursor.occurredAt && cursor.recordId) query = query.or(`server_updated_at.gt.${cursor.occurredAt},and(server_updated_at.eq.${cursor.occurredAt},id.gt.${cursor.recordId})`);
    const { data, error } = await query.order("server_updated_at", { ascending: true }).order("id", { ascending: true }).limit(limit);
    if (error) throwRemoteError(error);
    const rows = (data ?? []).map(parseDocument);
    return { rows, hasMore: rows.length === limit };
  }
}
