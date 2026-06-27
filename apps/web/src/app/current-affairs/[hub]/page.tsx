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
  return {
    title: titleParts.join(" — "),
    description: hub.description,
    alternates: { canonical: path },
    openGraph: {
      title: titleParts.join(" — "),
      description: hub.description,
      url: path,
      type: "website"
    }
  };
}

export default async function HubPage({ params, searchParams }: HubPageProps) {
  const [{ hub: hubPath }, query] = await Promise.all([params, searchParams]);
  const hub = getHub(hubPath);
  if (!hub) notFound();

  const category = clean(firstValue(query.category));
  const page = normalizePage(query.page);
  const month = hub.filterMode === "month" ? clean(firstValue(query.month)) : undefined;
  const year = hub.filterMode === "year" ? clean(firstValue(query.year)) : undefined;

  const [filters, articles] = await Promise.all([
    getArticleFilters(hub.contentKind, hub.contentFamily),
    getArticles({ contentKind: hub.contentKind, category, month, year, page })
  ]);

  const isMains = hub.contentFamily === "mains";
  const accentColor = isMains ? "text-saffron" : "text-civic";
  const accentBg = isMains ? "bg-saffron/10" : "bg-civic/10";

  return (
    <main className="list-page mx-auto max-w-7xl px-4 pb-24 pt-5 lg:pb-12">
      {/* Breadcrumb + hub header */}
      <div className="mb-5">
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/current-affairs/daily-news" className="hover:text-civic">Current Affairs</Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span className="font-semibold text-ink">{hub.label}</span>
        </nav>

        {/* Hub Segments / Navigation Tab Bar */}
        <div className="mb-5">
          <div className="inline-flex p-1 bg-paper/70 rounded-xl border border-line/60">
            <Link
              href="/current-affairs/daily-news"
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                !isMains
                  ? "bg-white text-civic shadow-sm border border-line/30"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Prelims
            </Link>
            <Link
              href="/current-affairs/editorial-summary"
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                isMains
                  ? "bg-white text-civic shadow-sm border border-line/30"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Mains
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {!isMains ? (
              <>
                <Link
                  href="/current-affairs/daily-news"
                  className={`inline-flex h-8 items-center rounded-full border px-3.5 text-xs font-bold transition-all ${
                    hub.path === "daily-news"
                      ? "border-civic bg-civic/5 text-civic"
                      : "border-line bg-white text-muted hover:bg-paper"
                  }`}
                >
                  Daily News
                </Link>
                <Link
                  href="/current-affairs/prelims-pyq"
                  className={`inline-flex h-8 items-center rounded-full border px-3.5 text-xs font-bold transition-all ${
                    hub.path === "prelims-pyq"
                      ? "border-civic bg-civic/5 text-civic"
                      : "border-line bg-white text-muted hover:bg-paper"
                  }`}
                >
                  Prelims PYQ
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/current-affairs/editorial-summary"
                  className={`inline-flex h-8 items-center rounded-full border px-3.5 text-xs font-bold transition-all ${
                    hub.path === "editorial-summary"
                      ? "border-civic bg-civic/5 text-civic"
                      : "border-line bg-white text-muted hover:bg-paper"
                  }`}
                >
                  Summaries
                </Link>
                <Link
                  href="/current-affairs/mains-topic-notes"
                  className={`inline-flex h-8 items-center rounded-full border px-3.5 text-xs font-bold transition-all ${
                    hub.path === "mains-topic-notes"
                      ? "border-civic bg-civic/5 text-civic"
                      : "border-line bg-white text-muted hover:bg-paper"
                  }`}
                >
                  Mains Notes
                </Link>
                <Link
                  href="/current-affairs/mains-pyq"
                  className={`inline-flex h-8 items-center rounded-full border px-3.5 text-xs font-bold transition-all ${
                    hub.path === "mains-pyq"
                      ? "border-civic bg-civic/5 text-civic"
                      : "border-line bg-white text-muted hover:bg-paper"
                  }`}
                >
                  Mains PYQ
                </Link>
              </>
            )}
          </div>
        </div>

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

          {/* Desktop inline filters */}
          <div className="hidden sm:block">
            <FilterPanel
              filters={filters}
              hub={hub}
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
            selectedCategory={category}
            selectedMonth={month}
            selectedYear={year}
          />
        </div>
      </div>

      {/* Article count + pagination context */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-muted">
          Page {articles.page} of {articles.total_pages}
        </p>
      </div>

      {/* Main list */}
      <GatedArticleList articles={articles.items} isMains={isMains} />

      {/* Pagination */}
      <div className="mt-5">
        <Pagination
          category={category}
          hub={hub}
          month={month}
          page={articles.page}
          totalPages={articles.total_pages}
          year={year}
        />
      </div>

      {/* Mobile filter sheet */}
      <MobileFilterSheet
        filters={filters}
        hub={hub}
        selectedCategory={category}
        selectedMonth={month}
        selectedYear={year}
      />
    </main>
  );
}
