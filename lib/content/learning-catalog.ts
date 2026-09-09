import manifest from "@/generated/learning-index.json";

export type LearningCatalogItem = {
  id: string;
  title: string;
  slug: string;
  priority: "core" | "supporting";
  estimatedMinutes: number;
};

export const learningCatalog = manifest.content as LearningCatalogItem[];
