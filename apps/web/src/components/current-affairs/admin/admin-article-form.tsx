"use client";

import { Save, Link2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { AdminArticleSummary, CategoryNode, CreateAdminArticlePayload } from "../../../lib/api";
import type { ContentKind } from "../../../lib/current-affairs";
import {
  ADMIN_ARTICLE_STATUSES,
  ADMIN_CONTENT_KINDS,
  adminSlug,
  contentFamilyForKind,
  joinAdminTags,
  splitAdminTags,
  type MasterArticleStatus
} from "../../../lib/admin-current-affairs";
import { authenticatedGet, useAuth } from "../../auth/auth-context";
import { RichTextMarkdownEditor } from "../rich-text-editor";
import { CascadingCategorySelector } from "./cascading-category-selector";

type DraftRelation = {
  targetArticleId: number;
  targetArticleTitle: string;
  relationType: string;
  label?: string;
  note?: string;
};

type AdminArticleFormProps = {
  article: AdminArticleSummary | null;
  categories: CategoryNode[];
  pending: boolean;
  onCancelEdit: () => void;
  onSubmit: (payload: CreateAdminArticlePayload & { draftRelations?: DraftRelation[] }, articleId?: number) => Promise<void>;
};

type ArticleFormState = {
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

function defaultState(): ArticleFormState {
  return {
    title: "",
    slug: "",
    contentKind: "daily_current_affairs",
    status: "draft",
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
  };
}

function stateFromArticle(article: AdminArticleSummary): ArticleFormState {
  const bj = article.body_json || {};
  const options = bj.options || [];
  return {
    title: article.title,
    slug: article.slug,
    contentKind: article.content_kind,
    status: article.status,
    categoryNodeId: article.category?.id ? String(article.category.id) : "",
    publicationDate: article.publication_date ?? "",
    sourceName: article.source_name ?? "",
    sourceUrl: article.source_url ?? "",
    tags: joinAdminTags(article.institute_tags),
    body: article.body,
    isAiGenerated: article.is_ai_generated,
    seoTitle: (article as any).seo_title ?? "",
    seoDescription: (article as any).seo_description ?? "",
    canonicalUrl: (article as any).canonical_url ?? "",
    keywords: (article as any).keywords ? (article as any).keywords.join(", ") : "",
    // PYQ specific fields
    year: bj.year ? String(bj.year) : new Date().getFullYear().toString(),
    questionStatement: bj.question_statement || "",
    suppQuestionStatement: bj.supp_question_statement || "",
    questionPrompt: bj.question_prompt || "",
    optionA: options[0]?.text || options.find((o: any) => o.label === "A")?.text || "",
    optionB: options[1]?.text || options.find((o: any) => o.label === "B")?.text || "",
    optionC: options[2]?.text || options.find((o: any) => o.label === "C")?.text || "",
    optionD: options[3]?.text || options.find((o: any) => o.label === "D")?.text || "",
    correctAnswer: bj.correct_answer || "A",
    explanation: bj.explanation || "",
    wordLimit: bj.word_limit ? String(bj.word_limit) : "250",
    maxMarks: bj.max_marks ? String(bj.max_marks) : "15",
    answerApproach: bj.answer_approach || "",
    modelAnswer: bj.model_answer || ""
  };
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

export function AdminArticleForm({
  article,
  categories,
  pending,
  onCancelEdit,
  onSubmit
}: AdminArticleFormProps) {
  const { token } = useAuth();
  const [state, setState] = useState<ArticleFormState>(() => article ? stateFromArticle(article) : defaultState());
  const [allArticles, setAllArticles] = useState<any[]>([]);
  const [draftRelations, setDraftRelations] = useState<DraftRelation[]>([]);
  
  const [relTargetId, setRelTargetId] = useState("");
  const [relType, setRelType] = useState("related_reference");
  const [relLabel, setRelLabel] = useState("");
  const [relNote, setRelNote] = useState("");

  useEffect(() => {
    setState(article ? stateFromArticle(article) : defaultState());
    setDraftRelations([]);
  }, [article]);

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

  const family = contentFamilyForKind(state.contentKind);
  const categoryOptions = useMemo(
    () => categories.filter((category) => category.content_family === family && category.is_active !== false),
    [categories, family]
  );

  function update<K extends keyof ArticleFormState>(key: K, value: ArticleFormState[K]): void {
    setState((current) => ({ ...current, [key]: value }));
  }

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

  const removeDraftRelation = (idx: number) => {
    setDraftRelations(prev => prev.filter((_, i) => i !== idx));
  };

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    let finalBody = state.body;
    let finalBodyJson: any = undefined;

    if (state.contentKind === "prelims_pyq") {
      finalBodyJson = {
        year: state.year,
        question_statement: state.questionStatement,
        supp_question_statement: state.suppQuestionStatement || undefined,
        question_prompt: state.questionPrompt || undefined,
        options: [
          { label: "A", text: state.optionA },
          { label: "B", text: state.optionB },
          { label: "C", text: state.optionC },
          { label: "D", text: state.optionD }
        ],
        correct_answer: state.correctAnswer,
        explanation: state.explanation
      };
      
      finalBody = `### Year: ${state.year}\n\n**${state.questionStatement}**\n\n${state.suppQuestionStatement ? `${state.suppQuestionStatement}\n\n` : ""}${state.questionPrompt ? `${state.questionPrompt}\n\n` : ""}(a) ${state.optionA}\n(b) ${state.optionB}\n(c) ${state.optionC}\n(d) ${state.optionD}\n\n**Correct Answer: (${state.correctAnswer})**\n\n### Explanation\n${state.explanation}`;
    } else if (state.contentKind === "mains_pyq") {
      finalBodyJson = {
        year: state.year,
        question_statement: state.questionStatement,
        word_limit: Number(state.wordLimit) || 250,
        max_marks: Number(state.maxMarks) || 15,
        answer_approach: state.answerApproach,
        model_answer: state.modelAnswer
      };
      
      finalBody = `### Year: ${state.year} | Marks: ${state.maxMarks} | Word Limit: ${state.wordLimit}\n\n**${state.questionStatement}**\n\n### Answer Approach\n${state.answerApproach}\n\n### Model Answer\n${state.modelAnswer}`;
    }

    const payload: CreateAdminArticlePayload & { body_json?: any; draftRelations?: DraftRelation[] } = {
      content_kind: state.contentKind,
      title: state.title,
      slug: state.slug || adminSlug(state.title),
      body: finalBody,
      body_json: finalBodyJson,
      draftRelations: draftRelations,
      category_node_id: state.categoryNodeId ? Number(state.categoryNodeId) : undefined,
      source_name: state.sourceName.trim() || undefined,
      source_url: state.sourceUrl.trim() || undefined,
      publication_date: state.publicationDate || undefined,
      institute_tags: splitAdminTags(state.tags),
      status: state.status,
      is_ai_generated: state.isAiGenerated,
      seo_title: state.seoTitle.trim() || undefined,
      seo_description: state.seoDescription.trim() || undefined,
      canonical_url: state.canonicalUrl.trim() || undefined,
      keywords: splitAdminTags(state.keywords)
    };

    await onSubmit(payload, article?.id);
    if (!article) {
      setState(defaultState());
      setDraftRelations([]);
    }
  }

  return (
    <form className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-sm" onSubmit={submit}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-ink">{article ? "Edit article" : "Create article"}</h2>
        {article && (
          <button
            className="h-10 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink"
            onClick={onCancelEdit}
            type="button"
          >
            New
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold text-ink">
          Content kind
          <select
            className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
            onChange={(event) => update("contentKind", event.target.value as ContentKind)}
            value={state.contentKind}
          >
            {ADMIN_CONTENT_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-bold text-ink">
          Status
          <select
            className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
            onChange={(event) => update("status", event.target.value as MasterArticleStatus)}
            value={state.status}
          >
            {ADMIN_ARTICLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-1 text-sm font-bold text-ink">
        Title
        <input
          className="h-11 rounded-md border border-line px-3 text-base font-normal"
          onBlur={() => {
            if (!state.slug) update("slug", adminSlug(state.title));
          }}
          onChange={(event) => update("title", event.target.value)}
          required
          value={state.title}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold text-ink">
          Slug
          <input
            className="h-11 rounded-md border border-line px-3 text-base font-normal"
            onChange={(event) => update("slug", adminSlug(event.target.value))}
            required
            value={state.slug}
          />
        </label>

        <label className="grid gap-1 text-sm font-bold text-ink">
          Publication date
          <input
            className="h-11 rounded-md border border-line px-3 text-base font-normal"
            onChange={(event) => update("publicationDate", event.target.value)}
            type="date"
            value={state.publicationDate}
          />
        </label>
      </div>

      <div className="grid gap-2 border border-line/50 p-3 rounded-lg bg-surface/30">
        <span className="text-sm font-bold text-ink">Category (Cascading Subject ➔ Topic ➔ Subtopic)</span>
        <CascadingCategorySelector
          categories={categories}
          value={state.categoryNodeId}
          onChange={(nodeId) => update("categoryNodeId", nodeId)}
          contentFamily={family}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold text-ink">
          Source name
          <input
            className="h-11 rounded-md border border-line px-3 text-base font-normal"
            onChange={(event) => update("sourceName", event.target.value)}
            value={state.sourceName}
          />
        </label>

        <label className="grid gap-1 text-sm font-bold text-ink">
          Source URL
          <input
            className="h-11 rounded-md border border-line px-3 text-base font-normal"
            onChange={(event) => update("sourceUrl", event.target.value)}
            type="url"
            value={state.sourceUrl}
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm font-bold text-ink">
        Tags
        <input
          className="h-11 rounded-md border border-line px-3 text-base font-normal"
          onChange={(event) => update("tags", event.target.value)}
          value={state.tags}
        />
      </label>

      <details className="group border border-line rounded-lg bg-surface p-3 overflow-hidden transition-all duration-300">
        <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-bold text-ink select-none">
          <span>Search Engine Optimization (SEO) & Meta Settings</span>
          <span className="text-civic transition-transform group-open:rotate-180 text-xs">▼</span>
        </summary>
        <div className="grid gap-3 mt-3 pt-3 border-t border-line/50">
          <label className="grid gap-1 text-xs font-bold text-ink">
            SEO Title Override
            <input
              className="h-10 rounded-md border border-line px-3 text-sm font-normal bg-white"
              onChange={(event) => update("seoTitle", event.target.value)}
              placeholder="Defaults to article title"
              value={state.seoTitle}
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-ink">
            SEO Meta Description
            <textarea
              className="min-h-16 rounded-md border border-line px-3 py-2 text-sm font-normal bg-white"
              onChange={(event) => update("seoDescription", event.target.value)}
              placeholder="Brief summary for search engine results"
              value={state.seoDescription}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold text-ink">
              Canonical URL
              <input
                className="h-10 rounded-md border border-line px-3 text-sm font-normal bg-white"
                onChange={(event) => update("canonicalUrl", event.target.value)}
                placeholder="https://yourdomain.com/..."
                value={state.canonicalUrl}
              />
            </label>
            <label className="grid gap-1 text-xs font-bold text-ink">
              Meta Keywords (comma-separated)
              <input
                className="h-10 rounded-md border border-line px-3 text-sm font-normal bg-white"
                onChange={(event) => update("keywords", event.target.value)}
                placeholder="e.g. data-privacy, upsc-notes"
                value={state.keywords}
              />
            </label>
          </div>
        </div>
      </details>

      {state.contentKind === "prelims_pyq" ? (
        <div className="space-y-4 rounded-xl border border-line bg-paper/20 p-4">
          <h3 className="text-sm font-bold text-ink uppercase tracking-wider">UPSC Prelims Question Editor</h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Exam Year
              <input
                className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                onChange={(event) => update("year", event.target.value)}
                type="text"
                value={state.year}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Correct Answer Key
              <select
                className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                onChange={(event) => update("correctAnswer", event.target.value)}
                value={state.correctAnswer}
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
            value={state.questionStatement}
            onChange={(val) => update("questionStatement", val)}
            placeholder="e.g. Consider the following statements regarding..."
            required
            minHeightClass="min-h-[140px]"
          />

          <label className="grid gap-1.5 text-xs font-bold text-ink">
            Supplementary Facts / List (Optional)
            <textarea
              className="min-h-20 rounded-lg border border-line px-3 py-2 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
              onChange={(event) => update("suppQuestionStatement", event.target.value)}
              placeholder="e.g. 1. It is a constitutional body...\n2. It meets twice a year..."
              value={state.suppQuestionStatement}
            />
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-ink">
            Question Prompt (Optional)
            <input
              className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
              onChange={(event) => update("questionPrompt", event.target.value)}
              placeholder="e.g. Which of the statements given above is/are correct?"
              value={state.questionPrompt}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Option A *
              <input
                className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                onChange={(event) => update("optionA", event.target.value)}
                required
                value={state.optionA}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Option B *
              <input
                className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                onChange={(event) => update("optionB", event.target.value)}
                required
                value={state.optionB}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Option C *
              <input
                className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                onChange={(event) => update("optionC", event.target.value)}
                required
                value={state.optionC}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Option D *
              <input
                className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                onChange={(event) => update("optionD", event.target.value)}
                required
                value={state.optionD}
              />
            </label>
          </div>

          <RichTextMarkdownEditor
            label="Explanation"
            value={state.explanation}
            onChange={(val) => update("explanation", val)}
            placeholder="Describe the solution details..."
            required
            minHeightClass="min-h-[160px]"
          />
        </div>
      ) : state.contentKind === "mains_pyq" ? (
        <div className="space-y-4 rounded-xl border border-line bg-paper/20 p-4">
          <h3 className="text-sm font-bold text-ink uppercase tracking-wider">UPSC Mains Question Editor</h3>
          
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Exam Year
              <input
                className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                onChange={(event) => update("year", event.target.value)}
                type="text"
                value={state.year}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Max Marks
              <input
                className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                onChange={(event) => update("maxMarks", event.target.value)}
                type="number"
                value={state.maxMarks}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Word Limit
              <input
                className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic focus:ring-2 focus:ring-civic/20"
                onChange={(event) => update("wordLimit", event.target.value)}
                type="number"
                value={state.wordLimit}
              />
            </label>
          </div>

          <RichTextMarkdownEditor
            label="Question Statement"
            value={state.questionStatement}
            onChange={(val) => update("questionStatement", val)}
            placeholder="e.g. Discuss the potential of India's demographic dividend..."
            required
            minHeightClass="min-h-[140px]"
          />

          <RichTextMarkdownEditor
            label="Structured Answering Approach / Guidelines"
            value={state.answerApproach}
            onChange={(val) => update("answerApproach", val)}
            placeholder="1. Introduction (Define dividend)\n2. Key Challenges (Job growth, skill mismatches)...\n3. Way Forward"
            required
            minHeightClass="min-h-[160px]"
          />

          <RichTextMarkdownEditor
            label="Model Answer"
            value={state.modelAnswer}
            onChange={(val) => update("modelAnswer", val)}
            placeholder="Write the full reference model answer key here..."
            required
            minHeightClass="min-h-[240px]"
          />
        </div>
      ) : (
        <RichTextMarkdownEditor
          label="Article Body (Markdown)"
          value={state.body}
          onChange={(val) => update("body", val)}
          placeholder="Write the educational content here. Markdown is fully supported..."
          required
          minHeightClass="min-h-[300px]"
        />
      )}

      {/* Connect & Link Other Articles */}
      <div className="space-y-4 rounded-xl border border-line bg-paper/20 p-4">
        <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
          <Link2 className="h-4 w-4 text-civic" />
          Connect & Link Other Articles
        </h3>
        
        {draftRelations.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-ink/65">Attached Article Connections:</span>
            <div className="grid gap-2">
              {draftRelations.map((rel, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white border border-line p-2.5 rounded-lg text-xs shadow-xs">
                  <div>
                    <span className="font-bold text-civic mr-1">[{rel.relationType}]</span>
                    <span className="font-semibold text-ink">{rel.targetArticleTitle}</span>
                    {rel.label && <span className="text-ink/60 italic ml-1">({rel.label})</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDraftRelation(idx)}
                    className="text-rose-500 hover:text-rose-700 font-bold px-2 py-1 hover:bg-rose-50 rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 pt-2 border-t border-line/60">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold text-ink">
              Select Target Article
              <select
                className="h-10 rounded-lg border border-line bg-white px-3 text-xs font-normal outline-none focus:border-civic"
                value={relTargetId}
                onChange={(e) => setRelTargetId(e.target.value)}
              >
                <option value="">-- Choose Article --</option>
                {allArticles.map((art) => (
                  <option key={art.id} value={art.id}>
                    [{art.content_kind.replace(/_/g, " ")}] {art.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-ink">
              Relation Type
              <select
                className="h-10 rounded-lg border border-line bg-white px-3 text-xs font-normal outline-none focus:border-civic"
                value={relType}
                onChange={(e) => setRelType(e.target.value)}
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
          </div>

          <div className="bg-civic/5 border border-civic/10 p-3 rounded-lg text-xs leading-relaxed text-civic font-semibold">
            💡 <strong>Relation Explanation:</strong> {RELATION_TYPE_EXPLANATIONS[relType] || "Select a relation type."}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold text-ink">
              Custom Label (Optional)
              <input
                className="h-10 rounded-lg border border-line px-3 text-xs font-normal outline-none focus:border-civic"
                value={relLabel}
                onChange={(e) => setRelLabel(e.target.value)}
                placeholder="e.g. Read context"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold text-ink">
              Note (Optional)
              <input
                className="h-10 rounded-lg border border-line px-3 text-xs font-normal outline-none focus:border-civic"
                value={relNote}
                onChange={(e) => setRelNote(e.target.value)}
                placeholder="Administrative note"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={addDraftRelation}
              disabled={!relTargetId}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-civic px-4 text-xs font-bold text-white hover:bg-civic/90 active:scale-[0.98] disabled:opacity-50"
            >
              Attach Connection
            </button>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input
          checked={state.isAiGenerated}
          className="h-4 w-4"
          onChange={(event) => update("isAiGenerated", event.target.checked)}
          type="checkbox"
        />
        AI generated
      </label>

      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        <Save aria-hidden="true" className="h-4 w-4" />
        {pending ? "Saving..." : article ? "Save changes" : "Create article"}
      </button>
    </form>
  );
}
