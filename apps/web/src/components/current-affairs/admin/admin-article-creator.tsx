"use client";

import { Brain, Sparkles, Save, Loader2, CheckCircle2, ChevronRight, Link2, Trash2, Edit3, Check, FileText, Search, Filter, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { CategoryNode, CreateAdminArticlePayload } from "../../../lib/api";
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
import { authenticatedGet, authenticatedPost, authenticatedPatch, authenticatedDelete, useAuth } from "../../auth/auth-context";
import { RichTextMarkdownEditor } from "../rich-text-editor";
import { ArticleCreatorAiWorkspace } from "./article-creator-ai-workspace";
import { CascadingCategorySelector } from "./cascading-category-selector";

type DraftRelation = {
  id?: number;
  targetArticleId: number;
  targetArticleTitle: string;
  relationType: string;
  label?: string;
  note?: string;
};

type AdminArticleCreatorProps = {
  categories: CategoryNode[];
  pending: boolean;
  onSubmit: (payload: CreateAdminArticlePayload & { draftRelations?: DraftRelation[] }) => Promise<void>;
  message: string | null;
  createType?: "daily-news" | "summaries" | "mains-notes" | "prelims-pyq" | "mains-pyq";
};

type FormState = {
  title: string;
  slug: string;
  contentKind: ContentKind;
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

const RELATION_TYPE_EXPLANATIONS: Record<string, string> = {
  related_reference: "Intra-article reference: Links standard related articles for cross-referencing. Renders as 'Related reading' on the student details page.",
  base_current_affairs: "Base Current Affairs: Links a Mains Daily Editorial summary to its corresponding factual Prelims Current Affairs article base.",
  imported_source: "Imported Source (Notes content import): Links a Mains Topic-wise Note to an imported base article, whose contents can then be embedded into note sections.",
  follow_up: "Follow Up: Links an older article to a newer article detailing further sequential developments on the same topic.",
  prerequisite: "Prerequisite: Recommends foundational background articles or concepts the student should read before starting this page.",
  mains_fodder: "Mains Fodder: Links a fact-filled Prelims article containing case studies, graphs, or key quotes to be used as fodder in Mains writing.",
  pyq_context: "PYQ Context: Links a Past Year Question (PYQ) to the modern current affairs explanation or issue that prompted/contextualizes it."
};

function getCreateRouteType(kind: string): string {
  if (kind === "daily_current_affairs") return "daily-news";
  if (kind === "prelims_pyq") return "prelims-pyq";
  if (kind === "daily_editorial_summary") return "summaries";
  if (kind === "mains_topic_note") return "mains-notes";
  if (kind === "mains_pyq") return "mains-pyq";
  return "daily-news";
}

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
  const [allArticles, setAllArticles] = useState<any[]>([]);
  const [draftRelations, setDraftRelations] = useState<DraftRelation[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  
  const [allDrafts, setAllDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [successLink, setSuccessLink] = useState<{ href: string; label: string } | null>(null);

  const [relTargetId, setRelTargetId] = useState("");
  const [relType, setRelType] = useState("related_reference");
  const [relLabel, setRelLabel] = useState("");
  const [relNote, setRelNote] = useState("");

  // Connect & Link states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterTopicId, setFilterTopicId] = useState("");
  const [filterSubtopicId, setFilterSubtopicId] = useState("");
  const [filterKind, setFilterKind] = useState<"all" | "same" | "other">("all");

  const filterSubjects = useMemo(() => {
    return categories.filter(c => c.node_type === "subject" && c.is_active !== false);
  }, [categories]);

  const filterTopics = useMemo(() => {
    if (!filterSubjectId) return [];
    return categories.filter(c => c.node_type === "topic" && String(c.parent_id) === filterSubjectId && c.is_active !== false);
  }, [categories, filterSubjectId]);

  const filterSubtopics = useMemo(() => {
    if (!filterTopicId) return [];
    return categories.filter(c => c.node_type === "subtopic" && String(c.parent_id) === filterTopicId && c.is_active !== false);
  }, [categories, filterTopicId]);

  // Text selection state for Modal Preview Box
  const [selectedHtml, setSelectedHtml] = useState("");

  const handlePreviewSelect = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const previewEl = document.getElementById("import-preview-content");
      if (previewEl && previewEl.contains(selection.anchorNode)) {
        const container = document.createElement("div");
        for (let i = 0; i < selection.rangeCount; i++) {
          container.appendChild(selection.getRangeAt(i).cloneContents());
        }
        setSelectedHtml(container.innerHTML);
      }
    } else {
      const previewEl = document.getElementById("import-preview-content");
      if (previewEl && selection && selection.anchorNode && previewEl.contains(selection.anchorNode)) {
        setSelectedHtml("");
      }
    }
  };

  const captureEditorSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const container = document.createElement("div");
      for (let i = 0; i < selection.rangeCount; i++) {
        container.appendChild(selection.getRangeAt(i).cloneContents());
      }
      setSelectedHtml(container.innerHTML);
    } else {
      setSelectedHtml("");
    }
  };

  const [activeActionArticleId, setActiveActionArticleId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"import" | "export" | "connect" | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState("");

  const filteredModalArticles = useMemo(() => {
    const query = modalSearchQuery.trim().toLowerCase();
    return allArticles.filter(art => {
      if (editingDraftId && art.id === Number(editingDraftId)) return false;
      if (!query) return true;
      return (
        art.title?.toLowerCase().includes(query) ||
        art.content_kind?.toLowerCase().includes(query)
      );
    });
  }, [allArticles, modalSearchQuery, editingDraftId]);
  const [importExportMode, setImportExportMode] = useState<"content" | "link" | "both">("content");
  const [customLinkText, setCustomLinkText] = useState("");
  const [relationType, setRelationType] = useState("related_reference");
  const [processingAction, setProcessingAction] = useState(false);

  const [importPreviewBody, setImportPreviewBody] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (activeActionArticleId && actionType === "import" && token) {
      setLoadingPreview(true);
      setImportPreviewBody("");
      authenticatedGet<any>(`/api/v1/current-affairs/admin/articles/${activeActionArticleId}`, token)
        .then(res => {
          setImportPreviewBody(res?.body || "");
        })
        .catch(err => {
          console.error("Failed to load preview:", err);
          setImportPreviewBody("<p class='text-rose-500'>Failed to load preview content.</p>");
        })
        .finally(() => {
          setLoadingPreview(false);
        });
    } else {
      setImportPreviewBody("");
      setLoadingPreview(false);
    }
  }, [activeActionArticleId, actionType, token]);

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
    setDraftRelations([]);
  }, [defaultKind]);

  // Reset success link when form fields are modified
  useEffect(() => {
    setSuccessLink(null);
  }, [formState.title, formState.slug, formState.body]);

  // Load all articles for dropdown select link relations
  useEffect(() => {
    const loadAll = async () => {
      if (!token) return;
      try {
        const res = await authenticatedGet<any[]>("/api/v1/current-affairs/articles?limit=300", token);
        setAllArticles(res || []);
      } catch (err) {
        console.error("Error loading articles list for connections:", err);
      }
    };
    void loadAll();
  }, [token]);

  const addDraftRelation = () => {
    if (!relTargetId) return;
    const target = allArticles.find(a => String(a.id) === relTargetId);
    if (!target) return;

    setDraftRelations(prev => [
      ...prev,
      {
        targetArticleId: Number(relTargetId),
        targetArticleTitle: target.title,
        relationType: relType,
        label: relLabel.trim() || undefined,
        note: relNote.trim() || undefined
      }
    ]);

    setRelTargetId("");
    setRelLabel("");
    setRelNote("");
  };

  const removeDraftRelation = async (idx: number) => {
    const rel = draftRelations[idx];
    if (editingDraftId && rel && rel.id && token) {
      if (!window.confirm("Are you sure you want to remove this relation from the database?")) return;
      try {
        await authenticatedDelete(`/api/v1/current-affairs/article-relations/${rel.id}`, token);
      } catch (err) {
        console.error("Failed to delete relation from database:", err);
      }
    }
    setDraftRelations(prev => prev.filter((_, i) => i !== idx));
  };

  const connectionMatches = useMemo(() => {
    return allArticles.filter(art => {
      // 1. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = art.title?.toLowerCase().includes(query);
        const slugMatch = art.slug?.toLowerCase().includes(query);
        const tagsMatch = Array.isArray(art.institute_tags) && art.institute_tags.some((t: string) => t.toLowerCase().includes(query));
        if (!titleMatch && !slugMatch && !tagsMatch) return false;
      }
      
      // 2. Kind filter
      if (filterKind === "same") {
        if (art.content_kind !== formState.contentKind) return false;
      } else if (filterKind === "other") {
        if (art.content_kind === formState.contentKind) return false;
      }

      // 3. Category levels filter
      if (filterSubjectId) {
        const artCatId = String(art.category_node_id || art.category?.id || "");
        if (!artCatId) return false;

        // If subtopic is selected, exact match
        if (filterSubtopicId) {
          if (artCatId !== filterSubtopicId) return false;
        }
        // If topic is selected, match the topic itself or its child subtopics
        else if (filterTopicId) {
          const isTopicOrChild = artCatId === filterTopicId || categories.some(c => String(c.id) === artCatId && String(c.parent_id) === filterTopicId);
          if (!isTopicOrChild) return false;
        }
        // If only subject is selected, match subject, child topics, or grandchild subtopics
        else {
          const isSubjectOrChild = artCatId === filterSubjectId || 
            categories.some(c => String(c.id) === artCatId && String(c.parent_id) === filterSubjectId) ||
            categories.some(c => {
              if (String(c.id) !== artCatId) return false;
              const parentTopic = categories.find(t => t.id === c.parent_id);
              return parentTopic && String(parentTopic.parent_id) === filterSubjectId;
            });
          if (!isSubjectOrChild) return false;
        }
      }

      // 4. Do not show the current article itself
      if (editingDraftId && art.id === editingDraftId) return false;

      return true;
    });
  }, [allArticles, searchQuery, filterKind, filterSubjectId, filterTopicId, filterSubtopicId, categories, formState.contentKind, editingDraftId]);

  const handleExecuteAction = async () => {
    if (!activeActionArticleId || !actionType || !token) return;
    setProcessingAction(true);
    try {
      const target = allArticles.find(a => a.id === activeActionArticleId);
      if (!target) {
        alert("Target article not found in list.");
        return;
      }

      let targetDetail = target;
      if (actionType === "import" || actionType === "export") {
        try {
          targetDetail = await authenticatedGet<any>(`/api/v1/current-affairs/admin/articles/${activeActionArticleId}`, token);
        } catch (err) {
          console.error("Failed to load target details, using list values:", err);
        }
      }

      const targetTitle = targetDetail.title || target.title;
      const targetSlug = targetDetail.slug || target.slug;
      const targetBody = targetDetail.body || "";

      // 1. If IMPORT
      if (actionType === "import") {
        const importedContent = selectedHtml.trim() ? selectedHtml : targetBody;

        let newBody = formState.body || "";
        if (importExportMode === "content" || importExportMode === "both") {
          newBody = newBody ? `${newBody}<br/>${importedContent}` : importedContent;
        }
        if (importExportMode === "link" || importExportMode === "both") {
          const linkText = customLinkText.trim() || targetTitle;
          const hyperlink = `<p><a href="/current-affairs/articles/${targetSlug}" class="text-civic font-bold hover:underline" target="_blank">${linkText}</a></p>`;
          newBody = newBody ? `${newBody}<br/>${hyperlink}` : hyperlink;
        }
        updateField("body", newBody);
      }

      // 2. If EXPORT
      if (actionType === "export") {
        let exportContent = "";
        const selectionContent = selectedHtml.trim() ? selectedHtml : (formState.body || "");

        if (importExportMode === "content" || importExportMode === "both") {
          exportContent = selectionContent;
        }
        if (importExportMode === "link" || importExportMode === "both") {
          const currentSlug = formState.slug || adminSlug(formState.title);
          const linkText = customLinkText.trim() || formState.title || "Related Article";
          const hyperlink = `<p><a href="/current-affairs/articles/${currentSlug}" class="text-civic font-bold hover:underline" target="_blank">${linkText}</a></p>`;
          exportContent = exportContent ? `${exportContent}<br/>${hyperlink}` : hyperlink;
        }

        const updatedTargetBody = targetBody ? `${targetBody}<br/>${exportContent}` : exportContent;

        await authenticatedPatch(`/api/v1/current-affairs/articles/${activeActionArticleId}`, token, {
          body: updatedTargetBody
        });

        // Sync local list cache
        setAllArticles(prev => prev.map(a => a.id === activeActionArticleId ? { ...a, body: updatedTargetBody } : a));
      }

      // 3. Save relation link
      let savedRelationId: number | undefined = undefined;
      const targetRelationType = (actionType === "import" || actionType === "export") ? "imported_source" : relationType;

      if (editingDraftId) {
        try {
          const resRel = await authenticatedPost<any>(`/api/v1/current-affairs/articles/${editingDraftId}/relations`, token, {
            target_article_id: activeActionArticleId,
            relation_type: targetRelationType,
            label: (actionType === "connect" ? relLabel.trim() : `Auto-${actionType}`) || undefined,
            note: (actionType === "connect" ? relNote.trim() : `Triggered via ${actionType}`) || undefined
          });
          if (resRel && resRel.id) {
            savedRelationId = resRel.id;
          }
        } catch (e) {
          console.error("Failed to save relation to DB:", e);
        }
      }

      const newRelation: DraftRelation = {
        id: savedRelationId,
        targetArticleId: activeActionArticleId,
        targetArticleTitle: targetTitle,
        relationType: targetRelationType,
        label: (actionType === "connect" ? relLabel.trim() : `Auto-${actionType}`) || undefined,
        note: (actionType === "connect" ? relNote.trim() : `Triggered via ${actionType}`) || undefined
      };

      setDraftRelations(prev => {
        const exists = prev.some(r => r.targetArticleId === activeActionArticleId && r.relationType === targetRelationType);
        if (exists) return prev;
        return [...prev, newRelation];
      });

      setActiveActionArticleId(null);
      setActionType(null);
      setCustomLinkText("");
      setRelLabel("");
      setRelNote("");
      
      alert(`Action "${actionType.toUpperCase()}" completed successfully and relation linked!`);
    } catch (err: any) {
      console.error("Failed to execute action:", err);
      alert(`Failed to execute action: ${err.message || err}`);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleCancelAction = () => {
    setActiveActionArticleId(null);
    setActionType(null);
    setCustomLinkText("");
    setRelLabel("");
    setRelNote("");
    setSelectedHtml("");
  };

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
      const detail = await authenticatedGet<any>(`/api/v1/current-affairs/admin/articles/${draftId}`, token);
      if (detail) {
        setEditingDraftId(detail.id);
        
        const bodyJson = detail.body_json || {};
        
        setFormState({
          title: detail.title,
          slug: detail.slug,
          contentKind: detail.content_kind,
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

        if (detail.outgoing_relations) {
          setDraftRelations(detail.outgoing_relations.map((rel: any) => ({
            id: rel.id,
            targetArticleId: rel.target_article.id,
            targetArticleTitle: rel.target_article.title,
            relationType: rel.relation_type,
            label: rel.label || undefined,
            note: rel.note || undefined
          })));
        } else {
          setDraftRelations([]);
        }
        
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      console.error("Failed to load draft detail:", err);
    }
  };

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
        setFormState(initialForm(defaultKind));
        setDraftRelations([]);
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
        setEditingDraftId(null);
        setFormState(initialForm(defaultKind));
        setDraftRelations([]);
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

    const payload: CreateAdminArticlePayload & { body_json?: any; draftRelations?: DraftRelation[] } = {
      content_kind: formState.contentKind,
      title: formState.title,
      slug: formState.slug || adminSlug(formState.title),
      body: finalBody,
      body_json: finalBodyJson,
      draftRelations: draftRelations,
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
        
        // Save relations
        if (draftRelations.length > 0) {
          for (const rel of draftRelations) {
            try {
              await authenticatedPost(`/api/v1/current-affairs/articles/${editingDraftId}/relations`, token, {
                target_article_id: rel.targetArticleId,
                relation_type: rel.relationType,
                label: rel.label,
                note: rel.note
              });
            } catch {}
          }
        }
        
        setSuccessLink({
          href: `/current-affairs/articles/${payload.slug || formState.slug}`,
          label: `Draft "${payload.title || formState.title}" updated successfully.`
        });
        setEditingDraftId(null);
        setFormState(initialForm(defaultKind));
        setDraftRelations([]);
        void loadDrafts();
      } catch (err) {
        console.error("Failed to update draft:", err);
        alert("Failed to update draft. Check slug uniqueness.");
      }
    } else {
      try {
        await onSubmit(payload);
        setSuccessLink({
          href: `/current-affairs/articles/${payload.slug || formState.slug}`,
          label: `Article "${payload.title || formState.title}" created successfully.`
        });
        setDraftRelations([]);
        setFormState(initialForm(defaultKind));
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
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successLink.label}</span>
          </div>
          <a
            href={successLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-xs transition-all flex items-center gap-1"
          >
            View Article ↗
          </a>
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
              setFormState(initialForm(defaultKind));
              setDraftRelations([]);
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

            <div className="grid gap-6 md:grid-cols-2">
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

            <label className="grid gap-1.5 text-sm font-bold text-ink">
              Article Title
              <input
                className="h-11 rounded-xl border border-line px-4 text-base font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
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

            <div className="grid gap-6 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-bold text-ink">
                Slug (URL suffix)
                <input
                  className="h-11 rounded-xl border border-line px-4 text-base font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                  onChange={(event) => updateField("slug", adminSlug(event.target.value))}
                  placeholder="e.g. digital-data-protection-act"
                  required
                  type="text"
                  value={formState.slug}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-bold text-ink">
                Publication Date
                <input
                  className="h-11 rounded-xl border border-line px-4 text-base font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                  onChange={(event) => updateField("publicationDate", event.target.value)}
                  type="date"
                  value={formState.publicationDate}
                />
              </label>
            </div>

            {/* Step-by-Step Subject Category selection as requested */}
            <div className="space-y-1.5">
              <span className="text-sm font-bold text-ink block">Subject Category Selection (Step-by-Step)</span>
              <CascadingCategorySelector
                categories={categories}
                value={formState.categoryNodeId}
                onChange={(nodeId) => updateField("categoryNodeId", nodeId)}
                contentFamily={family}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-bold text-ink">
                Source Citation Name
                <input
                  className="h-11 rounded-xl border border-line px-4 text-base font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                  onChange={(event) => updateField("sourceName", event.target.value)}
                  placeholder="e.g. The Hindu"
                  type="text"
                  value={formState.sourceName}
                />
              </label>

              <label className="grid gap-1.5 text-sm font-bold text-ink">
                Source Citation URL
                <input
                  className="h-11 rounded-xl border border-line px-4 text-base font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                  onChange={(event) => updateField("sourceUrl", event.target.value)}
                  placeholder="e.g. https://www.thehindu.com/..."
                  type="url"
                  value={formState.sourceUrl}
                />
              </label>
            </div>

            <label className="grid gap-1.5 text-sm font-bold text-ink">
              Tags (comma-separated)
              <input
                className="h-11 rounded-xl border border-line px-4 text-base font-normal text-ink outline-none focus:border-civic focus:ring-2 focus:ring-civic/20 transition-all"
                onChange={(event) => updateField("tags", event.target.value)}
                placeholder="e.g. data-privacy, fundamental-rights, cyber-security"
                type="text"
                value={formState.tags}
              />
            </label>

            <details className="group border border-line rounded-xl bg-surface p-4 overflow-hidden transition-all duration-300">
              <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-bold text-ink select-none">
                <span>Search Engine Optimization (SEO) & Meta Settings</span>
                <span className="text-civic transition-transform group-open:rotate-180 text-xs">▼</span>
              </summary>
              <div className="grid gap-4 mt-4 pt-4 border-t border-line/50">
                <label className="grid gap-1.5 text-xs font-bold text-ink">
                  SEO Title Override
                  <input
                    className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                    onChange={(event) => updateField("seoTitle", event.target.value)}
                    placeholder="Defaults to article title"
                    value={formState.seoTitle}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-ink">
                  SEO Meta Description
                  <textarea
                    className="min-h-16 rounded-lg border border-line px-3 py-2 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                    onChange={(event) => updateField("seoDescription", event.target.value)}
                    placeholder="Brief summary for search engine results"
                    value={formState.seoDescription || ""}
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Canonical URL
                    <input
                      className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                      onChange={(event) => updateField("canonicalUrl", event.target.value)}
                      placeholder="https://yourdomain.com/..."
                      value={formState.canonicalUrl}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-ink">
                    Meta Keywords (comma-separated)
                    <input
                      className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                      onChange={(event) => updateField("keywords", event.target.value)}
                      placeholder="e.g. data-privacy, upsc-notes"
                      value={formState.keywords}
                    />
                  </label>
                </div>
              </div>
            </details>

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
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink uppercase tracking-wide">
                    Article Body (HTML Editor) <span className="text-rose-500">*</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onMouseDown={captureEditorSelection}
                      onClick={() => {
                        setActionType("import");
                        setActiveActionArticleId(null);
                      }}
                      className="inline-flex h-7 items-center gap-1 rounded bg-civic/10 px-2.5 text-[10px] font-bold text-civic hover:bg-civic hover:text-white transition-all"
                    >
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                      Import Content
                    </button>
                    <button
                      type="button"
                      onMouseDown={captureEditorSelection}
                      onClick={() => {
                        setActionType("export");
                        setActiveActionArticleId(null);
                      }}
                      className="inline-flex h-7 items-center gap-1 rounded bg-berry/10 px-2.5 text-[10px] font-bold text-berry hover:bg-berry hover:text-white transition-all"
                    >
                      <ArrowUpFromLine className="h-3.5 w-3.5" />
                      Export Content
                    </button>
                  </div>
                </div>
                <RichTextMarkdownEditor
                  value={formState.body}
                  onChange={(val) => updateField("body", val)}
                  placeholder="Write the educational content here. Fully formatted HTML or plain text is supported..."
                  required
                  minHeightClass="min-h-[300px]"
                />
              </div>
            )}

            {/* Connect & Link Other Articles */}
            <div className="space-y-4 rounded-xl border border-line bg-paper/20 p-4 relative">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                <Link2 className="h-4 w-4 text-civic" />
                Connect & Link Other Articles
              </h3>

              {/* 1. Attached Connections list */}
              {draftRelations.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-ink/65 block font-bold">Attached Article Connections:</span>
                  <div className="grid gap-2">
                    {draftRelations.map((rel, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white border border-line p-3 rounded-lg text-xs shadow-xs hover:border-civic/50 transition-all">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="rounded bg-civic/10 px-1.5 py-0.5 text-[9px] font-bold text-civic uppercase">
                              {rel.relationType.replace(/_/g, " ")}
                            </span>
                            {rel.label && (
                              <span className="text-[10px] font-semibold text-ink/65 italic">
                                ({rel.label})
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-ink block mt-1 truncate">{rel.targetArticleTitle}</span>
                          {rel.note && <span className="text-[10px] text-ink/50 italic block mt-0.5">{rel.note}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeDraftRelation(idx)}
                          className="text-rose-500 hover:text-rose-700 font-bold px-2.5 py-1.5 hover:bg-rose-50 rounded-lg transition-all ml-2 flex-shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Filter Toolbar */}
              <div className="grid gap-3.5 p-4 rounded-xl bg-white/60 border border-line/65">
                <span className="text-xs font-bold text-ink/75 flex items-center gap-1.5 font-bold">
                  <Filter className="h-3.5 w-3.5 text-civic" />
                  Search & Filter Library Articles
                </span>
                
                {/* Row 1: Search Query & Content Type */}
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="sm:col-span-2 relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/40" />
                    <input
                      type="text"
                      className="w-full h-9 rounded-lg border border-line pl-8 pr-3 text-xs outline-none focus:border-civic bg-white"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search title, tag..."
                    />
                  </div>

                  <select
                    className="h-9 rounded-lg border border-line bg-white px-2.5 text-xs outline-none focus:border-civic font-medium"
                    value={filterKind}
                    onChange={(e) => setFilterKind(e.target.value as any)}
                  >
                    <option value="all">All Content Kinds</option>
                    <option value="same">Same Content Type</option>
                    <option value="other">Other Content Types</option>
                  </select>
                </div>

                {/* Row 2: Category Levels */}
                <div className="grid gap-2 sm:grid-cols-3 pt-2.5 border-t border-line/50">
                  <select
                    className="h-9 rounded-lg border border-line bg-white px-2.5 text-xs outline-none focus:border-civic font-medium"
                    value={filterSubjectId}
                    onChange={(e) => {
                      setFilterSubjectId(e.target.value);
                      setFilterTopicId("");
                      setFilterSubtopicId("");
                    }}
                  >
                    <option value="">-- All Subjects --</option>
                    {filterSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="h-9 rounded-lg border border-line bg-white px-2.5 text-xs outline-none focus:border-civic font-medium disabled:opacity-50"
                    value={filterTopicId}
                    disabled={!filterSubjectId}
                    onChange={(e) => {
                      setFilterTopicId(e.target.value);
                      setFilterSubtopicId("");
                    }}
                  >
                    <option value="">-- All Topics --</option>
                    {filterTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="h-9 rounded-lg border border-line bg-white px-2.5 text-xs outline-none focus:border-civic font-medium disabled:opacity-50"
                    value={filterSubtopicId}
                    disabled={!filterTopicId}
                    onChange={(e) => setFilterSubtopicId(e.target.value)}
                  >
                    <option value="">-- All Subtopics --</option>
                    {filterSubtopics.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Search Results List */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-ink/65 block font-bold">Available Matches ({connectionMatches.length}):</span>
                <div className="max-h-[260px] overflow-y-auto border border-line rounded-xl p-2 bg-white/70 space-y-1.5 shadow-inner">
                  {connectionMatches.length === 0 ? (
                    <div className="text-center py-6 text-xs text-ink/40 italic">
                      No matching articles found in library.
                    </div>
                  ) : (
                    connectionMatches.slice(0, 50).map((art) => {
                      const isConnected = draftRelations.some(r => r.targetArticleId === art.id);

                      return (
                        <div key={art.id} className="flex items-center justify-between gap-3 bg-white p-2.5 border border-line/60 rounded-lg hover:border-civic/30 transition-all">
                          <div className="min-w-0 flex-1">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-bold text-ink/60 uppercase">
                              {art.content_kind.replace(/_/g, " ")}
                            </span>
                            <span className="text-xs font-bold text-ink block mt-0.5 truncate">{art.title}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isConnected ? (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                Connected
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionType("connect");
                                    setActiveActionArticleId(art.id);
                                  }}
                                  className="h-7 px-2.5 rounded bg-slate-100 hover:bg-civic hover:text-white text-[10px] font-bold text-ink transition-all"
                                >
                                  Connect
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionType("import");
                                    setActiveActionArticleId(art.id);
                                  }}
                                  className="h-7 px-2.5 rounded bg-civic/10 hover:bg-civic hover:text-white text-[10px] font-bold text-civic flex items-center gap-1 transition-all"
                                >
                                  <ArrowDownToLine className="h-3 w-3" />
                                  Import
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionType("export");
                                    setActiveActionArticleId(art.id);
                                  }}
                                  className="h-7 px-2.5 rounded bg-berry/10 hover:bg-berry hover:text-white text-[10px] font-bold text-berry flex items-center gap-1 transition-all"
                                >
                                  <ArrowUpFromLine className="h-3 w-3" />
                                  Export
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 4. Action Config Overlay Panel */}
              {actionType && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
                  <div className={`bg-white border border-line rounded-2xl shadow-xl w-full p-5 sm:p-6 animate-in zoom-in-95 duration-200 space-y-4 ${
                    (actionType === "import" || actionType === "export") && activeActionArticleId !== null ? "max-w-2xl" : "max-w-md"
                  }`}>
                    <div>
                      <h4 className="text-sm font-black text-ink uppercase tracking-wide flex items-center gap-1.5 font-bold">
                        <Sparkles className="h-4.5 w-4.5 text-civic" />
                        Configure Action: {actionType.toUpperCase()}
                      </h4>
                      <p className="text-[11px] text-ink/65 mt-1 leading-tight flex items-center gap-1.5">
                        Target Article: 
                        {activeActionArticleId !== null ? (
                          <>
                            <strong className="text-ink truncate max-w-[220px]">
                              {allArticles.find(a => a.id === activeActionArticleId)?.title || "Unknown Article"}
                            </strong>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionArticleId(null);
                                setImportPreviewBody("");
                              }}
                              className="px-2 py-0.5 rounded border border-line bg-slate-50 text-[10px] text-civic font-bold hover:bg-civic hover:text-white transition-all"
                            >
                              Change Article
                            </button>
                          </>
                        ) : (
                          <span className="italic text-ink/50">Select target article below</span>
                        )}
                      </p>
                    </div>

                    {activeActionArticleId === null ? (
                      <div className="space-y-3 pt-2 border-t border-line/60">
                        <label className="grid gap-1.5 text-xs font-bold text-ink">
                          <span>Search Library Articles</span>
                          <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink/45" />
                            <input
                              type="text"
                              placeholder="Search library articles by title..."
                              className="w-full h-9 pl-9 pr-4 rounded-lg border border-line text-xs outline-none focus:border-civic bg-paper/20 font-normal"
                              value={modalSearchQuery}
                              onChange={(e) => setModalSearchQuery(e.target.value)}
                              autoFocus
                            />
                          </div>
                        </label>
                        
                        <div className="max-h-60 overflow-y-auto border border-line rounded-lg p-1 bg-white space-y-1">
                          {filteredModalArticles.length === 0 ? (
                            <div className="text-center py-8 text-xs text-ink/40 italic">
                              No matching articles found.
                            </div>
                          ) : (
                            filteredModalArticles.slice(0, 100).map((art) => (
                              <button
                                key={art.id}
                                type="button"
                                onClick={() => {
                                  setActiveActionArticleId(art.id);
                                }}
                                className="w-full text-left px-3 py-2 rounded-md hover:bg-civic/5 hover:text-civic border border-transparent hover:border-civic/10 transition-all flex items-center justify-between gap-3 text-xs"
                              >
                                <span className="font-bold truncate text-ink hover:text-civic">{art.title}</span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-bold text-ink/50 uppercase whitespace-nowrap">
                                  {art.content_kind.replace(/_/g, " ")}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {(actionType === "import" || actionType === "export") && (
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="grid gap-1.5 text-xs font-bold text-ink">
                                <span>Action Mode</span>
                                <div className="grid grid-cols-3 gap-2">
                                  {(["content", "link", "both"] as const).map(mode => (
                                    <button
                                      key={mode}
                                      type="button"
                                      onClick={() => setImportExportMode(mode)}
                                      className={`h-8 rounded font-bold text-[10px] capitalize transition-all border ${
                                        importExportMode === mode
                                          ? "bg-civic text-white border-civic"
                                          : "bg-white text-ink border-line hover:bg-paper"
                                      }`}
                                    >
                                      {mode}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {(importExportMode === "link" || importExportMode === "both") ? (
                                <label className="grid gap-1.5 text-xs font-bold text-ink">
                                  Custom Hyperlink Text (Optional)
                                  <input
                                    type="text"
                                    className="h-8 rounded-lg border border-line px-3 text-xs outline-none focus:border-civic font-normal"
                                    placeholder={
                                      actionType === "import"
                                        ? `Defaults to: ${allArticles.find(a => a.id === activeActionArticleId)?.title || ""}`
                                        : `Defaults to: ${formState.title || "Current Article"}`
                                    }
                                    value={customLinkText}
                                    onChange={(e) => setCustomLinkText(e.target.value)}
                                  />
                                </label>
                              ) : (
                                <div className="text-xs text-ink/50 italic flex items-center pt-5">
                                  No link will be generated in this mode.
                                </div>
                              )}
                            </div>

                            <div className="space-y-1.5 pt-2 border-t border-line/40">
                              <span className="text-xs font-bold text-ink/75 block">
                                {actionType === "import"
                                  ? "Target Article Content Preview (Highlight text to import a selection):"
                                  : "Current Article Content Preview (Highlight text to export a selection):"}
                              </span>
                              <p className="text-[10px] text-ink/50 leading-tight">
                                💡 <em>Optional: Highlight text inside the preview below to {actionType === "import" ? "import" : "export"} only that portion, otherwise the whole article content will be {actionType === "import" ? "appended" : "exported"}.</em>
                              </p>
                              {loadingPreview && actionType === "import" ? (
                                <div className="h-72 border border-line rounded-lg bg-slate-50 flex items-center justify-center text-xs text-ink/60 animate-pulse">
                                  <Loader2 className="h-5 w-5 animate-spin text-civic mr-1.5" />
                                  Loading preview...
                                </div>
                              ) : (
                                <div 
                                  id="import-preview-content"
                                  onMouseUp={handlePreviewSelect}
                                  onKeyUp={handlePreviewSelect}
                                  className="h-72 overflow-y-auto border border-line rounded-lg p-3 bg-paper/10 text-xs leading-relaxed select-text article-body prose prose-civic max-w-none shadow-inner"
                                  dangerouslySetInnerHTML={{
                                    __html: actionType === "import"
                                      ? (importPreviewBody || "<p class='italic text-ink/40'>No content available to preview.</p>")
                                      : (formState.body || "<p class='italic text-ink/40'>Current article is empty.</p>")
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {actionType === "connect" && (
                          <div className="grid gap-3 pt-2 border-t border-line/60">
                            <label className="grid gap-1 text-xs font-bold text-ink">
                              Relation Type
                              <select
                                className="h-10 rounded-lg border border-line bg-white px-3 text-xs font-normal outline-none focus:border-civic"
                                value={relationType}
                                onChange={(e) => setRelationType(e.target.value)}
                              >
                                <option value="related_reference">Related Reference (Intra-article reference)</option>
                                <option value="base_current_affairs">Base Current Affairs (Daily Editorial link)</option>
                                <option value="imported_source">Imported Source (Notes content import)</option>
                                <option value="follow_up">Follow Up</option>
                                <option value="prerequisite">Prerequisite</option>
                                <option value="mains_fodder">Mains Fodder</option>
                                <option value="pyq_context">PYQ Context</option>
                              </select>
                            </label>

                            <div className="bg-civic/5 border border-civic/10 p-2.5 rounded-lg text-[10px] leading-relaxed text-civic font-semibold">
                              💡 <strong>Relation Explanation:</strong> {RELATION_TYPE_EXPLANATIONS[relationType] || "Select a relation type."}
                            </div>

                            <div className="grid gap-2">
                              <label className="grid gap-1 text-xs font-bold text-ink">
                                Custom Label (Optional)
                                <input
                                  className="h-9 rounded-lg border border-line px-3 text-xs font-normal outline-none focus:border-civic"
                                  value={relLabel}
                                  onChange={(e) => setRelLabel(e.target.value)}
                                  placeholder="e.g. Read context"
                                />
                              </label>
                              <label className="grid gap-1 text-xs font-bold text-ink">
                                Note (Optional)
                                <input
                                  className="h-9 rounded-lg border border-line px-3 text-xs font-normal outline-none focus:border-civic"
                                  value={relNote}
                                  onChange={(e) => setRelNote(e.target.value)}
                                  placeholder="Administrative note"
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex gap-2 justify-end pt-3 border-t border-line">
                      <button
                        type="button"
                        onClick={handleCancelAction}
                        disabled={processingAction}
                        className="h-9 px-4 rounded-lg border border-line text-xs font-bold text-ink hover:bg-paper transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteAction}
                        disabled={processingAction}
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-civic px-4 text-xs font-bold text-white hover:bg-civic/90 active:scale-[0.98] disabled:opacity-50 transition-all"
                      >
                        {processingAction ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 font-bold" />
                            Processing...
                          </>
                        ) : (
                          "Execute Action"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-line">
              <button
                className="h-11 px-6 rounded-xl border border-line font-bold text-ink hover:bg-paper transition-all"
                onClick={() => {
                  setEditingDraftId(null);
                  setFormState(initialForm(defaultKind));
                  setDraftRelations([]);
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
                {pending ? "Saving..." : editingDraftId ? "Update Draft" : "Create and Save Article"}
              </button>
            </div>
          </form>

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
                        <span className="text-[9px] font-extrabold text-civic uppercase tracking-wider bg-civic/5 px-1.5 py-0.5 rounded">
                          {art.content_kind.replace(/_/g, " ")}
                        </span>
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
