"use client";

import { BookOpen, Layers3, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminArticleSummary, CategoryNode } from "../../../lib/api";
import type { ContentFamily } from "../../../lib/current-affairs";
import { adminSlug } from "../../../lib/admin-current-affairs";
import { CascadingParentCategorySelector } from "./cascading-parent-category-selector";
import { authenticatedGet, authenticatedPost, useAuth } from "../../auth/auth-context";

type LinkedConceptsManagerProps = {
  articleId: number | null;
  linkedConcepts: AdminArticleSummary[];
  onConceptsUpdated: (concepts: AdminArticleSummary[]) => void;
  categories: CategoryNode[];
  contentFamily: ContentFamily;
};

export function LinkedConceptsManager({
  articleId,
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
  const [additionalCategoryIds, setAdditionalCategoryIds] = useState<number[]>([]);
  const [savingConcept, setSavingConcept] = useState(false);

  // Search existing concepts state
  const [searchQuery, setSearchQuery] = useState("");
  const [allExistingConcepts, setAllExistingConcepts] = useState<AdminArticleSummary[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [selectedConceptId, setSelectedConceptId] = useState<string>("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleCreateConcept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !conceptTitle.trim() || !conceptBody.trim()) return;

    setSavingConcept(true);
    setErrorMessage(null);

    try {
      // 1. Create the concept article in database
      const payload = {
        content_kind: "daily_current_affairs",
        content_family: contentFamily,
        article_role: "concept",
        title: conceptTitle.trim(),
        slug: conceptSlug || adminSlug(conceptTitle, "concept"),
        body: conceptBody.trim(),
        category_node_id: primaryCategoryId ? Number(primaryCategoryId) : undefined,
        category_node_ids: additionalCategoryIds.length > 0 ? additionalCategoryIds : undefined,
        status: "published"
      };

      const newConcept = await authenticatedPost<AdminArticleSummary>("/api/v1/current-affairs/articles", token, payload);

      // 2. If articleId exists, create the relation link immediately
      if (articleId) {
        await authenticatedPost(`/api/v1/current-affairs/articles/${articleId}/relations`, token, {
          target_article_id: newConcept.id,
          relation_type: "prerequisite",
          label: "Background Concept"
        });
      }

      // 3. Update parent component state
      const updatedList = [...linkedConcepts, newConcept];
      onConceptsUpdated(updatedList);

      // Reset form & close modal
      setConceptTitle("");
      setConceptSlug("");
      setIsSlugManuallyEdited(false);
      setConceptBody("");
      setPrimaryCategoryId("");
      setAdditionalCategoryIds([]);
      setModalOpen(false);
    } catch (err: any) {
      console.error("Error creating concept:", err);
      setErrorMessage(err?.message || "Could not create concept. Check slug uniqueness.");
    } finally {
      setSavingConcept(false);
    }
  };

  const handleLinkExistingConcept = async () => {
    if (!selectedConceptId || !token) return;

    const conceptId = Number(selectedConceptId);
    const conceptObj = allExistingConcepts.find((c) => c.id === conceptId);
    if (!conceptObj) return;

    // Avoid duplicate linking
    if (linkedConcepts.some((c) => c.id === conceptId)) {
      setErrorMessage("This concept is already linked.");
      return;
    }

    try {
      if (articleId) {
        await authenticatedPost(`/api/v1/current-affairs/articles/${articleId}/relations`, token, {
          target_article_id: conceptId,
          relation_type: "prerequisite",
          label: "Background Concept"
        });
      }

      onConceptsUpdated([...linkedConcepts, conceptObj]);
      setSelectedConceptId("");
      setModalOpen(false);
    } catch (err: any) {
      console.error("Error linking concept:", err);
      setErrorMessage("Could not link selected concept.");
    }
  };

  const handleUnlinkConcept = (conceptId: number) => {
    const next = linkedConcepts.filter((c) => c.id !== conceptId);
    onConceptsUpdated(next);
  };

  const filteredConcepts = allExistingConcepts.filter((c) => {
    if (linkedConcepts.some((lc) => lc.id === c.id)) return false;
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
            Linked Concepts & Background Primers
          </h3>
          <p className="text-xs text-ink/60 mt-0.5">
            Attach evergreen concepts. Linked concepts will display on the article page and in category feeds.
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

      {/* Linked Concepts List */}
      {linkedConcepts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface/50 p-4 text-center text-xs text-ink/50">
          No concepts attached to this article yet. Click <strong className="text-ink">"+ Add Concept"</strong> to create a reusable background concept.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {linkedConcepts.map((concept) => (
            <div
              className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface p-3 shadow-2xs"
              key={concept.id}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="rounded bg-berry/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-berry">
                    Concept
                  </span>
                  {concept.category && (
                    <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-bold text-ink/60">
                      {concept.category.name}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-extrabold leading-snug text-ink line-clamp-1">{concept.title}</h4>
                <p className="text-[11px] text-ink/50 font-mono mt-0.5">/current-affairs/articles/{concept.slug}</p>
              </div>
              <button
                aria-label="Remove linked concept"
                className="grid h-7 w-7 shrink-0 place-items-center rounded border border-line bg-surface text-ink/50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                onClick={() => handleUnlinkConcept(concept.id)}
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/60 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-5 shadow-2xl space-y-4">
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

            {/* TAB 1: CREATE NEW CONCEPT */}
            {activeTab === "create" && (
              <form className="space-y-4" onSubmit={handleCreateConcept}>
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
                  Permalink (Auto-generated from title)
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

                <label className="grid gap-1 text-sm font-bold text-ink">
                  Concept Explainer / Background Primer Content
                  <textarea
                    className="min-h-36 rounded-xl border border-line p-3 text-sm font-normal text-ink leading-relaxed outline-none focus:border-berry"
                    onChange={(e) => setConceptBody(e.target.value)}
                    placeholder="Write a clear, evergreen explanation of this concept (e.g. Definition, constitutional provisions, key arguments, way forward)..."
                    required
                    value={conceptBody}
                  />
                </label>

                <div className="flex justify-end gap-2 pt-3 border-t border-line">
                  <button
                    className="h-10 rounded-xl border border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-paper"
                    onClick={() => setModalOpen(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-berry px-5 text-sm font-bold text-white shadow-sm hover:bg-berry/90 disabled:opacity-60"
                    disabled={savingConcept}
                    type="submit"
                  >
                    <BookOpen className="h-4 w-4" />
                    {savingConcept ? "Saving..." : "Save & Link Concept"}
                  </button>
                </div>
              </form>
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
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-berry px-5 text-sm font-bold text-white shadow-sm hover:bg-berry/90 disabled:opacity-60"
                    disabled={!selectedConceptId}
                    onClick={handleLinkExistingConcept}
                    type="button"
                  >
                    <BookOpen className="h-4 w-4" />
                    Link Selected Concept
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
