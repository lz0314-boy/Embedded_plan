import { describe, expect, it } from "vitest";
import { contentCatalog } from "@/lib/content/catalog";
import { selectInterviewQuestionIds, sessionScore } from "@/lib/interview/session";
import { buildProjectFollowUps, emptyProjectCase } from "@/lib/projects/follow-ups";

describe("interview selection", () => {
  it("keeps selection deterministic and respects direction", () => {
    const selection = { direction: "rt-thread" as const, platform: "", module: "", difficulty: "any" as const, questionCount: 2, totalMinutes: 15, priority: "random" as const, seed: "fixed-seed" };
    const first = selectInterviewQuestionIds(contentCatalog, selection, new Set(), new Set());
    const second = selectInterviewQuestionIds(contentCatalog, selection, new Set(), new Set());
    expect(first).toEqual(second);
    expect(first.every((id) => contentCatalog.find((item) => item.id === id)?.pillar === "rt-thread")).toBe(true);
    expect(first.every((id) => contentCatalog.find((item) => item.id === id)?.contentRole !== "placeholder")).toBe(true);
  });

  it("prioritizes weak and new questions without fabricating content", () => {
    const selection = { direction: "all" as const, platform: "", module: "", difficulty: "any" as const, questionCount: 3, totalMinutes: 15, priority: "weak" as const, seed: "fixed-seed" };
    const weak = selectInterviewQuestionIds(contentCatalog, selection, new Set(["rtt-question-2"]), new Set());
    expect(weak[0]).toBe("rtt-question-2");
    expect(sessionScore([{ selfScores: { mechanism: 4, boundary: 3 } }, { selfScores: { verification: 5 } }])).toBe(4);
  });

  it("builds deterministic project prompts from fields and linked public content", () => {
    const project = { ...emptyProjectCase("2026-09-09T00:00:00.000Z", "11111111-1111-4111-8111-111111111111"), title: "真实项目", context: "有背景", knowledgeLinks: ["c-memory-model", "missing"] };
    const first = buildProjectFollowUps(project, contentCatalog);
    const second = buildProjectFollowUps(project, contentCatalog);
    expect(first).toEqual(second);
    expect(first.some((item) => item.id === "knowledge:c-memory-model")).toBe(true);
    expect(first.find((item) => item.id === "field:role")?.reason).toContain("尚未填写");
  });
});
