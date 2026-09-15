import fs from "node:fs";
import path from "node:path";
import { listContentFiles, markdownToHtml, parseFrontmatter, readSources } from "./content-utils.mjs";

const content = listContentFiles().map((file) => {
  const { metadata, body } = parseFrontmatter(fs.readFileSync(file, "utf8"), file);
  let html;
  try { html = markdownToHtml(body); }
  catch (error) { throw new Error(`${file}: Markdown/MDX 渲染失败：${error instanceof Error ? error.message : String(error)}`); }
  return { ...metadata, body, html };
});
const manifest = { generatedAt: new Date().toISOString(), contentVersion: "local-uncommitted", content, sources: readSources() };
fs.mkdirSync(path.join(process.cwd(), "generated"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), "generated", "content-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
function cleanPreview(section) {
  const nextHeading = /^##\s/m.exec(section);
  return (nextHeading ? section.slice(0, nextHeading.index) : section)
    .replace(/```[\s\S]*?```/g, "代码示例见详情")
    .replace(/[`*_>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
}
function previews(body) {
  const marker = /^(?:##\s+(?:参考回答|参考答案)\s*$|(?:参考答案|答案)：?)[ \t]*/m.exec(body);
  if (!marker) return { promptPreview: cleanPreview(body), answerPreview: "" };
  return {
    promptPreview: cleanPreview(body.slice(0, marker.index)),
    answerPreview: cleanPreview(body.slice((marker.index ?? 0) + marker[0].length)),
  };
}
const browserContent = content.map((item) => {
  const metadata = {
    id: item.id,
    type: item.type,
    title: item.title,
    slug: item.slug,
    pillar: item.pillar,
    module: item.module,
    difficulty: item.difficulty,
    contentRole: item.contentRole,
    estimatedMinutes: item.estimatedMinutes,
    scope: item.scope,
    status: item.status,
  };
  if (item.type !== "interview-question" && item.type !== "quiz-question") return metadata;
  return {
    ...metadata,
    platforms: item.platforms,
    keywords: item.keywords,
    questionType: item.questionType,
    correctAnswer: item.correctAnswer,
    scoringPoints: item.scoringPoints,
    ...previews(item.body),
  };
});
fs.writeFileSync(path.join(process.cwd(), "generated", "content-index.json"), JSON.stringify({ generatedAt: manifest.generatedAt, contentVersion: manifest.contentVersion, content: browserContent }, null, 2) + "\n");
const learningContent = content
  .filter((item) => item.type === "lesson" && item.contentRole === "core" && item.status !== "deprecated")
  .map(({ id, title, slug, priority, contentRole, estimatedMinutes, prerequisites, pillar, module }) => ({ id, title, slug, priority, contentRole, estimatedMinutes, prerequisites, pillar, module }));
fs.writeFileSync(path.join(process.cwd(), "generated", "learning-index.json"), JSON.stringify({ generatedAt: manifest.generatedAt, contentVersion: manifest.contentVersion, content: learningContent }, null, 2) + "\n");
const questionCount = content.filter((item) => (item.type === "interview-question" || item.type === "quiz-question") && item.contentRole !== "placeholder" && item.status !== "deprecated").length;
fs.writeFileSync(path.join(process.cwd(), "generated", "content-stats.json"), JSON.stringify({ generatedAt: manifest.generatedAt, contentVersion: manifest.contentVersion, questionCount }) + "\n");
const detailDirectory = path.join(process.cwd(), "public", "content-items");
fs.mkdirSync(detailDirectory, { recursive: true });
for (const item of content) {
  fs.writeFileSync(path.join(detailDirectory, `${item.id}.json`), JSON.stringify({ id: item.id, body: item.body, html: item.html }) + "\n");
}
console.log(`内容清单已生成：${content.length} 条内容。`);
