export const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
export const scopePath = `${basePath}/`;

export function localUrl(path: string) {
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

export type OfflineAsset = { url: string; bytes: number; revision: string };
export type OfflinePackage = { id: string; title: string; bytes: number; assets: OfflineAsset[] };
export type OfflineIndex = {
  appVersion: string;
  contentVersion: string;
  packages: OfflinePackage[];
  pageUrls: string[];
};
export type InstalledPackage = { id: string; version: string; bytes: number; cacheName: string };
export type WorkerStatus = {
  index: OfflineIndex;
  installed: InstalledPackage[];
  cacheNames: string[];
};
