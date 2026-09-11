import manifest from "@/generated/learning-index.json";

export type LearningCatalogItem = {
  id: string;
  title: string;
  slug: string;
  priority: "core" | "supporting";
  contentRole: "core" | "supporting" | "placeholder";
  estimatedMinutes: number;
  prerequisites: string[];
  pillar: "c" | "cortex-m" | "rt-thread" | "linux-bsp" | "linux-user";
  module: string;
};

export const learningCatalog = manifest.content as LearningCatalogItem[];
