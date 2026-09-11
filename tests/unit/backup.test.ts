import { describe, expect, it } from "vitest";
import { checksumData } from "@/lib/domain/backup";
import { migrateBackup } from "@/lib/db/migrations";

describe("backup migration", () => {
  it("accepts schema version one and rejects other formats", () => {
    const data = { settings: [], contentProgress: [], notes: [], bookmarks: [], reviewCards: [], quizAttempts: [], wrongQuestions: [] };
    expect(migrateBackup({ format: "embedded-learning-backup", schemaVersion: 1, exportedAt: "2026-09-08T00:00:00.000Z", contentVersion: "test", checksum: "sha256:test", data }).schemaVersion).toBe(1);
    expect(() => migrateBackup({ format: "other", schemaVersion: 1, data })).toThrow();
  });

  it("sorts nested object keys without changing arrays", async () => {
    const left = { settings: [], contentProgress: [], notes: [{ z: 1, nested: { b: 2, a: 1 } }], bookmarks: [], reviewCards: [], quizAttempts: [], wrongQuestions: [] };
    const right = { wrongQuestions: [], quizAttempts: [], reviewCards: [], bookmarks: [], notes: [{ nested: { a: 1, b: 2 }, z: 1 }], contentProgress: [], settings: [] };
    expect(await checksumData(left)).toBe(await checksumData(right));
  });

  it("rejects malformed records before import can write them", () => {
    const data = { settings: [{ id: "default" }], contentProgress: [], notes: [], bookmarks: [], reviewCards: [], quizAttempts: [], wrongQuestions: [] };
    expect(() => migrateBackup({ format: "embedded-learning-backup", schemaVersion: 1, exportedAt: "2026-09-08T00:00:00.000Z", contentVersion: "test", checksum: "sha256:test", data })).toThrow(/记录校验失败/);
  });
});
