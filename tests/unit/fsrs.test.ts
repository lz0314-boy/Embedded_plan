import { describe, expect, it } from "vitest";
import { rateReviewCard, Rating } from "@/lib/fsrs/adapter";

describe("FSRS adapter", () => {
  it("creates a persisted card using the selected rating", () => {
    const card = rateReviewCard(undefined, Rating.Good, new Date("2026-09-08T00:00:00.000Z"));
    expect(card.algorithmVersion).toBe("ts-fsrs@5.4.2");
    expect(card.due).toContain("2026-");
    expect(card.reps).toBeGreaterThan(0);
  });
});
