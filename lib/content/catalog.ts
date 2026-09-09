import manifest from "@/generated/content-manifest.json";
import type { ContentRecord, SourceRecord } from "./schema";

export const contentCatalog = manifest.content as ContentRecord[];
export const sourceCatalog = manifest.sources as SourceRecord[];

export function getContentBySlug(slug: string) {
  return contentCatalog.find((item) => item.slug === slug);
}

export function getContentById(id: string) {
  return contentCatalog.find((item) => item.id === id);
}

export function getSourceById(id: string) {
  return sourceCatalog.find((item) => item.id === id);
}

export function labelStatus(status: ContentRecord["status"], verifiedAt: string | null) {
  if (status === "verified" && verifiedAt) return "已核验";
  return "待核验";
}
