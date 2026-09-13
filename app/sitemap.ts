import type { MetadataRoute } from "next";
import { contentCatalog } from "@/lib/content/catalog";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = [
    { url: siteUrl("/roadmap/") },
    { url: siteUrl("/questions/") },
    // Kept as a compatibility directory for existing bookmarks; it is not in
    // the product navigation or any default learning/review pool.
    { url: siteUrl("/labs/") },
  ];
  const publicContent = contentCatalog.filter((item) => item.status === "verified" && item.verifiedAt && ["lesson", "interview-question"].includes(item.type));
  return [...routes, ...publicContent.map((item) => ({ url: siteUrl(`/learn/${item.slug}/`), lastModified: item.verifiedAt ?? undefined }))];
}
