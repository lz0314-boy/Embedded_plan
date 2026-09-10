import Link from "@/components/static-link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contentCatalog, getContentBySlug, getSourceById, labelStatus } from "@/lib/content/catalog";
import { contentDescription, contentJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { siteUrl } from "@/lib/site";
import { LearnActions } from "./learn-actions";

export function generateStaticParams() { return contentCatalog.map((item) => ({ slug: item.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = getContentBySlug(slug);
  if (!item) return {};
  const indexable = item.status === "verified" && Boolean(item.verifiedAt);
  return {
    title: item.title,
    description: contentDescription(item),
    alternates: { canonical: siteUrl(`/learn/${item.slug}/`) },
    robots: { index: indexable, follow: true },
    openGraph: { title: item.title, description: contentDescription(item), type: "article", url: siteUrl(`/learn/${item.slug}/`) },
  };
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const item = getContentBySlug(slug); if (!item) notFound();
  const sources = item.sourceIds.map(getSourceById).filter((source): source is NonNullable<ReturnType<typeof getSourceById>> => Boolean(source));
  const verified = item.status === "verified" && Boolean(item.verifiedAt);
  return <><div className="eyebrow">{item.pillar} / {item.module}</div><h1>{item.title}</h1><p className="muted">{item.scope} · {item.platforms.join(" / ")} · <span className={`status ${verified ? "verified" : "pending"}`}>{labelStatus(item.status, item.verifiedAt)}</span></p><LearnActions contentId={item.id} /><article className="content-body" dangerouslySetInnerHTML={{ __html: item.html }} /><section className="panel" style={{ maxWidth: 760, marginTop: 32 }}><h2 style={{ marginTop: 0 }}>来源与边界</h2><ul>{item.sourceIds.map((id) => { const source = getSourceById(id); return <li key={id}>{source ? <Link href={source.url} target="_blank" rel="noreferrer">{source.title}</Link> : id}</li>; })}</ul><p className="muted">未完成固定版本和人工逐条核验的内容保持“待核验”。</p></section><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(contentJsonLd(item, sources)) }} /></>;
}
