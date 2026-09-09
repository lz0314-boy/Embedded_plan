import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "嵌入式软件面试题库",
  description: "按平台、模块和关键词整理的嵌入式软件面试题与回答提纲。",
  alternates: { canonical: siteUrl("/questions/") },
  robots: { index: true, follow: true },
  openGraph: { title: "嵌入式软件面试题库", description: "嵌入式软件面试题与回答提纲。", type: "website" },
};

export default function QuestionsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
