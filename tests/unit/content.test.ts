import { describe, expect, it } from "vitest";
import { contentCatalog } from "@/lib/content/catalog";

describe("content catalog", () => {
  it("contains the five golden pillars and keeps samples pending", () => {
    expect(new Set(contentCatalog.filter((item) => item.type === "lesson").map((item) => item.pillar))).toEqual(new Set(["c", "cortex-m", "rt-thread", "linux-bsp", "linux-user"]));
    expect(contentCatalog.every((item) => item.status !== "verified")).toBe(true);
  });
});
