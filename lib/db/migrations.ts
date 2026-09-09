import type { BackupData, BackupPackage } from "@/lib/domain/backup";

export function migrateBackup(input: unknown): BackupPackage {
  if (!input || typeof input !== "object") throw new Error("备份必须是 JSON 对象");
  const candidate = input as Partial<BackupPackage>;
  if (candidate.format !== "embedded-learning-backup" || candidate.schemaVersion !== 1 || !candidate.data) throw new Error("不支持的备份格式或 schema 版本");
  const data = candidate.data as BackupData;
  for (const key of ["settings", "contentProgress", "notes", "bookmarks", "reviewCards", "quizAttempts", "wrongQuestions"] as const) if (!Array.isArray(data[key])) throw new Error(`备份字段无效：${key}`);
  if (data.projectCases !== undefined && !Array.isArray(data.projectCases)) throw new Error("备份字段无效：projectCases");
  return { format: candidate.format, schemaVersion: 1, exportedAt: String(candidate.exportedAt), contentVersion: String(candidate.contentVersion), checksum: String(candidate.checksum), data };
}
