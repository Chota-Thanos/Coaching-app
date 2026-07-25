"use client";

import { ArrowRight, CheckCircle2, Copy, ExternalLink, Link2, Loader2, Plus, Save, Search, Wand2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AdminArticleDetail, AdminArticleSummary, CategoryNode } from "../../../lib/api";
import { RichTextMarkdownEditor } from "../rich-text-editor";
import { RenderedContent } from "../rendered-content";
import { authenticatedGet, authenticatedPatch, useAuth } from "../../auth/auth-context";

export type SourceArticleItem = {
  id?: number;
  title: string;
  slug: string;
  body: string;
  categoryName?: string;
  contentKind?: string;
  isConcept?: boolean;
};

type SplitScreenTransferModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sourceArticle: SourceArticleItem;
  linkedConcepts?: SourceArticleItem[];
  allArticles: AdminArticleSummary[];
  categories: CategoryNode[];
  initialTargetArticleId?: number;
  onSelectArticleId?: (id: number) => void;
  onRefresh?: () => Promise<void>;
};

export function SplitScreenTransferModal({
  isOpen,
  onClose,
  sourceArticle,
  linkedConcepts = [],
  allArticles,
  categories,
  initialTargetArticleId,
  onSelectArticleId,
  onRefresh
}: SplitScreenTransferModalProps) {
  const { token } = useAuth();
  
  // Source Selection (Main Article vs Linked Concepts)
  const [selectedSourceId, setSelectedSourceId] = useState<string>("main");

  // Target Article Search & Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKind, setFilterKind] = useState<string>("mains_topic_note"); // Default to Mains Notes as requested
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [targetId, setTargetId] = useState<string>(initialTargetArticleId ? String(initialTargetArticleId) : "");

  // Target Article Detail State
  const [targetDetail, setTargetDetail] = useState<AdminArticleDetail | null>(null);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [targetBody, setTargetBody] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // TipTap editor instance ref for right-hand editor
  const [targetEditor, setTargetEditor] = useState<any>(null);

  // Selected HTML fragment from Left Column (preserves formatting 100%)
  const [selectedHtml, setSelectedHtml] = useState("");

  // Compute active source item (Main Article or chosen Linked Concept)
  const activeSource = useMemo(() => {
    if (!selectedSourceId || selectedSourceId === "main") return sourceArticle;
    const found = linkedConcepts.find((c) => String(c.id) === selectedSourceId);
    return found || sourceArticle;
  }, [selectedSourceId, sourceArticle, linkedConcepts]);

  // Update targetId when initialTargetArticleId prop changes
  useEffect(() => {
    if (initialTargetArticleId) {
      setTargetId(String(initialTargetArticleId));
    }
  }, [initialTargetArticleId]);

  // Load target article details when targetId changes
  useEffect(() => {
    if (!isOpen || !token || !targetId) {
      setTargetDetail(null);
      setTargetBody("");
      setTargetEditor(null);
      return;
    }

    const fetchTarget = async () => {
      setLoadingTarget(true);
      setMessage(null);
      try {
        const detail = await authenticatedGet<AdminArticleDetail>(`/api/v1/current-affairs/admin/articles/${targetId}`, token);
        setTargetDetail(detail);
        setTargetBody(detail.body || "");
      } catch (err) {
        console.error("Failed to load target article detail:", err);
        setMessage("Could not fetch target article content.");
      } finally {
        setLoadingTarget(false);
      }
    };
    void fetchTarget();
  }, [isOpen, token, targetId]);

  // Filtered target articles
  const filteredTargets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allArticles
      .filter((a) => a.id !== activeSource.id)
      .filter((a) => {
        if (filterKind === "concepts") return a.article_role === "concept";
        if (filterKind === "all") return true;
        return a.content_kind === filterKind;
      })
      .filter((a) => filterCategoryId === "all" || String(a.category?.id) === filterCategoryId)
      .filter((a) => !q || a.title.toLowerCase().includes(q) || (a.category?.name ?? "").toLowerCase().includes(q));
  }, [allArticles, activeSource.id, filterKind, filterCategoryId, searchQuery]);

  // Save Target Article Body
  const handleSaveTarget = async () => {
    if (!token || !targetDetail || !targetBody.trim()) return;
    setSavingTarget(true);
    setMessage(null);
    try {
      await authenticatedPatch(`/api/v1/current-affairs/articles/${targetDetail.id}`, token, {
        body: targetBody.trim()
      });
      setMessage(`Successfully saved changes to "${targetDetail.title}".`);
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error("Failed to save target article:", err);
      setMessage("Error saving target article changes.");
    } finally {
      setSavingTarget(false);
    }
  };

  // Insert Inline Reference Link HTML directly at cursor location in target editor (Styled in Blue)
  const handleInsertReferenceLink = () => {
    const inlineRefHtml = `<a href="/current-affairs/articles/${activeSource.slug}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">Read more...</a>`;
    if (targetEditor && !targetEditor.isDestroyed) {
      targetEditor.chain().focus().insertContent(` ${inlineRefHtml}`).run();
      setMessage(`Inserted "Read more..." link for "${activeSource.title}" at active cursor.`);
    } else {
      setTargetBody((prev) => `${prev} ${inlineRefHtml}`);
      setMessage(`Inserted "Read more..." link.`);
    }
  };

  // Insert Content Snippet directly at cursor location preserving full HTML formatting
  const handleInsertSnippet = (snippetToInsert?: string) => {
    const htmlToUse = snippetToInsert || selectedHtml || activeSource.body;
    if (!htmlToUse.trim()) return;

    if (targetEditor && !targetEditor.isDestroyed) {
      targetEditor.chain().focus().insertContent(htmlToUse.trim()).run();
      setMessage(`Inserted formatted content from "${activeSource.title}" at active cursor.`);
    } else {
      setTargetBody((prev) => (prev ? `${prev}\n\n${htmlToUse.trim()}` : htmlToUse.trim()));
      setMessage(`Inserted content snippet.`);
    }
  };

  // Capture selected HTML fragment in left column (maintaining 100% bold, italic, headings & list formatting)
  const handleLeftColumnMouseUp = () => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const container = document.createElement("div");
      container.appendChild(range.cloneContents());
      const htmlContent = container.innerHTML.trim();
      if (htmlContent) {
        setSelectedHtml(htmlContent);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-midnight/70 backdrop-blur-md p-2 sm:p-4 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="flex flex-col h-full w-full max-w-7xl mx-auto rounded-2xl border border-line bg-surface shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper/40 px-5 py-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-civic/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-civic border border-civic/20">
                Split-Screen Content Transfer Workspace
              </span>
              {message && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 animate-in fade-in">
                  <CheckCircle2 className="h-3 w-3" />
                  {message}
                </span>
              )}
            </div>
            <h2 className="text-base font-black text-ink mt-0.5 flex items-center gap-2">
              <span>{activeSource.title || "Current Article"}</span>
              <ArrowRight className="h-4 w-4 text-ink/40" />
              <span className="text-civic">{targetDetail?.title || "Select Target Mains Note"}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {targetDetail && onSelectArticleId && (
              <button
                type="button"
                onClick={() => {
                  onSelectArticleId(targetDetail.id);
                  onClose();
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-bold text-civic hover:bg-civic/10 transition-colors"
                title="Open target article in main editor workspace"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Target Note in Workspace
              </button>
            )}

            <button
              aria-label="Close split screen workspace"
              className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-ink/70 hover:bg-paper hover:text-ink transition-colors"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* TARGET ARTICLE FILTER & SELECTION BAR */}
        <div className="grid gap-2 border-b border-line bg-surface px-5 py-2.5 sm:grid-cols-12 items-center text-xs shrink-0">
          <div className="sm:col-span-3 relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" />
            <input
              type="text"
              className="h-8 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-xs outline-none focus:border-civic"
              placeholder="Search target notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="sm:col-span-3">
            <select
              className="h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-xs font-normal text-ink outline-none focus:border-civic"
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
            >
              <option value="mains_topic_note">Filter: Mains Topic Notes (Recommended)</option>
              <option value="concepts">Filter: Concepts Only (⭐ Concept Primers)</option>
              <option value="daily_current_affairs">Filter: Daily Current Affairs</option>
              <option value="daily_editorial_summary">Filter: Editorial Summaries</option>
              <option value="all">Filter: All Content Types & Concepts</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              className="h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-xs font-normal text-ink outline-none focus:border-civic"
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
            >
              <option value="all">Category: All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.name} ({cat.node_type.replace(/_/g, " ")})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              className="h-8 w-full rounded-lg border border-civic bg-civic/5 px-3 text-xs font-bold text-civic outline-none focus:ring-2 focus:ring-civic/20"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">-- Choose Target Article / Concept ({filteredTargets.length}) --</option>
              {filteredTargets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.article_role === "concept" ? "⭐ Concept: " : ""}{a.title} ({a.category?.name ?? "General"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* MAIN SPLIT-SCREEN 50 / 50 WORKSPACE */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-line min-h-0 overflow-hidden">
          
          {/* LEFT COLUMN (50%): SOURCE ARTICLE CONTENT & QUICK ACTIONS */}
          <div className="flex flex-col h-full min-h-0 bg-paper/10 overflow-hidden">
            {/* Left Header & Actions Bar */}
            <div className="p-3 border-b border-line bg-surface space-y-2 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {linkedConcepts.length > 0 ? (
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <label className="text-xs font-black uppercase tracking-wider text-ink/70 shrink-0">
                      Copy Content From:
                    </label>
                    <select
                      className="h-8 rounded-lg border border-civic bg-civic/5 px-2.5 text-xs font-extrabold text-civic outline-none focus:ring-2 focus:ring-civic/20 min-w-0 flex-1"
                      value={selectedSourceId}
                      onChange={(e) => setSelectedSourceId(e.target.value)}
                    >
                      <option value="main">📰 Current Event: {sourceArticle.title}</option>
                      {linkedConcepts.map((concept) => (
                        <option key={concept.id} value={String(concept.id)}>
                          ⭐ Linked Concept: {concept.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-xs font-black uppercase tracking-wider text-ink/70 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-civic"></span>
                    Source Article Context (Left)
                  </span>
                )}

                {activeSource.categoryName && (
                  <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-bold text-ink/65 shrink-0">
                    {activeSource.categoryName}
                  </span>
                )}
              </div>

              {/* Quick Transfer Actions */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={!targetDetail}
                  onClick={handleInsertReferenceLink}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-600/40 bg-blue-50 px-3 text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50"
                  title={`Insert 'Read more...' blue hyperlink pointing to '${activeSource.title}' directly at cursor`}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Insert "Read more..." Link at Cursor
                </button>

                <button
                  type="button"
                  disabled={!targetDetail || !selectedHtml}
                  onClick={() => handleInsertSnippet(selectedHtml)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-berry/40 bg-berry/10 px-3 text-xs font-bold text-berry hover:bg-berry hover:text-white transition-all disabled:opacity-50"
                  title="Highlight text in the article body below, then click to insert formatted HTML at cursor"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Insert Formatted Snippet at Cursor ({selectedHtml.length > 0 ? "Text Selected" : "Highlight text first"})
                </button>

                <button
                  type="button"
                  disabled={!targetDetail}
                  onClick={() => handleInsertSnippet(activeSource.body)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-bold text-ink hover:bg-paper transition-all disabled:opacity-50"
                  title="Insert entire selected source article body preserving full HTML formatting at active cursor position"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Insert Full Body at Cursor
                </button>
              </div>
            </div>

            {/* Left Content Area with Text Selection */}
            <div
              className="flex-1 p-5 overflow-y-auto select-text article-body leading-relaxed text-sm text-ink bg-surface"
              onMouseUp={handleLeftColumnMouseUp}
            >
              <RenderedContent content={activeSource.body} />
            </div>
          </div>

          {/* RIGHT COLUMN (50%): TARGET MAINS NOTE EDITABLE WORKSPACE */}
          <div className="flex flex-col h-full min-h-0 bg-surface overflow-hidden">
            {/* Right Header Bar */}
            <div className="p-3 border-b border-line bg-surface flex items-center justify-between shrink-0">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-civic flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Target Mains Note Editor (Right)
                </span>
                {targetDetail && (
                  <h3 className="text-sm font-extrabold text-ink truncate max-w-md mt-0.5">
                    {targetDetail.title}
                  </h3>
                )}
              </div>

              {targetDetail && (
                <button
                  type="button"
                  disabled={savingTarget}
                  onClick={handleSaveTarget}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-civic px-4 text-xs font-bold text-white shadow-sm hover:bg-civic/90 transition-all disabled:opacity-60 shrink-0"
                >
                  {savingTarget ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {savingTarget ? "Saving Note..." : "Save Mains Note"}
                </button>
              )}
            </div>

            {/* Right Editor Area */}
            {loadingTarget ? (
              <div className="flex-1 grid place-items-center p-8 text-center text-xs text-ink/50">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-civic" />
                  <span>Loading target note content...</span>
                </div>
              </div>
            ) : targetDetail ? (
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                <RichTextMarkdownEditor
                  label="Target Mains Note Body Content"
                  onChange={(val) => setTargetBody(val)}
                  onEditorReady={(editor) => setTargetEditor(editor)}
                  placeholder="Click anywhere in this note to place your cursor, then click 'Insert Read more...' Link or 'Insert Snippet' on the left to place content right at your cursor..."
                  value={targetBody}
                  minHeightClass="min-h-[420px]"
                />
              </div>
            ) : (
              <div className="flex-1 grid place-items-center p-8 text-center text-xs text-ink/50 bg-paper/20">
                <div className="max-w-sm space-y-2">
                  <Wand2 className="h-8 w-8 text-civic/40 mx-auto" />
                  <h4 className="text-sm font-bold text-ink">Select a Target Mains Note</h4>
                  <p className="text-xs text-ink/60">
                    Use the top dropdown to pick the target Mains Note or article you want to edit side-by-side.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
