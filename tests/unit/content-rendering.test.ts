import { describe, expect, it } from "vitest";
import { gradeObjectiveAnswer } from "@/lib/domain/quiz";

// The renderer is a build-time ESM script, so exercise it through a dynamic import.
const renderer = import("../../scripts/content-utils.mjs");

describe("controlled Markdown renderer", () => {
  it("renders GFM tables, fenced code and a Mermaid text fallback", async () => {
    const { markdownToHtml } = await renderer;
    const html = markdownToHtml("# Title\n\n| A | B |\n| --- | :---: |\n| 1 | 2 |\n\n```c\nint x = 1;\n```\n\n```mermaid\nflowchart LR\n A --> B\n```");
    expect(html).toContain('<h1 id="title">Title</h1>');
    expect(html).toContain("<table>");
    expect(html).toContain('class="language-c"');
    expect(html).toContain("diagram-fallback");
  });

  it("rejects raw HTML, MDX expressions and unsafe links", async () => {
    const { markdownToHtml } = await renderer;
    expect(() => markdownToHtml("<script>alert(1)</script>")).toThrow();
    expect(() => markdownToHtml("{dangerousExpression}")).toThrow();
    expect(() => markdownToHtml("[run](javascript:alert(1))")).toThrow();
  });

  it("includes a source line in Markdown diagnostics", async () => {
    const { markdownToHtml } = await renderer;
    expect(() => markdownToHtml("# safe\n\n<script>alert(1)</script>")).toThrow(/line 3/);
    expect(() => markdownToHtml("# safe\n\n```c\nint value = 1;")).toThrow(/line 3/);
  });
});

describe("quiz grading", () => {
  it("does not treat a non-empty short answer as objectively correct", () => {
    expect(gradeObjectiveAnswer({ questionType: "short-answer" }, "some answer")).toBeNull();
    expect(gradeObjectiveAnswer({ questionType: "single-choice", correctAnswer: "C" }, "A")).toBe(false);
    expect(gradeObjectiveAnswer({ questionType: "single-choice", correctAnswer: "C" }, " c ")).toBe(true);
  });
});
