import { localUrl } from "@/lib/pwa/config";

export type ContentDetail = { id: string; body: string; html: string };

export async function fetchContentDetail(id: string): Promise<ContentDetail> {
  const response = await fetch(localUrl(`/content-items/${id}.json`), { credentials: "omit", cache: "force-cache" });
  if (!response.ok) throw new Error(`内容详情加载失败：${response.status}`);
  return response.json() as Promise<ContentDetail>;
}
