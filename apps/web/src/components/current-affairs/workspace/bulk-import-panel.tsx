"use client";

import { Download, Filter, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ArticleFiltersResponse, ArticleListResponse, ArticleSummary, StudentCollection, StudentFork } from "../../../lib/api";
import { CURRENT_AFFAIRS_HUBS, contentKindLabel, monthLabel, type CurrentAffairsHub } from "../../../lib/current-affairs";
import { authenticatedGet, authenticatedPost, useAuth } from "../../auth/auth-context";

type BulkImportPanelProps = {
  collections: StudentCollection[];
  onChanged: () => Promise<void>;
};

type CategoryOption = {
  label: string;
  value: string;
};

const DEFAULT_HUB = CURRENT_AFFAIRS_HUBS[0] as CurrentAffairsHub;

function categoryOptions(filters: ArticleFiltersResponse | null): CategoryOption[] {
  if (!filters) return [];
  return filters.categories.map((category) => ({
    label: category.name,
    value: category.slug || String(category.id)
  }));
}

function dateLabel(value: string | null): string {
  if (!value) return "Undated";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function BulkImportPanel({ collections, onChanged }: BulkImportPanelProps) {
  const { token, refreshForks } = useAuth();
  const [hubPath, setHubPath] = useState(DEFAULT_HUB.path);
  const [filters, setFilters] = useState<ArticleFiltersResponse | null>(null);
  const [category, setCategory] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [collectionId, setCollectionId] = useState(collections[0]?.id ? String(collections[0].id) : "");
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeHub = useMemo<CurrentAffairsHub>(() => {
    return CURRENT_AFFAIRS_HUBS.find((hub) => hub.path === hubPath) ?? DEFAULT_HUB;
  }, [hubPath]);

  const availableCategories = categoryOptions(filters);

  async function loadFilters(nextHub: CurrentAffairsHub): Promise<void> {
    if (!token) return;
    const records = await authenticatedGet<ArticleFiltersResponse>(
      `/api/v1/current-affairs/frontend/filters?content_kind=${nextHub.contentKind}&content_family=${nextHub.contentFamily}`,
      token
    );
    setFilters(records);
    setCategory("");
    setMonth("");
    setYear("");
  }

  async function searchArticles(): Promise<void> {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      if (!filters) {
        await loadFilters(activeHub);
      }
      const search = new URLSearchParams({
        content_kind: activeHub.contentKind,
        page: "1",
        limit: "30"
      });
      if (category) search.set("category", category);
      if (month) search.set("month", month);
      if (year) search.set("year", year);
      const response = await authenticatedGet<ArticleListResponse>(`/api/v1/current-affairs/frontend/articles?${search}`, token);
      setArticles(response.items);
      setSelectedIds(new Set());
      setMessage(response.items.length === 0 ? "No articles found for these filters." : null);
    } catch {
      setMessage("Could not load articles for import.");
    } finally {
      setLoading(false);
    }
  }

  async function changeHub(path: string): Promise<void> {
    const nextHub = CURRENT_AFFAIRS_HUBS.find((hub) => hub.path === path);
    if (!nextHub) return;
    setHubPath(path);
    setArticles([]);
    setSelectedIds(new Set());
    setMessage(null);
    await loadFilters(nextHub);
  }

  function toggleArticle(id: number): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function importSelected(): Promise<void> {
    if (!token || selectedIds.size === 0) return;
    setImporting(true);
    setMessage(null);
    try {
      for (const id of selectedIds) {
        const payload: { collection_id?: number } = {};
        if (collectionId) payload.collection_id = Number(collectionId);
        await authenticatedPost<StudentFork>(`/api/v1/current-affairs/articles/${id}/fork`, token, payload);
      }
      await refreshForks();
      await onChanged();
      setSelectedIds(new Set());
      setMessage(`Imported ${selectedIds.size} article${selectedIds.size === 1 ? "" : "s"}.`);
    } catch {
      setMessage("Could not import the selected articles.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-civic">
            <Download aria-hidden="true" className="h-4 w-4" />
            Bulk import
          </p>
          <h2 className="mt-1 text-lg font-black text-ink">Import institute articles into notes</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/65">
            Filter, select, and save multiple articles into a repository without opening each article.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-civic/30 bg-civic/10 px-3 text-sm font-bold text-civic hover:bg-civic/15"
          disabled={loading}
          onClick={searchArticles}
          type="button"
        >
          <Search aria-hidden="true" className="h-4 w-4" />
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <label className="grid gap-1 text-xs font-bold text-ink/70">
          Section
          <select
            className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
            onChange={(event) => void changeHub(event.target.value)}
            value={hubPath}
          >
            {CURRENT_AFFAIRS_HUBS.map((hub) => (
              <option key={hub.path} value={hub.path}>
                {hub.shortLabel}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-ink/70">
          Subject
          <select
            className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
            onFocus={() => {
              if (!filters) void loadFilters(activeHub);
            }}
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            <option value="">All subjects</option>
            {availableCategories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {activeHub.filterMode === "month" ? (
          <label className="grid gap-1 text-xs font-bold text-ink/70">
            Month
            <select
              className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
              onFocus={() => {
                if (!filters) void loadFilters(activeHub);
              }}
              onChange={(event) => setMonth(event.target.value)}
              value={month}
            >
              <option value="">All months</option>
              {(filters?.months ?? []).map(({ month }) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="grid gap-1 text-xs font-bold text-ink/70">
            Year
            <select
              className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
              onFocus={() => {
                if (!filters) void loadFilters(activeHub);
              }}
              onChange={(event) => setYear(event.target.value)}
              value={year}
            >
              <option value="">All years</option>
              {(filters?.years ?? []).map(({ year }) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-xs font-bold text-ink/70 md:col-span-2">
          Save into
          <select
            className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
            onChange={(event) => setCollectionId(event.target.value)}
            value={collectionId}
          >
            <option value="">Undefined Repo</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {articles.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-ink/70">{selectedIds.size} selected from {articles.length} results</p>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic px-3 text-sm font-bold text-white disabled:opacity-60"
              disabled={importing || selectedIds.size === 0}
              onClick={importSelected}
              type="button"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {importing ? "Importing..." : "Import selected"}
            </button>
          </div>
          <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
            {articles.map((article) => (
              <label
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-paper/30 p-3 hover:border-civic"
                key={article.id}
              >
                <input
                  checked={selectedIds.has(article.id)}
                  className="mt-1 h-4 w-4 accent-civic"
                  onChange={() => toggleArticle(article.id)}
                  type="checkbox"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-black leading-snug text-ink">{article.title}</span>
                  <span className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-ink/55">
                    <span>{contentKindLabel(article.content_kind)}</span>
                    <span>{dateLabel(article.publication_date)}</span>
                    {article.category && <span>{article.category.name}</span>}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {message && (
        <p className="rounded-lg border border-civic/20 bg-civic/8 px-3 py-2 text-sm font-semibold text-civic">
          <Filter aria-hidden="true" className="mr-1 inline h-4 w-4" />
          {message}
        </p>
      )}
    </section>
  );
}
