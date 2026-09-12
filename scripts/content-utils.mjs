import fs from "node:fs";
import path from "node:path";
import { mermaidToSvg } from "./diagram-utils.mjs";

export const root = process.cwd();
export const contentRoot = path.join(root, "content");

export function parseFrontmatter(source, file) {
  const diagnosticMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!diagnosticMatch) throw new Error(`${file}: line 1: missing YAML frontmatter`);
  for (const [lineIndex, rawLine] of diagnosticMatch[1].split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (line && !line.startsWith("#") && line.indexOf(":") < 1) {
      throw new Error(`${file}: line ${lineIndex + 2}: invalid frontmatter line`);
    }
  }
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
    if (value.startsWith("[") && value.endsWith("]")) {
      metadata[key] = value.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean).map((item) => item.replace(/^['"]|['"]$/g, ""));
    } else if (value === "null") metadata[key] = null;
    else if (/^-?\d+(?:\.\d+)?$/.test(value)) metadata[key] = Number(value);
    else if (value === "true" || value === "false") metadata[key] = value === "true";
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

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function markdownDiagnostic(message, line) {
  return new Error(`line ${line}: ${message}`);
}

function slugify(value) {
  const slug = value.toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "section";
}

function isSafeUrl(url) {
  return /^(?:https?:\/\/|mailto:|\/|#|\.\/|\.\.\/)/i.test(url) && !/^(?:javascript|data|vbscript):/i.test(url);
}

function inlineMarkdown(value) {
  const tokens = [];
  const token = (html) => { const id = `\u0000${tokens.length}\u0000`; tokens.push(html); return id; };
  let text = escapeHtml(value);
  text = text.replace(/`([^`\n]+)`/g, (_, code) => token(`<code>${code}</code>`));
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g, (_, alt, url, title) => {
    if (!isSafeUrl(url)) throw new Error(`Markdown 图片链接不安全：${url}`);
    return token(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${title ? ` title="${escapeHtml(title)}"` : ""} loading="lazy" />`);
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g, (_, label, url, title) => {
    if (!isSafeUrl(url)) throw new Error(`Markdown 链接不安全：${url}`);
    const external = /^https?:\/\//i.test(url) ? ' target="_blank" rel="noreferrer"' : "";
    return token(`<a href="${escapeHtml(url)}"${external}${title ? ` title="${escapeHtml(title)}"` : ""}>${label}</a>`);
  });
  text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>").replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
}

function assertSafeMarkdown(markdown) {
  // Run a line-preserving diagnostic pass before the compatibility checks
  // below. Fenced code is masked but its newlines are retained.
  const proseForDiagnostics = markdown.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, " "));
  const unsafeDiagnostics = [
    /(^|\n)\s*(?:import|export)\s+[^\n]*/m,
    /<\/?(?:script|style|iframe|object|embed|form|input|button)\b/i,
    /\bon[a-z]+\s*=/i,
    /(^|\n)\s*<\/?[a-z][^>]*>/i,
    /(?:javascript|vbscript|data):/i,
  ];
  for (const pattern of unsafeDiagnostics) {
    const match = pattern.exec(proseForDiagnostics);
    if (match) throw markdownDiagnostic("unsafe Markdown/MDX syntax", lineNumberAt(markdown, match.index));
  }
  const expressionDiagnostic = /(^|\n)\s*\{[^\n]+\}\s*(?:\n|$)/m.exec(proseForDiagnostics);
  if (expressionDiagnostic) throw markdownDiagnostic("bare expressions are not allowed", lineNumberAt(markdown, expressionDiagnostic.index));
  // Code is escaped as text, so HTML-looking includes and strings are safe
  // inside a fenced block. Validate only prose/MDX syntax here.
  const prose = markdown.replace(/```[\s\S]*?```/g, "");
  const unsafe = [
    /(^|\n)\s*(?:import|export)\s+[^\n]*/m,
    /<\/?(?:script|style|iframe|object|embed|form|input|button)\b/i,
    /\bon[a-z]+\s*=/i,
    /(^|\n)\s*<\/?[a-z][^>]*>/i,
    /(?:javascript|vbscript|data):/i,
  ];
  for (const pattern of unsafe) if (pattern.test(prose)) throw new Error("Markdown/MDX 包含不允许的 HTML、脚本或链接语法");
  if (/(^|\n)\s*\{[^\n]+\}\s*(?:\n|$)/m.test(prose)) throw new Error("Markdown/MDX 不允许裸表达式");
}

function splitTableRow(line) {
  const value = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return value.split("|").map((cell) => cell.trim());
}

function tableSeparator(line) {
  return /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function listStart(line) { return line.match(/^\s*([-+*]|\d+[.)])\s+(.*)$/); }

