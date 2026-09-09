import type { MetadataRoute } from "next";
import { localUrl, scopePath } from "@/lib/pwa/config";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: scopePath,
    name: "嵌入式复习站",
    short_name: "嵌入式复习站",
    description: "本地优先的嵌入式软件学习工具",
    start_url: scopePath,
    scope: scopePath,
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#171a1d",
    lang: "zh-CN",
    icons: [
      { src: localUrl("/icons/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: localUrl("/icons/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: localUrl("/icons/icon-maskable.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
