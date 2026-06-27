"use client";

import { ArrowLeft, CheckCircle2, ClipboardList, FileQuestion, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SignInPanel } from "../auth/sign-in-panel";
import { authenticatedDelete, authenticatedGet, authenticatedPatch, authenticatedPost, useAuth } from "../auth/auth-context";
import { formatStudyPlanItemType, type StudyPlanQuestion, type StudyPlanTestTemplate, type StudyPlanTestType } from "../../lib/study-plans";
import { RichTextMarkdownEditor } from "../current-affairs/rich-text-editor";
import { renderMathAndMarkdown, useKaTeX } from "../current-affairs/admin/katex-renderer";

type TaxonomyNode = {
  id: number;
  exam_id: number;
  parent_id?: number | null;
  node_type: string;
  name: string;
  slug: string;
  content_type?: "gk" | "aptitude";
};

type MainsTaxonomyNode = {
  id: number;
  exam_id: number;
  parent_id?: number | null;
  node_type: "paper" | "subject_area" | "theme" | "topic" | "subtopic";
  name: string;
  slug: string;
};

type QuestionNature = {
  id: number;
  exam_id: number;
  name: string;
  slug: string;
};

type StudyPlanTestDetail = StudyPlanTestTemplate & {
  exam?: { id: number; name: string };
  exam_level?: { id: number; name: string };
  questions: StudyPlanQuestion[];
};

type DraftOption = { label: string; text: string; is_correct?: boolean };
type DraftQuestion = {
  display_order: number;
  question_family: "objective" | "mains_subjective";
  question_statement: string;
  supplementary_statement?: string;
  question_prompt?: string;
  options: DraftOption[];
  correct_answer?: string;
  explanation?: string;
  model_answer?: string;
  word_limit?: number;
  marks: number;
  negative_marks: number;
  subject_node_id?: number;
  topic_node_id?: number;
  subtopic_node_id?: number;
  question_nature_id?: number;
  source_payload?: Record<string, unknown>;
};

type ParseMode = "gk" | "csat_math" | "csat_passage" | "mains";
type DraftWorkspaceMode = "manual" | "parse";
type TaxonomyContentType = "gk" | "aptitude";

const TEST_TYPE_OPTIONS: { value: StudyPlanTestType; label: string; note: string }[] = [
  { value: "prelims_test", label: "Prelims test", note: "GK / General Studies objective questions." },
  { value: "csat_test", label: "CSAT test", note: "Aptitude, maths, reasoning, and passage questions." },
  { value: "mains_test", label: "Mains test", note: "Subjective questions with reference answers." }
];

const CONTENT_MODE_LABELS: Record<ParseMode, string> = {
  gk: "Prelims GK objective",
  csat_math: "CSAT maths / reasoning",
  csat_passage: "CSAT passage quiz",
  mains: "Mains question + reference answer"
};

function Field({ children, label, note }: { children: ReactNode; label: string; note: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-ink/70">
      <span className="text-[11px] font-black uppercase tracking-wide text-ink/55">{label}</span>
      {children}
      <span className="text-[11px] font-semibold leading-4 text-ink/45">{note}</span>
    </label>
  );
}

function isObjective(testType: StudyPlanTestType) {
  return testType !== "mains_test";
}

function taxonomyContentTypeForTest(testType: StudyPlanTestType): TaxonomyContentType {
  return testType === "csat_test" ? "aptitude" : "gk";
}

function contentModesForTest(testType: StudyPlanTestType): ParseMode[] {
  if (testType === "prelims_test") return ["gk"];
  if (testType === "csat_test") return ["csat_math", "csat_passage"];
  return ["mains"];
}

function defaultParseModeForTest(testType: StudyPlanTestType): ParseMode {
  return contentModesForTest(testType)[0] ?? "gk";
}

function inferTestTypeFromExamLevel(levelName: string | undefined, savedType: StudyPlanTestType): StudyPlanTestType {
  const normalized = levelName?.toLowerCase() ?? "";
  if (normalized.includes("csat") || normalized.includes("aptitude")) return "csat_test";
  if (normalized.includes("mains")) return "mains_test";
  if (normalized.includes("prelims")) return "prelims_test";
  return savedType;
}

function readQuestionContentMode(question: Pick<DraftQuestion | StudyPlanQuestion, "source_payload">): string | undefined {
  const payload = question.source_payload;
  if (!payload || typeof payload !== "object") return undefined;
  const mode = payload.content_mode ?? payload.content_type;
  return typeof mode === "string" ? mode : undefined;
}

function contentModeLabel(mode?: string): string {
  if (mode === "gk") return "Prelims GK";
  if (mode === "aptitude") return "CSAT aptitude";
  if (mode === "csat_math") return "CSAT maths";
  if (mode === "csat_passage") return "CSAT passage";
  if (mode === "mains") return "Mains";
  return "Unclassified";
}

function readSourcePayload(question: Pick<DraftQuestion | StudyPlanQuestion, "source_payload">): Record<string, unknown> {
  return question.source_payload && typeof question.source_payload === "object" ? question.source_payload : {};
}

function readWordLimit(question: Pick<DraftQuestion | StudyPlanQuestion, "source_payload"> & { word_limit?: number }): number {
  const direct = Number(question.word_limit);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const payload = readSourcePayload(question);
  const payloadLimit = Number(payload.word_limit);
  return Number.isFinite(payloadLimit) && payloadLimit > 0 ? payloadLimit : 250;
}

function manualModeDescription(mode: ParseMode): string {
  if (mode === "gk") return "Create a normal Prelims GK objective question with four options.";
  if (mode === "csat_math") return "Create a CSAT maths, reasoning, or aptitude question with LaTeX support.";
  if (mode === "csat_passage") return "Create a passage-linked CSAT question and keep the passage tied to the quiz.";
  return "Create a mains subjective question with a reference answer field.";
}

function questionFitsTestType(question: StudyPlanQuestion, testType: StudyPlanTestType): boolean {
  if (testType === "mains_test" && question.question_family !== "mains_subjective") return false;
  if (testType !== "mains_test" && question.question_family !== "objective") return false;
  const mode = readQuestionContentMode(question);
  if (!mode) return true;
  if (testType === "prelims_test") return mode === "gk";
  if (testType === "csat_test") return ["aptitude", "csat_math", "csat_passage"].includes(mode);
  return mode === "mains";
}

