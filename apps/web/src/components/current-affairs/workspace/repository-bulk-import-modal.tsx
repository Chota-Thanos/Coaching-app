"use client";

import { Download, Filter, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ArticleFiltersResponse, ArticleListResponse, ArticleSummary, CategoryNode, StudentCollection, StudentFork } from "../../../lib/api";
import { CURRENT_AFFAIRS_HUBS, contentKindLabel, monthLabel, type CurrentAffairsHub } from "../../../lib/current-affairs";
import { authenticatedGet, authenticatedPost, useAuth } from "../../auth/auth-context";

type RepositoryBulkImportModalProps = {
  existingArticleIds: Set<number>;
  open: boolean;
  repository: StudentCollection;
  onClose: () => void;
  onImported: () => Promise<void>;
};

const DEFAULT_HUB = CURRENT_AFFAIRS_HUBS[0] as CurrentAffairsHub;

function dateLabel(value: string | null): string {
  if (!value) return "Undated";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function categoryOptionLabel(category: CategoryNode): string {
  return typeof category.article_count === "number" ? `${category.name} (${category.article_count})` : category.name;
}

export function RepositoryBulkImportModal({
  existingArticleIds,
  open,
  repository,
  onClose,
  onImported
}: RepositoryBulkImportModalProps) {
  const { token, refreshForks } = useAuth();
  const [hubPath, setHubPath] = useState(DEFAULT_HUB.path);
  const [filters, setFilters] = useState<ArticleFiltersResponse | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [subtopicId, setSubtopicId] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeHub = useMemo<CurrentAffairsHub>(() => {
    return CURRENT_AFFAIRS_HUBS.find((hub) => hub.path === hubPath) ?? DEFAULT_HUB;
  }, [hubPath]);

  const familyCategories = useMemo(() => {
    return (filters?.categories ?? []).filter((category) => (
      category.content_family === activeHub.contentFamily && category.is_active !== false
    ));
  }, [activeHub.contentFamily, filters?.categories]);
  const subjects = useMemo(() => {
    return familyCategories.filter((category) => category.node_type === "subject");
  }, [familyCategories]);
  const topics = useMemo(() => {
    return familyCategories.filter((category) => category.node_type === "topic" && String(category.parent_id) === subjectId);
  }, [familyCategories, subjectId]);
  const subtopics = useMemo(() => {
    return familyCategories.filter((category) => category.node_type === "subtopic" && String(category.parent_id) === topicId);
  }, [familyCategories, topicId]);
  const selectedCategoryId = subtopicId || topicId || subjectId;
  const importableArticles = articles.filter((article) => !existingArticleIds.has(Number(article.id)));
  const selectedImportableCount = Array.from(selectedIds).filter((id) => !existingArticleIds.has(id)).length;

  async function loadFilters(nextHub: CurrentAffairsHub): Promise<void> {
    if (!token) return;
    const records = await authenticatedGet<ArticleFiltersResponse>(
      `/api/v1/current-affairs/frontend/filters?content_kind=${nextHub.contentKind}&content_family=${nextHub.contentFamily}`,
      token
    );
    setFilters(records);
    setSubjectId("");
    setTopicId("");
    setSubtopicId("");
    setMonth("");
    setYear("");
  }

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    void loadFilters(activeHub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function changeHub(path: string): Promise<void> {
    const nextHub = CURRENT_AFFAIRS_HUBS.find((hub) => hub.path === path);
    if (!nextHub) return;
    setHubPath(path);
    setArticles([]);
    setSelectedIds(new Set());
    setMessage(null);
    await loadFilters(nextHub);
  }

  function changeSubject(id: string): void {
    setSubjectId(id);
    setTopicId("");
    setSubtopicId("");
    setArticles([]);
    setSelectedIds(new Set());
    setMessage(null);
  }

  function changeTopic(id: string): void {
    setTopicId(id);
    setSubtopicId("");
    setArticles([]);
    setSelectedIds(new Set());
    setMessage(null);
  }

  function changeSubtopic(id: string): void {
    setSubtopicId(id);
    setArticles([]);
    setSelectedIds(new Set());
    setMessage(null);
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
      if (selectedCategoryId) search.set("category", selectedCategoryId);
      if (month) search.set("month", month);
      if (year) search.set("year", year);
      const response = await authenticatedGet<ArticleListResponse>(`/api/v1/current-affairs/frontend/articles?${search}`, token);
      setArticles(response.items);
      setSelectedIds(new Set());
      setMessage(response.items.length === 0 ? "No articles found for these filters." : null);
    } catch {
      setMessage("Could not load articles for these filters.");
    } finally {
      setLoading(false);
    }
  }

  function toggleArticle(id: number): void {
    if (existingArticleIds.has(id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisibleSelection(): void {
    const importableIds = importableArticles.map((article) => Number(article.id));
    const allSelected = importableIds.length > 0 && importableIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of importableIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function importSelected(): Promise<void> {
    if (!token || selectedImportableCount === 0) return;
    const idsToImport = Array.from(selectedIds).filter((id) => !existingArticleIds.has(id));
    setImporting(true);
    setMessage(null);
    try {
      for (const id of idsToImport) {
        await authenticatedPost<StudentFork>(`/api/v1/current-affairs/articles/${id}/fork`, token, {
          collection_id: repository.id
        });
      }
      await refreshForks();
      await onImported();
      setSelectedIds(new Set());
      setMessage(`Imported ${idsToImport.length} article${idsToImport.length === 1 ? "" : "s"} into ${repository.name}.`);
    } catch {
      setMessage("Could not import the selected articles.");
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8">
      <div className="w-full max-w-5xl rounded-lg border border-line bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby="repository-import-title">
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-civic">
              <Download aria-hidden="true" className="h-4 w-4" />
              Bulk fork into repository
            </p>
            <h2 className="mt-1 text-2xl font-black text-ink" id="repository-import-title">
              Import articles to {repository.name}
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              Filter institute articles, select what matters, and fork them into this repository in one action.
            </p>
          </div>
          <button
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-white text-ink hover:border-civic hover:text-civic"
            onClick={onClose}
            type="button"
            aria-label="Close import modal"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 p-5">
          <div className="grid gap-3 rounded-lg border border-line bg-paper/30 p-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink/60">
              1. Section
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink"
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

            <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink/60">
              2. Subject
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink"
                onChange={(event) => changeSubject(event.target.value)}
                value={subjectId}
              >
                <option value="">All subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {categoryOptionLabel(subject)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink/60">
              3. Topic
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink disabled:bg-paper disabled:text-ink/45"
                disabled={!subjectId}
                onChange={(event) => changeTopic(event.target.value)}
                value={topicId}
              >
                <option value="">{subjectId ? "All topics" : "Choose subject first"}</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {categoryOptionLabel(topic)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink/60">
              4. Subtopic
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink disabled:bg-paper disabled:text-ink/45"
                disabled={!topicId}
                onChange={(event) => changeSubtopic(event.target.value)}
                value={subtopicId}
              >
                <option value="">{topicId ? "All subtopics" : "Choose topic first"}</option>
                {subtopics.map((subtopic) => (
                  <option key={subtopic.id} value={subtopic.id}>
                    {categoryOptionLabel(subtopic)}
                  </option>
                ))}
              </select>
            </label>

            {activeHub.filterMode === "month" ? (
              <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink/60">
                5. Month
                <select
                  className="h-11 rounded-md border border-line bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink"
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
              <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink/60">
                5. Year
                <select
                  className="h-11 rounded-md border border-line bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink"
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

            <div className="grid content-end">
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
                disabled={loading}
                onClick={searchArticles}
                type="button"
              >
                <Search aria-hidden="true" className="h-4 w-4" />
                {loading ? "Searching..." : "Show articles"}
              </button>
            </div>
          </div>

          <section className="rounded-lg border border-line bg-white">
            <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-black text-ink">6. Select articles</h3>
                <p className="mt-1 text-sm text-ink/60">
                  {articles.length === 0
                    ? "Use the filters above to load articles."
                    : `${selectedImportableCount} selected from ${importableArticles.length} available results.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {articles.length > 0 && (
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-md border border-civic/30 bg-civic/10 px-3 text-sm font-bold text-civic"
                    disabled={importableArticles.length === 0}
                    onClick={toggleVisibleSelection}
                    type="button"
                  >
                    Select visible
                  </button>
                )}
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic px-3 text-sm font-bold text-white disabled:opacity-60"
                  disabled={importing || selectedImportableCount === 0}
                  onClick={importSelected}
                  type="button"
                >
                  <Download aria-hidden="true" className="h-4 w-4" />
                  {importing ? "Importing..." : "Import selected"}
                </button>
              </div>
            </div>

            {articles.length > 0 ? (
              <div className="grid max-h-[26rem] gap-2 overflow-y-auto p-4">
                {articles.map((article) => {
                  const id = Number(article.id);
                  const alreadyAdded = existingArticleIds.has(id);
                  return (
                    <label
                      className={`flex items-start gap-3 rounded-lg border p-3 ${
                        alreadyAdded
                          ? "border-line bg-paper/60 text-ink/45"
                          : "cursor-pointer border-line bg-white hover:border-civic"
                      }`}
                      key={article.id}
                    >
                      <input
                        checked={selectedIds.has(id)}
                        className="mt-1 h-4 w-4 accent-civic"
                        disabled={alreadyAdded}
                        onChange={() => toggleArticle(id)}
                        type="checkbox"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black leading-snug text-ink">{article.title}</span>
                        <span className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-ink/55">
                          <span>{contentKindLabel(article.content_kind)}</span>
                          <span>{dateLabel(article.publication_date)}</span>
                          {article.category && <span>{article.category.name}</span>}
                          {alreadyAdded && <span className="font-black text-civic">Already in repository</span>}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="p-5 text-sm text-ink/60">No article list loaded yet.</p>
            )}
          </section>

          {message && (
            <p className="rounded-lg border border-civic/20 bg-civic/10 px-3 py-2 text-sm font-semibold text-civic">
              <Filter aria-hidden="true" className="mr-1 inline h-4 w-4" />
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
