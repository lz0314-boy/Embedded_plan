import fs from "node:fs";
import { listContentFiles, parseFrontmatter, readSources } from "./content-utils.mjs";

const files = listContentFiles();
const sources = readSources();
const verificationManifest = JSON.parse(fs.readFileSync("content/verification/batches.json", "utf8"));
const approvedContentIds = new Set(verificationManifest.batches.flatMap((batch) => batch.contentIds.filter((id) => !id.startsWith("catalog-") || batch.allowCatalog === true)));
const sourceIds = new Set(sources.map((source) => source.id));
const ids = new Set();
const slugs = new Set();
const records = [];
const errors = [];
const required = ["id", "type", "title", "slug", "pillar", "module", "difficulty", "priority", "contentRole", "estimatedMinutes", "scope", "platforms", "prerequisites", "related", "sourceIds", "verifiedAt", "status", "keywords"];
const allowedTypes = new Set(["lesson", "interview-question", "quiz-question", "code-lab"]);
const allowedPillars = new Set(["c", "cortex-m", "rt-thread", "linux-bsp", "linux-user"]);
const allowedStatuses = new Set(["draft", "reviewed", "verified", "deprecated"]);
const allowedRoles = new Set(["core", "supporting", "placeholder"]);
const allowedScopes = new Set(["rtos-generic", "rt-thread", "cortex-m", "chip", "esp32", "linux-user", "linux-bsp", "alpha-board"]);
const directoryTypes = new Map([["lessons", "lesson"], ["questions", "interview-question"], ["quizzes", "quiz-question"], ["labs", "code-lab"]]);
const minimumCounts = new Map([["lesson", 40], ["interview-question", 200], ["quiz-question", 250], ["code-lab", 20]]);
const typeCounts = new Map([...minimumCounts.keys()].map((type) => [type, 0]));

for (const source of sources) {
  for (const field of ["id", "title", "organization", "url", "versionOrCommit", "accessedAt", "platforms", "citationNote"]) {
    if (!source[field]) errors.push(`content/sources.yml: 来源 ${source.id ?? "<unknown>"} 缺少 ${field}`);
  }
  if (source.url && !source.url.startsWith("https://")) errors.push(`content/sources.yml: 来源 ${source.id} 必须使用 HTTPS`);
}

for (const file of files) {
  const relative = file.replaceAll("\\", "/");
  const { metadata } = parseFrontmatter(fs.readFileSync(file, "utf8"), relative);
  const missing = required.filter((key) => !(key in metadata));
  if (missing.length) errors.push(`${relative}: 缺少字段 ${missing.join(", ")}`);
  if (!allowedTypes.has(metadata.type)) errors.push(`${relative}: 非法 type ${metadata.type}`);
  if (!allowedPillars.has(metadata.pillar)) errors.push(`${relative}: 非法 pillar ${metadata.pillar}`);
  if (!allowedStatuses.has(metadata.status)) errors.push(`${relative}: 非法 status ${metadata.status}`);
  if (!allowedRoles.has(metadata.contentRole)) errors.push(`${relative}: 非法 contentRole ${metadata.contentRole}`);
  if (!allowedScopes.has(metadata.scope)) errors.push(`${relative}: 非法 scope ${metadata.scope}`);
  if (metadata.status === "verified" && (!metadata.verifiedAt || metadata.verifiedAt === "null")) errors.push(`${relative}: verified 内容必须有 verifiedAt`);
  if (metadata.id?.startsWith("catalog-") && metadata.status === "verified" && !approvedContentIds.has(metadata.id)) errors.push(`${relative}: catalog 内容必须先登记在核验批次中`);
  if (metadata.scope === "esp32" && metadata.platforms?.some((platform) => platform.startsWith("cortex-m"))) errors.push(`${relative}: ESP32 不得混入 Cortex-M 平台`);
  const directory = relative.split("/").at(-2);
  if (directoryTypes.has(directory) && directoryTypes.get(directory) !== metadata.type) errors.push(`${relative}: 目录与 type 不一致`);
  if (!missing.length && allowedTypes.has(metadata.type) && allowedPillars.has(metadata.pillar) && allowedStatuses.has(metadata.status) && allowedRoles.has(metadata.contentRole) && allowedScopes.has(metadata.scope)) {
    const record = metadata;
    if (ids.has(record.id)) errors.push(`${relative}: 重复 id ${record.id}`);
    if (slugs.has(record.slug)) errors.push(`${relative}: 重复 slug ${record.slug}`);
    ids.add(record.id); slugs.add(record.slug); records.push(record);
    typeCounts.set(record.type, (typeCounts.get(record.type) ?? 0) + 1);
    for (const sourceId of record.sourceIds) if (!sourceIds.has(sourceId)) errors.push(`${relative}: 不存在 sourceId ${sourceId}`);
    for (const related of [...record.prerequisites, ...record.related]) if (!records.some((item) => item.id === related) && !files.some((candidate) => candidate.includes(`${related}.mdx`))) errors.push(`${relative}: 关联 ID ${related} 尚未登记`);
  }
}

for (const [type, minimum] of minimumCounts) if ((typeCounts.get(type) ?? 0) < minimum) errors.push(`内容数量不足：${type} 需要至少 ${minimum} 条`);

// Resolve relationships after every file has been read so forward references
// are checked consistently. Prerequisites form a directed acyclic graph.
const recordById = new Map(records.map((record) => [record.id, record]));
for (const record of records) {
  for (const relation of ["prerequisites", "related"]) {
    for (const target of record[relation] ?? []) {
      if (target === record.id) errors.push(`${record.id}: ${relation} 不能自引用`);
      else if (!recordById.has(target)) errors.push(`${record.id}: ${relation} 引用不存在的 ID ${target}`);
    }
  }
}
const visiting = new Set();
const visited = new Set();
function visitPrerequisites(id, trail = []) {
  if (visiting.has(id)) {
    const start = trail.indexOf(id);
    errors.push(`前置依赖形成循环：${[...(start >= 0 ? trail.slice(start) : trail), id].join(" -> ")}`);
    return;
  }
  if (visited.has(id)) return;
  const record = recordById.get(id);
  if (!record) return;
  visiting.add(id);
  for (const prerequisite of record.prerequisites ?? []) visitPrerequisites(prerequisite, [...trail, id]);
  visiting.delete(id);
  visited.add(id);
}
for (const record of records) visitPrerequisites(record.id);

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`内容校验通过：${files.length} 个 MDX，${sources.length} 个来源登记；课程 ${typeCounts.get("lesson")}、面试题 ${typeCounts.get("interview-question")}、测验 ${typeCounts.get("quiz-question")}、实验 ${typeCounts.get("code-lab")}。`);
