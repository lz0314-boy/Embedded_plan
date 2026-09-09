import { describe, expect, it } from "vitest";
import { retryDelay } from "@/lib/sync/engine";
import { documentKey, documentMutationId, sameValue, validateDocumentPayload } from "@/lib/sync/validation";
import { emptyProjectCase } from "@/lib/projects/follow-ups";

describe("sync protocol helpers", () => {
  it("uses the documented bounded retry schedule", () => {
    expect(retryDelay(0)).toBe(5_000);
    expect(retryDelay(1)).toBe(30_000);
    expect(retryDelay(4)).toBe(3_600_000);
    expect(retryDelay(99)).toBe(3_600_000);
    expect(retryDelay(99, 10)).toBe(6 * 60 * 60 * 1000);
  });

  it("keeps document queue keys stable and compares JSON values by content", () => {
    expect(documentKey("note", "n-1")).toBe("note:n-1");
    expect(documentMutationId("note", "n-1")).toBe("document:note:n-1");
    expect(sameValue({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true);
  });

  it("validates settings and rejects malformed or oversized documents", () => {
    const settings = { id: "default", dailyMinutes: 60, targetDate: null, focus: "balanced", selfAssessment: "new", notificationsEnabled: false, createdAt: "2026-09-09T00:00:00.000Z", updatedAt: "2026-09-09T00:00:00.000Z" };
    expect(validateDocumentPayload("settings", settings)).toEqual(settings);
    expect(() => validateDocumentPayload("settings", { ...settings, focus: "free-form" })).toThrow("文档格式无效");
    expect(() => validateDocumentPayload("note", "x".repeat(256 * 1024 + 1))).toThrow("超过 256 KiB");
  });

  it("validates project cases as private sync documents", () => {
    const project = emptyProjectCase("2026-09-09T00:00:00.000Z", "11111111-1111-4111-8111-111111111111");
    expect(validateDocumentPayload("project_case", project)).toEqual(project);
    expect(() => validateDocumentPayload("project_case", { ...project, syncEnabled: "yes" })).toThrow("文档格式无效");
  });
});