function parseOptions(options: unknown): DraftOption[] {
  if (!Array.isArray(options)) return [];
  return options.map((option, index) => {
    if (typeof option === "object" && option !== null) {
      const record = option as Record<string, unknown>;
      return {
        label: String(record.label ?? record.key ?? String.fromCharCode(65 + index)),
        text: String(record.text ?? record.value ?? record.statement ?? ""),
        is_correct: Boolean(record.is_correct)
      };
    }
    return { label: String.fromCharCode(65 + index), text: String(option), is_correct: false };
  });
}

function readAnswer(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return String(record.key ?? record.label ?? record.value ?? "");
  }
  return "";
}

function normalizeDraft(raw: any, index: number, context: {
  testType: StudyPlanTestType;
  parseMode: ParseMode;
  subjectId?: number;
  topicId?: number;
  subtopicId?: number;
  natureId?: number;
  passageTitle?: string;
  passageText?: string;
}): DraftQuestion {
  const mains = context.testType === "mains_test" || context.parseMode === "mains";
  const passageText = raw.passage_text ?? context.passageText;
  const sourcePayload = {
    ...(raw.source_payload ?? raw),
    content_mode: context.parseMode,
    passage_title: raw.passage_title ?? context.passageTitle,
    passage_text: passageText,
    passage_group_key: passageText ? `passage-${Date.now()}` : undefined
  };
  const options = mains ? [] : parseOptions(raw.options);
  const correct = raw.correct_answer ?? options.find((option) => option.is_correct)?.label;
  return {
    display_order: Number(raw.display_order ?? index + 1),
    question_family: mains ? "mains_subjective" : "objective",
    question_statement: raw.question_statement ?? raw.question ?? raw.prompt ?? "",
    supplementary_statement: raw.supplementary_statement ?? raw.supp_question_statement ?? passageText ?? "",
    question_prompt: raw.question_prompt ?? (mains ? raw.directive ?? "Write your answer." : "Choose the correct option."),
    options,
    correct_answer: mains ? undefined : readAnswer(correct),
    explanation: raw.explanation ?? "",
    model_answer: raw.model_answer ?? "",
    word_limit: mains ? Number(raw.word_limit ?? raw.source_payload?.word_limit ?? 250) : undefined,
    marks: Number(raw.marks ?? (mains ? 10 : 2)),
    negative_marks: Number(raw.negative_marks ?? (mains ? 0 : context.testType === "csat_test" ? 0 : 0.66)),
    subject_node_id: raw.subject_node_id ?? context.subjectId,
    topic_node_id: raw.topic_node_id ?? context.topicId,
    subtopic_node_id: raw.subtopic_node_id ?? context.subtopicId,
    question_nature_id: raw.question_nature_id ?? context.natureId,
    source_payload: sourcePayload
  };
}

function toPayload(question: DraftQuestion) {
  const sourcePayload = { ...(question.source_payload ?? {}) };
  if (sourcePayload.content_mode === "csat_passage" && question.supplementary_statement) {
    sourcePayload.passage_text = question.supplementary_statement;
    sourcePayload.passage_group_key = sourcePayload.passage_group_key ?? `manual-passage-${question.display_order}`;
  }
  if (question.question_family === "mains_subjective") {
    sourcePayload.content_mode = "mains";
    sourcePayload.word_limit = readWordLimit(question);
    return {
      display_order: question.display_order,
      question_family: "mains_subjective",
      question_statement: question.question_statement,
      supplementary_statement: undefined,
      question_prompt: undefined,
      options: [],
      correct_answer: undefined,
      explanation: undefined,
      model_answer: question.model_answer || undefined,
      marks: question.marks,
      negative_marks: 0,
      subject_node_id: null,
      topic_node_id: null,
      subtopic_node_id: null,
      question_nature_id: null,
      source_payload: sourcePayload
    };
  }
  return {
    display_order: question.display_order,
    question_family: question.question_family,
    question_statement: question.question_statement,
    supplementary_statement: question.supplementary_statement || undefined,
    question_prompt: question.question_prompt || undefined,
    options: question.options,
    correct_answer: question.correct_answer || undefined,
    explanation: question.explanation || undefined,
    model_answer: question.model_answer || undefined,
    marks: question.marks,
    negative_marks: question.negative_marks,
    subject_node_id: question.subject_node_id ?? null,
    topic_node_id: question.topic_node_id ?? null,
    subtopic_node_id: question.subtopic_node_id ?? null,
    question_nature_id: question.question_nature_id ?? null,
    source_payload: sourcePayload
  };
}

function QuestionPreview({
  question,
  index
}: {
  question: DraftQuestion | StudyPlanQuestion;
  index: number;
}) {
  useKaTeX();
  const options = parseOptions(question.options);
  const passageText = typeof question.source_payload?.passage_text === "string" ? question.source_payload.passage_text : null;
  const contentMode = readQuestionContentMode(question);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-civic/10 px-2 py-1 text-[11px] font-black text-civic">Q{index + 1}</span>
        <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black capitalize text-ink/55">{question.question_family.replace(/_/g, " ")}</span>
        <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black text-ink/55">{contentModeLabel(contentMode)}</span>
        <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black text-ink/55">{question.marks} marks</span>
        {question.question_family === "mains_subjective" && (
          <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black text-ink/55">{readWordLimit(question)} words</span>
        )}
      </div>
      {passageText && (
        <div className="rounded-md border border-line bg-paper p-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-ink/45">Linked passage</p>
          <div className="mt-2 text-sm leading-6 text-ink/75" dangerouslySetInnerHTML={renderMathAndMarkdown(passageText)} />
        </div>
      )}
      <div className="text-sm font-black leading-6 text-ink" dangerouslySetInnerHTML={renderMathAndMarkdown(question.question_statement)} />
      {question.supplementary_statement && !passageText && (
        <div className="rounded-md border-l-2 border-line bg-paper p-3 text-sm leading-6 text-ink/70" dangerouslySetInnerHTML={renderMathAndMarkdown(question.supplementary_statement)} />
      )}
      {question.question_prompt && question.question_family !== "mains_subjective" && <div className="text-xs font-bold text-civic" dangerouslySetInnerHTML={renderMathAndMarkdown(question.question_prompt)} />}
      {options.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {options.map((option) => {
            const correct = option.label === readAnswer(question.correct_answer) || option.is_correct;
            return (
              <div className={`rounded-md border px-3 py-2 text-xs font-semibold ${correct ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line bg-white text-ink/70"}`} key={option.label}>
                <span className="font-black">{option.label}.</span>{" "}
                <span dangerouslySetInnerHTML={renderMathAndMarkdown(option.text)} />
              </div>
            );
          })}
        </div>
      )}
      {question.model_answer && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">Reference answer</p>
          <div className="mt-2 text-sm leading-6 text-ink/75" dangerouslySetInnerHTML={renderMathAndMarkdown(question.model_answer)} />
        </div>
      )}
      {question.explanation && (
        <div className="text-xs leading-5 text-ink/60" dangerouslySetInnerHTML={renderMathAndMarkdown(question.explanation)} />
      )}
    </div>
  );
}

