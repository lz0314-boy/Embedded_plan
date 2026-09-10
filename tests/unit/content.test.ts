import { describe, expect, it } from "vitest";
import { contentCatalog } from "@/lib/content/catalog";

describe("content catalog", () => {
  it("contains five pillars and respects verification batches", () => {
    expect(new Set(contentCatalog.filter((item) => item.type === "lesson").map((item) => item.pillar))).toEqual(new Set(["c", "cortex-m", "rt-thread", "linux-bsp", "linux-user"]));
    expect(contentCatalog.some((item) => item.status === "verified")).toBe(true);
    expect(contentCatalog.filter((item) => item.id.startsWith("catalog-")).every((item) => item.status === "draft" && item.verifiedAt === null)).toBe(true);
    expect(contentCatalog.filter((item) => item.status === "verified").every((item) => item.verifiedAt)).toBe(true);
  });
});
