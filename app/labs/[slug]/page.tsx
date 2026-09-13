import Link from "@/components/static-link";
import type { Metadata } from "next";
import { CodeLabRunner } from "@/components/code/code-lab-runner";
import { contentCatalog, getContentBySlug, getSourceById } from "@/lib/content/catalog";
import { contentDescription, contentJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { siteUrl } from "@/lib/site";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return contentCatalog.filter((item) => item.type === "code-lab").map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = getContentBySlug(slug);
  if (!item || item.type !== "code-lab") return {};
  const indexable = item.status === "verified" && Boolean(item.verifiedAt);
  return {
    title: item.title,
    description: contentDescription(item),
    alternates: { canonical: siteUrl(`/labs/${item.slug}/`) },
    robots: { index: indexable, follow: true },
    openGraph: { title: item.title, description: contentDescription(item), type: "article", url: siteUrl(`/labs/${item.slug}/`) },
  };
}

export default async function LabPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getContentBySlug(slug);
  if (!item || item.type !== "code-lab") notFound();
  const sources = item.sourceIds.map(getSourceById).filter((source): source is NonNullable<ReturnType<typeof getSourceById>> => Boolean(source));
  return <><div className="eyebrow">实验 · {item.pillar} / {item.module}</div><h1>{item.title}</h1><p className="muted">{item.scope} · {item.platforms.join(" / ")}</p><p className="muted">这是保留给旧书签的兼容页面；实验不在主导航、默认学习路线或随机复习池中。</p><article className="content-body" dangerouslySetInnerHTML={{ __html: item.html }} /><CodeLabRunner labId={item.id} /><section className="panel" style={{ maxWidth: 760, marginTop: 24 }}><h2 style={{ marginTop: 0 }}>来源与边界</h2><ul>{item.sourceIds.map((id) => { const source = getSourceById(id); return <li key={id}>{source ? <Link href={source.url} target="_blank" rel="noreferrer">{source.title}</Link> : id}</li>; })}</ul><p className="muted">浏览器 C runner 只适用于标准 C/WASI 练习；RT-Thread、Cortex-M 和 i.MX6ULL 行为必须回到对应源码、架构手册或真板验证。</p></section><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(contentJsonLd(item, sources, "labs")) }} /></>;
}
