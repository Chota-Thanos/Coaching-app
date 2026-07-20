"use client";

import { Archive, Eye, FilePenLine, RefreshCw, Search, Trash2, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { AdminArticleDetail, AdminArticleSummary, CategoryNode, CreateAdminArticlePayload } from "../../../lib/api";
import type { ContentKind } from "../../../lib/current-affairs";
import {
  ADMIN_ARTICLE_STATUSES,
  ADMIN_CONTENT_KINDS,
  contentFamilyForKind,
  statusLabel,
  type MasterArticleStatus
} from "../../../lib/admin-current-affairs";
import {
  authenticatedDelete,
  authenticatedGet,
  authenticatedPatch,
  authenticatedPost,
  useAuth
} from "../../auth/auth-context";
import { AdminArticleDetailPanel } from "./admin-article-detail-panel";

type ArticleFilters = {
  contentKind: string;
  status: string;
  categoryNodeId: string;
  search: string;
};

const emptyFilters: ArticleFilters = {
  contentKind: "",
  status: "",
  categoryNodeId: "",
  search: ""
};

function formatDate(value: string | null): string {
  if (!value) return "Undated";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function articleListPath(filters: ArticleFilters, status?: MasterArticleStatus): string {
  const search = new URLSearchParams({ limit: "80", offset: "0" });
  if (filters.contentKind) search.set("content_kind", filters.contentKind);
  if (filters.categoryNodeId) search.set("category_node_id", filters.categoryNodeId);
  if (filters.search.trim()) search.set("search", filters.search.trim());
  if (status) search.set("status", status);
  return `/api/v1/current-affairs/articles?${search}`;
}

function dedupeArticles(records: AdminArticleSummary[]): AdminArticleSummary[] {
  const map = new Map<number, AdminArticleSummary>();
  for (const record of records) map.set(Number(record.id), record);
  return Array.from(map.values()).sort((a, b) => {
    const first = new Date(a.publication_date ?? a.created_at).getTime();
    const second = new Date(b.publication_date ?? b.created_at).getTime();
    return second - first;
  });
}

export function AdminArticleManager({ defaultContentKind = "" }: { defaultContentKind?: string }) {
  const { token } = useAuth();
  const router = useRouter();
  const [articles, setArticles] = useState<AdminArticleSummary[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [filters, setFilters] = useState<ArticleFilters>({
    ...emptyFilters,
    contentKind: defaultContentKind
  });
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<AdminArticleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Bulk actions and Quick edit states
  const [selectedArticleIds, setSelectedArticleIds] = useState<number[]>([]);
  const [bulkReassignOpen, setBulkReassignOpen] = useState(false);
  const [bulkReassignCategoryId, setBulkReassignCategoryId] = useState<string>("");
  const [quickEditingArticle, setQuickEditingArticle] = useState<AdminArticleSummary | null>(null);
  const [quickEditForm, setQuickEditForm] = useState({
    title: "",
    status: "",
    content_kind: "",
    category_node_id: ""
  });
  const [savingQuickEdit, setSavingQuickEdit] = useState(false);

  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const viewId = searchParams.get("view");

  const categoryOptions = useMemo(() => {
    if (!filters.contentKind) return categories;
    const family = contentFamilyForKind(filters.contentKind as ContentKind);
    return categories.filter((category) => category.content_family === family);
  }, [categories, filters.contentKind]);

  const loadCategories = useCallback(async () => {
    if (!token) return;
    const records = await authenticatedGet<CategoryNode[]>("/api/v1/current-affairs/categories?limit=200", token);
    setCategories(records);
  }, [token]);

  const loadArticles = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setMessage(null);
    try {
      const records = filters.status
        ? await authenticatedGet<AdminArticleSummary[]>(articleListPath(filters, filters.status as MasterArticleStatus), token)
        : dedupeArticles((await Promise.all(
          ADMIN_ARTICLE_STATUSES.map((status) => authenticatedGet<AdminArticleSummary[]>(articleListPath(filters, status), token))
        )).flat());
      setArticles(filters.status ? records : records);
    } catch {
      setMessage("Could not load articles.");
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  const loadDetail = useCallback(async (articleId: number) => {
    if (!token) return;
    const detail = await authenticatedGet<AdminArticleDetail>(`/api/v1/current-affairs/admin/articles/${articleId}`, token);
    setSelectedDetail(detail);
    setSelectedArticleId(articleId);
  }, [token]);

  useEffect(() => {
    if (editId && token) {
      const articleId = Number(editId);
      const existing = articles.find((a) => a.id === articleId);

      const getCreatorPath = (kind: string) => {
        switch (kind) {
          case "daily_current_affairs":
            return "/admin/current-affairs/create/daily-news";
          case "daily_editorial_summary":
            return "/admin/current-affairs/create/summaries";
          case "mains_topic_note":
            return "/admin/current-affairs/create/mains-notes";
          case "prelims_pyq":
            return "/admin/current-affairs/create/prelims-pyq";
          case "mains_pyq":
            return "/admin/current-affairs/create/mains-pyq";
          default:
            return "/admin/current-affairs/create/daily-news";
        }
      };

      if (existing) {
        router.push(`${getCreatorPath(existing.content_kind)}?edit=${articleId}`);
      } else {
        const fetchAndRedirect = async () => {
          try {
            const detail = await authenticatedGet<AdminArticleDetail>(`/api/v1/current-affairs/admin/articles/${articleId}`, token);
            if (detail) {
              router.push(`${getCreatorPath(detail.content_kind)}?edit=${articleId}`);
            }
          } catch (err) {
            console.error("Failed to load article detail for URL redirect:", err);
          }
        };
        void fetchAndRedirect();
      }
    }
  }, [editId, articles, token, router]);

  useEffect(() => {
    if (viewId && token) {
      void loadDetail(Number(viewId)).then(() => {
        document.getElementById("article-detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      router.replace(window.location.pathname);
    }
  }, [viewId, token, router, loadDetail]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    setFilters((f) => ({ ...f, contentKind: defaultContentKind }));
  }, [defaultContentKind]);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  async function patchStatus(articleId: number, status: MasterArticleStatus): Promise<void> {
    if (!token) return;
    await authenticatedPatch<AdminArticleSummary>(`/api/v1/current-affairs/articles/${articleId}`, token, { status });
    await loadArticles();
    await loadDetail(articleId);
  }

  async function archiveArticle(articleId: number): Promise<void> {
    if (!token) return;
    await authenticatedPost<AdminArticleSummary>(`/api/v1/current-affairs/articles/${articleId}/archive`, token, {});
    await loadArticles();
    await loadDetail(articleId);
  }

  async function deleteArticle(articleId: number): Promise<void> {
    if (!token || !window.confirm("Delete this current affairs article?")) return;
    await authenticatedDelete<AdminArticleSummary>(`/api/v1/current-affairs/articles/${articleId}`, token);
    setSelectedArticleId(null);
    setSelectedDetail(null);
    await loadArticles();
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedArticleIds(articles.map(a => Number(a.id)));
    } else {
      setSelectedArticleIds([]);
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedArticleIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  async function handleBulkDelete() {
    if (!token || selectedArticleIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete all ${selectedArticleIds.length} selected articles? This action is irreversible.`)) return;

    setLoading(true);
    setMessage(null);
    try {
      for (const id of selectedArticleIds) {
        await authenticatedDelete(`/api/v1/current-affairs/articles/${id}`, token);
      }
      setMessage(`Successfully deleted ${selectedArticleIds.length} articles.`);
      setSelectedArticleIds([]);
      if (selectedArticleId && selectedArticleIds.includes(selectedArticleId)) {
        setSelectedArticleId(null);
        setSelectedDetail(null);
      }
      await loadArticles();
    } catch (err: any) {
      console.error(err);
      setMessage("Error deleting some articles: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkReassign() {
    if (!token || selectedArticleIds.length === 0 || !bulkReassignCategoryId) {
      setMessage("Target category is required.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      for (const id of selectedArticleIds) {
        await authenticatedPatch(`/api/v1/current-affairs/articles/${id}`, token, {
          category_node_id: Number(bulkReassignCategoryId)
        });
      }
      setMessage(`Successfully reassigned ${selectedArticleIds.length} articles.`);
      setSelectedArticleIds([]);
      setBulkReassignOpen(false);
      setBulkReassignCategoryId("");
      await loadArticles();
    } catch (err: any) {
      console.error(err);
      setMessage("Error updating some articles: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  }

  function handleOpenQuickEdit(article: AdminArticleSummary) {
    setQuickEditingArticle(article);
    setQuickEditForm({
      title: article.title,
      status: article.status,
      content_kind: article.content_kind,
      category_node_id: article.category?.id ? String(article.category.id) : ""
    });
  }

  async function handleSaveQuickEdit() {
    if (!token || !quickEditingArticle) return;
    if (!quickEditForm.title.trim()) {
      setMessage("Title is required.");
      return;
    }
    setSavingQuickEdit(true);
    setMessage(null);
    try {
      await authenticatedPatch(`/api/v1/current-affairs/articles/${quickEditingArticle.id}`, token, {
        title: quickEditForm.title.trim(),
        status: quickEditForm.status,
        content_kind: quickEditForm.content_kind,
        category_node_id: quickEditForm.category_node_id ? Number(quickEditForm.category_node_id) : null
      });
      setMessage("Article updated successfully.");
      setQuickEditingArticle(null);
      await loadArticles();
      if (selectedArticleId === quickEditingArticle.id) {
        await loadDetail(quickEditingArticle.id);
      }
    } catch (err: any) {
      console.error(err);
      setMessage("Failed to update article: " + (err.message || err));
    } finally {
      setSavingQuickEdit(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-black text-ink">Article library</h2>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink hover:border-civic transition-all disabled:opacity-60"
            disabled={loading}
            onClick={loadArticles}
            type="button"
          >
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <form
          className="grid gap-4 rounded-2xl border border-line bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr]"
          onSubmit={(event) => {
            event.preventDefault();
            void loadArticles();
          }}
        >
          <label className="grid gap-1.5 text-sm font-bold text-ink">
            Kind
            <select
              className="h-11 rounded-xl border border-line bg-surface px-3 text-base font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
              onChange={(event) => setFilters((current) => ({ ...current, contentKind: event.target.value, categoryNodeId: "" }))}
              value={filters.contentKind}
            >
              <option value="">All kinds</option>
              {ADMIN_CONTENT_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-bold text-ink">
            Status
            <select
              className="h-11 rounded-xl border border-line bg-surface px-3 text-base font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              value={filters.status}
            >
              <option value="">All statuses</option>
              {ADMIN_ARTICLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-bold text-ink">
            Category
            <select
              className="h-11 rounded-xl border border-line bg-surface px-3 text-base font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
              onChange={(event) => setFilters((current) => ({ ...current, categoryNodeId: event.target.value }))}
              value={filters.categoryNodeId}
            >
              <option value="">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-bold text-ink">
            Search
            <span className="flex h-11 items-center rounded-xl border border-line bg-white px-3 focus-within:border-civic focus-within:ring-2 focus-within:ring-civic/20 transition-all">
              <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-civic" />
              <input
                className="min-w-0 flex-1 border-0 bg-transparent px-2 text-base font-normal text-ink outline-none"
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search by title, body, keyword..."
                value={filters.search}
              />
            </span>
          </label>
        </form>

        {message && <p className="rounded-xl border border-line bg-white p-4 text-sm font-semibold text-civic shadow-sm">{message}</p>}

        {/* Select All Checkbox Bar */}
        {articles.length > 0 && (
          <div className="flex items-center justify-between bg-white border border-line px-5 py-3 rounded-2xl shadow-sm animate-in fade-in duration-200">
            <label className="flex items-center gap-2.5 text-xs font-bold text-ink cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4.5 w-4.5 rounded border-line text-civic focus:ring-civic cursor-pointer"
                checked={articles.length > 0 && selectedArticleIds.length === articles.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
              Select All Articles on screen ({articles.length})
            </label>
            {selectedArticleIds.length > 0 && (
              <span className="text-xs text-civic font-black bg-civic/10 px-3 py-1 rounded-full">
                {selectedArticleIds.length} selected
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {articles.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No current affairs articles found in library.
            </p>
          ) : (
            articles.map((article) => {
              const isSelected = selectedArticleIds.includes(Number(article.id));
              return (
                <article
                  className={`rounded-xl border p-4.5 shadow-sm transition-all hover:shadow hover:border-indigo-400 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white ${
                    isSelected 
                      ? "border-indigo-600 bg-indigo-50/10 ring-1 ring-indigo-600/25" 
                      : selectedArticleId === article.id 
                        ? "border-indigo-600 ring-2 ring-indigo-600/10" 
                        : "border-slate-200"
                  }`}
                  key={article.id}
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <input 
                      type="checkbox"
                      className="h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 mt-1"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(Number(article.id))}
                    />
                    
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className={`rounded-md px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wide border ${
                          article.status === 'published' 
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-150' 
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {statusLabel(article.status)}
                        </span>
                        <span className="rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wide text-slate-600">
                          {article.content_kind.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] font-extrabold text-slate-400">
                          ID: #{article.id}
                        </span>
                      </div>
                      
                      <h3 className="text-base font-extrabold leading-snug text-slate-800 line-clamp-1">{article.title}</h3>
                      <p className="text-xs text-slate-500 font-semibold">
                        {formatDate(article.publication_date)} — {article.category?.name ?? "Undefined category"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Actions Column */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0 border-t lg:border-t-0 border-slate-100 pt-3 lg:pt-0">
                    <button
                      className="inline-flex h-8 items-center justify-center gap-1 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-indigo-500 hover:text-indigo-600 transition-all"
                      onClick={() => void loadDetail(article.id)}
                      type="button"
                    >
                      <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                      View
                    </button>
                    <button
                      className="inline-flex h-8 items-center justify-center gap-1 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-indigo-500 hover:text-indigo-600 transition-all"
                      onClick={() => {
                        const getCreatorPath = (kind: string) => {
                          switch (kind) {
                            case "daily_current_affairs":
                              return "/admin/current-affairs/create/daily-news";
                            case "daily_editorial_summary":
                              return "/admin/current-affairs/create/summaries";
                            case "mains_topic_note":
                              return "/admin/current-affairs/create/mains-notes";
                            case "prelims_pyq":
                              return "/admin/current-affairs/create/prelims-pyq";
                            case "mains_pyq":
                              return "/admin/current-affairs/create/mains-pyq";
                            default:
                              return "/admin/current-affairs/create/daily-news";
                          }
                        };
                        router.push(`${getCreatorPath(article.content_kind)}?edit=${article.id}`);
                      }}
                      type="button"
                    >
                      <FilePenLine aria-hidden="true" className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      className="inline-flex h-8 items-center justify-center gap-1 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-indigo-500 hover:text-indigo-600 transition-all"
                      onClick={() => handleOpenQuickEdit(article)}
                      type="button"
                    >
                      <FilePenLine aria-hidden="true" className="h-3.5 w-3.5" />
                      Quick Edit
                    </button>

                    {article.status !== "published" ? (
                      <button
                        className="inline-flex h-8 items-center justify-center rounded-lg bg-indigo-600 px-3.5 text-xs font-bold text-white hover:bg-indigo-700 active:scale-[0.98] transition-all"
                        onClick={() => void patchStatus(article.id, "published")}
                        type="button"
                      >
                        Publish
                      </button>
                    ) : (
                      <button
                        className="inline-flex h-8 items-center justify-center gap-1 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-amber-500 hover:text-amber-600 transition-all"
                        onClick={() => void archiveArticle(article.id)}
                        type="button"
                      >
                        <Archive aria-hidden="true" className="h-3.5 w-3.5" />
                        Archive
                      </button>
                    )}
                    <button
                      className="inline-flex h-8 items-center justify-center gap-1 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-rose-500 hover:text-rose-600 hover:bg-rose-50/50 transition-all"
                      onClick={() => void deleteArticle(article.id)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* Floating Bulk Actions Bar */}
      {selectedArticleIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-ink text-white px-6 py-3.5 rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 border border-white/10 backdrop-blur-md bg-opacity-95">
          <span className="text-xs font-black tracking-wider uppercase text-white/80">
            {selectedArticleIds.length} Article{selectedArticleIds.length > 1 ? "s" : ""} selected
          </span>
          <div className="h-4 w-[1px] bg-white/20" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkReassignOpen(true)}
              className="inline-flex h-8 items-center justify-center px-3.5 rounded-full bg-white/10 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/5 active:scale-[0.98]"
            >
              Reassign Category
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="inline-flex h-8 items-center justify-center px-3.5 rounded-full bg-berry hover:bg-berry/90 text-white text-xs font-bold transition-all border border-berry/20 active:scale-[0.98]"
            >
              Delete Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedArticleIds([])}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all"
              title="Cancel selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Reassign Category Modal */}
      {bulkReassignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-line p-6 animate-in fade-in zoom-in-95 duration-200">
            <button
              className="absolute top-4 right-4 h-8 w-8 rounded-full border border-line bg-white hover:bg-paper text-ink/70 hover:text-ink flex items-center justify-center font-bold text-sm transition-all"
              onClick={() => {
                setBulkReassignOpen(false);
                setBulkReassignCategoryId("");
              }}
              type="button"
            >
              ✕
            </button>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-ink">Reassign Category</h3>
                <p className="text-xs text-ink/60">
                  Select a target category to reassign {selectedArticleIds.length} selected article{selectedArticleIds.length > 1 ? "s" : ""}.
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-ink uppercase tracking-wider">Target Category</label>
                <select
                  className="w-full h-11 rounded-xl border border-line bg-surface px-3 text-base font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                  value={bulkReassignCategoryId}
                  onChange={(e) => setBulkReassignCategoryId(e.target.value)}
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.content_family.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line/60">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setBulkReassignOpen(false);
                    setBulkReassignCategoryId("");
                  }}
                  className="px-4 py-2 text-sm font-bold text-ink/70 hover:text-ink border border-line bg-white hover:bg-paper rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !bulkReassignCategoryId}
                  onClick={handleBulkReassign}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-civic hover:bg-civic/90 text-white text-sm font-bold rounded-xl shadow-sm hover:shadow active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Reassign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Details Modal */}
      {quickEditingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-line p-6 animate-in fade-in zoom-in-95 duration-200">
            <button
              className="absolute top-4 right-4 h-8 w-8 rounded-full border border-line bg-white hover:bg-paper text-ink/70 hover:text-ink flex items-center justify-center font-bold text-sm transition-all"
              onClick={() => setQuickEditingArticle(null)}
              type="button"
            >
              ✕
            </button>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-ink">Quick Edit Details</h3>
                <p className="text-xs text-ink/60">
                  Update main details for article ID #{quickEditingArticle.id}.
                </p>
              </div>
              
              <div className="space-y-4 pt-2">
                <label className="grid gap-1.5 text-xs font-bold text-ink uppercase tracking-wider">
                  Article Title
                  <input
                    type="text"
                    className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all placeholder:text-ink/30"
                    placeholder="Enter article title"
                    value={quickEditForm.title}
                    onChange={(e) => setQuickEditForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-bold text-ink uppercase tracking-wider">
                    Content Kind
                    <select
                      className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                      value={quickEditForm.content_kind}
                      onChange={(e) => setQuickEditForm(prev => ({ ...prev, content_kind: e.target.value }))}
                    >
                      {ADMIN_CONTENT_KINDS.map((kind) => (
                        <option key={kind.value} value={kind.value}>
                          {kind.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1.5 text-xs font-bold text-ink uppercase tracking-wider">
                    Status
                    <select
                      className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                      value={quickEditForm.status}
                      onChange={(e) => setQuickEditForm(prev => ({ ...prev, status: e.target.value }))}
                    >
                      {ADMIN_ARTICLE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-1.5 text-xs font-bold text-ink uppercase tracking-wider">
                  Category
                  <select
                    className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                    value={quickEditForm.category_node_id}
                    onChange={(e) => setQuickEditForm(prev => ({ ...prev, category_node_id: e.target.value }))}
                  >
                    <option value="">No Category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} ({category.content_family.replace(/_/g, " ")})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line/60">
                <button
                  type="button"
                  disabled={savingQuickEdit}
                  onClick={() => setQuickEditingArticle(null)}
                  className="px-4 py-2 text-sm font-bold text-ink/70 hover:text-ink border border-line bg-white hover:bg-paper rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingQuickEdit}
                  onClick={handleSaveQuickEdit}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-civic hover:bg-civic/90 text-white text-sm font-bold rounded-xl shadow-sm hover:shadow active:scale-[0.98] transition-all"
                >
                  {savingQuickEdit && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedDetail && (
        <div id="article-detail-panel">
          <AdminArticleDetailPanel
            article={selectedDetail}
            onRefresh={async () => {
              if (selectedArticleId) await loadDetail(selectedArticleId);
              await loadArticles();
            }}
            onSelectArticleId={loadDetail}
          />
        </div>
      )}
    </div>
  );
}
