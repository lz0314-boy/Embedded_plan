import type { MetadataRoute } from "next";
import { siteOrigin, sitePath, siteUrl } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: [sitePath("/roadmap/"), sitePath("/questions/"), sitePath("/labs/"), sitePath("/learn/")], disallow: [sitePath("/quiz/"), sitePath("/review/"), sitePath("/interview/"), sitePath("/notes/"), sitePath("/stats/"), sitePath("/projects/"), sitePath("/settings/"), sitePath("/auth/"), sitePath("/offline/")] }],
    host: siteOrigin,
    sitemap: siteUrl("/sitemap.xml"),
  };
}
