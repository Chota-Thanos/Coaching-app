import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { GatedArticleList } from "../../../components/current-affairs/gated-article-list";
import { FilterPanel } from "../../../components/current-affairs/filter-panel";
import { MobileFilterSheet } from "../../../components/current-affairs/mobile-filter-sheet";
import { Pagination } from "../../../components/current-affairs/pagination";
import { getArticleFilters, getArticles } from "../../../lib/api";
import { firstValue, getHub, hubHref, normalizePage } from "../../../lib/current-affairs";

export const dynamic = "force-dynamic";

type HubPageProps = {
  params: Promise<{ hub: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function clean(value: string | undefined): string | undefined {
  return value && value !== "all" ? value : undefined;
}

const PAGE_SIZE_OPTIONS = [12, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;

function normalizePageSize(value: string | undefined): number {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed : DEFAULT_PAGE_SIZE;
}

export async function generateMetadata({ params, searchParams }: HubPageProps): Promise<Metadata> {
  const [{ hub: hubPath }, query] = await Promise.all([params, searchParams]);
  const hub = getHub(hubPath);
  if (!hub) return {};

  const category = clean(firstValue(query.category));
  const month = clean(firstValue(query.month));
  const year = clean(firstValue(query.year));
  const titleParts = [hub.label];
  if (month) titleParts.push(month);
  if (year) titleParts.push(year);
  if (category) titleParts.push(category);

  const path = hubHref(hub, { category, month, year, page: normalizePage(query.page) });
  const title = titleParts.join(" — ");

  // Hub pages are what rank for the broad searches ("upsc current affairs"),
  // so they carry the stage-specific terms plus the site-wide ones. A filtered
  // view also carries its own category/month, which is what someone searching
  // "polity current affairs august 2026" is actually after.
  const stageKeywords =
    hub.contentFamily === "mains"
      ? ["current affairs for mains", "UPSC mains current affairs", "editorial analysis", "mains answer writing"]
      : ["current affairs for prelims", "UPSC prelims current affairs", "prelims preparation"];
  const keywords = [
    hub.label,
    ...stageKeywords,
    ...(category ? [`${category} current affairs`, category] : []),
    ...(month ? [`${month} current affairs`] : []),
    ...(year ? [`current affairs ${year}`] : []),
    "current affairs",
    "UPSC current affairs",
    "daily current affairs",
    "UPSC preparation",
    "IAS preparation",
    "WayToIAS",
  ].filter((value, index, all) => all.findIndex((v) => v.toLowerCase() === value.toLowerCase()) === index);

  return {
    title,
    description: hub.description,
    keywords,
    alternates: { canonical: path },
    openGraph: {
      title,
      description: hub.description,
      url: path,
      type: "website",
      siteName: "WayToIAS — UPSC Current Affairs"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: hub.description
    }
  };
}

export default async function HubPage({ params, searchParams }: HubPageProps) {
  const [{ hub: hubPath }, query] = await Promise.all([params, searchParams]);
  const hub = getHub(hubPath);
  if (!hub) notFound();

  const category = clean(firstValue(query.category));
  const page = normalizePage(query.page);
  const perPage = normalizePageSize(firstValue(query.per_page));
  const month = hub.filterMode === "month" ? clean(firstValue(query.month)) : undefined;
  const year = hub.filterMode === "year" ? clean(firstValue(query.year)) : undefined;

  const [filters, articles] = await Promise.all([
    getArticleFilters(hub.contentKind, hub.contentFamily),
    getArticles({ contentKind: hub.contentKind, articleRole: hub.articleRole, category, month, year, page, limit: perPage })
  ]);

  const isMains = hub.contentFamily === "mains";
  const accentColor = isMains ? "text-saffron" : "text-civic";
  const accentBg = isMains ? "bg-saffron/10" : "bg-civic/10";

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://waytoias.com";
  const currentPath = hubHref(hub, { category, month, year, page });
  const fullUrl = `${baseUrl}${currentPath}`;

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
        name: "Current Affairs",
        item: `${baseUrl}/current-affairs/daily-news`
      },
      {
        "@type": "ListItem",
        position: 3,
        name: hub.label,
        item: fullUrl
      }
    ]
  };

  const jsonLdCollection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${hub.label} — WayToIAS UPSC Current Affairs`,
    description: hub.description,
    url: fullUrl,
    publisher: {
      "@type": "Organization",
      name: "WayToIAS",
      url: baseUrl
    }
  };

  return (
    <main className="list-page mx-auto max-w-7xl px-4 pb-24 pt-5 lg:pb-12">
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} type="application/ld+json" />
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdCollection) }} type="application/ld+json" />
      {/* Breadcrumb + hub header */}
      <div className="mb-5">
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/current-affairs/daily-news" className="hover:text-civic">Current Affairs</Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span className="font-semibold text-ink">{hub.label}</span>
        </nav>

        <div className="flex flex-col gap-4 rounded-2xl border border-line/60 bg-surface px-5 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${accentBg}`}>
              {isMains ? "📝" : "📰"}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase tracking-widest ${accentColor}`}>
                  {hub.contentFamily}
                </span>
                <span className="text-xs text-muted">·</span>
                <span className="text-xs font-semibold text-muted">{articles.total} articles</span>
              </div>
              <h1 className="text-lg font-black leading-tight text-ink">{hub.label}</h1>
            </div>
          </div>

          {/* Desktop inline filters — category first, ahead of the content-type tabs below */}
          <div className="hidden sm:block">
            <FilterPanel
              filters={filters}
              hub={hub}
              perPage={perPage}
              selectedCategory={category}
              selectedMonth={month}
              selectedYear={year}
            />
          </div>
        </div>

        {/* Mobile: filter chips row */}
        <div className="mt-3 sm:hidden">
          <FilterPanel
            filters={filters}
            hub={hub}
            perPage={perPage}
            selectedCategory={category}
            selectedMonth={month}
            selectedYear={year}
          />
        </div>

        {/* Hub Segments / Prominent Navigation Tab Bar */}
        <div className="mt-6 space-y-4">
          {/* Main Segmented Mode Switcher (Prelims vs Mains) */}
          <div className="inline-flex items-center gap-1.5 p-1.5 bg-slate-200/90 dark:bg-slate-800/90 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-md">
            <Link
              href="/current-affairs/daily-news"
              className={`rounded-xl px-6 py-2 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                !isMains
                  ? "bg-[#4a3fe0] dark:bg-[#5b5bf5] text-white shadow-lg ring-2 ring-[#4a3fe0]/30 scale-[1.03]"
                  : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/70 dark:hover:bg-slate-700/70"
              }`}
            >
              <span className="text-sm">📰</span> Prelims Hub
            </Link>
            <Link
              href="/current-affairs/editorial-summary"
              className={`rounded-xl px-6 py-2 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                isMains
                  ? "bg-amber-600 dark:bg-amber-500 text-white shadow-lg ring-2 ring-amber-600/30 scale-[1.03]"
                  : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/70 dark:hover:bg-slate-700/70"
              }`}
            >
              <span className="text-sm">📝</span> Mains Hub
            </Link>
          </div>

          {/* Sub-Hub Module Tabs */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] font-mono font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">
              Modules:
            </span>
            {!isMains ? (
              <>
                <Link
                  href="/current-affairs/daily-news"
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all border-2 ${
                    hub.path === "daily-news"
                      ? "border-[#4a3fe0] bg-[#4a3fe0] text-white shadow-md ring-2 ring-[#4a3fe0]/20 scale-[1.02]"
                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-[#4a3fe0] dark:hover:border-[#5b5bf5] hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs"
                  }`}
                >
                  📰 Daily News
                </Link>
                <Link
                  href="/current-affairs/prelims-pyq"
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all border-2 ${
                    hub.path === "prelims-pyq"
                      ? "border-[#4a3fe0] bg-[#4a3fe0] text-white shadow-md ring-2 ring-[#4a3fe0]/20 scale-[1.02]"
                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-[#4a3fe0] dark:hover:border-[#5b5bf5] hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs"
                  }`}
                >
                  ⚡ Prelims PYQ
                </Link>
                <Link
                  href="/current-affairs/concepts"
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all border-2 ${
                    hub.path === "concepts"
                      ? "border-purple-600 bg-purple-600 text-white shadow-md ring-2 ring-purple-600/20 scale-[1.02]"
                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-purple-600 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs"
                  }`}
                >
                  💡 Concepts
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/current-affairs/editorial-summary"
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all border-2 ${
                    hub.path === "editorial-summary"
                      ? "border-amber-600 bg-amber-600 text-white shadow-md ring-2 ring-amber-600/20 scale-[1.02]"
                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-amber-600 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs"
                  }`}
                >
                  📑 Summaries
                </Link>
                <Link
                  href="/current-affairs/mains-topic-notes"
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all border-2 ${
                    hub.path === "mains-topic-notes"
                      ? "border-amber-600 bg-amber-600 text-white shadow-md ring-2 ring-amber-600/20 scale-[1.02]"
                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-amber-600 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs"
                  }`}
                >
                  📝 Mains Notes
                </Link>
                <Link
                  href="/current-affairs/mains-pyq"
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all border-2 ${
                    hub.path === "mains-pyq"
                      ? "border-amber-600 bg-amber-600 text-white shadow-md ring-2 ring-amber-600/20 scale-[1.02]"
                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-amber-600 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs"
                  }`}
                >
                  ⚖️ Mains PYQ
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Article count + pagination context */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted">
          Page {articles.page} of {articles.total_pages} — {articles.total} article{articles.total === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-semibold text-muted">Show:</span>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <Link
              key={size}
              className={`rounded-md px-2 py-1 font-bold transition-all ${
                size === perPage ? "bg-civic text-white" : "border border-line bg-surface text-ink hover:border-civic"
              }`}
              // Changing page size resets to page 1 — the old page number can
              // point past the end, or mid-way through content, once the
              // page holds a different number of articles.
              href={hubHref(hub, { category, month, year, per_page: size, page: 1 })}
            >
              {size}
            </Link>
          ))}
        </div>
      </div>

      {/* Main list */}
      <GatedArticleList articles={articles.items} />

      {/* Pagination */}
      <div className="mt-5">
        <Pagination
          category={category}
          hub={hub}
          month={month}
          page={articles.page}
          perPage={perPage}
          totalPages={articles.total_pages}
          year={year}
        />
      </div>

      {/* Mobile filter sheet */}
      <MobileFilterSheet
        filters={filters}
        hub={hub}
        perPage={perPage}
        selectedCategory={category}
        selectedMonth={month}
        selectedYear={year}
      />
    </main>
  );
}
