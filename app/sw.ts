/// <reference lib="webworker" />

import { ExpirationPlugin, NetworkOnly, Serwist, StaleWhileRevalidate, type SerwistPlugin } from "serwist";
import type { InstalledPackage, OfflineAsset, OfflineIndex } from "../lib/pwa/config";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (string | { url: string; revision?: string })[];
};

declare const __PWA_CONFIG__: { scope: string; cachePrefix: string; index: OfflineIndex };
const { scope, cachePrefix, index } = __PWA_CONFIG__;
const origin = self.location.origin;
const runtimeCache = `${cachePrefix}-content-${index.contentVersion}`;
const packagePrefix = `${cachePrefix}-package-`;
const markerUrl = new URL(`${scope}pwa/complete`, origin).href;
const knownPages = new Set(index.pageUrls);
let packageOperation = false;

const onlyPublic: SerwistPlugin = {
  cacheWillUpdate: async ({ response }) => response.status === 200 && response.type !== "opaque" ? response : null,
};
const contentStrategy = new StaleWhileRevalidate({ cacheName: runtimeCache, plugins: [onlyPublic, new ExpirationPlugin({ maxEntries: 64 })] });

async function installedPackages() {
  const installed: InstalledPackage[] = [];
  for (const name of await caches.keys()) {
    if (!name.startsWith(packagePrefix)) continue;
    const marker = await (await caches.open(name)).match(markerUrl);
    if (marker) installed.push({ ...await marker.json(), cacheName: name });
  }
  return installed;
}

async function packageResponse(url: string, currentOnly = true) {
  for (const item of await installedPackages()) {
    if (currentOnly && item.version !== index.contentVersion) continue;
    const response = await (await caches.open(item.cacheName)).match(url);
    if (response) return response;
  }
}

let serwist: Serwist;
serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  cacheId: cachePrefix,
  skipWaiting: false,
  clientsClaim: true,
  runtimeCaching: [{
    matcher: ({ request, url }) => request.mode === "navigate" && url.origin === origin && url.pathname.startsWith(scope) && !request.headers.has("Authorization"),
    handler: async ({ request, event }): Promise<Response> => {
      const pathname = new URL(request.url).pathname;
      if (knownPages.has(pathname)) {
        const cachedShell: Response | undefined = await serwist.matchPrecache(pathname);
        if (cachedShell) return cachedShell;
        const normalized = new URL(pathname, origin).href;
        const downloaded = await packageResponse(normalized);
        if (downloaded) return downloaded;
        try {
          return await contentStrategy.handle({ request: new Request(normalized, { credentials: "omit" }), event });
        } catch {
          const older = await packageResponse(normalized, false);
          if (older) return older;
        }
      } else {
        try { return await fetch(request); } catch { }
      }
      return (await serwist.matchPrecache(`${scope}offline/`)) ?? Response.error();
    },
  }, {
    matcher: () => true,
    handler: new NetworkOnly(),
  }],
});

async function fetchAsset(asset: OfflineAsset) {
  const response = await fetch(asset.url, { cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok || new URL(response.url).origin !== origin) throw new Error("离线包资源不可用");
  const bytes = await response.clone().arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== asset.revision) throw new Error("内容版本已经改变，请检查更新后重新下载");
  return response;
}

async function downloadPackage(id: string) {
  const definition = index.packages.find((item) => item.id === id);
  if (!definition) throw new Error("未知离线包");
  const name = `${packagePrefix}${id}-${index.contentVersion}-${crypto.randomUUID()}`;
  const cache = await caches.open(name);
  try {
    for (const asset of definition.assets) {
      await cache.put(asset.url, await fetchAsset(asset));
    }
    await cache.put(markerUrl, new Response(JSON.stringify({ id, version: index.contentVersion, bytes: definition.bytes }), { headers: { "Content-Type": "application/json" } }));
    for (const item of await installedPackages()) {
      if (item.id === id && item.cacheName !== name) await caches.delete(item.cacheName);
    }
  } catch (error) {
    await caches.delete(name);
    throw error;
  }
}

async function assertSingleTab() {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  if (windows.filter((client) => client.url.startsWith(self.registration.scope)).length > 1) throw new Error("请先关闭本站的其他标签页，避免打断另一页的草稿");
}

async function respond(event: ExtendableMessageEvent) {
  const client = event.source as Client | null;
  if (!client?.url?.startsWith(self.registration.scope)) return;
  const port = event.ports[0];
  const type = event.data?.type;
  try {
    if (type === "STATUS") {
      port?.postMessage({ ok: true, value: { index, installed: await installedPackages(), cacheNames: (await caches.keys()).filter((name) => name.startsWith(cachePrefix)) } });
      return;
    }
    if (type === "PREPARE_UPDATE" || type === "ACTIVATE_UPDATE") {
      await assertSingleTab();
      if (type === "ACTIVATE_UPDATE") await self.skipWaiting();
    } else if (["DOWNLOAD_PACKAGE", "DELETE_PACKAGE", "CLEAR_CONTENT_CACHE"].includes(type)) {
      if (packageOperation) throw new Error("另一项缓存操作尚未完成");
      packageOperation = true;
      try {
        if (type === "DOWNLOAD_PACKAGE") await downloadPackage(event.data.id);
        if (type === "DELETE_PACKAGE") {
          const definition = index.packages.find((item) => item.id === event.data.id);
          if (!definition) throw new Error("未知离线包");
          for (const item of await installedPackages()) if (item.id === definition.id) await caches.delete(item.cacheName);
          const runtime = await caches.open(runtimeCache);
          for (const asset of definition.assets) await runtime.delete(asset.url);
        }
        if (type === "CLEAR_CONTENT_CACHE") {
          for (const name of await caches.keys()) if (name.startsWith(`${cachePrefix}-content-`)) await caches.delete(name);
        }
      } finally { packageOperation = false; }
    } else throw new Error("未知缓存操作");
    port?.postMessage({ ok: true });
  } catch (error) {
    port?.postMessage({ ok: false, error: error instanceof Error ? error.message : "缓存操作失败" });
  }
}

self.addEventListener("message", (event: ExtendableMessageEvent) => { event.waitUntil(respond(event)); });
serwist.addEventListeners();
