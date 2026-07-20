"use client";

import { Brain, Save, Loader2, CheckCircle2, FileText } from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { AdminArticleDetail, ArticleRole, CategoryNode, CreateAdminArticlePayload } from "../../../lib/api";
import type { ContentKind } from "../../../lib/current-affairs";
import {
  ADMIN_ARTICLE_STATUSES,
  ADMIN_CONTENT_KINDS,
  adminSlug,
  contentFamilyForKind,
  splitAdminTags,
  statusLabel,
  type MasterArticleStatus
} from "../../../lib/admin-current-affairs";
import { authenticatedGet, authenticatedPatch, authenticatedDelete, useAuth } from "../../auth/auth-context";
import { RichTextMarkdownEditor } from "../rich-text-editor";
import { ArticleCreatorAiWorkspace } from "./article-creator-ai-workspace";
import { CascadingCategorySelector } from "./cascading-category-selector";
import { AdminArticleDetailPanel } from "./admin-article-detail-panel";

type AdminArticleCreatorProps = {
  categories: CategoryNode[];
  pending: boolean;
  onSubmit: (payload: CreateAdminArticlePayload) => Promise<{ id: number } | void>;
  message: string | null;
  createType?: "daily-news" | "summaries" | "mains-notes" | "prelims-pyq" | "mains-pyq";
};

type FormState = {
  title: string;
  slug: string;
  contentKind: ContentKind;
  articleRole: ArticleRole;
  status: MasterArticleStatus;
  categoryNodeId: string;
  publicationDate: string;
  sourceName: string;
  sourceUrl: string;
  tags: string;
  body: string;
  isAiGenerated: boolean;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  keywords: string;
  // PYQ Fields
  year: string;
  questionStatement: string;
  suppQuestionStatement: string;
  questionPrompt: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string;
  wordLimit: string;
  maxMarks: string;
  answerApproach: string;
  modelAnswer: string;
};

const initialForm = (kind: ContentKind): FormState => ({
  title: "",
  slug: "",
  contentKind: kind,
  articleRole: "event",
  status: "published", // Default to published as requested
  categoryNodeId: "",
  publicationDate: new Date().toISOString().slice(0, 10),
  sourceName: "",
  sourceUrl: "",
  tags: "",
  body: "",
  isAiGenerated: false,
  seoTitle: "",
  seoDescription: "",
  canonicalUrl: "",
  keywords: "",
  year: new Date().getFullYear().toString(),
  questionStatement: "",
  suppQuestionStatement: "",
  questionPrompt: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctAnswer: "A",
  explanation: "",
  wordLimit: "250",
  maxMarks: "15",
  answerApproach: "",
  modelAnswer: ""
});

