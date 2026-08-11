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
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://waytoias.com";
    const articleUrl = `${baseUrl}${articleHref(article.slug)}`;

    return {
      title: article.title,
      description,
      alternates: { canonical: articleHref(article.slug) },
      openGraph: {
        title: article.title,
        description,
        type: "article",
        url: articleUrl,
        siteName: "WayToIAS — UPSC Current Affairs",
        publishedTime: article.publication_date ?? undefined,
        images: image ? [{ url: image }] : undefined
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description,
        images: image ? [image] : undefined
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
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://waytoias.com";
  const articleUrl = `${baseUrl}${articleHref(article.slug)}`;

  const jsonLdArticle = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: articleDescription(article.body),
    datePublished: article.publication_date,
    dateModified: article.publication_date,
    articleSection: article.category?.name || "General Studies",
    keywords: article.institute_tags ? article.institute_tags.join(", ") : "UPSC, Current Affairs, WayToIAS",
    image: heroAsset?.file_url ? [heroAsset.file_url] : undefined,
    mainEntityOfPage: articleUrl,
    author: {
      "@type": "Organization",
      name: "WayToIAS Research Team",
      url: baseUrl
    },
    publisher: {
      "@type": "Organization",
      name: "WayToIAS",
      url: baseUrl,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/icon.png`
      }
    }
  };

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl
      },
      {
        "@type": "ListItem",
        position: 2,
        name: hub?.shortLabel ?? "Current Affairs",
        item: `${baseUrl}${hub ? `/current-affairs/${hub.path}` : "/current-affairs/daily-news"}`
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: articleUrl
      }
    ]
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-5">
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }} type="application/ld+json" />
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} type="application/ld+json" />
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

      <header className="rounded-lg border border-line bg-surface p-4 shadow-sm md:p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-civic/10 px-2 py-1 text-xs font-bold text-civic">{contentKindLabel(article.content_kind)}</span>
            {article.article_role === "concept" && (
              <span className="rounded-md bg-berry/10 px-2 py-1 text-xs font-bold text-berry">Concept</span>
            )}
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
          {(article.source_name || article.source_url) && (
            <div className="flex items-center gap-2">
              <ExternalLink aria-hidden="true" className="h-4 w-4 text-civic" />
              <dt className="sr-only">Source</dt>
              {/* The source URL was stored but never surfaced — a reader had no
                  way to reach the original piece. Linked when we have one, and
                  still shown as text when only the publication is known. */}
              <dd>
                {article.source_url ? (
                  <a
                    className="font-semibold text-civic underline decoration-civic/40 underline-offset-2 hover:decoration-civic"
                    href={article.source_url}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                  >
                    {article.source_name ?? "Read the original"}
                  </a>
                ) : (
                  article.source_name
                )}
              </dd>
            </div>
          )}
          {article.article_role === "concept" && article.incoming_relations[0] && (
            <div className="flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="h-4 w-4 text-berry" />
              <dt className="sr-only">Last updated</dt>
              <dd>
                Last updated{" "}
                {formatDate(
                  article.incoming_relations[0].source_article.publication_date ??
                    article.incoming_relations[0].source_article.created_at ??
                    null
                )}
              </dd>
            </div>
          )}
        </dl>
      </header>

      <GatedArticleBody article={article} heroAsset={heroAsset} hub={hub} />
    </main>
  );
}
