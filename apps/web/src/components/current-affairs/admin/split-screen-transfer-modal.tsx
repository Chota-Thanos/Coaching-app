"use client";

import { ArrowRight, CheckCircle2, Copy, ExternalLink, Link2, Loader2, Plus, RefreshCw, Save, Search, Sparkles, Wand2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AdminArticleDetail, AdminArticleSummary, CategoryNode } from "../../../lib/api";
import { RichTextMarkdownEditor } from "../rich-text-editor";
import { RenderedContent } from "../rendered-content";
import { authenticatedGet, authenticatedPatch, useAuth } from "../../auth/auth-context";

type SplitScreenTransferModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sourceArticle: {
    id?: number;
    title: string;
    slug: string;
    body: string;
    categoryName?: string;
    contentKind?: string;
  };
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
  allArticles,
  categories,
  initialTargetArticleId,
  onSelectArticleId,
  onRefresh
}: SplitScreenTransferModalProps) {
  const { token } = useAuth();
  
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

  // Selected text snippet from Left Column
  const [selectedText, setSelectedText] = useState("");

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
      .filter((a) => a.id !== sourceArticle.id)
      .filter((a) => filterKind === "all" || a.content_kind === filterKind)
      .filter((a) => filterCategoryId === "all" || String(a.category?.id) === filterCategoryId)
      .filter((a) => !q || a.title.toLowerCase().includes(q) || (a.category?.name ?? "").toLowerCase().includes(q));
  }, [allArticles, sourceArticle.id, filterKind, filterCategoryId, searchQuery]);

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

  // Insert Reference Link HTML into Target Editor
  const handleInsertReferenceLink = () => {
    const refLinkHtml = `<p><a href="/current-affairs/articles/${sourceArticle.slug}">Read more: ${sourceArticle.title}</a></p>`;
    setTargetBody((prev) => (prev ? `${prev}\n\n${refLinkHtml}` : refLinkHtml));
    setMessage(`Inserted reference link to "${sourceArticle.title}" at cursor/end.`);
  };

  // Insert Selected Snippet into Target Editor
  const handleInsertSnippet = (snippetToInsert?: string) => {
    const textToUse = snippetToInsert || selectedText || sourceArticle.body;
    if (!textToUse.trim()) return;
    const formattedSnippet = textToUse.trim().startsWith("<") ? textToUse.trim() : `<p>${textToUse.trim()}</p>`;
    setTargetBody((prev) => (prev ? `${prev}\n\n${formattedSnippet}` : formattedSnippet));
    setMessage(`Inserted content snippet into target note.`);
  };

  // Capture text selected by user in left column
  const handleLeftColumnMouseUp = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      setSelectedText(sel.toString().trim());
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
              <span>{sourceArticle.title || "Current Article"}</span>
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
              <option value="daily_current_affairs">Filter: Daily Current Affairs</option>
              <option value="daily_editorial_summary">Filter: Editorial Summaries</option>
              <option value="all">Filter: All Content Types</option>
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
              <option value="">-- Choose Target Mains Note ({filteredTargets.length}) --</option>
              {filteredTargets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.category?.name ?? "General"})
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
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-ink/70 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-civic"></span>
                  Source Article Context (Left)
                </span>
                {sourceArticle.categoryName && (
                  <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-bold text-ink/65">
                    {sourceArticle.categoryName}
                  </span>
                )}
              </div>

              {/* Quick Transfer Actions */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={!targetDetail}
                  onClick={handleInsertReferenceLink}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-civic/40 bg-civic/10 px-3 text-xs font-bold text-civic hover:bg-civic hover:text-white transition-all disabled:opacity-50"
                  title="Insert a hyperlink referencing this source article into the target note at cursor"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Insert Reference Link at Cursor
                </button>

                <button
                  type="button"
                  disabled={!targetDetail || !selectedText}
                  onClick={() => handleInsertSnippet(selectedText)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-berry/40 bg-berry/10 px-3 text-xs font-bold text-berry hover:bg-berry hover:text-white transition-all disabled:opacity-50"
                  title="Highlight text in the article body below, then click to insert at cursor"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Insert Selected Snippet ({selectedText.length > 0 ? `${selectedText.length} chars` : "Highlight text first"})
                </button>

                <button
                  type="button"
                  disabled={!targetDetail}
                  onClick={() => handleInsertSnippet(sourceArticle.body)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-bold text-ink hover:bg-paper transition-all disabled:opacity-50"
                  title="Append entire source article body to target note"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Append Full Article Body
                </button>
              </div>
            </div>

            {/* Left Content Area with Text Selection */}
            <div
              className="flex-1 p-5 overflow-y-auto select-text article-body leading-relaxed text-sm text-ink bg-surface"
              onMouseUp={handleLeftColumnMouseUp}
            >
              <RenderedContent content={sourceArticle.body} />
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
                  placeholder="The target Mains Note content will appear here. Click any button on the left to insert text or reference links at your cursor..."
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
