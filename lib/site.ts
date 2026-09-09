import { basePath, localUrl } from "@/lib/pwa/config";

const fallbackOrigin = "http://localhost:4173";

function readOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return fallbackOrigin;
  try {
    const url = new URL(configured);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallbackOrigin;
    return url.origin;
  } catch {
    return fallbackOrigin;
  }
}

export const siteOrigin = readOrigin();

export function siteUrl(path: string) {
  return new URL(localUrl(path), `${siteOrigin}/`).toString();
}

export function sitePath(path: string) {
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}
