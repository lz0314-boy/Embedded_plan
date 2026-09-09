import fs from "node:fs";
import path from "node:path";

export const root = process.cwd();
export const contentRoot = path.join(root, "content");

export function parseFrontmatter(source, file) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: 缺少 YAML frontmatter`);
  const metadata = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`${file}: 非法 frontmatter 行 ${rawLine}`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) metadata[key] = value.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean);
    else if (value === "null") metadata[key] = null;
    else if (/^\d+$/.test(value)) metadata[key] = Number(value);
    else metadata[key] = value.replace(/^['"]|['"]$/g, "");
  }
  return { metadata, body: match[2].trim() };
}

export function listContentFiles() {
  const result = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.name.endsWith(".mdx")) result.push(absolute);
    }
  }
  walk(contentRoot);
  return result.sort();
}

export function readSources() {
  const source = fs.readFileSync(path.join(contentRoot, "sources.yml"), "utf8");
  const records = [];
  let current = null;
  for (const line of source.split(/\r?\n/)) {
    const item = line.match(/^  - id: (.+)$/);
    if (item) { current = { id: item[1].trim() }; records.push(current); continue; }
    const field = line.match(/^    (\w+): (.+)$/);
    if (field && current) current[field[1]] = field[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return records;
}

export function markdownToHtml(markdown) {
  return markdown
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .split(/\n\n+/).map((part) => part.startsWith("<h") ? part : `<p>${part.replace(/\n/g, "<br />")}</p>`).join("\n");
}
