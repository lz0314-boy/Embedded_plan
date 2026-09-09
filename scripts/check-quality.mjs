import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const output = path.resolve("out");
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "http://localhost:4173";
let origin = "http://localhost:4173";
try {
  const candidate = new URL(configuredOrigin);
  if (candidate.protocol === "http:" || candidate.protocol === "https:") origin = candidate.origin;
} catch {}

function siteUrl(route) {
  return new URL(`${basePath}${route.startsWith("/") ? route : `/${route}`}`, `${origin}/`).toString();
}

function pageFile(route) {
  const relative = route ? `${route.replace(/^\//, "").replace(/\/$/, "")}/index.html` : "index.html";
  const candidates = [path.join(output, relative), path.join(output, basePath.replace(/^\//, ""), relative)];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`缺少静态页面：${route || "/"}`);
  return found;
}

function readPage(route) {
  return fs.readFileSync(pageFile(route), "utf8");
}

function metaContent(html, selector) {
  const match = html.match(selector);
  return match?.[1] ?? "";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertMetadata(route, { indexable, title, jsonLd = false, canonicalRequired = indexable || jsonLd }) {
  const html = readPage(route);
  const robots = metaContent(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i).replace(/\s/g, "").toLowerCase();
  assert(indexable ? robots.includes("index") && !robots.includes("noindex") : robots.includes("noindex"), `robots 元数据不符合预期：${route}`);
  const canonical = metaContent(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (canonicalRequired) assert(canonical === siteUrl(route), `canonical 不符合预期：${route} -> ${canonical}`);
  if (title) assert(metaContent(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i).includes(title), `缺少 Open Graph 标题：${route}`);
  if (jsonLd) assert(/application\/ld\+json/i.test(html) && /TechArticle|LearningResource/.test(html) && /BreadcrumbList/.test(html), `缺少内容页 JSON-LD：${route}`);
  assert(/Content-Security-Policy/i.test(html) && /sha256-/i.test(html), `缺少带 hash 的 CSP：${route}`);
  assert(!/['"]unsafe-eval['"]/i.test(html), `CSP 不得开放 unsafe-eval：${route}`);
}

function assetPath(source) {
  const url = new URL(source, "https://quality.invalid");
  assert(url.origin === "https://quality.invalid", `首屏加载了外部资源：${source}`);
  let relative = decodeURIComponent(url.pathname).replace(/^\//, "");
  const prefix = basePath.replace(/^\//, "");
  if (prefix && relative.startsWith(`${prefix}/`)) relative = relative.slice(prefix.length + 1);
  const candidates = [path.join(output, relative), path.join(output, prefix, relative)];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`首屏资源不存在：${source}`);
  return found;
}

function initialTransfer(route) {
  const html = readPage(route);
  const external = [...html.matchAll(/<script\b([^>]*)>/gi)]
    .filter(([, attributes]) => /\bsrc\s*=/.test(attributes) && !/\bnomodule\b/i.test(attributes))
    .map(([, attributes]) => attributes.match(/\bsrc=["']([^"']+)["']/i)?.[1])
    .filter((source) => source)
    .map((source) => assetPath(source));
  const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attributes]) => !/\bsrc\s*=/.test(attributes) && !/application\/ld\+json/i.test(attributes))
    .map(([, , body]) => Buffer.from(body));
  const styles = [...html.matchAll(/<link\b[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)].map(([, source]) => assetPath(source));
  const scripts = [...new Set(external)].map((file) => zlib.gzipSync(fs.readFileSync(file)).length).reduce((sum, size) => sum + size, 0) + inline.map((body) => zlib.gzipSync(body).length).reduce((sum, size) => sum + size, 0);
  const css = [...new Set(styles)].map((file) => zlib.gzipSync(fs.readFileSync(file)).length).reduce((sum, size) => sum + size, 0);
  return { scripts, css };
}

assert(fs.existsSync(path.join(output, "robots.txt")), "缺少 robots.txt");
assert(fs.existsSync(path.join(output, "sitemap.xml")), "缺少 sitemap.xml");
const robots = fs.readFileSync(path.join(output, "robots.txt"), "utf8");
assert(robots.includes("/settings/") && robots.includes("sitemap.xml"), "robots.txt 未声明私有路由或 sitemap");
const sitemap = fs.readFileSync(path.join(output, "sitemap.xml"), "utf8");
assert(sitemap.includes(siteUrl("/roadmap/")) && sitemap.includes(siteUrl("/questions/")) && sitemap.includes(siteUrl("/labs/")), "sitemap 缺少公开目录");
assert(!sitemap.includes(siteUrl("/learn/rt-thread-scheduler/")), "草稿内容不得进入 sitemap");

assertMetadata("/", { indexable: false });
assertMetadata("/roadmap/", { indexable: true, title: "知识地图与学习路线" });
assertMetadata("/questions/", { indexable: true, title: "嵌入式软件面试题库" });
assertMetadata("/labs/", { indexable: true, title: "代码与分析实验" });
assertMetadata("/learn/rt-thread-scheduler/", { indexable: false, jsonLd: true });
assertMetadata("/labs/c-memory-lab/", { indexable: false, jsonLd: true });
for (const route of ["/quiz/", "/review/", "/interview/", "/interview/session/", "/notes/", "/stats/", "/projects/", "/settings/", "/auth/callback/", "/offline/"]) assertMetadata(route, { indexable: false });

const transfers = ["/", "/learn/rt-thread-scheduler/"].map((route) => ({ route, ...initialTransfer(route) }));
for (const transfer of transfers) {
  assert(transfer.scripts <= 200 * 1024, `JS gzip 预算超限：${transfer.route} ${transfer.scripts} bytes`);
  assert(transfer.css <= 50 * 1024, `CSS gzip 预算超限：${transfer.route} ${transfer.css} bytes`);
}
const contentIndex = path.join(process.cwd(), "generated", "content-index.json");
assert(fs.existsSync(contentIndex), "缺少轻量内容索引");
const indexGzip = zlib.gzipSync(fs.readFileSync(contentIndex)).length;
assert(indexGzip <= 1.5 * 1024 * 1024, `内容索引 gzip 预算超限：${indexGzip} bytes`);
assert(fs.existsSync(path.join(output, "_headers")), "缺少静态托管安全头配置");
assert(fs.existsSync(path.resolve("vercel.json")), "缺少 Vercel 安全头配置");

console.log(`质量检查通过：${transfers.map(({ route, scripts, css }) => `${route || "/"} JS=${scripts}B CSS=${css}B`).join("；")}；内容索引 gzip=${indexGzip}B。`);
