"use client";

import { BookOpen, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AdminArticleSummary, CategoryNode } from "../../../lib/api";
import type { ContentFamily } from "../../../lib/current-affairs";
import { adminSlug } from "../../../lib/admin-current-affairs";
import { CascadingParentCategorySelector } from "./cascading-parent-category-selector";
import { RichTextMarkdownEditor } from "../rich-text-editor";
import { authenticatedGet, useAuth } from "../../auth/auth-context";

export type ConceptDraft = {
  id?: number; // if linking an existing concept from DB
  tempId?: string; // if newly created concept in local state
  title: string;
  slug: string;
  body: string;
  categoryNodeId?: string;
  categoryName?: string;
  isNew: boolean;
};

type LinkedConceptsManagerProps = {
  linkedConcepts: ConceptDraft[];
  onConceptsUpdated: (concepts: ConceptDraft[]) => void;
  categories: CategoryNode[];
  contentFamily: ContentFamily;
};

export function LinkedConceptsManager({
  linkedConcepts,
  onConceptsUpdated,
  categories,
  contentFamily
}: LinkedConceptsManagerProps) {
  const { token } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "existing">("create");

  // New Concept Form state
  const [conceptTitle, setConceptTitle] = useState("");
  const [conceptSlug, setConceptSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [conceptBody, setConceptBody] = useState("");
  const [primaryCategoryId, setPrimaryCategoryId] = useState("");

  // Search existing concepts state
  const [searchQuery, setSearchQuery] = useState("");
  const [allExistingConcepts, setAllExistingConcepts] = useState<AdminArticleSummary[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [selectedConceptId, setSelectedConceptId] = useState<string>("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const categoriesById = useMemo(() => new Map(categories.map((c) => [String(c.id), c])), [categories]);

  // Auto-generate slug as concept title changes unless manually modified
  const handleTitleChange = (val: string) => {
    setConceptTitle(val);
    if (!isSlugManuallyEdited) {
      setConceptSlug(adminSlug(val, "concept"));
    }
  };

  const handleSlugChange = (val: string) => {
    setIsSlugManuallyEdited(true);
    setConceptSlug(adminSlug(val, "concept"));
  };

  // Load existing concepts when switching to existing tab or opening modal
  useEffect(() => {
    if (!modalOpen || !token) return;
    const fetchConcepts = async () => {
      setLoadingExisting(true);
      try {
        const res = await authenticatedGet<AdminArticleSummary[]>(
          "/api/v1/current-affairs/articles?article_role=concept&limit=150",
          token
        );
        setAllExistingConcepts(res || []);
      } catch (err) {
        console.error("Failed to load concepts list:", err);
      } finally {
        setLoadingExisting(false);
      }
    };
    void fetchConcepts();
  }, [modalOpen, token]);

  // Client-side local addition of new concept (NO page reload, NO server request yet)
  const handleAddConceptDraft = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!conceptTitle.trim() || !conceptBody.trim()) {
      setErrorMessage("Please provide both Concept Title and Explainer Content.");
      return;
    }

    const categoryObj = primaryCategoryId ? categoriesById.get(primaryCategoryId) : null;
    const newDraft: ConceptDraft = {
      tempId: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: conceptTitle.trim(),
      slug: conceptSlug || adminSlug(conceptTitle, "concept"),
      body: conceptBody.trim(),
      categoryNodeId: primaryCategoryId || undefined,
      categoryName: categoryObj?.name,
      isNew: true
    };

    onConceptsUpdated([...linkedConcepts, newDraft]);

    // Reset form & close modal cleanly
    setConceptTitle("");
    setConceptSlug("");
    setIsSlugManuallyEdited(false);
    setConceptBody("");
    setPrimaryCategoryId("");
    setErrorMessage(null);
    setModalOpen(false);
  };

  // Client-side local linking of existing DB concept
  const handleLinkExistingConcept = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!selectedConceptId) return;

    const conceptId = Number(selectedConceptId);
    const conceptObj = allExistingConcepts.find((c) => c.id === conceptId);
    if (!conceptObj) return;

    if (linkedConcepts.some((c) => c.id === conceptId || c.slug === conceptObj.slug)) {
      setErrorMessage("This concept is already in your linked list.");
      return;
    }

    const draftItem: ConceptDraft = {
      id: conceptObj.id,
      title: conceptObj.title,
      slug: conceptObj.slug,
      body: conceptObj.body || "",
      categoryNodeId: conceptObj.category?.id ? String(conceptObj.category.id) : undefined,
      categoryName: conceptObj.category?.name,
      isNew: false
    };

    onConceptsUpdated([...linkedConcepts, draftItem]);
    setSelectedConceptId("");
    setErrorMessage(null);
    setModalOpen(false);
  };

  const handleRemoveConcept = (index: number) => {
    const next = [...linkedConcepts];
    next.splice(index, 1);
    onConceptsUpdated(next);
  };

  const filteredConcepts = allExistingConcepts.filter((c) => {
    if (linkedConcepts.some((lc) => lc.id === c.id || lc.slug === c.slug)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.title.toLowerCase().includes(q) || (c.category?.name ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3 rounded-xl border border-line bg-paper/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-berry" />
            Linked Concepts & Background Primers ({linkedConcepts.length})
          </h3>
          <p className="text-xs text-ink/60 mt-0.5">
            Attach evergreen concepts. Concepts are stored locally and will be saved & linked when you submit the event.
          </p>
        </div>
        <button
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-berry px-3 text-xs font-bold text-white shadow-xs hover:bg-berry/90 transition-all"
          onClick={() => {
            setErrorMessage(null);
            setModalOpen(true);
          }}
          type="button"
        >
          <Plus className="h-4 w-4" />
          Add Concept
        </button>
      </div>

      {/* Linked Concepts List below the event */}
      {linkedConcepts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface/50 p-4 text-center text-xs text-ink/50">
          No concepts attached to this event yet. Click <strong className="text-ink">"+ Add Concept"</strong> to compose or select a background concept.
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {linkedConcepts.map((concept, index) => (
            <div
              className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-2xs transition-all hover:border-berry/40"
              key={concept.tempId || concept.id || index}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="rounded bg-berry/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-berry">
                    Concept
                  </span>
                  {concept.isNew && (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-700">
                      New Draft
                    </span>
                  )}
                  {concept.categoryName && (
                    <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-bold text-ink/65">
                      {concept.categoryName}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-extrabold leading-snug text-ink line-clamp-1">{concept.title}</h4>
                <p className="text-[11px] text-ink/50 font-mono mt-0.5">/current-affairs/articles/{concept.slug}</p>
                {concept.body && (
                  <p className="mt-1 text-xs text-ink/65 line-clamp-2 leading-relaxed">
                    {concept.body.replace(/<[^>]*>?/gm, "").replace(/^[#*`-\s]+/, "").slice(0, 100)}...
                  </p>
                )}
              </div>
              <button
                aria-label="Remove concept from list"
                className="grid h-7 w-7 shrink-0 place-items-center rounded border border-line bg-surface text-ink/50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                onClick={() => handleRemoveConcept(index)}
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Concept Creation & Linking Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-midnight/60 px-4 py-6 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
              e.preventDefault();
              if (activeTab === "create") {
                handleAddConceptDraft(e);
              } else if (activeTab === "existing") {
                handleLinkExistingConcept(e);
              }
            }
          }}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-line bg-surface p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line pb-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-berry">
                  <Sparkles className="h-4 w-4" />
                  Concept Management
                </span>
                <h2 className="text-xl font-black text-ink mt-1">Add Reusable Background Concept</h2>
              </div>
              <button
                aria-label="Close modal"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink/70 hover:bg-paper"
                onClick={() => setModalOpen(false)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-line gap-2">
              <button
                className={`pb-2.5 px-3 text-sm font-bold transition-all border-b-2 ${
                  activeTab === "create"
                    ? "border-berry text-berry"
                    : "border-transparent text-ink/60 hover:text-ink"
                }`}
                onClick={() => setActiveTab("create")}
                type="button"
              >
                Create New Concept
              </button>
              <button
                className={`pb-2.5 px-3 text-sm font-bold transition-all border-b-2 ${
                  activeTab === "existing"
                    ? "border-berry text-berry"
                    : "border-transparent text-ink/60 hover:text-ink"
                }`}
                onClick={() => setActiveTab("existing")}
                type="button"
              >
                Link Existing Concept
              </button>
            </div>

            {errorMessage && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {errorMessage}
              </p>
            )}

            {/* TAB 1: CREATE NEW CONCEPT WITH RICH TEXT EDITOR */}
            {activeTab === "create" && (
              <div className="space-y-4">
                <label className="grid gap-1 text-sm font-bold text-ink">
                  Concept Title
                  <input
                    className="h-11 rounded-xl border border-line px-3 text-base font-normal text-ink outline-none focus:border-berry"
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. Collegium System & Judicial Appointments"
                    required
                    type="text"
                    value={conceptTitle}
                  />
                </label>

                <label className="grid gap-1 text-xs font-bold text-ink">
                  Permalink (Auto-generated in real-time)
                  <div className="flex h-9 items-center gap-1 overflow-x-auto whitespace-nowrap rounded-lg border border-line bg-paper/40 px-3 text-xs text-ink/60">
                    <span className="shrink-0">/current-affairs/articles/</span>
                    <input
                      className="min-w-0 flex-1 bg-transparent font-mono text-ink outline-none"
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="collegium-system"
                      required
                      type="text"
                      value={conceptSlug}
                    />
                  </div>
                </label>

                <div className="space-y-1">
                  <CascadingParentCategorySelector
                    categories={categories}
                    contentFamily={contentFamily}
                    label="Assigned Primary Category (Step-by-Step)"
                    onChange={(catId) => setPrimaryCategoryId(catId)}
                    value={primaryCategoryId}
                  />
                </div>

                {/* RICH TEXT EDITOR FOR CONCEPT BODY */}
                <div className="space-y-1">
                  <RichTextMarkdownEditor
                    label="Concept Explainer / Background Primer Content"
                    onChange={(val) => setConceptBody(val)}
                    placeholder="Write a comprehensive, evergreen explainer of this concept using rich text formatting..."
                    value={conceptBody}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-line">
                  <button
                    className="h-10 rounded-xl border border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-paper"
                    onClick={() => setModalOpen(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-berry px-5 text-sm font-bold text-white shadow-sm hover:bg-berry/90 transition-all"
                    onClick={handleAddConceptDraft}
                    type="button"
                  >
                    <BookOpen className="h-4 w-4" />
                    Add Concept to Event
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: LINK EXISTING CONCEPT */}
            {activeTab === "existing" && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-ink/40" />
                  <input
                    className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm font-normal text-ink outline-none focus:border-berry"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search existing concepts by title or category..."
                    type="text"
                    value={searchQuery}
                  />
                </div>

                {loadingExisting ? (
                  <p className="py-8 text-center text-xs text-ink/50">Loading existing concepts...</p>
                ) : filteredConcepts.length === 0 ? (
                  <p className="py-8 text-center text-xs text-ink/50">No unlinked concepts found matching your search.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {filteredConcepts.map((concept) => (
                      <label
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                          selectedConceptId === String(concept.id)
                            ? "border-berry bg-berry/5"
                            : "border-line bg-surface hover:border-berry/40"
                        }`}
                        key={concept.id}
                      >
                        <input
                          checked={selectedConceptId === String(concept.id)}
                          className="mt-1 h-4 w-4 accent-berry"
                          name="selected_concept"
                          onChange={() => setSelectedConceptId(String(concept.id))}
                          type="radio"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ink">{concept.title}</span>
                            {concept.category && (
                              <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-ink/60">
                                {concept.category.name}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-ink/50 line-clamp-1 mt-0.5">{concept.slug}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-line">
                  <button
                    className="h-10 rounded-xl border border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-paper"
                    onClick={() => setModalOpen(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-berry px-5 text-sm font-bold text-white shadow-sm hover:bg-berry/90 disabled:opacity-60 transition-all"
                    disabled={!selectedConceptId}
                    onClick={handleLinkExistingConcept}
                    type="button"
                  >
                    <BookOpen className="h-4 w-4" />
                    Add Concept to Event
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
