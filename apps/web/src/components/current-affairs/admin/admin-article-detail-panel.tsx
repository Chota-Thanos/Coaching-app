"use client";

import Link from "next/link";
import { ImagePlus, Plus, Trash2, Link2, ExternalLink, Sparkles, Search, CheckCircle2, ArrowRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import type { FormEvent } from "react";
import type { AdminArticleDetail, AdminArticleSummary, CategoryNode, CreateArticleAssetPayload } from "../../../lib/api";
import { articleHref } from "../../../lib/current-affairs";
import { authenticatedDelete, authenticatedGet, authenticatedPatch, authenticatedPost, useAuth } from "../../auth/auth-context";
import { SplitScreenTransferModal } from "./split-screen-transfer-modal";

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

  // Concept updates timeline state
  const [conceptUpdates, setConceptUpdates] = useState<any[]>([]);
  const [loadingConceptUpdates, setLoadingConceptUpdates] = useState(false);
  const [newUpdateBody, setNewUpdateBody] = useState("");
  const [savingUpdate, setSavingUpdate] = useState(false);

  // Split-Screen Side-by-Side Transfer Workspace Modal state
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitInitialTargetId, setSplitInitialTargetId] = useState<number | undefined>(undefined);

  useEffect(() => {
    const loadAll = async () => {
      if (!token) return;
      try {
        const res = await authenticatedGet<AdminArticleSummary[]>("/api/v1/current-affairs/articles?limit=300&include_concepts=true", token);
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

  const openSplitScreenForTarget = (targetId?: number) => {
    setSplitInitialTargetId(targetId);
    setSplitModalOpen(true);
  };

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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openSplitScreenForTarget(undefined)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-civic/40 bg-civic/10 px-3 text-xs font-bold text-civic hover:bg-civic hover:text-white transition-all shadow-xs"
            title="Open side-by-side split screen to transfer content & reference links into Mains Notes"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            ↔️ Mains Notes Split-Screen
          </button>

          {article.status === "published" && (
            <Link
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-bold text-ink hover:border-civic transition-colors"
              href={articleHref(article.slug)}
              target="_blank"
            >
              <ExternalLink className="h-3.5 w-3.5 text-civic" />
              Public Page
            </Link>
          )}
        </div>
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

      {/* 2. RELATIONS & CROSS-LINKING OVERHAUL WITH SPLIT-SCREEN TRANSFER */}
      <section className="space-y-4 rounded-xl border border-line bg-paper/20 p-4">
        <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-civic" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
              Article Cross-Linking & References
            </h3>
          </div>

          <button
            type="button"
            onClick={() => openSplitScreenForTarget(undefined)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-civic/40 bg-civic/10 px-3 text-xs font-bold text-civic hover:bg-civic hover:text-white transition-all shadow-xs"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            ↔️ Open Split-Screen Mains Notes Transfer
          </button>
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

        {/* List of Outgoing Relations with Split-Screen Transfer Button */}
        <div className="space-y-2">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-ink/70">Outgoing Linked Articles</h4>
          {article.outgoing_relations.filter((rel) => rel.target_article?.article_role !== "concept" && rel.relation_type !== "prerequisite").length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-surface/50 p-3 text-xs text-ink/50">
              No articles linked yet. Search and select an article above to link.
            </p>
          ) : (
            <div className="grid gap-2.5">
              {article.outgoing_relations.filter((rel) => rel.target_article?.article_role !== "concept" && rel.relation_type !== "prerequisite").map((rel) => (
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
                    <button
                      onClick={() => openSplitScreenForTarget(Number(rel.target_article.id))}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-civic/40 bg-civic/10 px-3 text-xs font-bold text-civic hover:bg-civic hover:text-white transition-all shadow-2xs"
                      title="Open side-by-side split screen to transfer content and reference link at cursor"
                      type="button"
                    >
                      <ArrowRight className="h-3 w-3" />
                      ↔️ Split-Screen Transfer
                    </button>

                    {onSelectArticleId && (
                      <button
                        onClick={() => onSelectArticleId(Number(rel.target_article.id))}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-xs font-bold text-ink hover:border-civic hover:text-civic transition-colors"
                        title="Edit Target Article in Main Workspace"
                        type="button"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Edit Note
                      </button>
                    )}

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

      {/* 4. SIDE-BY-SIDE SPLIT SCREEN WORKSPACE MODAL */}
      <SplitScreenTransferModal
        allArticles={allArticles}
        categories={categories}
        initialTargetArticleId={splitInitialTargetId}
        isOpen={splitModalOpen}
        linkedConcepts={article.outgoing_relations
          .filter((rel) => rel.target_article?.article_role === "concept" || rel.label === "Core Concept" || rel.relation_type === "prerequisite")
          .map((rel) => ({
            id: rel.target_article.id,
            title: rel.target_article.title,
            slug: rel.target_article.slug,
            body: rel.target_article.body,
            categoryName: rel.target_article.category?.name,
            isConcept: true
          }))}
        onClose={() => setSplitModalOpen(false)}
        onRefresh={onRefresh}
        onSelectArticleId={(id) => {
          if (onSelectArticleId) onSelectArticleId(id);
        }}
        sourceArticle={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          body: article.body,
          categoryName: article.category?.name,
          contentKind: article.content_kind
        }}
      />

      {message && (
        <div className="rounded-xl border border-civic/20 bg-civic/5 p-3 text-xs font-semibold text-civic flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {message}
        </div>
      )}
    </section>
  );
}
