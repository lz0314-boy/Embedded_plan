import type { ContentRecord, SourceRecord } from "@/lib/content/schema";
import { siteUrl } from "@/lib/site";

export function contentDescription(item: ContentRecord) {
  const value = item.body.replace(/[#*_`\[\]()]/g, "").replace(/\s+/g, " ").trim();
  return (value || `${item.title}：嵌入式软件系统化学习内容。`).slice(0, 160);
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function contentJsonLd(item: ContentRecord, sources: SourceRecord[], routePrefix = "learn") {
  const contentUrl = siteUrl(`/${routePrefix}/${item.slug}/`);
  const resourceType = item.type === "interview-question" ? "LearningResource" : "TechArticle";
  return [
    {
      "@context": "https://schema.org",
      "@type": resourceType,
      name: item.title,
      headline: item.title,
      description: contentDescription(item),
      url: contentUrl,
      inLanguage: "zh-CN",
      isAccessibleForFree: true,
      learningResourceType: item.type,
      educationalLevel: item.difficulty,
      keywords: item.keywords.join(", "),
      about: item.platforms,
      ...(item.verifiedAt ? { dateModified: item.verifiedAt } : {}),
      citation: sources.map((source) => source.url),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "知识地图", item: siteUrl("/roadmap/") },
        { "@type": "ListItem", position: 2, name: item.module, item: siteUrl(`/roadmap/#${item.pillar}`) },
        { "@type": "ListItem", position: 3, name: item.title, item: contentUrl },
      ],
    },
  ];
}
