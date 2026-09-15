import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { build } from "esbuild";
import { injectManifest } from "@serwist/build";

const output = path.resolve("out");
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
if (basePath && !/^\/[a-zA-Z0-9/_-]+$/.test(basePath)) throw new Error("Invalid basePath");
const urlFor = (relative) => `${basePath}/${relative.replaceAll("\\", "/")}`;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const catalog = JSON.parse(await fs.readFile("generated/content-manifest.json", "utf8"));
const packageInfo = JSON.parse(await fs.readFile("package.json", "utf8"));

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}

function icon(size) {
  const rows = Buffer.alloc((size * 3 + 1) * size);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const horizontal = column / size;
      const vertical = row / size;
      const stroke = horizontal > 0.3 && horizontal < 0.4 && vertical > 0.3 && vertical < 0.7;
      const bar = horizontal > 0.3 && horizontal < 0.7 && ((vertical > 0.3 && vertical < 0.39) || (vertical > 0.46 && vertical < 0.55));
      const color = stroke || bar ? [244, 245, 246] : [23, 26, 29];
      rows.set(color, row * (size * 3 + 1) + 1 + column * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(rows)), pngChunk("IEND", Buffer.alloc(0))]);
}

await fs.mkdir(path.join(output, "icons"), { recursive: true });
for (const [name, size] of [["icon-192", 192], ["icon-512", 512], ["icon-maskable", 512]]) {
  await fs.writeFile(path.join(output, "icons", `${name}.png`), icon(size));
}
await fs.mkdir(path.join(output, "pwa"), { recursive: true });

async function describeAsset(relative, url = urlFor(relative)) {
  const bytes = await fs.readFile(path.join(output, relative));
  return { url, bytes: bytes.length, revision: digest(bytes) };
}

const titles = { c: "C 语言与计算机基础", "cortex-m": "Cortex-M 与 MCU", "rt-thread": "RT-Thread", "linux-bsp": "i.MX6ULL Linux BSP", "linux-user": "Linux 应用" };
const packages = await Promise.all(Object.entries(titles).map(async ([id, title]) => {
  const assets = await Promise.all(catalog.content.filter((item) => item.pillar === id).map((item) => describeAsset(`learn/${item.slug}/index.html`, urlFor(`learn/${item.slug}/`))));
  return { id, title, assets, bytes: assets.reduce((total, asset) => total + asset.bytes, 0) };
}));
const contentHash = digest(JSON.stringify({ content: catalog.content, sources: catalog.sources }));
const contentVersion = `local-${contentHash.slice(0, 16)}`;
const shellRoutes = ["", "roadmap/", "questions/", "labs/", "review/", "quiz/", "settings/", "stats/", "offline/"];
const shell = await Promise.all(shellRoutes.map((route) => describeAsset(`${route}index.html`, urlFor(route))));
const detailAssets = await Promise.all(catalog.content
  .filter((item) => (item.type === "interview-question" || item.type === "quiz-question") && item.contentRole !== "placeholder" && item.status !== "deprecated")
  .map((item) => describeAsset(`content-items/${item.id}.json`, urlFor(`content-items/${item.id}.json`))));
const files = await fs.readdir(output, { recursive: true });
const staticAssets = await Promise.all(files.filter((file) => /^(?:_next[\\/]static|icons)[\\/].*\.(?:js|css|png|svg)$/.test(file)).map((file) => describeAsset(file)));
const appVersion = `${packageInfo.version}-${digest(JSON.stringify([...shell, ...staticAssets])).slice(0, 16)}`;
const index = { appVersion, contentVersion, packages, pageUrls: [...shell.map((entry) => entry.url), ...packages.flatMap((item) => item.assets.map((asset) => asset.url))] };
await fs.writeFile(path.join(output, "pwa/offline-index.json"), JSON.stringify(index));
const extras = await Promise.all(["manifest.webmanifest", "pwa/offline-index.json"].map((file) => describeAsset(file)));
const entries = [...shell, ...detailAssets, ...staticAssets, ...extras].map(({ url, revision }) => ({ url, revision }));

await build({
  entryPoints: ["app/sw.ts"], outfile: ".pwa-worker.js", bundle: true, minify: true,
  format: "iife", target: "es2020",
  define: { "process.env.NODE_ENV": '"production"', "__PWA_CONFIG__": JSON.stringify({ scope: `${basePath}/`, cachePrefix: `elp-${digest(basePath).slice(0, 10)}`, index }) },
});
const result = await injectManifest({ swSrc: ".pwa-worker.js", swDest: "out/sw.js", globDirectory: "out", globPatterns: [], additionalPrecacheEntries: entries });
await fs.unlink(".pwa-worker.js");
if (result.warnings.length) throw new Error(result.warnings.join("\n"));
console.log(`PWA: ${result.count} precache resources, ${packages.length} optional packages, ${appVersion}, ${contentVersion}`);