function renderList(lines, start) {
  const first = listStart(lines[start]);
  if (!first) return undefined;
  const ordered = /^\d/.test(first[1]);
  const items = [];
  let index = start;
  while (index < lines.length) {
    const match = listStart(lines[index]);
    if (!match || /^\d/.test(match[1]) !== ordered) break;
    let item = match[2];
    const task = item.match(/^\[([ xX])\]\s+(.*)$/);
    if (task) item = `<label class="task-item"><input type="checkbox" disabled${task[1].toLowerCase() === "x" ? " checked" : ""} /> ${inlineMarkdown(task[2])}</label>`;
    else item = inlineMarkdown(item);
    items.push(`<li>${item}</li>`);
    index += 1;
  }
  return { html: `<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`, next: index };
}

/** Convert the controlled Markdown subset used by content/ to safe static HTML. */
export function markdownToHtml(markdown) {
  assertSafeMarkdown(markdown);
  const normalizedMarkdown = markdown.replace(/\r\n?/g, "\n");
  const fenceLines = normalizedMarkdown.split("\n");
  let openFenceLine = null;
  for (const [lineIndex, sourceLine] of fenceLines.entries()) {
    if (/^\s*```\s*$/.test(sourceLine)) {
      openFenceLine = openFenceLine === null ? lineIndex + 1 : null;
    } else if (openFenceLine === null && /^\s*```\s*[\w-]+\s*$/.test(sourceLine)) {
      openFenceLine = lineIndex + 1;
    }
  }
  if (openFenceLine !== null) throw markdownDiagnostic("code fence is not closed", openFenceLine);
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  const headingIds = new Map();
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const fence = line.match(/^\s*```\s*([\w-]*)\s*$/);
    if (fence) {
      const language = fence[1].toLowerCase();
      const source = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) { source.push(lines[index]); index += 1; }
      if (index >= lines.length) throw new Error("代码围栏未闭合");
      const escaped = escapeHtml(source.join("\n"));
      if (language === "mermaid") {
        // Mermaid is rendered during the content build so the exported site does
        // not depend on a browser-side script or an online service. Keep the
        // source in an explicit details block: it is useful for screen readers,
        // debugging a diagram and environments that cannot display SVG.
        const svg = mermaidToSvg(source.join("\n"), "课程流程图");
        if (svg) {
          const visualClass = svg.includes("diagram-horizontal") ? " diagram-horizontal-visual" : "";
          output.push(`<figure class="diagram diagram-mermaid"><div class="diagram-visual${visualClass}">${svg}</div><details class="diagram-fallback"><summary>查看文字版与 Mermaid 源码</summary><pre class="mermaid-source">${escaped}</pre><p>按节点和箭头顺序阅读流程；图形仅用于帮助建立结构。</p></details></figure>`);
        } else {
          output.push(`<figure class="diagram diagram-mermaid diagram-unavailable"><figcaption>流程图（当前语法未生成图形）</figcaption><pre class="mermaid-source">${escaped}</pre><p class="diagram-fallback">文字降级：按上方节点和箭头顺序阅读流程。</p></figure>`);
        }
      }
      else output.push(`<pre class="code-block"><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${escaped}</code></pre>`);
      index += 1;
      continue;
    }
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const base = slugify(heading[2]);
      const occurrence = headingIds.get(base) ?? 0;
      headingIds.set(base, occurrence + 1);
      const id = occurrence ? `${base}-${occurrence + 1}` : base;
      output.push(`<h${level} id="${escapeHtml(id)}">${inlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^\s*(?:---+|\*\s*\*\s*\*|___+)\s*$/.test(line)) { output.push("<hr />"); index += 1; continue; }
    if (/^\s*>/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) { quote.push(lines[index].replace(/^\s*>\s?/, "")); index += 1; }
      output.push(`<blockquote>${inlineMarkdown(quote.join("\n")).replaceAll("\n", "<br />")}</blockquote>`);
      continue;
    }
    if (index + 1 < lines.length && line.includes("|") && tableSeparator(lines[index + 1])) {
      const headers = splitTableRow(line);
      const alignments = splitTableRow(lines[index + 1]).map((cell) => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : cell.startsWith(":") ? "left" : "");
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) { rows.push(splitTableRow(lines[index])); index += 1; }
      output.push(`<div class="table-scroll"><table><thead><tr>${headers.map((cell, i) => `<th${alignments[i] ? ` style="text-align:${alignments[i]}"` : ""}>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, i) => `<td${alignments[i] ? ` style="text-align:${alignments[i]}"` : ""}>${inlineMarkdown(row[i] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const list = renderList(lines, index);
    if (list) { output.push(list.html); index = list.next; continue; }
    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !/^\s*```/.test(lines[index]) && !/^\s*(#{1,6})\s+/.test(lines[index]) && !/^\s*>/.test(lines[index]) && !listStart(lines[index]) && !(index + 1 < lines.length && lines[index].includes("|") && tableSeparator(lines[index + 1]))) { paragraph.push(lines[index]); index += 1; }
    output.push(`<p>${inlineMarkdown(paragraph.join("\n")).replaceAll("\n", "<br />")}</p>`);
  }
  return output.join("\n");
}
