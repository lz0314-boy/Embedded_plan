import { describe, expect, it } from "vitest";
import { buildDailyTasks, weaknessScore } from "@/lib/domain/study";

describe("daily learning plan", () => {
  it("puts due reviews before new core lessons", () => {
    const tasks = buildDailyTasks({ id: "default", dailyMinutes: 60, targetDate: null, focus: "balanced", selfAssessment: "new", notificationsEnabled: false, createdAt: "2026-09-08T00:00:00.000Z", updatedAt: "2026-09-08T00:00:00.000Z" }, [], [{ cardId: "card-1", contentId: "rtt-scheduler", due: "2026-09-07T00:00:00.000Z", state: 2, stability: 1, difficulty: 5, reps: 1, lapses: 0, algorithmVersion: "test" }], new Date("2026-09-08T00:00:00.000Z"));
    expect(tasks[0].kind).toBe("review");
    expect(tasks.some((task) => task.kind === "new")).toBe(true);
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
