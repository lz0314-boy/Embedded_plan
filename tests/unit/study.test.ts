import { describe, expect, it } from "vitest";
import { buildDailyTasks, weaknessScore } from "@/lib/domain/study";

describe("daily learning plan", () => {
  it("puts due reviews before new core lessons", () => {
    const tasks = buildDailyTasks({ id: "default", dailyMinutes: 60, targetDate: null, focus: "balanced", selfAssessment: "new", notificationsEnabled: false, createdAt: "2026-09-08T00:00:00.000Z", updatedAt: "2026-09-08T00:00:00.000Z" }, [], [{ cardId: "card-1", contentId: "rtt-scheduler", due: "2026-09-07T00:00:00.000Z", state: 2, stability: 1, difficulty: 5, reps: 1, lapses: 0, algorithmVersion: "test" }], new Date("2026-09-08T00:00:00.000Z"));
    expect(tasks[0].kind).toBe("review");
    expect(tasks.some((task) => task.kind === "new")).toBe(true);
  });

  it("does not schedule a lesson until its prerequisites are completed", () => {
    const settings = { id: "default", dailyMinutes: 90, targetDate: null, focus: "balanced", selfAssessment: "new", notificationsEnabled: false, createdAt: "2026-09-08T00:00:00.000Z", updatedAt: "2026-09-08T00:00:00.000Z" } as const;
    const withoutPrerequisite = buildDailyTasks(settings, [], [], new Date("2026-09-08T00:00:00.000Z"));
    expect(withoutPrerequisite.some((task) => task.contentId === "c99-pointer-lifetime")).toBe(false);
    const withPrerequisite = buildDailyTasks(settings, [{ contentId: "c-memory-model", status: "completed", position: 1, updatedAt: "2026-09-08T00:00:00.000Z" }], [], new Date("2026-09-08T00:00:00.000Z"));
    expect(withPrerequisite.some((task) => task.contentId === "c99-pointer-lifetime")).toBe(true);
  });

  it("keeps one due task per content item", () => {
    const settings = { id: "default", dailyMinutes: 30, targetDate: null, focus: "balanced", selfAssessment: "new", notificationsEnabled: false, createdAt: "2026-09-08T00:00:00.000Z", updatedAt: "2026-09-08T00:00:00.000Z" } as const;
    const cards = [
      { cardId: "card-a", contentId: "c-memory-model", due: "2026-09-07T00:00:00.000Z", state: 2, stability: 1, difficulty: 5, reps: 1, lapses: 0, algorithmVersion: "test" },
      { cardId: "card-b", contentId: "c-memory-model", due: "2026-09-07T00:00:00.000Z", state: 2, stability: 1, difficulty: 5, reps: 1, lapses: 0, algorithmVersion: "test" },
    ];
    const tasks = buildDailyTasks(settings, [], cards, new Date("2026-09-08T00:00:00.000Z"));
    expect(tasks.filter((task) => task.kind === "review" && task.contentId === "c-memory-model")).toHaveLength(1);
  });

  it("never puts placeholder catalog entries in the default plan", () => {
    const settings = { id: "default", dailyMinutes: 90, targetDate: null, focus: "balanced", selfAssessment: "new", notificationsEnabled: false, createdAt: "2026-09-08T00:00:00.000Z", updatedAt: "2026-09-08T00:00:00.000Z" } as const;
    const tasks = buildDailyTasks(settings, [], [], new Date("2026-09-08T00:00:00.000Z"));
    expect(tasks.some((task) => task.contentId.startsWith("catalog-"))).toBe(false);
  });
});

describe("weakness score", () => {
  it("is deterministic and bounded for normalized inputs", () => {
    const score = weaknessScore(0.8, 0.2, 0.1, 0.5);
    expect(score).toBeCloseTo(0.215);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
