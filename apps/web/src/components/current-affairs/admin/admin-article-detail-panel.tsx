"use client";

import Link from "next/link";
import { ImagePlus, Layers3, Plus, Trash2, Link2, ExternalLink, FileText, RefreshCw, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { AdminArticleDetail, AdminArticleSummary, ArticleAsset, ArticleSection, CreateArticleAssetPayload } from "../../../lib/api";
import { ARTICLE_ASSET_TYPES, adminSlug, type ArticleAssetType } from "../../../lib/admin-current-affairs";
import { articleHref } from "../../../lib/current-affairs";
import { authenticatedDelete, authenticatedGet, authenticatedPatch, authenticatedPost, useAuth } from "../../auth/auth-context";

type AdminArticleDetailPanelProps = {
  article: AdminArticleDetail | null;
  onRefresh: () => Promise<void>;
  onSelectArticleId?: (id: number) => void;
};

type SectionState = {
  heading: string;
  slug: string;
  body: string;
  seoDescription: string;
};

type AssetState = {
  assetType: ArticleAssetType;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  altText: string;
  caption: string;
};

const emptySection: SectionState = {
  heading: "",
  slug: "",
  body: "",
  seoDescription: ""
};

const emptyAsset: AssetState = {
  assetType: "image",
  fileName: "",
  fileUrl: "",
  mimeType: "",
  altText: "",
  caption: ""
};

function sectionSummary(section: ArticleSection): string {
  return section.body.length > 110 ? `${section.body.slice(0, 110).trim()}...` : section.body;
}

const RELATION_TYPE_EXPLANATIONS: Record<string, string> = {
  related_reference: "Intra-article reference: Links standard related articles for cross-referencing. Renders as 'Related reading' on the student details page.",
  base_current_affairs: "Base Current Affairs: Links a Mains Daily Editorial summary to its corresponding factual Prelims Current Affairs article base.",
  imported_source: "Imported Source (Notes content import): Links a Mains Topic-wise Note to an imported base article, whose contents can then be embedded into note sections.",
  follow_up: "Follow Up: Links an older article to a newer article detailing further sequential developments on the same topic.",
  prerequisite: "Prerequisite: Recommends foundational background articles or concepts the student should read before starting this page.",
  mains_fodder: "Mains Fodder: Links a fact-filled Prelims article containing case studies, graphs, or key quotes to be used as fodder in Mains writing.",
  pyq_context: "PYQ Context: Links a Past Year Question (PYQ) to the modern current affairs explanation or issue that prompted/contextualizes it."
};

export function AdminArticleDetailPanel({ article, onRefresh, onSelectArticleId }: AdminArticleDetailPanelProps) {
  const { token } = useAuth();
  const [section, setSection] = useState<SectionState>(emptySection);
  const [asset, setAsset] = useState<AssetState>(emptyAsset);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Relations & backlink state variables
  const [allArticles, setAllArticles] = useState<AdminArticleSummary[]>([]);
  const [targetArticleId, setTargetArticleId] = useState<string>("");
  const [relationType, setRelationType] = useState<string>("related_reference");
  const [relationLabel, setRelationLabel] = useState<string>("");
  const [relationNote, setRelationNote] = useState<string>("");
  const [relationPending, setRelationPending] = useState(false);
  const [relationConceptsOnly, setRelationConceptsOnly] = useState(false);

  // Article role (event/concept) state
  const [roleSaving, setRoleSaving] = useState(false);

  // Concept updates timeline state
  const [conceptUpdates, setConceptUpdates] = useState<any[]>([]);
  const [loadingConceptUpdates, setLoadingConceptUpdates] = useState(false);
  const [newUpdateBody, setNewUpdateBody] = useState("");
  const [savingUpdate, setSavingUpdate] = useState(false);

  // Backlink Modal states
  const [backlinkModalOpen, setBacklinkModalOpen] = useState(false);
  const [backlinkDestArticle, setBacklinkDestArticle] = useState<{ id: number; title: string; slug: string } | null>(null);
  const [backlinkDestSections, setBacklinkDestSections] = useState<ArticleSection[]>([]);
  const [selectedDestSectionId, setSelectedDestSectionId] = useState<string>("");
  const [backlinkContent, setBacklinkContent] = useState("");
  const [backlinkLoadingSections, setBacklinkLoadingSections] = useState(false);
  const [backlinkPending, setBacklinkPending] = useState(false);

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

  async function createRelation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !article || !targetArticleId) return;

    setRelationPending(true);
    try {
      await authenticatedPost(`/api/v1/current-affairs/articles/${article.id}/relations`, token, {
        target_article_id: Number(targetArticleId),
        relation_type: relationType,
        label: relationLabel || undefined,
        note: relationNote || undefined
      });
      setTargetArticleId("");
      setRelationLabel("");
      setRelationNote("");
      await onRefresh();
      setMessage("Relation added successfully.");
    } catch {
      setMessage("Could not add article relation.");
    } finally {
      setRelationPending(false);
    }
  }

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

  async function openBacklinkModal(destId: number, destTitle: string, destSlug: string) {
    if (!token || !article) return;
    setBacklinkDestArticle({ id: destId, title: destTitle, slug: destSlug });
    setBacklinkModalOpen(true);
    setBacklinkLoadingSections(true);
    setSelectedDestSectionId("");
    setBacklinkContent(`<p>See also: <a href="/current-affairs/articles/${article.slug}">${article.title}</a></p>`);
    
    try {
      const detail = await authenticatedGet<AdminArticleDetail>(`/api/v1/current-affairs/admin/articles/${destId}`, token);
      setBacklinkDestSections(detail.sections || []);
    } catch (err) {
      console.error("Failed to load sections for destination article:", err);
      setBacklinkDestSections([]);
    } finally {
      setBacklinkLoadingSections(false);
    }
  }

  async function submitBacklink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !backlinkDestArticle) return;
    
    setBacklinkPending(true);
    try {
      await authenticatedPost(`/api/v1/current-affairs/articles/${backlinkDestArticle.id}/insert-content`, token, {
        content: backlinkContent,
        section_id: selectedDestSectionId ? Number(selectedDestSectionId) : undefined
      });
      setBacklinkModalOpen(false);
      setBacklinkDestArticle(null);
      await onRefresh();
      setMessage(`Backlink successfully inserted into '${backlinkDestArticle.title}'`);
    } catch (err) {
      console.error(err);
      setMessage("Could not insert backlink.");
    } finally {
      setBacklinkPending(false);
    }
  }

  if (!article) {
    return (
      <section className="rounded-lg border border-dashed border-line bg-white p-5 text-sm text-ink/65">
        Select an article to manage sections and assets.
      </section>
    );
  }

  async function createSection(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !article) return;

    setPending(true);
    setMessage(null);
    try {
      await authenticatedPost(`/api/v1/current-affairs/articles/${article.id}/sections`, token, {
        heading: section.heading,
        slug: section.slug || adminSlug(section.heading, "section"),
        body: section.body,
        seo_description: section.seoDescription || undefined,
        is_active: true
      });
      setSection(emptySection);
      await onRefresh();
      setMessage("Section added.");
    } catch {
      setMessage("Could not add section.");
    } finally {
      setPending(false);
    }
  }

  async function createAsset(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !article) return;

    const payload: CreateArticleAssetPayload = {
      asset_type: asset.assetType,
      file_name: asset.fileName,
      file_url: asset.fileUrl,
      mime_type: asset.mimeType || undefined,
      alt_text: asset.altText || undefined,
      caption: asset.caption || undefined
    };

    setPending(true);
    setMessage(null);
    try {
      await authenticatedPost(`/api/v1/current-affairs/articles/${article.id}/assets`, token, payload);
      setAsset(emptyAsset);
      await onRefresh();
      setMessage("Asset added.");
    } catch {
      setMessage("Could not add asset.");
    } finally {
      setPending(false);
    }
  }

  async function deleteSection(sectionId: number): Promise<void> {
    if (!token) return;
    await authenticatedDelete(`/api/v1/current-affairs/article-sections/${sectionId}`, token);
    await onRefresh();
  }

  async function deleteAsset(assetId: number): Promise<void> {
    if (!token) return;
    await authenticatedDelete(`/api/v1/current-affairs/article-assets/${assetId}`, token);
    await onRefresh();
  }

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-civic">Selected article</p>
        <h2 className="mt-2 text-xl font-black leading-snug text-ink">{article.title}</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-md bg-paper px-2 py-1 text-ink/65">{article.status}</span>
          <span className="rounded-md bg-paper px-2 py-1 text-ink/65">{article.content_kind.replace(/_/g, " ")}</span>
          {article.category && <span className="rounded-md bg-paper px-2 py-1 text-ink/65">{article.category.name}</span>}
          {article.article_role === "concept" && (
            <span className="rounded-md bg-berry/10 px-2 py-1 text-berry">Concept</span>
          )}
        </div>

        {article.content_kind === "daily_current_affairs" && (
          <div className="mt-3 grid gap-1.5">
            <span className="text-xs font-bold text-ink">Article role</span>
            <div className="grid w-fit grid-cols-2 gap-1.5 rounded-lg border border-line bg-surface p-1">
              <button
                type="button"
                disabled={roleSaving}
                onClick={() => void toggleArticleRole("event")}
                className={`h-8 rounded-md px-4 text-xs font-bold transition-all disabled:opacity-60 ${
                  article.article_role === "event" ? "bg-civic text-white shadow-sm" : "text-ink/60 hover:bg-white"
                }`}
              >
                Event
              </button>
              <button
                type="button"
                disabled={roleSaving}
                onClick={() => void toggleArticleRole("concept")}
                className={`h-8 rounded-md px-4 text-xs font-bold transition-all disabled:opacity-60 ${
                  article.article_role === "concept" ? "bg-civic text-white shadow-sm" : "text-ink/60 hover:bg-white"
                }`}
              >
                Concept
              </button>
            </div>
          </div>
        )}

        {article.status === "published" && (
          <Link className="mt-4 inline-flex h-10 items-center rounded-md border border-line bg-white px-3 text-sm font-bold text-ink hover:border-civic" href={articleHref(article.slug)}>
            Open public page
          </Link>
        )}
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers3 aria-hidden="true" className="h-5 w-5 text-civic" />
          <h3 className="text-lg font-black text-ink">Sections</h3>
        </div>
        <form className="grid gap-3 rounded-lg border border-line bg-white p-4" onSubmit={createSection}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold text-ink">
              Heading
              <input
                className="h-11 rounded-md border border-line px-3 text-base font-normal"
                onBlur={() => setSection((current) => ({ ...current, slug: current.slug || adminSlug(current.heading, "section") }))}
                onChange={(event) => setSection((current) => ({ ...current, heading: event.target.value }))}
                required
                value={section.heading}
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">
              Slug
              <input
                className="h-11 rounded-md border border-line px-3 text-base font-normal"
                onChange={(event) => setSection((current) => ({ ...current, slug: adminSlug(event.target.value, "section") }))}
                required
                value={section.slug}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-bold text-ink">
            SEO description
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onChange={(event) => setSection((current) => ({ ...current, seoDescription: event.target.value }))}
              value={section.seoDescription}
            />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink">
            Body
            <textarea
              className="min-h-28 rounded-md border border-line px-3 py-2 text-base font-normal leading-6"
              onChange={(event) => setSection((current) => ({ ...current, body: event.target.value }))}
              value={section.body}
            />
          </label>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add section
          </button>
        </form>

        <div className="grid gap-3">
          {article.sections.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-white p-4 text-sm text-ink/65">No sections added.</p>
          ) : (
            article.sections.map((item) => (
              <article className="rounded-lg border border-line bg-white p-4 shadow-sm" key={item.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h4 className="text-base font-extrabold leading-snug text-ink">{item.heading}</h4>
                    <p className="mt-1 text-sm text-ink/65">{sectionSummary(item)}</p>
                  </div>
                  <button
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink hover:border-berry hover:text-berry"
                    onClick={() => void deleteSection(item.id)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ImagePlus aria-hidden="true" className="h-5 w-5 text-civic" />
          <h3 className="text-lg font-black text-ink">Assets</h3>
        </div>
        <form className="grid gap-3 rounded-lg border border-line bg-white p-4" onSubmit={createAsset}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold text-ink">
              Asset type
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
                onChange={(event) => setAsset((current) => ({ ...current, assetType: event.target.value as ArticleAssetType }))}
                value={asset.assetType}
              >
                {ARTICLE_ASSET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">
              File name
              <input
                className="h-11 rounded-md border border-line px-3 text-base font-normal"
                onChange={(event) => setAsset((current) => ({ ...current, fileName: event.target.value }))}
                required
                value={asset.fileName}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-bold text-ink">
            File URL
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onChange={(event) => setAsset((current) => ({ ...current, fileUrl: event.target.value }))}
              required
              type="url"
              value={asset.fileUrl}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold text-ink">
              MIME type
              <input
                className="h-11 rounded-md border border-line px-3 text-base font-normal"
                onChange={(event) => setAsset((current) => ({ ...current, mimeType: event.target.value }))}
                value={asset.mimeType}
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">
              Alt text
              <input
                className="h-11 rounded-md border border-line px-3 text-base font-normal"
                onChange={(event) => setAsset((current) => ({ ...current, altText: event.target.value }))}
                value={asset.altText}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-bold text-ink">
            Caption
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onChange={(event) => setAsset((current) => ({ ...current, caption: event.target.value }))}
              value={asset.caption}
            />
          </label>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            <ImagePlus aria-hidden="true" className="h-4 w-4" />
            Add asset
          </button>
        </form>

        <div className="grid gap-3">
          {article.assets.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-white p-4 text-sm text-ink/65">No assets added.</p>
          ) : (
            article.assets.map((item: ArticleAsset) => (
              <article className="rounded-lg border border-line bg-white p-4 shadow-sm" key={item.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h4 className="truncate text-base font-extrabold leading-snug text-ink">{item.file_name}</h4>
                    <p className="mt-1 break-all text-sm text-ink/65">{item.file_url}</p>
                    <p className="mt-1 text-xs font-bold text-civic">{item.asset_type.replace(/_/g, " ")}</p>
                  </div>
                  <button
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink hover:border-berry hover:text-berry"
                    onClick={() => void deleteAsset(item.id)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Link2 aria-hidden="true" className="h-5 w-5 text-civic" />
          <h3 className="text-lg font-black text-ink">Relations & Cross-Linking</h3>
        </div>
        
        {/* Form to Add Relation */}
        <form className="grid gap-3 rounded-lg border border-line bg-white p-4" onSubmit={createRelation}>
          <label className="flex items-center gap-2 text-xs font-bold text-ink/75 cursor-pointer">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-line accent-civic"
              checked={relationConceptsOnly}
              onChange={(e) => setRelationConceptsOnly(e.target.checked)}
            />
            Concepts only (reusable topic primers)
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold text-ink">
              Related Article
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
                onChange={(event) => setTargetArticleId(event.target.value)}
                required
                value={targetArticleId}
              >
                <option value="">-- Choose Article --</option>
                {allArticles
                  .filter((a) => Number(a.id) !== article.id)
                  .filter((a) => !relationConceptsOnly || a.article_role === "concept")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.content_kind.replace(/_/g, " ")}{a.article_role === "concept" ? " — Concept" : ""})
                    </option>
                  ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">
              Relation Type
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
                onChange={(event) => setRelationType(event.target.value)}
                required
                value={relationType}
              >
                <option value="related_reference">Related Reference</option>
                <option value="base_current_affairs">Base Current Affairs</option>
                <option value="imported_source">Imported Source</option>
                <option value="follow_up">Follow Up</option>
                <option value="prerequisite">Prerequisite</option>
                <option value="mains_fodder">Mains Fodder</option>
                <option value="pyq_context">PYQ Context</option>
              </select>
            </label>
          </div>

          <div className="bg-civic/5 border border-civic/10 p-3 rounded-lg text-xs leading-relaxed text-civic font-semibold">
            💡 <strong>Relation Explanation:</strong> {RELATION_TYPE_EXPLANATIONS[relationType] || "Select a relation type."}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold text-ink">
              Label (optional)
              <input
                className="h-11 rounded-md border border-line px-3 text-base font-normal"
                onChange={(event) => setRelationLabel(event.target.value)}
                placeholder="e.g. Critical Follow-up on Data Bill"
                value={relationLabel}
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">
              Note (optional)
              <input
                className="h-11 rounded-md border border-line px-3 text-base font-normal"
                onChange={(event) => setRelationNote(event.target.value)}
                placeholder="Internal memo or context note"
                value={relationNote}
              />
            </label>
          </div>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
            disabled={relationPending || !targetArticleId}
            type="submit"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add Relation
          </button>
        </form>

        {/* List of Outgoing Relations */}
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-ink">Outgoing Relations (Referenced by this article)</h4>
          {article.outgoing_relations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-white p-4 text-xs text-ink/65">
              This article does not reference any other articles.
            </p>
          ) : (
            <div className="grid gap-3">
              {article.outgoing_relations.map((rel) => (
                <div key={rel.id} className="rounded-lg border border-line bg-white p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded bg-civic/10 px-1.5 py-0.5 text-[10px] font-bold text-civic uppercase">
                        {rel.relation_type.replace(/_/g, " ")}
                      </span>
                      {rel.label && (
                        <span className="text-xs font-semibold text-ink/70">
                          ({rel.label})
                        </span>
                      )}
                      {rel.target_article.article_role === "concept" && (
                        <span className="rounded bg-berry/10 px-1.5 py-0.5 text-[10px] font-bold text-berry uppercase">
                          Concept
                        </span>
                      )}
                    </div>
                    <h5 className="mt-1 text-sm font-extrabold text-ink truncate">{rel.target_article.title}</h5>
                    {rel.note && <p className="text-xs text-ink/65 mt-0.5 italic">{rel.note}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {onSelectArticleId && (
                      <button
                        onClick={() => onSelectArticleId(Number(rel.target_article.id))}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink hover:border-civic transition-all"
                        type="button"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open Article
                      </button>
                    )}
                    <button
                      onClick={() => openBacklinkModal(Number(rel.target_article.id), rel.target_article.title, rel.target_article.slug)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-civic px-3 text-xs font-bold text-white hover:bg-civic/90 transition-all"
                      type="button"
                    >
                      <Link2 className="h-3 w-3" />
                      Insert Link Back
                    </button>
                    <button
                      onClick={() => deleteRelation(rel.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink hover:border-berry hover:text-berry"
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

        {/* List of Incoming Relations */}
        <div className="space-y-2 mt-4">
          <h4 className="text-sm font-bold text-ink">Incoming Relations (Referencing this article)</h4>
          {article.incoming_relations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-white p-4 text-xs text-ink/65">
              No other articles reference this article.
            </p>
          ) : (
            <div className="grid gap-3">
              {article.incoming_relations.map((rel) => (
                <div key={rel.id} className="rounded-lg border border-line bg-white p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded bg-civic/10 px-1.5 py-0.5 text-[10px] font-bold text-civic uppercase">
                        {rel.relation_type.replace(/_/g, " ")}
                      </span>
                      {rel.label && (
                        <span className="text-xs font-semibold text-ink/70">
                          ({rel.label})
                        </span>
                      )}
                      {rel.source_article.article_role === "concept" && (
                        <span className="rounded bg-berry/10 px-1.5 py-0.5 text-[10px] font-bold text-berry uppercase">
                          Concept
                        </span>
                      )}
                    </div>
                    <h5 className="mt-1 text-sm font-extrabold text-ink truncate">{rel.source_article.title}</h5>
                    {rel.note && <p className="text-xs text-ink/65 mt-0.5 italic">{rel.note}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {onSelectArticleId && (
                      <button
                        onClick={() => onSelectArticleId(Number(rel.source_article.id))}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink hover:border-civic transition-all"
                        type="button"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open Article
                      </button>
                    )}
                    <button
                      onClick={() => openBacklinkModal(Number(rel.source_article.id), rel.source_article.title, rel.source_article.slug)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-civic px-3 text-xs font-bold text-white hover:bg-civic/90 transition-all"
                      type="button"
                    >
                      <Link2 className="h-3 w-3" />
                      Insert Link Back
                    </button>
                    <button
                      onClick={() => deleteRelation(rel.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink hover:border-berry hover:text-berry"
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

      {article.article_role === "concept" && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="h-5 w-5 text-berry" />
            <h3 className="text-lg font-black text-ink">Concept Updates Timeline</h3>
          </div>
          <p className="text-xs text-ink/55 leading-snug -mt-2">
            Add dated updates as new developments touch this concept, instead of creating a duplicate article. Every article linking here shows the latest update automatically.
          </p>

          <div className="grid gap-2 rounded-lg border border-line bg-white p-4">
            <textarea
              className="min-h-20 rounded-md border border-line px-3 py-2 text-sm font-normal leading-6"
              onChange={(event) => setNewUpdateBody(event.target.value)}
              placeholder="e.g. Ministry of Railways announced a second hydrogen train route in Oct 2026..."
              value={newUpdateBody}
            />
            <button
              type="button"
              onClick={() => void addConceptUpdate()}
              disabled={savingUpdate || !newUpdateBody.trim()}
              className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {savingUpdate ? "Saving..." : "Add update"}
            </button>
          </div>

          <div className="grid gap-2">
            {loadingConceptUpdates ? (
              <p className="text-xs text-ink/50 italic">Loading updates...</p>
            ) : conceptUpdates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-white p-3 text-xs text-ink/65">No updates yet.</p>
            ) : (
              conceptUpdates.map((upd) => (
                <div key={upd.id} className="rounded-lg border border-line bg-white p-3 shadow-xs flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-berry uppercase">
                      {new Date(upd.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                    <p className="text-xs text-ink mt-1 whitespace-pre-wrap">{upd.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteConceptUpdate(upd.id)}
                    className="text-rose-500 hover:text-rose-700 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Backlink Insertion Modal Overlay */}
      {backlinkModalOpen && backlinkDestArticle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 backdrop-blur-sm p-4 overflow-y-auto">
          <form 
            onSubmit={submitBacklink} 
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-line p-6 animate-in fade-in zoom-in-95 duration-200 space-y-4"
          >
            <button
              className="absolute top-4 right-4 h-8 w-8 rounded-full border border-line bg-white hover:bg-paper text-ink/70 hover:text-ink flex items-center justify-center font-bold text-sm transition-all"
              onClick={() => {
                setBacklinkModalOpen(false);
                setBacklinkDestArticle(null);
              }}
              type="button"
            >
              ✕
            </button>
            
            <div>
              <h3 className="text-lg font-black text-ink flex items-center gap-2">
                <Link2 className="h-5 w-5 text-civic" />
                Insert Backlink & Content
              </h3>
              <p className="text-xs text-ink/60 mt-1">
                Insert a backlink pointing to the current article <strong>"{article.title}"</strong> into the target article <strong>"{backlinkDestArticle.title}"</strong>.
              </p>
            </div>

            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Select Target Placement Area
              {backlinkLoadingSections ? (
                <div className="flex items-center gap-2 text-ink/65 text-xs py-2 bg-paper/50 rounded px-3 border border-line">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-civic" />
                  <span>Loading article sections...</span>
                </div>
              ) : (
                <select
                  value={selectedDestSectionId}
                  onChange={(e) => setSelectedDestSectionId(e.target.value)}
                  className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-normal outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                >
                  <option value="">Main Body (Append to end)</option>
                  {backlinkDestSections.map(sec => (
                    <option key={sec.id} value={sec.id}>
                      Section: {sec.heading}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Backlink HTML Content to Insert
              <textarea
                value={backlinkContent}
                onChange={(e) => setBacklinkContent(e.target.value)}
                required
                className="min-h-[120px] rounded-lg border border-line p-3 font-mono text-xs outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                placeholder="HTML to append, e.g. <p>See also: <a href=&quot;/current-affairs/articles/slug&quot;>Title</a></p>"
              />
            </label>

            <div className="flex gap-3 justify-end pt-4 border-t border-line">
              <button
                type="button"
                className="h-10 px-4 rounded-lg border border-line font-bold text-xs text-ink hover:bg-paper"
                onClick={() => {
                  setBacklinkModalOpen(false);
                  setBacklinkDestArticle(null);
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={backlinkPending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-civic px-4 text-xs font-bold text-white shadow-md hover:bg-civic/90 transition-all"
              >
                {backlinkPending && <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />}
                Insert Backlink
              </button>
            </div>
          </form>
        </div>
      )}

      {message && <p className="rounded-lg border border-line bg-white p-3 text-sm font-semibold text-civic">{message}</p>}
    </section>
  );
}