export function AdminArticleCreator({ categories, pending, onSubmit, message, createType }: AdminArticleCreatorProps) {
  const { token } = useAuth();
  const router = useRouter();
  
  const defaultKind = useMemo(() => {
    if (createType === "daily-news") return "daily_current_affairs";
    if (createType === "prelims-pyq") return "prelims_pyq";
    if (createType === "summaries") return "daily_editorial_summary";
    if (createType === "mains-notes") return "mains_topic_note";
    if (createType === "mains-pyq") return "mains_pyq";
    return "daily_current_affairs";
  }, [createType]);

  const [formState, setFormState] = useState<FormState>(initialForm(defaultKind));
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  const [editingArticleDetail, setEditingArticleDetail] = useState<AdminArticleDetail | null>(null);

  const [allDrafts, setAllDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [successLink, setSuccessLink] = useState<{ href: string; label: string } | null>(null);

  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const allowedKinds = useMemo(() => {
    if (createType === "daily-news") {
      return ADMIN_CONTENT_KINDS.filter(k => k.value === "daily_current_affairs");
    }
    if (createType === "prelims-pyq") {
      return ADMIN_CONTENT_KINDS.filter(k => k.value === "prelims_pyq");
    }
    if (createType === "summaries") {
      return ADMIN_CONTENT_KINDS.filter(k => k.value === "daily_editorial_summary");
    }
    if (createType === "mains-notes") {
      return ADMIN_CONTENT_KINDS.filter(k => k.value === "mains_topic_note");
    }
    if (createType === "mains-pyq") {
      return ADMIN_CONTENT_KINDS.filter(k => k.value === "mains_pyq");
    }
    return ADMIN_CONTENT_KINDS;
  }, [createType]);

  // Compute filtered drafts during rendering to keep loadDrafts stable
  const drafts = useMemo(() => {
    const kinds = new Set(allowedKinds.map(k => k.value));
    return allDrafts.filter(art => kinds.has(art.content_kind));
  }, [allDrafts, allowedKinds]);

  // Load all drafts for draft list
  const loadDrafts = useCallback(async () => {
    if (!token) return;
    setLoadingDrafts(true);
    try {
      const res = await authenticatedGet<any[]>("/api/v1/current-affairs/articles?status=draft&limit=100", token);
      setAllDrafts(res || []);
    } catch (err) {
      console.error("Failed to load drafts:", err);
    } finally {
      setLoadingDrafts(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void loadDrafts();
  }, [token, loadDrafts]);

  // Reset content kind to default kind when createType changes
  useEffect(() => {
    setFormState(initialForm(defaultKind));
    setEditingDraftId(null);
    setEditingArticleDetail(null);
  }, [defaultKind]);

  // Reset success link when form fields are modified
  useEffect(() => {
    setSuccessLink(null);
  }, [formState.title, formState.slug, formState.body]);

  const family = contentFamilyForKind(formState.contentKind);
  const categoryOptions = useMemo(
    () => categories.filter((category) => category.content_family === family && category.is_active !== false),
    [categories, family]
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  const handleEditDraft = async (draftId: number) => {
    if (!token) return;
    try {
      const detail = await authenticatedGet<AdminArticleDetail>(`/api/v1/current-affairs/admin/articles/${draftId}`, token);
      if (detail) {
        setEditingDraftId(detail.id);
        setEditingArticleDetail(detail);

        const bodyJson: any = (detail as any).body_json || {};
        
        setFormState({
          title: detail.title,
          slug: detail.slug,
          contentKind: detail.content_kind,
          articleRole: detail.article_role || "event",
          status: detail.status,
          categoryNodeId: detail.category?.id ? String(detail.category.id) : "",
          publicationDate: detail.publication_date ? detail.publication_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          sourceName: detail.source_name || "",
          sourceUrl: detail.source_url || "",
          tags: Array.isArray(detail.institute_tags) ? detail.institute_tags.join(", ") : "",
          body: detail.body || "",
          isAiGenerated: detail.is_ai_generated || false,
          seoTitle: detail.seo_title || "",
          seoDescription: detail.seo_description || "",
          canonicalUrl: detail.canonical_url || "",
          keywords: Array.isArray(detail.keywords) ? detail.keywords.join(", ") : "",
          
          year: bodyJson.year || new Date().getFullYear().toString(),
          questionStatement: bodyJson.question_statement || "",
          suppQuestionStatement: bodyJson.supp_question_statement || "",
          questionPrompt: bodyJson.question_prompt || "",
          optionA: bodyJson.options?.[0]?.text || "",
          optionB: bodyJson.options?.[1]?.text || "",
          optionC: bodyJson.options?.[2]?.text || "",
          optionD: bodyJson.options?.[3]?.text || "",
          correctAnswer: bodyJson.correct_answer || "A",
          explanation: bodyJson.explanation || "",
          wordLimit: String(bodyJson.word_limit || 250),
          maxMarks: String(bodyJson.max_marks || 15),
          answerApproach: bodyJson.answer_approach || "",
          modelAnswer: bodyJson.model_answer || ""
        });

        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      console.error("Failed to load draft detail:", err);
    }
  };

  // Lightweight refresh for the embedded connections panel — does not touch
  // formState, so it won't clobber in-progress, unsaved title/body edits.
  const refreshEditingArticleDetail = useCallback(async () => {
    if (!token || !editingDraftId) return;
    try {
      const detail = await authenticatedGet<AdminArticleDetail>(`/api/v1/current-affairs/admin/articles/${editingDraftId}`, token);
      setEditingArticleDetail(detail);
    } catch (err) {
      console.error("Failed to refresh article detail:", err);
    }
  }, [token, editingDraftId]);

  const loadedEditIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (editId && token && loadedEditIdRef.current !== editId) {
      loadedEditIdRef.current = editId;
      void handleEditDraft(Number(editId));
      // Clean query parameter from URL using Next.js router
      router.replace(window.location.pathname);
    }
  }, [editId, token, router]);

  const handleDeleteDraft = async (draftId: number) => {
    if (!token || !window.confirm("Are you sure you want to delete this draft?")) return;
    try {
      await authenticatedDelete(`/api/v1/current-affairs/articles/${draftId}`, token);
      if (editingDraftId === draftId) {
        setEditingDraftId(null);
        setEditingArticleDetail(null);
        setFormState(initialForm(defaultKind));
      }
      void loadDrafts();
    } catch (err) {
      console.error("Failed to delete draft:", err);
    }
  };

  const handlePublishDraftDirectly = async (draftId: number) => {
    if (!token) return;
    try {
      await authenticatedPatch(`/api/v1/current-affairs/articles/${draftId}`, token, { status: "published" });
      if (editingDraftId === draftId) {
        void refreshEditingArticleDetail();
        updateField("status", "published");
      }
      void loadDrafts();
    } catch (err) {
      console.error("Failed to publish draft:", err);
    }
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    let finalBody = formState.body;
    let finalBodyJson: any = undefined;

    if (formState.contentKind === "prelims_pyq") {
      finalBodyJson = {
        year: formState.year,
        question_statement: formState.questionStatement,
        supp_question_statement: formState.suppQuestionStatement || undefined,
        question_prompt: formState.questionPrompt || undefined,
        options: [
          { label: "A", text: formState.optionA },
          { label: "B", text: formState.optionB },
          { label: "C", text: formState.optionC },
          { label: "D", text: formState.optionD }
        ],
        correct_answer: formState.correctAnswer,
        explanation: formState.explanation
      };
      
      finalBody = `### Year: ${formState.year}\n\n**${formState.questionStatement}**\n\n${formState.suppQuestionStatement ? `${formState.suppQuestionStatement}\n\n` : ""}${formState.questionPrompt ? `${formState.questionPrompt}\n\n` : ""}(a) ${formState.optionA}\n(b) ${formState.optionB}\n(c) ${formState.optionC}\n(d) ${formState.optionD}\n\n**Correct Answer: (${formState.correctAnswer})**\n\n### Explanation\n${formState.explanation}`;
    } else if (formState.contentKind === "mains_pyq") {
      finalBodyJson = {
        year: formState.year,
        question_statement: formState.questionStatement,
        word_limit: Number(formState.wordLimit) || 250,
        max_marks: Number(formState.maxMarks) || 15,
        answer_approach: formState.answerApproach,
        model_answer: formState.modelAnswer
      };
      
      finalBody = `### Year: ${formState.year} | Marks: ${formState.maxMarks} | Word Limit: ${formState.wordLimit}\n\n**${formState.questionStatement}**\n\n### Answer Approach\n${formState.answerApproach}\n\n### Model Answer\n${formState.modelAnswer}`;
    }

    const payload: CreateAdminArticlePayload & { body_json?: any } = {
      content_kind: formState.contentKind,
      article_role: formState.contentKind === "daily_current_affairs" ? formState.articleRole : "event",
      title: formState.title,
      slug: formState.slug || adminSlug(formState.title),
      body: finalBody,
      body_json: finalBodyJson,
      category_node_id: formState.categoryNodeId ? Number(formState.categoryNodeId) : undefined,
      source_name: formState.sourceName.trim() || undefined,
      source_url: formState.sourceUrl.trim() || undefined,
      publication_date: formState.publicationDate || undefined,
      institute_tags: splitAdminTags(formState.tags),
      status: formState.status,
      is_ai_generated: formState.isAiGenerated,
      seo_title: formState.seoTitle.trim() || undefined,
      seo_description: formState.seoDescription.trim() || undefined,
      canonical_url: formState.canonicalUrl.trim() || undefined,
      keywords: splitAdminTags(formState.keywords)
    };

    if (editingDraftId) {
      if (!token) return;
      try {
        await authenticatedPatch(`/api/v1/current-affairs/articles/${editingDraftId}`, token, payload);

        setSuccessLink({
          href: `/current-affairs/articles/${payload.slug || formState.slug}`,
          label: `Draft "${payload.title || formState.title}" updated successfully.`
        });
        // Stay in edit mode — the connections panel below stays available for
        // continued work instead of vanishing on every save.
        void refreshEditingArticleDetail();
        void loadDrafts();
      } catch (err) {
        console.error("Failed to update draft:", err);
        alert("Failed to update draft. Check slug uniqueness.");
      }
    } else {
      try {
        const created = await onSubmit(payload);
        setSuccessLink({
          href: `/current-affairs/articles/${payload.slug || formState.slug}`,
          label: `Article "${payload.title || formState.title}" created successfully. You can now connect it to other articles below.`
        });
        // Switch straight into edit mode for the article just created, so the
        // connections panel (sections/relations/import-export) appears immediately.
        if (created?.id) {
          void handleEditDraft(created.id);
        } else {
          setFormState(initialForm(defaultKind));
        }
        void loadDrafts();
      } catch (err) {
        console.error("Failed to create article:", err);
        alert("Failed to create article. Please check input validation or slug uniqueness.");
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">


      {successLink && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{successLink.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={successLink.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-xs transition-all flex items-center gap-1"
              >
                View Article ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {message && !successLink && (
        <div className="rounded-xl border border-civic/20 bg-civic/5 p-4 text-sm font-semibold text-civic flex items-center gap-2 shadow-sm animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      )}

      {editingDraftId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 flex items-center justify-between shadow-sm animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span>Editing Draft ID: <strong>{editingDraftId}</strong> ({formState.title || "Untitled"})</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingDraftId(null);
              setEditingArticleDetail(null);
              setFormState(initialForm(defaultKind));
            }}
            className="text-xs bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-lg font-bold shadow-xs transition-all"
          >
            Cancel Edit & Create New
          </button>
        </div>
      )}

      {/* Grid Layout: Form and AI generator on the Left, Drafts list on the Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column - Creator Form & AI Workspace */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* 1st - DRAFT FORM EDITOR (Kept at the top as requested) */}
          <form className="bg-white border border-line rounded-2xl p-4 sm:p-6 shadow-sm space-y-6" onSubmit={handleFormSubmit}>
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-ink">
                  {editingDraftId ? "Draft Editor Workspace" : "Manual Creation Form"}
                </h2>
                <p className="text-xs text-ink/60 mt-1">Review, refine, or manually compose the article details.</p>
              </div>
              {formState.isAiGenerated && (
                <span className="flex items-center gap-1 rounded-full bg-civic/10 px-3 py-1 text-xs font-bold text-civic shrink-0">
                  <Brain className="h-3.5 w-3.5" />
                  AI Draft Generated
                </span>
              )}
            </div>

            {/* Row 1, above title/body: what you're creating */}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-bold text-ink">
                Content type (UPSC syllabus)
                <select
                  className="h-11 rounded-xl border border-line bg-surface px-3 text-base font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                  onChange={(event) => updateField("contentKind", event.target.value as ContentKind)}
                  value={formState.contentKind}
                >
                  {allowedKinds.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-bold text-ink">
                Publishing status
                <select
                  className="h-11 rounded-xl border border-line bg-surface px-3 text-base font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                  onChange={(event) => updateField("status", event.target.value as MasterArticleStatus)}
                  value={formState.status}
                >
                  {ADMIN_ARTICLE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {formState.contentKind === "daily_current_affairs" && (
              <div className="grid gap-1.5">
                <span className="text-sm font-bold text-ink">Article role</span>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-1.5">
                  <button
                    type="button"
                    onClick={() => updateField("articleRole", "event")}
                    className={`h-9 rounded-lg text-sm font-bold transition-all ${
                      formState.articleRole === "event" ? "bg-civic text-white shadow-sm" : "text-ink/60 hover:bg-white"
                    }`}
                  >
                    Event (dated news)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("articleRole", "concept")}
                    className={`h-9 rounded-lg text-sm font-bold transition-all ${
                      formState.articleRole === "concept" ? "bg-civic text-white shadow-sm" : "text-ink/60 hover:bg-white"
                    }`}
                  >
                    Concept (reusable primer)
                  </button>
                </div>
                <p className="text-[11px] text-ink/55 leading-snug">
                  {formState.articleRole === "concept"
                    ? "Evergreen explainer, kept out of the daily feed. Link event articles to it instead of re-explaining the concept each time. Add dated updates from the connections section below once saved."
                    : "A dated news write-up. Link any reusable background concept it depends on from the connections section below once saved."}
                </p>
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-line bg-paper/30 p-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-ink">Category</h3>
              <CascadingCategorySelector
                categories={categories}
                value={formState.categoryNodeId}
                onChange={(nodeId) => updateField("categoryNodeId", nodeId)}
                contentFamily={family}
              />
            </div>

            {/* Title, permalink, and the content editor */}
            <label className="grid gap-1.5 text-sm font-bold text-ink">
              Article Title
              <input
                className="h-12 rounded-xl border border-line px-4 text-lg font-bold text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                onBlur={() => {
                  if (!formState.slug) updateField("slug", adminSlug(formState.title));
                }}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="e.g. Analyzing the Digital Personal Data Protection Act 2023"
                required
                type="text"
                value={formState.title}
              />
            </label>

            <label className="grid gap-1 text-xs font-bold text-ink">
              Permalink
              <div className="flex h-9 items-center gap-1 overflow-x-auto whitespace-nowrap rounded-lg border border-line bg-paper/40 px-3 text-xs text-ink/60">
                <span className="shrink-0">/current-affairs/articles/</span>
                <input
                  className="min-w-0 flex-1 bg-transparent font-mono text-ink outline-none"
                  onChange={(event) => updateField("slug", adminSlug(event.target.value))}
                  placeholder="digital-data-protection-act"
                  required
                  type="text"
                  value={formState.slug}
                />
              </div>
            </label>

            {formState.contentKind === "prelims_pyq" ? (
              <div className="space-y-4 rounded-xl border border-line bg-paper/20 p-4">
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider">UPSC Prelims Question Editor</h3>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Exam Year
                    <input
                      className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                      onChange={(event) => updateField("year", event.target.value)}
                      type="text"
                      value={formState.year}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Correct Answer Key
                    <select
                      className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-normal outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                      onChange={(event) => updateField("correctAnswer", event.target.value)}
                      value={formState.correctAnswer}
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </label>
                </div>

                <RichTextMarkdownEditor
                  label="Question Statement / Main Context"
                  value={formState.questionStatement}
                  onChange={(val) => updateField("questionStatement", val)}
                  placeholder="e.g. Consider the following statements regarding..."
                  required
                  minHeightClass="min-h-[140px]"
                />

                <label className="grid gap-1.5 text-xs font-bold text-ink">
                  Supplementary Facts / List (Optional)
                  <textarea
                    className="min-h-20 rounded-lg border border-line px-3 py-2 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                    onChange={(event) => updateField("suppQuestionStatement", event.target.value)}
                    placeholder="e.g. 1. It is a constitutional body...\n2. It meets twice a year..."
                    value={formState.suppQuestionStatement || ""}
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-bold text-ink">
                  Question Prompt (Optional)
                  <input
                    className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                    onChange={(event) => updateField("questionPrompt", event.target.value)}
                    placeholder="e.g. Which of the statements given above is/are correct?"
                    value={formState.questionPrompt}
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Option A *
                    <input
                      className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                      onChange={(event) => updateField("optionA", event.target.value)}
                      required
                      value={formState.optionA}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Option B *
                    <input
                      className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                      onChange={(event) => updateField("optionB", event.target.value)}
                      required
                      value={formState.optionB}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Option C *
                    <input
                      className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                      onChange={(event) => updateField("optionC", event.target.value)}
                      required
                      value={formState.optionC}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Option D *
                    <input
                      className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                      onChange={(event) => updateField("optionD", event.target.value)}
                      required
                      value={formState.optionD}
                    />
                  </label>
                </div>

                <RichTextMarkdownEditor
                  label="Explanation"
                  value={formState.explanation}
                  onChange={(val) => updateField("explanation", val)}
                  placeholder="Describe the solution details..."
                  required
                  minHeightClass="min-h-[160px]"
                />
              </div>
            ) : formState.contentKind === "mains_pyq" ? (
              <div className="space-y-4 rounded-xl border border-line bg-paper/20 p-4">
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider">UPSC Mains Question Editor</h3>
                
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Exam Year
                    <input
                      className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                      onChange={(event) => updateField("year", event.target.value)}
                      type="text"
                      value={formState.year}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Max Marks
                    <input
                      className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                      onChange={(event) => updateField("maxMarks", event.target.value)}
                      type="number"
                      value={formState.maxMarks}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Word Limit
                    <input
                      className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                      onChange={(event) => updateField("wordLimit", event.target.value)}
                      type="number"
                      value={formState.wordLimit}
                    />
                  </label>
                </div>

                <RichTextMarkdownEditor
                  label="Question Statement"
                  value={formState.questionStatement}
                  onChange={(val) => updateField("questionStatement", val)}
                  placeholder="e.g. Discuss the potential of India's demographic dividend..."
                  required
                  minHeightClass="min-h-[140px]"
                />

                <RichTextMarkdownEditor
                  label="Structured Answering Approach / Guidelines"
                  value={formState.answerApproach}
                  onChange={(val) => updateField("answerApproach", val)}
                  placeholder="1. Introduction (Define dividend)\n2. Key Challenges (Job growth, skill mismatches)...\n3. Way Forward"
                  required
                  minHeightClass="min-h-[160px]"
                />

                <RichTextMarkdownEditor
                  label="Model Answer"
                  value={formState.modelAnswer}
                  onChange={(val) => updateField("modelAnswer", val)}
                  placeholder="Write the full reference model answer key here..."
                  required
                  minHeightClass="min-h-[240px]"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-ink uppercase tracking-wide">
                  Article Body (HTML Editor) <span className="text-rose-500">*</span>
                </span>
                <RichTextMarkdownEditor
                  value={formState.body}
                  onChange={(val) => updateField("body", val)}
                  placeholder="Write the educational content here. Fully formatted HTML or plain text is supported..."
                  required
                  minHeightClass="min-h-[300px]"
                />
              </div>
            )}

            {/* Below title/body: source, tags, SEO — in that reading order */}
            <div className="grid gap-4 rounded-xl border border-line bg-paper/30 p-4 md:grid-cols-3">
              <h3 className="col-span-full text-xs font-black uppercase tracking-wider text-ink">Source & Tags</h3>
              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Source Name
                <input
                  className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                  onChange={(event) => updateField("sourceName", event.target.value)}
                  placeholder="e.g. The Hindu"
                  type="text"
                  value={formState.sourceName}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Source URL
                <input
                  className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                  onChange={(event) => updateField("sourceUrl", event.target.value)}
                  placeholder="https://..."
                  type="url"
                  value={formState.sourceUrl}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Tags (comma-separated)
                <input
                  className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                  onChange={(event) => updateField("tags", event.target.value)}
                  placeholder="data-privacy, cyber-security"
                  type="text"
                  value={formState.tags}
                />
              </label>
            </div>

            <details className="group rounded-xl border border-line bg-paper/30 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-black uppercase tracking-wider text-ink select-none">
                <span>SEO & Meta</span>
                <span className="text-civic transition-transform group-open:rotate-180 text-xs">▼</span>
              </summary>
              <div className="mt-3 grid gap-3 border-t border-line/50 pt-3 md:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-bold text-ink">
                  SEO Title Override
                  <input
                    className="h-9 rounded-lg border border-line bg-white px-3 text-sm font-normal outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                    onChange={(event) => updateField("seoTitle", event.target.value)}
                    placeholder="Defaults to article title"
                    value={formState.seoTitle}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-ink">
                  Canonical URL
                  <input
                    className="h-9 rounded-lg border border-line bg-white px-3 text-sm font-normal outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                    onChange={(event) => updateField("canonicalUrl", event.target.value)}
                    placeholder="https://yourdomain.com/..."
                    value={formState.canonicalUrl}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-ink md:col-span-2">
                  SEO Meta Description
                  <textarea
                    className="min-h-16 rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                    onChange={(event) => updateField("seoDescription", event.target.value)}
                    placeholder="Brief summary for search engine results — also reused as the default blurb when this article is referenced elsewhere"
                    value={formState.seoDescription || ""}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-ink md:col-span-2">
                  Meta Keywords (comma-separated)
                  <input
                    className="h-9 rounded-lg border border-line bg-white px-3 text-sm font-normal outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                    onChange={(event) => updateField("keywords", event.target.value)}
                    placeholder="e.g. data-privacy, upsc-notes"
                    value={formState.keywords}
                  />
                </label>
              </div>
            </details>

            <label className="grid gap-1.5 text-sm font-bold text-ink">
              Publication Date
              <input
                className="h-11 rounded-xl border border-line px-4 text-base font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                onChange={(event) => updateField("publicationDate", event.target.value)}
                type="date"
                value={formState.publicationDate}
              />
            </label>

            {!editingDraftId && (
              <div className="rounded-xl border border-dashed border-civic/40 bg-civic/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-civic/70">🔒 Locked until you save — not a working section yet</p>
                <h3 className="mt-1 text-sm font-black text-ink">Sections, Connections & Concept Updates</h3>
                <p className="mt-1 text-xs text-ink/65 leading-relaxed">
                  This is just a preview note, not a real panel. Hit "{formState.status === "draft" ? "Save Draft" : "Publish"}" below and it will be replaced, right here on this page, by the actual working tools: breaking the article into named sections, linking it to other articles (with buttons to import a short reference <em>from</em> a linked article into this one, or export a reference <em>to</em> this article into a linked one), and — for Concept articles — the dated Updates Timeline.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t border-line">
              <button
                className="h-11 px-6 rounded-xl border border-line font-bold text-ink hover:bg-paper transition-all"
                onClick={() => {
                  setEditingDraftId(null);
                  setEditingArticleDetail(null);
                  setFormState(initialForm(defaultKind));
                }}
                type="button"
              >
                Clear Form
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-civic px-6 font-bold text-white shadow-md hover:bg-civic/90 active:scale-[0.98] disabled:opacity-60 transition-all"
                disabled={pending}
                type="submit"
              >
                <Save className="h-4 w-4" />
                {pending ? "Saving..." : editingDraftId ? "Update" : formState.status === "draft" ? "Save Draft" : "Publish"}
              </button>
            </div>
          </form>

          {/* 1.5th - Sections, assets, connections & concept updates — unlocked once the article is saved */}
          {editingDraftId && editingArticleDetail && (
            <div className="bg-white border border-line rounded-2xl p-4 sm:p-6 shadow-sm">
              <AdminArticleDetailPanel
                article={editingArticleDetail}
                onRefresh={refreshEditingArticleDetail}
              />
            </div>
          )}

          {/* 2nd - UNIFIED AI GENERATION WORKSPACE (Moves to the bottom of the form) */}
          <ArticleCreatorAiWorkspace
            contentKind={formState.contentKind}
            setContentKind={(kind) => updateField("contentKind", kind)}
            categoryNodeId={formState.categoryNodeId}
            setCategoryNodeId={(id) => updateField("categoryNodeId", id)}
            categories={categories}
            family={family}
            categoryOptions={categoryOptions}
            onDraftGenerated={(draft) => {
              setFormState(draft);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>

        {/* Right Column - Drafts sidebar list */}
        <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-6">
          <div className="bg-white border border-line rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-sm font-black text-ink flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-civic" />
                <span>Drafts List ({drafts.length})</span>
              </h3>
              <button
                type="button"
                onClick={loadDrafts}
                className="text-[10px] bg-paper hover:bg-line border border-line text-ink/70 px-2 py-0.5 rounded font-bold"
                disabled={loadingDrafts}
              >
                {loadingDrafts ? "Loading..." : "Refresh"}
              </button>
            </div>
            
            <p className="text-[11px] text-ink/50 mt-2">
              Select any draft below to edit, publish directly, or delete it from the queue.
            </p>

            <div className="mt-4 space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {drafts.length === 0 ? (
                <div className="text-center py-10 bg-paper/20 rounded-xl border border-dashed border-line">
                  <p className="text-xs text-ink/40">No drafts in queue</p>
                </div>
              ) : (
                drafts.map((art) => (
                  <div
                    key={art.id}
                    className={`border rounded-xl p-3 text-xs flex flex-col justify-between gap-3 transition-all ${
                      editingDraftId === art.id
                        ? "bg-amber-50/40 border-amber-300 shadow-xs"
                        : "bg-paper/10 border-line hover:border-civic/40"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-extrabold text-civic uppercase tracking-wider bg-civic/5 px-1.5 py-0.5 rounded">
                            {art.content_kind.replace(/_/g, " ")}
                          </span>
                          {art.article_role === "concept" && (
                            <span className="text-[9px] font-extrabold text-berry uppercase tracking-wider bg-berry/5 px-1.5 py-0.5 rounded">
                              Concept
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-ink/45 font-semibold">
                          #{art.id}
                        </span>
                      </div>
                      <h4
                        className="font-extrabold text-ink leading-tight line-clamp-2 hover:text-civic cursor-pointer"
                        onClick={() => handleEditDraft(art.id)}
                      >
                        {art.title}
                      </h4>
                      <span className="text-[10px] text-ink/40 font-semibold block mt-1">
                        {art.category?.name ?? "No category"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 border-t border-line/60 pt-2 bg-white/20">
                      <button
                        type="button"
                        onClick={() => handleEditDraft(art.id)}
                        className="flex-1 bg-white hover:bg-civic/5 border border-line text-ink hover:text-civic py-1 rounded font-bold text-center transition-all"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePublishDraftDirectly(art.id)}
                        className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 py-1 px-1.5 rounded font-bold text-center transition-all"
                        title="Publish directly"
                      >
                        Publish
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDraft(art.id)}
                        className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 py-1 px-1.5 rounded font-bold text-center transition-all"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helpers for Mock AI Generation

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().split(/[^a-zA-Z]+/);
  const stopwords = new Set(["a", "an", "the", "on", "in", "of", "and", "or", "to", "for", "with", "by", "issue", "generate", "write", "about", "discuss"]);
  const freqMap = new Map<string, number>();
  for (const w of words) {
    if (w.length > 3 && !stopwords.has(w)) {
      freqMap.set(w, (freqMap.get(w) ?? 0) + 1);
    }
  }
  return Array.from(freqMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

type GeneratedArticle = {
  kind: ContentKind;
  categorySlug: string;
  tags: string[];
  title: string;
  body: string;
};

export function generateMockAiContent(prompt: string, categories: CategoryNode[]): GeneratedArticle {
  const p = prompt.toLowerCase();
  
  // 1. Map to Category & ContentKind
  let categorySlug = "judiciary-constitutional-rights"; // Default fallback
  let kind: ContentKind = "daily_current_affairs";
  let tags: string[] = ["general"];
  let title = "Educational Overview of Current Development";
  let body = "";

  if (p.includes("repo") || p.includes("rbi") || p.includes("monetary") || p.includes("bank") || p.includes("economy") || p.includes("budget") || p.includes("fiscal")) {
    if (p.includes("mains") || p.includes("editorial") || p.includes("note")) {
      categorySlug = p.includes("infrastructure") || p.includes("investment") ? "infrastructure-investment" : "inclusive-growth";
      kind = p.includes("editorial") ? "daily_editorial_summary" : "mains_topic_note";
    } else {
      categorySlug = p.includes("fiscal") || p.includes("tax") ? "fiscal-policy-reforms" : "banking-monetary-policy";
      kind = p.includes("pyq") ? "prelims_pyq" : "daily_current_affairs";
    }
    tags = ["economy", "financial-reforms"];
  } 
  else if (p.includes("climate") || p.includes("monsoon") || p.includes("environment") || p.includes("disaster") || p.includes("ecology")) {
    if (p.includes("mains") || p.includes("editorial") || p.includes("note")) {
      categorySlug = p.includes("disaster") || p.includes("mitigation") ? "disaster-risk-mitigation" : "climate-policy-pledges";
      kind = p.includes("editorial") ? "daily_editorial_summary" : "mains_topic_note";
    } else {
      categorySlug = p.includes("monsoon") || p.includes("rain") ? "meteorological-events-monsoons" : "ecology-conservation";
      kind = p.includes("pyq") ? "prelims_pyq" : "daily_current_affairs";
    }
    tags = ["environment", "climate-science"];
  } 
  else if (p.includes("court") || p.includes("judgment") || p.includes("constitution") || p.includes("rights") || p.includes("polity") || p.includes("electoral") || p.includes("election")) {
    if (p.includes("mains") || p.includes("editorial") || p.includes("note") || p.includes("sovereignty")) {
      categorySlug = "constitution-polity-mains";
      kind = p.includes("pyq") ? "mains_pyq" : (p.includes("editorial") ? "daily_editorial_summary" : "mains_topic_note");
    } else {
      categorySlug = p.includes("electoral") || p.includes("election") ? "electoral-systems-reforms" : "judiciary-constitutional-rights";
      kind = p.includes("pyq") ? "prelims_pyq" : "daily_current_affairs";
    }
    tags = ["polity", "constitutional-law"];
  }
  else if (p.includes("mains") && p.includes("pyq")) {
    categorySlug = "constitution-polity-mains";
    kind = "mains_pyq";
    tags = ["mains-pyq", "constitutional-law"];
  }
  else if (p.includes("prelims") && p.includes("pyq")) {
    categorySlug = "judiciary-constitutional-rights";
    kind = "prelims_pyq";
    tags = ["prelims-pyq", "polity"];
  }

  // 2. Generate Titles and Bodies dynamically based on Kind & Keywords
  const keywords = extractKeywords(prompt);
  const capitalizedKeywords = keywords.map(w => w.charAt(0).toUpperCase() + w.slice(1));
  const mainSubject = capitalizedKeywords[0] ?? "Developmental Reform";
  const modifier = capitalizedKeywords[1] ? ` and ${capitalizedKeywords[1]}` : "";

  if (kind === "daily_current_affairs") {
    title = `Significant Updates on ${mainSubject}${modifier} Framework`;
    body = `### Context
In recent administrative developments, the Government of India has introduced critical revisions focusing on **${mainSubject}** policies. These changes represent a strategic response to evolving national and international benchmarks, aiming to modernize existing operational standards.

### Key Highlights
1. **Structural Upgrades**: The framework establishes enhanced monitoring capabilities to ensure compliance and increase transparency.
2. **Citizen-Centric Focus**: By simplifying regulatory requirements, the updates seek to enhance accessibility and convenience for stakeholders.
3. **Decentralized Execution**: Implementing agencies will receive expanded operational mandates to expedite regional implementation.

### Relevance for UPSC aspirants
- **Prelims focus**: Know the specific articles, statutory provisions, and nodal ministries responsible for regulating ${mainSubject}.
- **Core takeaway**: Memorize dates of enforcement and major key targets outlined in the policy guidelines.`;
  } 
  else if (kind === "daily_editorial_summary") {
    title = `Editorial Analysis: Re-evaluating ${mainSubject}${modifier} Policies`;
    body = `### Summary of the Editorial
This editorial provides a comprehensive critique of the present legal and administrative parameters governing **${mainSubject}**. While acknowledging historical progress, the author argues that current regulatory mechanism contains significant operational gaps that inhibit optimal outcomes.

### Core Arguments
- **Implementation Bottlenecks**: The article identifies a critical disconnect between national policy declarations and grassroots execution, primarily driven by resource constraints.
- **Strategic Imperatives**: To address this, the editorial recommends implementing independent regulatory review councils and adopting robust public engagement guidelines.
- **Future Directions**: Over the medium term, fostering public-private collaboration is highlighted as the most viable path to ensure fiscal sustainability and technology transfer.

### Critical Evaluation for Mains
- **GS Paper II / III Connection**: This analysis highlights critical structural constraints in governance structures. Aspirants should draw from these arguments to write balanced answers discussing policy design versus grassroots efficacy.`;
  }
  else if (kind === "mains_topic_note") {
    title = `Comprehensive Study Note on ${mainSubject}${modifier}`;
    body = `### Introduction
**${mainSubject}** constitutes a crucial component of India's developmental and administrative agenda. A clear understanding of its historical trajectory, legal framework, and functional mechanisms is essential to analyze public administration systems.

### Constitutional & Legislative Mandates
- **Constitutional Backing**: Relevant articles and entries in the Seventh Schedule define parliamentary and state jurisdiction over these affairs.
- **Key Legislation**: Primary acts establish statutory authorities tasked with regulatory oversight, compliance auditing, and dispute resolution.

### Structural Performance Analysis
| Indicator | Strengths | Constraints |
| :--- | :--- | :--- |
| **Institutional Governance** | Robust policy definition; clear hierarchy. | Staffing shortages; overlapping authority. |
| **Financial Inclusion** | Increased budget allocation. | Underutilization of development funds. |
| **Technology Adoption** | Digitsation of registration systems. | Low digital literacy in rural sections. |

### Way Forward
A comprehensive restructuring is needed to resolve institutional overlaps and ensure fiscal resilience. Policymakers must focus on capacity building, standardizing service delivery agreements, and promoting public participation in audits.`;
  }
  else if (kind === "prelims_pyq") {
    title = `Prelims PYQ: Concept of ${mainSubject}${modifier}`;
    body = `### Previous Years Question

**With reference to ${mainSubject} in India, consider the following statements:**
1. It is governed by a statutory body established under a constitutional amendment.
2. The regulations apply uniformly to both public sector and private entities.

**Which of the statements given above is/are correct?**
(a) 1 only
(b) 2 only
(c) Both 1 and 2
(d) Neither 1 nor 2

**Answer: (b)**

### Detailed Explanation
- **Statement 1 is incorrect**: The regulatory body is established through an executive order / ordinary act of Parliament, not via a constitutional amendment.
- **Statement 2 is correct**: The provisions of the regulatory act bind all operational agencies in the country, including both public departments and private enterprises, to maintain uniform standards.

### UPSC Preparation Tip
Always examine the exact legal status (Constitutional vs. Statutory vs. Executive) of national institutions mentioned in questions.`;
  }
  else {
    title = `Mains Question: Critical Assessment of ${mainSubject}${modifier}`;
    body = `### Mains Practice Question

**"While the establishment of legislative safeguards for ${mainSubject} is a positive step, institutional overlaps and inadequate resource distribution continue to hinder effective implementation." Critically analyze. (Answer in 250 words)**

### Model Answer Guidelines

#### 1. Introduction (approx. 40 words)
- Define **${mainSubject}** and state its legislative origin (relevant Acts). Highlight its significance in achieving sustainable governance.

#### 2. Key Challenges (approx. 120 words)
- **Overlapping Authority**: Highlight how multiple regulatory bodies create jurisdictional conflicts, leading to administrative delays.
- **Resource Constraints**: Discuss the lack of trained personnel and modern tools at the local governance level.
- **Statutory Compliance**: Mention the weak enforcement mechanisms that allow non-compliant entities to operate with minimal penalties.

#### 3. Reform Measures (approx. 60 words)
- Propose establishing a unified regulatory clearinghouse.
- Advocate for mandatory regular training programs for local administrators.
- Suggest transitioning to real-time digital monitoring to ensure compliance.

#### 4. Conclusion (approx. 30 words)
- Summarize by stating that aligning regulatory frameworks with global best practices is essential to achieve administrative efficiency.`;
  }

  return {
    kind,
    categorySlug,
    tags,
    title,
    body
  };
}
