import Link from "@/components/static-link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contentCatalog, getContentBySlug, getSourceById } from "@/lib/content/catalog";
import { contentDescription, contentJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { siteUrl } from "@/lib/site";
import { LearnActions } from "./learn-actions";

export function generateStaticParams() { return contentCatalog.map((item) => ({ slug: item.slug })); }

const difficultyLabels = { beginner: "入门", intermediate: "进阶", advanced: "高级" } as const;
const typeLabels = { lesson: "课程", "interview-question": "面试题", "quiz-question": "测验", "code-lab": "代码实验" } as const;

function plainHeading(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

function tableOfContents(html: string) {
  return [...html.matchAll(/<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)].map((match) => ({ level: Number(match[1]), id: match[2], label: plainHeading(match[3]) }));
}

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
  const toc = tableOfContents(item.html);
  const related = item.related.map((id) => contentCatalog.find((candidate) => candidate.id === id || candidate.slug === id)).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  return <>
    <div className="eyebrow">{typeLabels[item.type]} · {item.pillar} / {item.module}</div>
    <h1>{item.title}</h1>
    <p className="muted">{item.scope} · {item.platforms.join(" / ")}</p>
    <div className="learning-meta" aria-label="内容信息"><span className="learning-meta-item">{typeLabels[item.type]}</span><span className="learning-meta-item">约 {item.estimatedMinutes} 分钟</span><span className="learning-meta-item">{difficultyLabels[item.difficulty]}</span></div>
    <div className="learning-layout">
      <div className="learning-main">
        <article className="content-body" dangerouslySetInnerHTML={{ __html: item.html }} />
        <section className="panel learning-sources"><h2>来源与边界</h2><p><span className={`status ${verified ? "verified" : "pending"}`}>{verified ? "已核验" : "待核验"}</span></p><ul>{item.sourceIds.map((id) => { const source = getSourceById(id); return <li key={id}>{source ? <Link href={source.url} target="_blank" rel="noreferrer">{source.title}</Link> : id}</li>; })}</ul><p className="muted">{verified ? "本条内容已绑定版本化资料并完成核验。" : "本条内容可以直接学习；证据状态仅说明资料覆盖程度，未完成逐条核验的板级结论会单独标注。"}</p>{related.length ? <><h3>相关内容</h3><ul>{related.map((candidate) => <li key={candidate.id}><Link href={`/learn/${candidate.slug}/`}>{candidate.title}</Link></li>)}</ul></> : null}</section>
      </div>
      <aside className="learning-sidebar">
        {toc.length ? <section className="panel"><h2>本页导航</h2><nav className="learning-toc" aria-label="本页导航">{toc.map((heading) => <a className={`level-${heading.level}`} href={`#${heading.id}`} key={heading.id}>{heading.label}</a>)}</nav></section> : null}
        <LearnActions contentId={item.id} />
        <section className="panel"><h2>建议学习动作</h2><ol><li>先用一句话复述结论。</li><li>对照流程图、代码或日志解释机制。</li><li>合上页面，完成一次主动回忆或自测。</li></ol></section>
      </aside>
    </div>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(contentJsonLd(item, sources)) }} />
  </>;
}
