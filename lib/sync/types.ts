import type { SyncDocumentType, SyncMutation, SyncState } from "@/lib/domain/types";

export type SyncRunReason = "login" | "online" | "foreground" | "manual" | "retry";

export type RemoteEvent = {
  id: string;
  userId: string;
  eventType: string;
  entityId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  deviceId: string;
  createdAt: string;
};

export type RemoteDocument = {
  id: string;
  userId: string;
  documentType: SyncDocumentType;
  entityId: string;
  payload: unknown;
  version: number;
  deviceId: string;
  clientUpdatedAt: string;
  serverUpdatedAt: string;
  deletedAt: string | null;
};

export type RemoteEventInput = Omit<RemoteEvent, "createdAt" | "userId"> & { userId: string };
export type RemoteDocumentInput = Omit<RemoteDocument, "serverUpdatedAt" | "userId"> & { userId: string };

export type RemoteDocumentUpdate = {
  id: string;
  userId: string;
  documentType: SyncDocumentType;
  payload: unknown;
  baseVersion: number;
  nextVersion: number;
  deviceId: string;
  clientUpdatedAt: string;
  deletedAt: string | null;
};

export type RemoteInsertEventResult = { kind: "inserted" | "duplicate"; event: RemoteEvent };
export type RemoteInsertDocumentResult = { kind: "inserted"; document: RemoteDocument } | { kind: "existing"; document: RemoteDocument };
export type RemoteUpdateDocumentResult = { kind: "updated"; document: RemoteDocument } | { kind: "conflict"; document?: RemoteDocument };

export type RemotePage<T> = { rows: T[]; hasMore: boolean };

export interface SyncRemote {
  insertEvent(input: RemoteEventInput): Promise<RemoteInsertEventResult>;
  insertDocument(input: RemoteDocumentInput): Promise<RemoteInsertDocumentResult>;
  updateDocument(input: RemoteDocumentUpdate): Promise<RemoteUpdateDocumentResult>;
  listEvents(userId: string, cursor: { occurredAt: string | null; recordId: string | null }, limit: number): Promise<RemotePage<RemoteEvent>>;
  listDocuments(userId: string, cursor: { occurredAt: string | null; recordId: string | null }, limit: number): Promise<RemotePage<RemoteDocument>>;
}

export type SyncResult = {
  state: SyncState;
  pushed: number;
  pulled: number;
  conflicts: number;
};

export type QueueMutation = SyncMutation;

export class SyncRemoteError extends Error {
  readonly kind: "auth" | "validation" | "remote";
  readonly status: number | undefined;

  constructor(message: string, kind: "auth" | "validation" | "remote", status?: number) {
    super(message);
    this.name = "SyncRemoteError";
    this.kind = kind;
    this.status = status;
  }
}

export class SyncConflictError extends Error {
  readonly document?: RemoteDocument;

  constructor(message: string, document?: RemoteDocument) {
    super(message);
    this.name = "SyncConflictError";
    this.document = document;
  }
}

export function isSyncRemoteError(error: unknown): error is SyncRemoteError {
  return error instanceof SyncRemoteError;
}
