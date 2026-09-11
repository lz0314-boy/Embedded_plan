import manifest from "@/generated/content-index.json";

/** Lightweight metadata used by client-side planning; bodies stay out of the home bundle. */
export type ContentIndexItem = {
  id: string;
  title: string;
  slug: string;
  type: "lesson" | "interview-question" | "quiz-question" | "code-lab";
  priority: "core" | "supporting";
  contentRole: "core" | "supporting" | "placeholder";
  status: "draft" | "reviewed" | "verified" | "deprecated";
};

export const contentIndex = manifest.content as ContentIndexItem[];