export function AdminStudyPlanTestContent({ testTemplateId }: { testTemplateId: number }) {
  const { token, user, isInitialized } = useAuth();
  const [test, setTest] = useState<StudyPlanTestDetail | null>(null);
  const [taxonomyNodes, setTaxonomyNodes] = useState<TaxonomyNode[]>([]);
  const [mainsTaxonomyNodes, setMainsTaxonomyNodes] = useState<MainsTaxonomyNode[]>([]);
  const [natures, setNatures] = useState<QuestionNature[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [parseMode, setParseMode] = useState<ParseMode>("gk");
  const [workspaceMode, setWorkspaceMode] = useState<DraftWorkspaceMode>("manual");
  const [rawText, setRawText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [selectedDrafts, setSelectedDrafts] = useState<number[]>([]);
  const [editingSavedId, setEditingSavedId] = useState<number | null>(null);
  const [editingDraftIndex, setEditingDraftIndex] = useState<number | null>(null);
  const [tree, setTree] = useState({
    subject_id: "",
    source_id: "",
    topic_id: "",
    subtopic_id: "",
    question_nature_id: ""
  });
  const [mainsTree, setMainsTree] = useState({
    paper_id: "",
    subject_area_id: "",
    theme_id: "",
    topic_id: "",
    subtopic_id: ""
  });
  const [testForm, setTestForm] = useState({
    title: "",
    description: "",
    test_type: "prelims_test" as StudyPlanTestType,
    duration_minutes: "120",
    status: "draft",
    instructions: ""
  });

  const effectiveTestType = testForm.test_type || test?.test_type || "prelims_test";
  const contentType = taxonomyContentTypeForTest(effectiveTestType);
  const contentModeOptions = useMemo(() => contentModesForTest(effectiveTestType), [effectiveTestType]);
  const examNodes = useMemo(() => {
    if (!test) return [];
    return taxonomyNodes.filter((node) => node.exam_id === test.exam_id && node.content_type === contentType);
  }, [contentType, taxonomyNodes, test]);
  const subjects = useMemo(() => examNodes.filter((node) => node.node_type === "subject"), [examNodes]);
  const sourceNodes = useMemo(() => tree.subject_id ? examNodes.filter((node) => String(node.parent_id) === tree.subject_id && ["source_bucket", "subject_area"].includes(node.node_type)) : [], [examNodes, tree.subject_id]);
  const topics = useMemo(() => {
    const parent = tree.source_id || tree.subject_id;
    return parent ? examNodes.filter((node) => String(node.parent_id) === parent && ["topic", "theme"].includes(node.node_type)) : [];
  }, [examNodes, tree.source_id, tree.subject_id]);
  const subtopics = useMemo(() => tree.topic_id ? examNodes.filter((node) => String(node.parent_id) === tree.topic_id && node.node_type === "subtopic") : [], [examNodes, tree.topic_id]);
  const mainsExamNodes = useMemo(() => {
    if (!test) return [];
    return mainsTaxonomyNodes.filter((node) => node.exam_id === test.exam_id);
  }, [mainsTaxonomyNodes, test]);
  const mainsPapers = useMemo(() => mainsExamNodes.filter((node) => node.node_type === "paper" && !node.parent_id), [mainsExamNodes]);
  const mainsSubjectAreas = useMemo(() => mainsTree.paper_id ? mainsExamNodes.filter((node) => node.node_type === "subject_area" && String(node.parent_id) === mainsTree.paper_id) : [], [mainsExamNodes, mainsTree.paper_id]);
  const mainsThemes = useMemo(() => mainsTree.subject_area_id ? mainsExamNodes.filter((node) => node.node_type === "theme" && String(node.parent_id) === mainsTree.subject_area_id) : [], [mainsExamNodes, mainsTree.subject_area_id]);
  const mainsTopics = useMemo(() => mainsTree.theme_id ? mainsExamNodes.filter((node) => node.node_type === "topic" && String(node.parent_id) === mainsTree.theme_id) : [], [mainsExamNodes, mainsTree.theme_id]);
  const mainsSubtopics = useMemo(() => mainsTree.topic_id ? mainsExamNodes.filter((node) => node.node_type === "subtopic" && String(node.parent_id) === mainsTree.topic_id) : [], [mainsExamNodes, mainsTree.topic_id]);
  const savedQuestions = useMemo(() => {
    if (!test) return [];
    return (test.questions ?? []).filter((question) => {
      const belongsToCurrentTest = question.test_template_id === undefined || Number(question.test_template_id) === Number(test.id);
      return belongsToCurrentTest && questionFitsTestType(question, effectiveTestType);
    });
  }, [effectiveTestType, test]);
  const hiddenQuestionCount = Math.max(0, (test?.questions?.length ?? 0) - savedQuestions.length);
  const hasUnsavedTestTypeCorrection = Boolean(test && test.test_type !== effectiveTestType);

  useEffect(() => {
    if (!contentModeOptions.includes(parseMode)) setParseMode(defaultParseModeForTest(effectiveTestType));
  }, [contentModeOptions, effectiveTestType, parseMode]);

  const loadData = async () => {
    if (!token) return;
    const detail = await authenticatedGet<StudyPlanTestDetail>(`/api/v1/study-plan-tests/${testTemplateId}`, token);
    const [nodes, mainsNodes, natureRecords] = await Promise.all([
      authenticatedGet<TaxonomyNode[]>("/api/v1/assessment/taxonomy-nodes?limit=1000", token),
      authenticatedGet<MainsTaxonomyNode[]>(`/api/v1/assessment/mains/taxonomy-nodes?exam_id=${detail.exam_id}&limit=1000`, token),
      authenticatedGet<QuestionNature[]>(`/api/v1/assessment/question-natures?exam_id=${detail.exam_id}`, token)
    ]);
    const inferredTestType = inferTestTypeFromExamLevel(detail.exam_level?.name, detail.test_type);
    setTest(detail);
    setTaxonomyNodes(nodes);
    setMainsTaxonomyNodes(mainsNodes);
    setNatures(natureRecords);
    setTestForm({
      title: detail.title,
      description: detail.description ?? "",
      test_type: inferredTestType,
      duration_minutes: String(detail.duration_minutes),
      status: detail.status,
      instructions: detail.instructions ?? ""
    });
    setParseMode(defaultParseModeForTest(inferredTestType));
    setTree({
      subject_id: "",
      source_id: "",
      topic_id: "",
      subtopic_id: "",
      question_nature_id: ""
    });
    setMainsTree({
      paper_id: "",
      subject_area_id: "",
      theme_id: "",
      topic_id: "",
      subtopic_id: ""
    });
    if (inferredTestType !== detail.test_type) {
      setMessage(`This test is saved as ${formatStudyPlanItemType(detail.test_type)}, but the exam level is ${detail.exam_level?.name}. Save test settings to correct the type before saving questions.`);
    }
  };

  useEffect(() => {
    if (token) void loadData().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load test content."));
  }, [token, testTemplateId]);

  const selectedContext = {
    subjectId: effectiveTestType === "mains_test" ? undefined : tree.subject_id ? Number(tree.subject_id) : undefined,
    topicId: effectiveTestType === "mains_test" ? undefined : tree.topic_id ? Number(tree.topic_id) : undefined,
    subtopicId: effectiveTestType === "mains_test" ? undefined : tree.subtopic_id ? Number(tree.subtopic_id) : undefined,
    natureId: effectiveTestType === "mains_test" ? undefined : tree.question_nature_id ? Number(tree.question_nature_id) : undefined
  };

  const selectedMainsTaxonomy = {
    paper_node_id: mainsTree.paper_id ? Number(mainsTree.paper_id) : undefined,
    subject_area_node_id: mainsTree.subject_area_id ? Number(mainsTree.subject_area_id) : undefined,
    theme_node_id: mainsTree.theme_id ? Number(mainsTree.theme_id) : undefined,
    topic_node_id: mainsTree.topic_id ? Number(mainsTree.topic_id) : undefined,
    subtopic_node_id: mainsTree.subtopic_id ? Number(mainsTree.subtopic_id) : undefined
  };

  const applyMainsContext = (question: DraftQuestion): DraftQuestion => {
    if (effectiveTestType !== "mains_test") return question;
    return {
      ...question,
      question_family: "mains_subjective",
      options: [],
      correct_answer: undefined,
      negative_marks: 0,
      word_limit: readWordLimit(question),
      source_payload: {
        ...readSourcePayload(question),
        content_mode: "mains",
        word_limit: readWordLimit(question),
        mains_taxonomy: selectedMainsTaxonomy
      }
    };
  };

  const parseQuestions = async () => {
    if (!token || !test) return;
    setBusy("parse");
    setMessage(null);
    try {
      const result = await authenticatedPost<any>("/api/v1/study-plans/admin/ai/parse", token, {
        raw_text: rawText,
        content_type: parseMode,
        instructions
      });
      const rawQuestions = Array.isArray(result) ? result : result.questions ?? [];
      const normalized = rawQuestions.map((question: any, index: number) => applyMainsContext(normalizeDraft(question, index, {
        testType: effectiveTestType,
        parseMode,
        ...selectedContext,
        passageTitle: result.passage_title,
        passageText: result.passage_text
      })));
      setDrafts(normalized);
      setSelectedDrafts(normalized.map((_: DraftQuestion, index: number) => index));
      setMessage(`Parsed ${normalized.length} questions. Review the list before saving.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not parse questions.");
    } finally {
      setBusy(null);
    }
  };

  const addBlankDraft = (modeOverride?: ParseMode) => {
    if (!test) return;
    const draftMode = modeOverride ?? parseMode;
    const draft = normalizeDraft({}, savedQuestions.length + drafts.length, {
      testType: effectiveTestType,
      parseMode: draftMode,
      ...selectedContext
    });
    draft.source_payload = {
      ...(draft.source_payload ?? {}),
      content_mode: draftMode
    };
    draft.question_statement = effectiveTestType === "mains_test" ? "Write mains question here..." : "Write question here...";
    draft.question_prompt = effectiveTestType === "mains_test" ? "Write your answer." : "Choose the correct option.";
    if (draftMode === "csat_math") {
      draft.question_statement = "Write CSAT maths or reasoning question here...";
      draft.question_prompt = "Solve and choose the correct option.";
    }
    if (draftMode === "csat_passage") {
      draft.supplementary_statement = "Paste linked CSAT passage here...";
      draft.question_statement = "Write passage-based question here...";
      draft.question_prompt = "Choose the correct answer based on the passage.";
      draft.source_payload = {
        ...(draft.source_payload ?? {}),
        passage_group_key: `manual-passage-${Date.now()}`
      };
    }
    if (draftMode === "mains") {
      draft.model_answer = "Write reference answer here...";
      draft.word_limit = 250;
    }
    draft.options = isObjective(effectiveTestType)
      ? ["A", "B", "C", "D"].map((label, index) => ({ label, text: index === 0 ? "Correct option" : "", is_correct: index === 0 }))
      : [];
    draft.correct_answer = isObjective(effectiveTestType) ? "A" : undefined;
    setDrafts((current) => [...current, applyMainsContext(draft)]);
    setSelectedDrafts((current) => [...current, drafts.length]);
    setEditingDraftIndex(drafts.length);
  };

  const saveSelectedDrafts = async () => {
    if (!token || !test) return;
    if (hasUnsavedTestTypeCorrection) {
      setMessage("Save test settings first so the server stores the corrected test type before questions are saved.");
      return;
    }
    const records = drafts.filter((_, index) => selectedDrafts.includes(index));
    if (records.length === 0) {
      setMessage("Select at least one draft question to save.");
      return;
    }
    setBusy("save-drafts");
    setMessage(null);
    try {
      await authenticatedPost("/api/v1/study-plans/admin/ai/save-draft", token, {
        test_template_id: test.id,
        questions: records.map((record) => toPayload(applyMainsContext(record)))
      });
      setDrafts((current) => current.filter((_, index) => !selectedDrafts.includes(index)));
      setSelectedDrafts([]);
      await loadData();
      setMessage(`Saved ${records.length} questions to this test.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save questions.");
    } finally {
      setBusy(null);
    }
  };

  const saveTestSettings = async () => {
    if (!token || !test) return;
    setBusy("test-settings");
    try {
      await authenticatedPatch(`/api/v1/study-plan-tests/${test.id}`, token, {
        title: testForm.title,
        description: testForm.description || null,
        test_type: testForm.test_type,
        duration_minutes: Number(testForm.duration_minutes),
        status: testForm.status,
        instructions: testForm.instructions || null
      });
      await loadData();
      setMessage("Test settings updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update test settings.");
    } finally {
      setBusy(null);
    }
  };

  const updateQuestion = async (question: StudyPlanQuestion) => {
    if (!token) return;
    setBusy(`save-question-${question.id}`);
    try {
      await authenticatedPatch(`/api/v1/study-plan-questions/${question.id}`, token, toPayload(applyMainsContext(question as unknown as DraftQuestion)));
      await loadData();
      setEditingSavedId(null);
      setMessage("Question updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update question.");
    } finally {
      setBusy(null);
    }
  };

  const deleteQuestion = async (question: StudyPlanQuestion) => {
    if (!token) return;
    const confirmed = window.confirm(`Delete question ${question.display_order || question.id}?`);
    if (!confirmed) return;
    setBusy(`delete-question-${question.id}`);
    try {
      await authenticatedDelete(`/api/v1/study-plan-questions/${question.id}`, token);
      await loadData();
      setMessage("Question deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete question.");
    } finally {
      setBusy(null);
    }
  };

  if (!isInitialized) {
    return <main className="mx-auto max-w-6xl px-4 py-8"><p className="rounded-lg border border-line bg-white p-6 text-center text-sm font-bold text-ink/50">Verifying session...</p></main>;
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <section className="rounded-lg border border-line bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-ink">Study Plan Test Content</h1>
          <p className="mt-2 text-sm text-ink/70">Sign in with an admin or editor account.</p>
          <div className="mt-6"><SignInPanel /></div>
        </section>
      </main>
    );
  }

  const hasAccess = user && ["admin", "moderator", "content_editor"].includes(user.role);
  if (!hasAccess) {
    return <main className="mx-auto max-w-6xl px-4 py-8"><section className="rounded-lg border border-berry/30 bg-berry/10 p-6"><h1 className="text-2xl font-black text-ink">Access Restricted</h1></section></main>;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 pb-16 pt-6">
      <section className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <Link className="inline-flex items-center gap-2 text-xs font-bold text-ink/50 hover:text-civic" href="/admin/study-plans">
            <ArrowLeft className="h-3.5 w-3.5" />
            Study Plans
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-civic">Full Test Content Manager</p>
          <h1 className="mt-1 text-3xl font-black text-ink">{test?.title ?? "Loading test"}</h1>
          <p className="mt-1 text-sm text-ink/65">{test ? formatStudyPlanItemType(effectiveTestType) : ""} question creation, parsing, review, edit, and delete controls.</p>
        </div>
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-black text-white disabled:opacity-60" disabled={busy === "test-settings" || !test} onClick={saveTestSettings} type="button">
          {busy === "test-settings" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save test settings
        </button>
      </section>

      {message && <p className="rounded-md border border-line bg-white px-3 py-2 text-sm font-bold text-civic">{message}</p>}

      {test && (
        <>
          {hasUnsavedTestTypeCorrection && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold leading-6 text-amber-800">
              Saved type is {formatStudyPlanItemType(test.test_type)}, but this page is using {formatStudyPlanItemType(effectiveTestType)} based on the exam level. Save test settings before adding or saving questions.
            </p>
          )}
          <section className="grid gap-4 rounded-lg border border-line bg-white p-5 shadow-sm lg:grid-cols-5">
            <Field label="Test title" note="Shown on plan step, attempt screen, and result screen.">
              <input className="h-10 rounded-md border border-line px-3 text-sm" value={testForm.title} onChange={(event) => setTestForm({ ...testForm, title: event.target.value })} />
            </Field>
            <Field label="Test type" note="Controls content modes, syllabus tree, scoring family, and parser behavior.">
              <select
                className="h-10 rounded-md border border-line px-3 text-sm"
                value={testForm.test_type}
                onChange={(event) => {
                  const nextType = event.target.value as StudyPlanTestType;
                  setTestForm({ ...testForm, test_type: nextType });
                  setParseMode(defaultParseModeForTest(nextType));
                  setTree({ subject_id: "", source_id: "", topic_id: "", subtopic_id: "", question_nature_id: tree.question_nature_id });
                  setMainsTree({ paper_id: "", subject_area_id: "", theme_id: "", topic_id: "", subtopic_id: "" });
                  setDrafts([]);
                  setSelectedDrafts([]);
                  setEditingDraftIndex(null);
                }}
              >
                {TEST_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Duration" note="Attempt time limit in minutes.">
              <input className="h-10 rounded-md border border-line px-3 text-sm" value={testForm.duration_minutes} onChange={(event) => setTestForm({ ...testForm, duration_minutes: event.target.value })} />
            </Field>
            <Field label="Status" note="Draft for preparation, published when students can attempt.">
              <select className="h-10 rounded-md border border-line px-3 text-sm" value={testForm.status} onChange={(event) => setTestForm({ ...testForm, status: event.target.value })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Existing questions" note="Saved in this study-plan test only.">
              <div className="flex h-10 items-center rounded-md border border-line px-3 text-sm font-black text-ink">{savedQuestions.length} questions</div>
            </Field>
            {hiddenQuestionCount > 0 && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800 lg:col-span-5">
                {hiddenQuestionCount} saved question{hiddenQuestionCount === 1 ? "" : "s"} are hidden because they belong to another test or do not match the selected test type.
              </p>
            )}
            <div className="lg:col-span-2">
              <Field label="Description" note="Internal or student-facing test context.">
                <textarea className="min-h-20 rounded-md border border-line p-3 text-sm" value={testForm.description} onChange={(event) => setTestForm({ ...testForm, description: event.target.value })} />
              </Field>
            </div>
            <div className="lg:col-span-2">
              <Field label="Instructions" note="Attempt instructions shown before or during the test.">
                <textarea className="min-h-20 rounded-md border border-line p-3 text-sm" value={testForm.instructions} onChange={(event) => setTestForm({ ...testForm, instructions: event.target.value })} />
              </Field>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-4 rounded-lg border border-line bg-white p-5 shadow-sm">
              {effectiveTestType === "mains_test" ? (
                <>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-civic">Mains syllabus tree</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-ink/50">Using categories from Assessment Mains taxonomy.</p>
                  </div>
                  {mainsPapers.length === 0 && (
                    <p className="rounded-md border border-dashed border-line bg-paper px-3 py-2 text-xs font-bold leading-5 text-ink/55">
                      No Mains taxonomy categories are configured for this exam.
                    </p>
                  )}
                  <Field label="Paper" note="Assessment Mains paper node.">
                    <select className="h-10 rounded-md border border-line px-3 text-sm" value={mainsTree.paper_id} onChange={(event) => setMainsTree({ paper_id: event.target.value, subject_area_id: "", theme_id: "", topic_id: "", subtopic_id: "" })}>
                      <option value="">Choose paper</option>
                      {mainsPapers.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Subject area" note="Second level under the paper.">
                    <select className="h-10 rounded-md border border-line px-3 text-sm" value={mainsTree.subject_area_id} onChange={(event) => setMainsTree({ ...mainsTree, subject_area_id: event.target.value, theme_id: "", topic_id: "", subtopic_id: "" })} disabled={!mainsTree.paper_id}>
                      <option value="">Choose subject area</option>
                      {mainsSubjectAreas.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Theme" note="Theme configured in the Mains assessment section.">
                    <select className="h-10 rounded-md border border-line px-3 text-sm" value={mainsTree.theme_id} onChange={(event) => setMainsTree({ ...mainsTree, theme_id: event.target.value, topic_id: "", subtopic_id: "" })} disabled={!mainsTree.subject_area_id}>
                      <option value="">Choose theme</option>
                      {mainsThemes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Topic" note="Topic configured in the Mains assessment section.">
                    <select className="h-10 rounded-md border border-line px-3 text-sm" value={mainsTree.topic_id} onChange={(event) => setMainsTree({ ...mainsTree, topic_id: event.target.value, subtopic_id: "" })} disabled={!mainsTree.theme_id}>
                      <option value="">Choose topic</option>
                      {mainsTopics.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Subtopic" note="Most specific Mains category.">
                    <select className="h-10 rounded-md border border-line px-3 text-sm" value={mainsTree.subtopic_id} onChange={(event) => setMainsTree({ ...mainsTree, subtopic_id: event.target.value })} disabled={!mainsTree.topic_id}>
                      <option value="">Optional subtopic</option>
                      {mainsSubtopics.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                    </select>
                  </Field>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-civic">Syllabus tree</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-ink/50">
                      {contentType === "aptitude" ? "Showing only CSAT / aptitude categories for this exam." : "Showing only GK / General Studies categories for this exam."}
                    </p>
                  </div>
                  {subjects.length === 0 && (
                    <p className="rounded-md border border-dashed border-line bg-paper px-3 py-2 text-xs font-bold leading-5 text-ink/55">
                      No {contentType === "aptitude" ? "CSAT / aptitude" : "GK / General Studies"} syllabus categories are configured for this exam.
                    </p>
                  )}
                  <Field label="Subject" note="Top level category.">
                    <select className="h-10 rounded-md border border-line px-3 text-sm" value={tree.subject_id} onChange={(event) => setTree({ subject_id: event.target.value, source_id: "", topic_id: "", subtopic_id: "", question_nature_id: tree.question_nature_id })}>
                      <option value="">Choose subject</option>
                      {subjects.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Source / area" note="Second level, used to reach the correct topic branch.">
                    <select className="h-10 rounded-md border border-line px-3 text-sm" value={tree.source_id} onChange={(event) => setTree({ ...tree, source_id: event.target.value, topic_id: "", subtopic_id: "" })} disabled={!tree.subject_id}>
                      <option value="">Optional source / area</option>
                      {sourceNodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Topic" note="Saved to the question where supported.">
                    <select className="h-10 rounded-md border border-line px-3 text-sm" value={tree.topic_id} onChange={(event) => setTree({ ...tree, topic_id: event.target.value, subtopic_id: "" })} disabled={!tree.subject_id}>
                      <option value="">Choose topic</option>
                      {topics.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Subtopic" note="Most specific category for analytics.">
                    <select className="h-10 rounded-md border border-line px-3 text-sm" value={tree.subtopic_id} onChange={(event) => setTree({ ...tree, subtopic_id: event.target.value })} disabled={!tree.topic_id}>
                      <option value="">Optional subtopic</option>
                      {subtopics.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Question nature" note="Conceptual, factual, analytical, comprehension, etc.">
                    <select className="h-10 rounded-md border border-line px-3 text-sm" value={tree.question_nature_id} onChange={(event) => setTree({ ...tree, question_nature_id: event.target.value })}>
                      <option value="">Choose nature</option>
                      {natures.map((nature) => <option key={nature.id} value={nature.id}>{nature.name}</option>)}
                    </select>
                  </Field>
                </>
              )}
            </div>

            <div className="space-y-4">
              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-civic">Parse or create</p>
                    <h2 className="mt-1 text-xl font-black text-ink">Draft questions</h2>
                  </div>
                </div>
                <div className="mt-4 inline-flex rounded-md border border-line bg-paper p-1">
                  <button
                    className={`inline-flex h-9 items-center gap-2 rounded px-3 text-xs font-black ${workspaceMode === "manual" ? "bg-white text-civic shadow-sm" : "text-ink/55"}`}
                    onClick={() => setWorkspaceMode("manual")}
                    type="button"
                  >
                    <FileQuestion className="h-3.5 w-3.5" />
                    Manual create
                  </button>
                  <button
                    className={`inline-flex h-9 items-center gap-2 rounded px-3 text-xs font-black ${workspaceMode === "parse" ? "bg-white text-civic shadow-sm" : "text-ink/55"}`}
                    onClick={() => setWorkspaceMode("parse")}
                    type="button"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    AI parse
                  </button>
                </div>

                {workspaceMode === "manual" ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {contentModeOptions.map((mode) => (
                      <button
                        className="flex min-h-28 flex-col items-start justify-between rounded-lg border border-line bg-white p-4 text-left shadow-sm hover:border-civic/40 hover:bg-civic/5"
                        key={mode}
                        onClick={() => addBlankDraft(mode)}
                        type="button"
                      >
                        <span className="inline-flex items-center gap-2 text-sm font-black text-ink">
                          <Plus className="h-4 w-4 text-civic" />
                          {CONTENT_MODE_LABELS[mode]}
                        </span>
                        <span className="mt-3 text-xs font-semibold leading-5 text-ink/55">{manualModeDescription(mode)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                      <Field label="Content mode" note="Controls parser behavior and output structure.">
                        <select className="h-10 rounded-md border border-line px-3 text-sm" value={parseMode} onChange={(event) => setParseMode(event.target.value as ParseMode)}>
                          {contentModeOptions.map((mode) => <option key={mode} value={mode}>{CONTENT_MODE_LABELS[mode]}</option>)}
                        </select>
                      </Field>
                      <Field label="Raw text" note="Paste questions, passage sets, maths problems, or mains prompts for parsing.">
                        <textarea className="min-h-28 rounded-md border border-line p-3 text-sm" value={rawText} onChange={(event) => setRawText(event.target.value)} />
                      </Field>
                    </div>
                    <div className="mt-4">
                      <RichTextMarkdownEditor
                        label="Additional parser instructions and LaTeX notes"
                        value={instructions}
                        onChange={setInstructions}
                        minHeightClass="min-h-[100px]"
                        placeholder="Example: Preserve all equations in LaTeX. Treat the first paragraph as the shared passage."
                      />
                    </div>
                  </>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {workspaceMode === "parse" && (
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-black text-white disabled:opacity-60" disabled={busy === "parse" || !rawText.trim()} onClick={parseQuestions} type="button">
                      {busy === "parse" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Parse to question list
                    </button>
                  )}
                  <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-60" disabled={busy === "save-drafts" || selectedDrafts.length === 0 || hasUnsavedTestTypeCorrection} onClick={saveSelectedDrafts} type="button">
                    {busy === "save-drafts" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Save selected drafts
                  </button>
                </div>
              </section>

              {drafts.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-lg font-black text-ink">Draft output preview</h2>
                  {drafts.map((draft, index) => (
                    <div className="rounded-lg border border-line bg-white p-4 shadow-sm" key={index}>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs font-black text-ink/60">
                          <input checked={selectedDrafts.includes(index)} onChange={(event) => setSelectedDrafts((current) => event.target.checked ? [...current, index] : current.filter((item) => item !== index))} type="checkbox" />
                          Select draft
                        </label>
                        <div className="flex gap-2">
                          <button className="h-8 rounded-md border border-line px-2 text-xs font-black text-ink" onClick={() => setEditingDraftIndex(editingDraftIndex === index ? null : index)} type="button">Edit</button>
                          <button className="h-8 rounded-md border border-rose-200 px-2 text-xs font-black text-rose-700" onClick={() => setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index))} type="button">Delete</button>
                        </div>
                      </div>
                      {editingDraftIndex === index ? (
                        <QuestionEditor question={draft} onChange={(next) => setDrafts((current) => current.map((item, draftIndex) => draftIndex === index ? next as DraftQuestion : item))} />
                      ) : (
                        <QuestionPreview question={draft} index={index} />
                      )}
                    </div>
                  ))}
                </section>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-civic" />
              <h2 className="text-xl font-black text-ink">Saved questions</h2>
            </div>
            {savedQuestions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm font-bold text-ink/50">No saved questions yet.</p>
            ) : (
              savedQuestions.map((question, index) => (
                <div className="rounded-lg border border-line bg-white p-4 shadow-sm" key={question.id}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-black uppercase tracking-wide text-ink/45">Saved question #{question.id}</p>
                    <div className="flex gap-2">
                      <button className="h-8 rounded-md border border-line px-2 text-xs font-black text-ink" onClick={() => setEditingSavedId(editingSavedId === question.id ? null : question.id)} type="button">Edit</button>
                      <button className="inline-flex h-8 items-center gap-1 rounded-md border border-rose-200 px-2 text-xs font-black text-rose-700 disabled:opacity-60" disabled={busy === `delete-question-${question.id}`} onClick={() => deleteQuestion(question)} type="button">
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                  {editingSavedId === question.id ? (
                    <QuestionEditor
                      question={question}
                      onChange={(next) => setTest((current) => current ? { ...current, questions: current.questions.map((item) => item.id === question.id ? next as StudyPlanQuestion : item) } : current)}
                      onSave={() => {
                        const currentQuestion = test.questions.find((item) => item.id === question.id) ?? question;
                        void updateQuestion(currentQuestion);
                      }}
                      saving={busy === `save-question-${question.id}`}
                    />
                  ) : (
                    <QuestionPreview question={question} index={index} />
                  )}
                </div>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}

function QuestionEditor({
  question,
  onChange,
  onSave,
  saving
}: {
  question: DraftQuestion | StudyPlanQuestion;
  onChange: (question: DraftQuestion | StudyPlanQuestion) => void;
  onSave?: () => void;
  saving?: boolean;
}) {
  const options = parseOptions(question.options);
  const questionContentMode = readQuestionContentMode(question);
  const update = (patch: Partial<DraftQuestion>) => onChange({ ...question, ...patch } as DraftQuestion);
  if (question.question_family === "mains_subjective") {
    const updateMains = (patch: Partial<DraftQuestion>) => {
      const next = {
        ...question,
        ...patch,
        question_family: "mains_subjective" as const,
        options: [],
        correct_answer: undefined,
        supplementary_statement: undefined,
        question_prompt: undefined,
        explanation: undefined,
        negative_marks: 0,
        source_payload: {
          ...readSourcePayload(question),
          ...readSourcePayload(patch as DraftQuestion),
          content_mode: "mains",
          word_limit: patch.word_limit ?? readWordLimit(question)
        }
      };
      onChange(next as DraftQuestion);
    };

    return (
      <div className="space-y-4 rounded-md border border-line bg-paper p-4">
        <Field label="Question" note="Mains question visible to students.">
          <textarea className="min-h-28 rounded-md border border-line p-3 text-sm" value={question.question_statement} onChange={(event) => updateMains({ question_statement: event.target.value })} />
        </Field>
        <Field label="Reference answer" note="Reference answer shown in review or admin checking context.">
          <textarea className="min-h-40 rounded-md border border-line p-3 text-sm" value={question.model_answer ?? ""} onChange={(event) => updateMains({ model_answer: event.target.value })} />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Marks" note="Marks allotted for this Mains question.">
            <input className="h-10 rounded-md border border-line px-3 text-sm" value={question.marks} onChange={(event) => updateMains({ marks: Number(event.target.value) })} />
          </Field>
          <Field label="Word limit" note="Expected maximum answer length in words.">
            <input className="h-10 rounded-md border border-line px-3 text-sm" value={readWordLimit(question)} onChange={(event) => updateMains({ word_limit: Number(event.target.value) })} />
          </Field>
        </div>
        {onSave && (
          <button className="inline-flex h-10 items-center gap-2 rounded-md bg-civic px-4 text-sm font-black text-white disabled:opacity-60" disabled={saving} onClick={onSave} type="button">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save question
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4 rounded-md border border-line bg-paper p-4">
      <Field label="Content subtype" note="Saved with the question and used for segregation.">
        <div className="flex h-10 items-center rounded-md border border-line bg-white px-3 text-sm font-black text-ink">{contentModeLabel(questionContentMode)}</div>
      </Field>
      <Field label="Question statement" note="Main question visible to students.">
        <textarea className="min-h-24 rounded-md border border-line p-3 text-sm" value={question.question_statement} onChange={(event) => update({ question_statement: event.target.value })} />
      </Field>
      <Field label={questionContentMode === "csat_passage" ? "Linked passage" : "Supplementary / passage text"} note="Use this for statement lists, linked passages, or shared CSAT case text.">
        <textarea className="min-h-24 rounded-md border border-line p-3 text-sm" value={question.supplementary_statement ?? ""} onChange={(event) => update({ supplementary_statement: event.target.value })} />
      </Field>
      <Field label="Prompt" note="Final instruction, directive, or question prompt.">
        <input className="h-10 rounded-md border border-line px-3 text-sm" value={question.question_prompt ?? ""} onChange={(event) => update({ question_prompt: event.target.value })} />
      </Field>
      {question.question_family === "objective" && (
        <div className="grid gap-3 md:grid-cols-2">
          {options.map((option, optionIndex) => (
            <Field label={`Option ${option.label}`} note="Supports LaTeX wrapped in $ symbols." key={option.label}>
              <input
                className="h-10 rounded-md border border-line px-3 text-sm"
                value={option.text}
                onChange={(event) => {
                  const next = options.map((item, index) => index === optionIndex ? { ...item, text: event.target.value } : item);
                  update({ options: next });
                }}
              />
            </Field>
          ))}
          <Field label="Correct answer" note="Objective scoring key.">
            <select className="h-10 rounded-md border border-line px-3 text-sm" value={readAnswer(question.correct_answer)} onChange={(event) => update({ correct_answer: event.target.value, options: options.map((option) => ({ ...option, is_correct: option.label === event.target.value })) })}>
              {options.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
            </select>
          </Field>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Marks" note="Marks awarded for this question.">
          <input className="h-10 rounded-md border border-line px-3 text-sm" value={question.marks} onChange={(event) => update({ marks: Number(event.target.value) })} />
        </Field>
        <Field label="Negative marks" note="Penalty for wrong objective answer.">
          <input className="h-10 rounded-md border border-line px-3 text-sm" value={question.negative_marks} onChange={(event) => update({ negative_marks: Number(event.target.value) })} />
        </Field>
        <Field label="Display order" note="Question order inside this test.">
          <input className="h-10 rounded-md border border-line px-3 text-sm" value={question.display_order} onChange={(event) => update({ display_order: Number(event.target.value) })} />
        </Field>
      </div>
      <Field label="Explanation" note="Shown in review for objective questions.">
        <textarea className="min-h-20 rounded-md border border-line p-3 text-sm" value={question.explanation ?? ""} onChange={(event) => update({ explanation: event.target.value })} />
      </Field>
      <Field label="Reference answer" note="Used for mains/reference answers.">
        <textarea className="min-h-28 rounded-md border border-line p-3 text-sm" value={question.model_answer ?? ""} onChange={(event) => update({ model_answer: event.target.value })} />
      </Field>
      {onSave && (
        <button className="inline-flex h-10 items-center gap-2 rounded-md bg-civic px-4 text-sm font-black text-white disabled:opacity-60" disabled={saving} onClick={onSave} type="button">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save question
        </button>
      )}
    </div>
  );
}
