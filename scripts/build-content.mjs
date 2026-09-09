import fs from "node:fs";
import path from "node:path";
import { listContentFiles, markdownToHtml, parseFrontmatter, readSources } from "./content-utils.mjs";

const content = listContentFiles().map((file) => {
  const { metadata, body } = parseFrontmatter(fs.readFileSync(file, "utf8"), file);
  return { ...metadata, body, html: markdownToHtml(body) };
});
const manifest = { generatedAt: new Date().toISOString(), contentVersion: "local-uncommitted", content, sources: readSources() };
fs.mkdirSync(path.join(process.cwd(), "generated"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), "generated", "content-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const browserContent = content.map(({ body: _body, html: _html, ...metadata }) => metadata);
fs.writeFileSync(path.join(process.cwd(), "generated", "content-index.json"), JSON.stringify({ generatedAt: manifest.generatedAt, contentVersion: manifest.contentVersion, content: browserContent }, null, 2) + "\n");
const learningContent = content.filter((item) => item.type === "lesson").map(({ id, title, slug, priority, estimatedMinutes }) => ({ id, title, slug, priority, estimatedMinutes }));
fs.writeFileSync(path.join(process.cwd(), "generated", "learning-index.json"), JSON.stringify({ generatedAt: manifest.generatedAt, contentVersion: manifest.contentVersion, content: learningContent }, null, 2) + "\n");
console.log(`内容清单已生成：${content.length} 条内容。`);
