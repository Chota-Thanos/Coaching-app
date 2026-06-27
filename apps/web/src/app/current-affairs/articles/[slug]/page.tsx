import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronRight, ExternalLink } from "lucide-react";
import { getArticleBySlug } from "../../../../lib/api";
import { articleHref, contentKindLabel, CURRENT_AFFAIRS_HUBS } from "../../../../lib/current-affairs";
import { GatedArticleBody } from "../../../../components/current-affairs/gated-article-body";
import { AdminArticleActions } from "../../../../components/current-affairs/admin-article-actions";

export const dynamic = "force-dynamic";

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

function formatDate(value: string | null): string {
  if (!value) return "Undated";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function paragraphs(body: string): string[] {
  return body.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
}

function articleDescription(body: string): string {
  const compact = body.replace(/\s+/g, " ").trim();
  return compact.length > 155 ? `${compact.slice(0, 155).trim()}...` : compact;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const article = await getArticleBySlug(slug);
    const description = articleDescription(article.body);
    const image = article.assets.find((asset) => ["thumbnail", "image"].includes(asset.asset_type))?.file_url;
    return {
      title: article.title,
      description,
      alternates: { canonical: articleHref(article.slug) },
      openGraph: {
        title: article.title,
        description,
        type: "article",
        publishedTime: article.publication_date ?? undefined,
        images: image ? [{ url: image }] : undefined
      }
    };
  } catch {
    return {};
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  let article;
  try {
    article = await getArticleBySlug(slug);
  } catch {
    notFound();
  }

  const hub = CURRENT_AFFAIRS_HUBS.find((item) => item.contentKind === article.content_kind);
  const heroAsset = article.assets.find((asset) => ["thumbnail", "image"].includes(asset.asset_type));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    datePublished: article.publication_date,
    articleSection: article.category?.name,
    keywords: article.institute_tags,
    image: heroAsset?.file_url,
    mainEntityOfPage: articleHref(article.slug)
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-5">
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} type="application/ld+json" />
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink/65">
        <Link className="font-semibold text-civic" href={hub ? `/current-affairs/${hub.path}` : "/current-affairs/daily-news"}>
          {hub?.shortLabel ?? "Current Affairs"}
        </Link>
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
        {article.category && (
          <>
            <span>{article.category.name}</span>
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </>
        )}
        <span className="line-clamp-1">{article.title}</span>
      </nav>

      <header className="rounded-lg border border-line bg-white p-4 shadow-sm md:p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-civic/10 px-2 py-1 text-xs font-bold text-civic">{contentKindLabel(article.content_kind)}</span>
            {article.category && <span className="rounded-md bg-paper px-2 py-1 text-xs font-bold text-ink/65">{article.category.name}</span>}
          </div>
          <AdminArticleActions article={article} />
        </div>
        <h1 className="text-3xl font-black leading-tight text-ink md:text-5xl">{article.title}</h1>
        <dl className="mt-4 grid gap-2 text-sm text-ink/70 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <CalendarDays aria-hidden="true" className="h-4 w-4 text-civic" />
            <dt className="sr-only">Publication date</dt>
            <dd>{formatDate(article.publication_date)}</dd>
          </div>
          {article.source_name && (
            <div className="flex items-center gap-2">
              <ExternalLink aria-hidden="true" className="h-4 w-4 text-civic" />
              <dt className="sr-only">Source</dt>
              <dd>{article.source_name}</dd>
            </div>
          )}
        </dl>
      </header>

      <GatedArticleBody article={article} heroAsset={heroAsset} hub={hub} />
    </main>
  );
}
