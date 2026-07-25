"use client";

import Link from "next/link";
import { ImagePlus, Plus, Trash2, Link2, ExternalLink, RefreshCw, Sparkles, ArrowDownToLine, ArrowUpFromLine, Search, BookOpen, CheckCircle2, X } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import type { FormEvent } from "react";
import type { AdminArticleDetail, AdminArticleSummary, ArticleAsset, CategoryNode, CreateArticleAssetPayload } from "../../../lib/api";
import { articleHref } from "../../../lib/current-affairs";
import { RenderedContent } from "../rendered-content";
import { authenticatedDelete, authenticatedGet, authenticatedPatch, authenticatedPost, useAuth } from "../../auth/auth-context";

type AdminArticleDetailPanelProps = {
  article: AdminArticleDetail | null;
  onRefresh: () => Promise<void>;
  onSelectArticleId?: (id: number) => void;
  onInsertContentToActiveEditor?: (contentHtml: string) => void;
  categories?: CategoryNode[];
};

type AssetState = {
  fileUrl: string;
  altText: string;
  fileName: string;
};

const emptyAsset: AssetState = {
  fileUrl: "",
  altText: "",
  fileName: ""
};

export function AdminArticleDetailPanel({
  article,
  onRefresh,
  onSelectArticleId,
  onInsertContentToActiveEditor,
  categories = []
}: AdminArticleDetailPanelProps) {
  const { token } = useAuth();
  const [asset, setAsset] = useState<AssetState>(emptyAsset);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Relations & backlink state variables
  const [allArticles, setAllArticles] = useState<AdminArticleSummary[]>([]);
  const [targetArticleId, setTargetArticleId] = useState<string>("");
  const [relationType, setRelationType] = useState<string>("related_reference");
  const [relationLabel, setRelationLabel] = useState<string>("");
  const [relationPending, setRelationPending] = useState(false);

  // Filters for relation search
  const [filterSearchQuery, setFilterSearchQuery] = useState("");
  const [filterContentKind, setFilterContentKind] = useState<string>("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");

  // Article role (event/concept) state
  const [roleSaving, setRoleSaving] = useState(false);

  // Concept updates timeline state
  const [conceptUpdates, setConceptUpdates] = useState<any[]>([]);
  const [loadingConceptUpdates, setLoadingConceptUpdates] = useState(false);
  const [newUpdateBody, setNewUpdateBody] = useState("");
  const [savingUpdate, setSavingUpdate] = useState(false);

  // Content Import & Export Modal state
  type RefDirection = "import" | "export";
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [refDirection, setRefDirection] = useState<RefDirection>("import");
  const [refTargetArticle, setRefTargetArticle] = useState<AdminArticleDetail | null>(null);
  const [refLoadingTarget, setRefLoadingTarget] = useState(false);
  const [refSnippet, setRefSnippet] = useState("");
  const [refPending, setRefPending] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      if (!token) return;
      try {
        const res = await authenticatedGet<AdminArticleSummary[]>("/api/v1/current-affairs/articles?limit=150", token);
        setAllArticles(res || []);
      } catch (err) {
        console.error("Error loading articles list for relations:", err);
      }
    };
    void loadAll();
  }, [token]);

  const loadConceptUpdates = async (articleId: number) => {
    if (!token) return;
    setLoadingConceptUpdates(true);
    try {
      const res = await authenticatedGet<any[]>(`/api/v1/current-affairs/articles/${articleId}/updates`, token);
      setConceptUpdates(res || []);
    } catch (err) {
      console.error("Failed to load concept updates:", err);
    } finally {
      setLoadingConceptUpdates(false);
    }
  };

  useEffect(() => {
    if (article && article.article_role === "concept") {
      void loadConceptUpdates(article.id);
    } else {
      setConceptUpdates([]);
    }
    setNewUpdateBody("");
  }, [article?.id, article?.article_role, token]);

  async function toggleArticleRole(nextRole: "event" | "concept"): Promise<void> {
    if (!token || !article || article.article_role === nextRole) return;
    setRoleSaving(true);
    try {
      await authenticatedPatch(`/api/v1/current-affairs/articles/${article.id}`, token, { article_role: nextRole });
      await onRefresh();
    } catch (err) {
      console.error("Failed to update article role:", err);
      setMessage("Could not update article role.");
    } finally {
      setRoleSaving(false);
    }
  }

  async function addConceptUpdate(): Promise<void> {
    if (!token || !article || !newUpdateBody.trim()) return;
    setSavingUpdate(true);
    try {
      await authenticatedPost(`/api/v1/current-affairs/articles/${article.id}/updates`, token, {
        body: newUpdateBody.trim()
      });
      setNewUpdateBody("");
      await loadConceptUpdates(article.id);
    } catch (err) {
      console.error("Failed to add concept update:", err);
      setMessage("Failed to save update.");
    } finally {
      setSavingUpdate(false);
    }
  }

  async function deleteConceptUpdate(updateId: number): Promise<void> {
    if (!token || !article || !window.confirm("Remove this update entry?")) return;
    try {
      await authenticatedDelete(`/api/v1/current-affairs/article-updates/${updateId}`, token);
      await loadConceptUpdates(article.id);
    } catch (err) {
      console.error("Failed to delete concept update:", err);
    }
  }

  async function addRelation(targetId: number, relType: string, label?: string): Promise<void> {
    if (!token || !article) return;
    setRelationPending(true);
    try {
      await authenticatedPost(`/api/v1/current-affairs/articles/${article.id}/relations`, token, {
        target_article_id: targetId,
        relation_type: relType,
        label: label || undefined
      });
      await onRefresh();
      setMessage("Relation added successfully.");
    } catch {
      setMessage("Could not add article relation.");
    } finally {
      setRelationPending(false);
    }
  }

  async function createRelation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!targetArticleId) return;
    await addRelation(Number(targetArticleId), relationType, relationLabel);
    setTargetArticleId("");
    setRelationLabel("");
  }

  // Filter articles by Search Query, Content Kind, and Category
  const filteredRelationTargets = useMemo(() => {
    if (!article) return [];
    const query = filterSearchQuery.trim().toLowerCase();
    return allArticles
      .filter((a) => Number(a.id) !== article.id)
      .filter((a) => filterContentKind === "all" || a.content_kind === filterContentKind)
      .filter((a) => filterCategoryId === "all" || String(a.category?.id) === filterCategoryId)
      .filter((a) => !query || a.title.toLowerCase().includes(query) || (a.category?.name ?? "").toLowerCase().includes(query));
  }, [allArticles, article, filterSearchQuery, filterContentKind, filterCategoryId]);

  async function deleteRelation(relationId: number): Promise<void> {
    if (!token || !window.confirm("Are you sure you want to remove this relation?")) return;
    try {
      await authenticatedDelete(`/api/v1/current-affairs/article-relations/${relationId}`, token);
      await onRefresh();
      setMessage("Relation deleted.");
    } catch {
      setMessage("Could not delete relation.");
    }
  }

  // Open Interactive Content Import / Export Modal
  async function openContentModal(direction: RefDirection, targetId: number) {
    if (!token || !article) return;
    setRefDirection(direction);
    setRefModalOpen(true);
    setRefLoadingTarget(true);
    setRefTargetArticle(null);
    setRefSnippet("");

    try {
      const detail = await authenticatedGet<AdminArticleDetail>(`/api/v1/current-affairs/admin/articles/${targetId}`, token);
      setRefTargetArticle(detail);
      if (direction === "import") {
        setRefSnippet(detail.body || "");
      } else {
        setRefSnippet(article.body || "");
      }
    } catch (err) {
      console.error("Failed to load target article content:", err);
      setMessage("Could not fetch target article content.");
    } finally {
      setRefLoadingTarget(false);
    }
  }

  // Execute Import Content into Active Editor Body
  function handleExecuteImport() {
    if (!refSnippet.trim()) return;
    if (onInsertContentToActiveEditor) {
      onInsertContentToActiveEditor(refSnippet.trim());
      setMessage(`Imported content snippet into active article editor.`);
      setRefModalOpen(false);
    }
  }

  // Execute Export Content into Target Article Body
  async function handleExecuteExport() {
    if (!token || !refTargetArticle || !refSnippet.trim()) return;
    setRefPending(true);
    try {
      const appendedBody = (refTargetArticle.body ? refTargetArticle.body + "\n\n" : "") + refSnippet.trim();
      await authenticatedPatch(`/api/v1/current-affairs/articles/${refTargetArticle.id}`, token, {
        body: appendedBody
      });
      setMessage(`Exported content into '${refTargetArticle.title}'.`);
      setRefModalOpen(false);
      await onRefresh();
    } catch (err) {
      console.error("Failed to export content into target article:", err);
      setMessage("Could not export content to target article.");
    } finally {
      setRefPending(false);
    }
  }

  if (!article) {
    return (
      <section className="rounded-lg border border-dashed border-line bg-surface p-5 text-sm text-ink/65">
        Select an article to manage assets and cross-linking relations.
      </section>
    );
  }

  async function createAsset(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !article || !asset.fileUrl.trim()) return;

    const payload: CreateArticleAssetPayload = {
      asset_type: "image",
      file_name: asset.fileName || asset.altText || "article_image",
      file_url: asset.fileUrl.trim(),
      mime_type: "image/jpeg",
      alt_text: asset.altText.trim() || undefined
    };

    setPending(true);
    setMessage(null);
    try {
      await authenticatedPost(`/api/v1/current-affairs/articles/${article.id}/assets`, token, payload);
      setAsset(emptyAsset);
      await onRefresh();
      setMessage("Image asset added.");
    } catch {
      setMessage("Could not add image asset.");
    } finally {
      setPending(false);
    }
  }

  async function deleteAsset(assetId: number): Promise<void> {
    if (!token) return;
    await authenticatedDelete(`/api/v1/current-affairs/article-assets/${assetId}`, token);
    await onRefresh();
  }

  return (
    <section className="space-y-6">
      {/* Article Meta Bar */}
      <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-civic">Editing Article #{article.id}</span>
          <h2 className="text-lg font-black text-ink">{article.title}</h2>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-bold text-ink/65">{article.status}</span>
            <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-bold text-ink/65">{article.content_kind.replace(/_/g, " ")}</span>
            {article.category && <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-bold text-ink/65">{article.category.name}</span>}
            {article.article_role === "concept" && (
              <span className="rounded bg-berry/10 px-2 py-0.5 text-[10px] font-black uppercase text-berry border border-berry/20">
                Concept Primer
              </span>
            )}
          </div>
        </div>

        {article.status === "published" && (
          <Link
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-bold text-ink hover:border-civic transition-colors"
            href={articleHref(article.slug)}
            target="_blank"
          >
            <ExternalLink className="h-3.5 w-3.5 text-civic" />
            Open Public Page
          </Link>
        )}
      </div>

      {/* 1. COMPRESSED & SIMPLIFIED ASSETS SECTION */}
      <section className="space-y-3 rounded-xl border border-line bg-paper/20 p-4">
        <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-civic" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
              Article Hero Images & Assets ({article.assets.length})
            </h3>
          </div>
          <span className="text-[11px] text-ink/50">Add thumbnail or header images</span>
        </div>

        {/* Compact inline image upload / link form */}
        <form className="grid gap-2.5 sm:grid-cols-12 items-end rounded-xl border border-line bg-surface p-3 shadow-2xs" onSubmit={createAsset}>
          <div className="sm:col-span-6 grid gap-1">
            <label className="text-xs font-bold text-ink">Image File URL or Browse Local File</label>
            <div className="flex items-center gap-2">
              <input
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-xs font-normal text-ink outline-none focus:border-civic"
                onChange={(e) => setAsset((prev) => ({ ...prev, fileUrl: e.target.value }))}
                placeholder="Paste image URL (https://...) or upload file"
                required
                type="url"
                value={asset.fileUrl}
              />
              <label className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-paper px-3 text-xs font-bold text-ink hover:bg-line cursor-pointer">
                <ImagePlus className="h-3.5 w-3.5 text-civic" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const res = evt.target?.result as string;
                      if (res) {
                        setAsset((prev) => ({
                          ...prev,
                          fileUrl: res,
                          fileName: file.name,
                          altText: prev.altText || file.name.replace(/\.[^/.]+$/, "")
                        }));
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </div>
          </div>

          <div className="sm:col-span-4 grid gap-1">
            <label className="text-xs font-bold text-ink">Alt Text (Image Description)</label>
            <input
              className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs font-normal text-ink outline-none focus:border-civic"
              onChange={(e) => setAsset((prev) => ({ ...prev, altText: e.target.value }))}
              placeholder="e.g. Map of Indian Ports"
              type="text"
              value={asset.altText}
            />
          </div>

          <div className="sm:col-span-2">
            <button
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-civic px-3 text-xs font-bold text-white shadow-xs hover:bg-civic/90 transition-all disabled:opacity-60"
              disabled={pending || !asset.fileUrl}
              type="submit"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Image
            </button>
          </div>
        </form>

        {/* Compact Image Cards Grid */}
        {article.assets.length > 0 && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {article.assets.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 shadow-2xs">
                <img
                  src={item.file_url}
                  alt={item.alt_text || item.file_name}
                  className="h-12 w-16 rounded-lg object-cover border border-line bg-paper/40 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h5 className="text-xs font-extrabold text-ink truncate">{item.alt_text || item.file_name || "Image Asset"}</h5>
                  <p className="text-[11px] text-ink/50 truncate font-mono mt-0.5">{item.file_url}</p>
                </div>
                <button
                  onClick={() => void deleteAsset(item.id)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink/50 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  title="Delete Image"
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. RELATIONS & CROSS-LINKING OVERHAUL WITH FILTERS */}
      <section className="space-y-4 rounded-xl border border-line bg-paper/20 p-4">
        <div className="flex items-center gap-2 border-b border-line/60 pb-2.5">
          <Link2 className="h-4 w-4 text-civic" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
            Article Cross-Linking & References
          </h3>
        </div>

        {/* Form to Add Relation with Filters */}
        <form className="grid gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-2xs" onSubmit={createRelation}>
          <div className="grid gap-2 sm:grid-cols-3">
            {/* Filter 1: Title Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" />
              <input
                type="text"
                className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-xs outline-none focus:border-civic"
                placeholder="Search by title..."
                value={filterSearchQuery}
                onChange={(e) => setFilterSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter 2: Content Type / Kind Filter */}
            <select
              className="h-9 rounded-lg border border-line bg-surface px-2.5 text-xs font-normal text-ink outline-none focus:border-civic"
              value={filterContentKind}
              onChange={(e) => setFilterContentKind(e.target.value)}
            >
              <option value="all">All Content Types</option>
              <option value="daily_current_affairs">Daily Current Affairs</option>
              <option value="daily_editorial_summary">Editorial Summaries</option>
              <option value="mains_topic_note">Mains Notes</option>
              <option value="prelims_pyq">Prelims PYQ</option>
              <option value="mains_pyq">Mains PYQ</option>
            </select>

            {/* Filter 3: Category Filter */}
            <select
              className="h-9 rounded-lg border border-line bg-surface px-2.5 text-xs font-normal text-ink outline-none focus:border-civic"
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.name} ({cat.node_type.replace(/_/g, " ")})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs font-bold text-ink sm:col-span-2">
              Select Target Article ({filteredRelationTargets.length} match{filteredRelationTargets.length === 1 ? "" : "es"})
              <select
                className="h-10 rounded-lg border border-line bg-surface px-3 text-xs font-normal text-ink outline-none focus:border-civic"
                onChange={(event) => setTargetArticleId(event.target.value)}
                required
                value={targetArticleId}
              >
                <option value="">-- Choose Article to Link --</option>
                {filteredRelationTargets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.content_kind.replace(/_/g, " ")}{a.article_role === "concept" ? " — Concept" : ""})
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-bold text-ink">
              Relation Type
              <select
                className="h-10 rounded-lg border border-line bg-surface px-3 text-xs font-normal text-ink outline-none focus:border-civic"
                onChange={(event) => setRelationType(event.target.value)}
                required
                value={relationType}
              >
                <option value="related_reference">🔗 Related Reference</option>
                <option value="prerequisite">⭐ Core Concept</option>
                <option value="follow_up">📰 Follow-up News</option>
              </select>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line/60">
            <button
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-civic px-4 text-xs font-bold text-white shadow-xs hover:bg-civic/90 transition-all disabled:opacity-60"
              disabled={relationPending || !targetArticleId}
              type="submit"
            >
              <Plus className="h-3.5 w-3.5" />
              Link Selected Article
            </button>
          </div>
        </form>

        {/* List of Outgoing Relations with Import / Export Content Buttons */}
        <div className="space-y-2">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-ink/70">Outgoing Linked Articles</h4>
          {article.outgoing_relations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-surface/50 p-3 text-xs text-ink/50">
              No articles linked yet. Search and select an article above to link.
            </p>
          ) : (
            <div className="grid gap-2.5">
              {article.outgoing_relations.map((rel) => (
                <div key={rel.id} className="rounded-xl border border-line bg-surface p-3 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="rounded bg-civic/10 px-1.5 py-0.5 text-[10px] font-black uppercase text-civic border border-civic/20">
                        {rel.relation_type.replace(/_/g, " ")}
                      </span>
                      {rel.target_article.article_role === "concept" && (
                        <span className="rounded bg-berry/10 px-1.5 py-0.5 text-[10px] font-black uppercase text-berry border border-berry/20">
                          Concept
                        </span>
                      )}
                    </div>
                    <h5 className="mt-1 text-sm font-extrabold text-ink truncate">{rel.target_article.title}</h5>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {onSelectArticleId && (
                      <button
                        onClick={() => onSelectArticleId(Number(rel.target_article.id))}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-xs font-bold text-ink hover:border-civic hover:text-civic transition-colors"
                        title="Edit Target Article in Workspace"
                        type="button"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Edit Article
                      </button>
                    )}

                    <button
                      onClick={() => openContentModal("import", Number(rel.target_article.id))}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-civic/30 bg-civic/10 px-2.5 text-xs font-bold text-civic hover:bg-civic hover:text-white transition-all"
                      title="Open and Import content from target article into active editor"
                      type="button"
                    >
                      <ArrowDownToLine className="h-3 w-3" />
                      Import Content
                    </button>

                    <button
                      onClick={() => openContentModal("export", Number(rel.target_article.id))}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-berry/30 bg-berry/10 px-2.5 text-xs font-bold text-berry hover:bg-berry hover:text-white transition-all"
                      title="Export content into target article"
                      type="button"
                    >
                      <ArrowUpFromLine className="h-3 w-3" />
                      Export Content
                    </button>

                    <button
                      onClick={() => deleteRelation(rel.id)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-ink/50 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="Remove Relation"
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. CONCEPT UPDATES TIMELINE (Only for Concept articles) */}
      {article.article_role === "concept" && (
        <section className="space-y-3 rounded-xl border border-line bg-paper/20 p-4">
          <div className="flex items-center gap-2 border-b border-line/60 pb-2.5">
            <Sparkles className="h-4 w-4 text-berry" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink">Concept Updates Timeline</h3>
          </div>
          <p className="text-xs text-ink/65 leading-snug">
            Add dated updates as new developments touch this background concept.
          </p>

          <div className="grid gap-2 rounded-xl border border-line bg-surface p-3">
            <textarea
              className="min-h-20 rounded-lg border border-line px-3 py-2 text-xs font-normal outline-none focus:border-civic"
              onChange={(event) => setNewUpdateBody(event.target.value)}
              placeholder="e.g. Ministry of Railways announced second hydrogen train route in Oct 2026..."
              value={newUpdateBody}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void addConceptUpdate()}
                disabled={savingUpdate || !newUpdateBody.trim()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-civic px-3 text-xs font-bold text-white disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                {savingUpdate ? "Saving..." : "Add Concept Update"}
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            {loadingConceptUpdates ? (
              <p className="text-xs text-ink/50 italic py-2">Loading updates...</p>
            ) : conceptUpdates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-surface/50 p-3 text-xs text-ink/50">No updates yet.</p>
            ) : (
              conceptUpdates.map((upd) => (
                <div key={upd.id} className="rounded-xl border border-line bg-surface p-3 shadow-2xs flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase text-berry">
                      {new Date(upd.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                    <p className="text-xs text-ink mt-1 whitespace-pre-wrap leading-relaxed">{upd.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteConceptUpdate(upd.id)}
                    className="text-ink/40 hover:text-rose-600 shrink-0"
                    title="Delete update"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* 4. INTERACTIVE CONTENT IMPORT / EXPORT MODAL OVERLAY */}
      {refModalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-midnight/60 px-4 py-6 overflow-y-auto"
          onClick={() => setRefModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-line bg-surface p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line pb-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-civic">
                  {refDirection === "import" ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                  {refDirection === "import" ? "Content Import System" : "Content Export System"}
                </span>
                <h2 className="text-lg font-black text-ink mt-0.5">
                  {refDirection === "import" ? (
                    <>Import Content from Target Article into Active Editor</>
                  ) : (
                    <>Export Content into Target Article</>
                  )}
                </h2>
              </div>
              <button
                aria-label="Close modal"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink/70 hover:bg-paper"
                onClick={() => setRefModalOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {refLoadingTarget ? (
              <div className="py-12 text-center text-xs text-ink/50 flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-civic" />
                Fetching target article content...
              </div>
            ) : refTargetArticle ? (
              <div className="space-y-4">
                {/* Target Article Banner */}
                <div className="rounded-xl border border-line bg-paper/40 p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-ink/50 uppercase">Target Article #{refTargetArticle.id}</span>
                    <h3 className="text-base font-extrabold text-ink">{refTargetArticle.title}</h3>
                    {refTargetArticle.category && (
                      <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-bold text-ink/65">
                        {refTargetArticle.category.name}
                      </span>
                    )}
                  </div>

                  {onSelectArticleId && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectArticleId(refTargetArticle.id);
                        setRefModalOpen(false);
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-bold text-civic hover:bg-civic/10 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open & Edit in Workspace
                    </button>
                  )}
                </div>

                {/* Target Article Body Rendered Preview */}
                <div className="rounded-xl border border-line bg-surface p-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-ink/70 mb-2">
                    {refDirection === "import" ? "Target Article Content (Read & Select)" : "Target Article Current Body"}
                  </h4>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-line/60 bg-paper/20 p-3 text-sm text-ink leading-relaxed article-body select-text">
                    <RenderedContent content={refTargetArticle.body} />
                  </div>
                </div>

                {/* Snippet Editor */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">
                    {refDirection === "import"
                      ? "Content Snippet to Import into Active Editor Body"
                      : "Content Snippet to Export & Append to Target Article"}
                  </label>
                  <textarea
                    className="min-h-32 w-full rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink outline-none focus:border-civic"
                    onChange={(e) => setRefSnippet(e.target.value)}
                    value={refSnippet}
                  />
                  <p className="text-[11px] text-ink/50">
                    {refDirection === "import"
                      ? "Edit or filter the snippet above. Clicking 'Insert into Active Editor' appends this directly to your main article body."
                      : "Clicking 'Export Content' appends this snippet directly to the target article in the database."}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-line">
                  <button
                    className="h-9 rounded-xl border border-line bg-surface px-4 text-xs font-bold text-ink hover:bg-paper"
                    onClick={() => setRefModalOpen(false)}
                    type="button"
                  >
                    Cancel
                  </button>

                  {refDirection === "import" ? (
                    <button
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-civic px-5 text-xs font-bold text-white shadow-xs hover:bg-civic/90 transition-all disabled:opacity-60"
                      disabled={!refSnippet.trim()}
                      onClick={handleExecuteImport}
                      type="button"
                    >
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                      Insert into Active Editor
                    </button>
                  ) : (
                    <button
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-berry px-5 text-xs font-bold text-white shadow-xs hover:bg-berry/90 transition-all disabled:opacity-60"
                      disabled={refPending || !refSnippet.trim()}
                      onClick={() => void handleExecuteExport()}
                      type="button"
                    >
                      <ArrowUpFromLine className="h-3.5 w-3.5" />
                      {refPending ? "Exporting..." : "Export Content to Target"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-ink/50">Target article not found.</p>
            )}
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-civic/20 bg-civic/5 p-3 text-xs font-semibold text-civic flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {message}
        </div>
      )}
    </section>
  );
}
