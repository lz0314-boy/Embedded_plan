import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/database";
import { Rating } from "@/lib/fsrs/adapter";
import { completeContent, rateQuizMemory } from "@/lib/sync/repository";

describe("learning and FSRS boundaries", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("records reading completion without synthesizing an FSRS Good", async () => {
    await completeContent("c99-pointer-lifetime");
    expect(await db.contentProgress.get("c99-pointer-lifetime")).toMatchObject({ status: "completed" });
    expect(await db.reviewCards.count()).toBe(0);
  });

  it("removes the legacy recordings object store", () => {
    expect(db.tables.map((table) => table.name)).not.toContain("recordings");
  });

  it("creates or updates a review card only after explicit recall rating", async () => {
    const card = await rateQuizMemory("c99-pointer-lifetime", Rating.Hard);
    expect(card.contentId).toBe("c99-pointer-lifetime");
    expect(await db.reviewCards.count()).toBe(1);
  });
});
