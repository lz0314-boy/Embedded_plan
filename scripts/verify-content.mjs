import fs from "node:fs";
import path from "node:path";
import { listContentFiles, parseFrontmatter, readSources } from "./content-utils.mjs";

const args = new Set(process.argv.slice(2));
const batchIndex = process.argv.indexOf("--batch");
const batchId = batchIndex >= 0 ? process.argv[batchIndex + 1] : null;
const apply = args.has("--apply");

if (!batchId) {
  console.error("用法：node scripts/verify-content.mjs --batch <id> [--apply]");
  process.exit(1);
}

const manifestPath = path.join(process.cwd(), "content", "verification", "batches.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const batch = manifest.batches.find((item) => item.id === batchId);
if (!batch) {
  console.error(`未找到核验批次：${batchId}`);
  process.exit(1);
}

const sourceIds = new Set(readSources().map((source) => source.id));
const files = listContentFiles();
const records = new Map();
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const parsed = parseFrontmatter(source, file);
  records.set(parsed.metadata.id, { file, source, metadata: parsed.metadata });
}

const errors = [];
for (const sourceId of batch.sourceIds) {
  if (!sourceIds.has(sourceId)) errors.push(`批次 ${batch.id} 引用了不存在的 sourceId：${sourceId}`);
}

for (const id of batch.contentIds) {
  const record = records.get(id);
  if (!record) {
    errors.push(`批次 ${batch.id} 找不到内容：${id}`);
    continue;
  }
  if (id.startsWith("catalog-") && !batch.allowCatalog) errors.push(`${id} 属于扩充目录，批次未显式允许修改`);
  if (record.metadata.status === "verified" || record.metadata.verifiedAt !== null) errors.push(`${id} 已有核验状态，拒绝覆盖`);
  if (!record.metadata.sourceIds.every((sourceId) => batch.sourceIds.includes(sourceId))) errors.push(`${id} 的 sourceIds 超出批次证据范围`);
  if (!record.metadata.sourceIds.length) errors.push(`${id} 没有来源，不能核验`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`${apply ? "将更新" : "预览"} ${batch.contentIds.length} 条内容：${batch.id}`);
for (const id of batch.contentIds) {
  const record = records.get(id);
  console.log(`- ${id} <- ${batch.reviewedAt}`);
  if (apply) {
    const next = record.source
      .replace(/^verifiedAt: null$/m, `verifiedAt: ${batch.reviewedAt}`)
      .replace(/^status: draft$/m, "status: verified");
    fs.writeFileSync(record.file, next, "utf8");
  }
}

if (!apply) console.log("这是预览模式；确认批次证据后追加 --apply 才会写入 MDX。");
