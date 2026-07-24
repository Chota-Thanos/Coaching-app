"use client";

import { 
  Eye, 
  FileEdit, 
  Trash2, 
  CheckCircle2, 
  Loader2, 
  Search, 
  RefreshCw, 
  X, 
  BookOpen, 
  Clock, 
  Award, 
  Lock, 
  Unlock, 
  Sparkles,
  HelpCircle,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useCallback, useEffect, useState, useMemo } from "react";
import { 
  authenticatedGet, 
  authenticatedPatch, 
  authenticatedDelete, 
  authenticatedPost,
  authenticatedPut,
  useAuth 
} from "../../auth/auth-context";
import { QuizManagerBulkReassign } from "./quiz-manager-bulk-reassign";
import { QuizManagerEditQuestionModal } from "./quiz-manager-edit-question-modal";
import { useKaTeX, renderMathAndMarkdown } from "./katex-renderer";

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
  node_type: string;
  name: string;
  slug: string;
};

type Exam = {
  id: number;
  name: string;
  slug: string;
};

type ExamLevel = {
  id: number;
  name: string;
  slug: string;
};

type QuestionNature = {
  id: number;
  exam_id: number;
  name: string;
  slug: string;
};

type QuizTemplate = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  exam_id: number;
  exam_level_id: number;
  test_type: string;
  duration_minutes: number;
  total_marks: number;
  access_type: string;
  status: string;
  question_count: number;
  created_at: string;
};

type QuizPaperQuestion = {
  id: number;
  marks: number;
  negative_marks: number;
  display_order: number;
  question_version: {
    id: number;
    question_statement: string;
    supplementary_statement?: string;
    question_prompt?: string;
    options: { key: string; text: string }[];
    correct_answer?: { key: string } | string;
    explanation?: string;
  };
  passage?: {
    id: number;
    title: string | null;
    body: string;
  };
};

type QuizPaperDetail = {
  id: number;
  title: string;
  description: string | null;
  duration_minutes: number;
  total_marks: number;
  status: string;
  exam: Exam;
  exam_level: ExamLevel;
  sections: { id: number; title: string; instructions?: string }[];
  questions: QuizPaperQuestion[];
};

type QuizFilters = {
  examId: string;
  testType: string;
  status: string;
  search: string;
};

const defaultFilters: QuizFilters = {
  examId: "",
  testType: "",
  status: "published",
  search: ""
};

function formatStatus(status: string) {
  switch (status) {
    case "draft": return { label: "Draft", class: "bg-amber-50 text-amber-700 border-amber-200" };
    case "in_review": return { label: "In Review", class: "bg-blue-50 text-blue-700 border-blue-200" };
    case "published": return { label: "Published", class: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "archived": return { label: "Archived", class: "bg-slate-50 text-slate-700 border-slate-200" };
    default: return { label: status, class: "bg-slate-50 text-slate-700 border-slate-200" };
  }
}

function formatTestType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function AdminQuizManager({ 
  initialRepo = "gk", 
  hideRepoTabs = false,
  forceStatus,
  defaultTab
}: { 
  initialRepo?: "gk" | "aptitude" | "mains"; 
  hideRepoTabs?: boolean;
  forceStatus?: string;
  defaultTab?: string;
} = {}) {
  const { token } = useAuth();
  useKaTeX();
  
  // States for Templates (Mains)
  const [quizzes, setQuizzes] = useState<QuizTemplate[]>([]);
  const [selectedQuizIds, setSelectedQuizIds] = useState<number[]>([]);
  
  // States for Questions (GK & CSAT)
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  
  // Shared Configuration States
  const [exams, setExams] = useState<Exam[]>([]);
  const [questionNatures, setQuestionNatures] = useState<QuestionNature[]>([]);
  const [allTaxonomyNodes, setAllTaxonomyNodes] = useState<TaxonomyNode[]>([]);
  const [mainsTaxonomyNodes, setMainsTaxonomyNodes] = useState<MainsTaxonomyNode[]>([]);
  
  const [filters, setFilters] = useState<QuizFilters>({ ...defaultFilters, status: forceStatus || defaultFilters.status });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Repositories content type tabs
  const [activeRepo, setActiveRepo] = useState<"gk" | "aptitude" | "mains">(initialRepo);

  // Bulk Edit Categories states
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkFormLevels, setBulkFormLevels] = useState<ExamLevel[]>([]);
  const [bulkForm, setBulkForm] = useState({
    exam_id: "",
    exam_level_id: "",
    subject_node_id: "",
    source_node_id: "",
    topic_node_id: "",
    subtopic_node_id: "",
    question_nature_id: "",
    status: ""
  });

  // Modals state (Mains View Template)
  const [viewingQuizId, setViewingQuizId] = useState<number | null>(null);
  const [viewingDetail, setViewingDetail] = useState<QuizPaperDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit Template details modal state (Mains)
  const [editingQuiz, setEditingQuiz] = useState<QuizTemplate | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    slug: "",
    description: "",
    test_type: "sectional_test",
    duration_minutes: 30,
    total_marks: 6,
    access_type: "free",
    status: "draft",
    exam_id: "",
    exam_level_id: ""
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Edit Question modal state (GK & CSAT)
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [expandedExplanationIds, setExpandedExplanationIds] = useState<Record<number, boolean>>({});

  const toggleExplanation = (qId: number) => {
    setExpandedExplanationIds(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  const groupedQuestions = useMemo(() => {
    const groups: Array<{
      type: "passage" | "independent";
      passageId?: number;
      passageTitle?: string;
      passageBody?: string;
      questions: any[];
      key: string;
    }> = [];

    const passageMap = new Map<number, { passageTitle?: string; passageBody?: string; questions: any[] }>();
    const independentList: any[] = [];

    questions.forEach((q) => {
      if (q.passage_id) {
        if (!passageMap.has(q.passage_id)) {
          passageMap.set(q.passage_id, {
            passageTitle: q.passage_title,
            passageBody: q.passage_body,
            questions: []
          });
        }
        passageMap.get(q.passage_id)!.questions.push(q);
      } else {
        independentList.push(q);
      }
    });

    // Add passages
    passageMap.forEach((val, key) => {
      val.questions.sort((a, b) => (a.display_order || a.id) - (b.display_order || b.id));
      groups.push({
        type: "passage",
        passageId: key,
        passageTitle: val.passageTitle,
        passageBody: val.passageBody,
        questions: val.questions,
        key: `passage-${key}`
      });
    });

    // Add independent questions
    independentList.forEach((q) => {
      groups.push({
        type: "independent",
        questions: [q],
        key: `indep-${q.id}`
      });
    });

    return groups;
  }, [questions]);

  const groupedInspectorQuestions = useMemo(() => {
    if (!viewingDetail?.questions) return [];
    
    const items: Array<
      | { type: "independent"; question: QuizPaperQuestion; originalIndex: number }
      | { type: "passage"; passage: Exclude<QuizPaperQuestion["passage"], null | undefined>; questions: Array<{ question: QuizPaperQuestion; originalIndex: number }> }
    > = [];

    const passageMap = new Map<number, typeof items[number] & { type: "passage" }>();

    viewingDetail.questions.forEach((q, idx) => {
      if (q.passage) {
        const existing = passageMap.get(q.passage.id);
        if (existing) {
          existing.questions.push({ question: q, originalIndex: idx });
        } else {
          const group: { type: "passage"; passage: Exclude<typeof q.passage, null | undefined>; questions: Array<{ question: typeof q; originalIndex: number }> } = {
            type: "passage",
            passage: q.passage,
            questions: [{ question: q, originalIndex: idx }]
          };
          passageMap.set(q.passage.id, group);
          items.push(group);
        }
      } else {
        items.push({
          type: "independent",
          question: q,
          originalIndex: idx
        });
      }
    });

    return items;
  }, [viewingDetail?.questions]);

  const renderPassageGroup = (group: {
    passageId?: number;
    passageTitle?: string;
    passageBody?: string;
    questions: any[];
  }) => {
    const sisterIds = group.questions.map(q => q.id);
    const isAllSelected = sisterIds.every(id => selectedQuestionIds.includes(id));
    const firstQ = group.questions[0];
    const statusConfig = formatStatus(firstQ?.status || "draft");

    // Helper to extract taxonomy path
    const getTaxonomyPathStr = (q: any) => {
      const parts = [];
      if (q.subject_node_id) {
        const subject = allTaxonomyNodes.find(n => n.id === q.subject_node_id);
        if (subject) parts.push(subject.name);
      }
      if (q.topic_node_id) {
        const topic = allTaxonomyNodes.find(n => n.id === q.topic_node_id);
        if (topic) parts.push(topic.name);
      }
      if (q.subtopic_node_id) {
        const subtopic = allTaxonomyNodes.find(n => n.id === q.subtopic_node_id);
        if (subtopic) parts.push(subtopic.name);
      }
      return parts.join(" > ") || "General Study Node";
    };

    return (
      <div 
        key={`passage-group-${group.passageId}`}
        className={`bg-surface border rounded-2xl p-6 shadow-sm flex flex-col gap-5 transition-all hover:shadow-md ${
          isAllSelected ? "border-civic bg-civic/5 ring-1 ring-civic/25" : "border-line hover:border-civic/30"
        }`}
      >
        {/* Package Header */}
        <div className="flex justify-between items-start gap-4 border-b border-line pb-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <input 
              type="checkbox"
              className="h-4.5 w-4.5 rounded border-line text-civic focus:ring-civic cursor-pointer"
              checked={isAllSelected}
              onChange={() => {
                if (isAllSelected) {
                  setSelectedQuestionIds(prev => prev.filter(x => !sisterIds.includes(x)));
                } else {
                  setSelectedQuestionIds(prev => {
                    const next = [...prev];
                    sisterIds.forEach(x => {
                      if (!next.includes(x)) next.push(x);
                    });
                    return next;
                  });
                }
              }}
            />
            <span className={`text-[10px] font-black uppercase border px-2 py-0.5 rounded-full shrink-0 ${statusConfig.class}`}>
              {statusConfig.label}
            </span>
            <span className="text-[10px] font-black uppercase bg-amber-500/10 text-amber-700 border border-amber-200/40 px-2.5 py-0.5 rounded-full">
              Passage Linked Package ({group.questions.length} Qs)
            </span>
            <span className="text-[10px] font-extrabold text-ink/40 bg-slate-100 px-2 py-0.5 rounded">
              {getTaxonomyPathStr(firstQ)}
            </span>
          </div>
          <span className="text-[10px] font-bold text-ink/40">
            ID: #{group.passageId}
          </span>
        </div>

        {/* Shared Passage Body */}
        <div className="bg-amber-50/20 border border-amber-200/40 rounded-xl p-4.5 space-y-2">
          {group.passageTitle && (
            <h5 className="font-black text-sm text-ink flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-civic" />
              {group.passageTitle}
            </h5>
          )}
          <div 
            className="text-xs sm:text-sm text-ink/80 leading-relaxed font-serif whitespace-pre-wrap"
            dangerouslySetInnerHTML={renderMathAndMarkdown(group.passageBody || "")}
          />
        </div>

        {/* Nested Questions List */}
        <div className="space-y-6 divide-y divide-line/60 pt-2">
          {group.questions.map((q, subIdx) => {
            const subNatureName = q.question_nature?.name || "No Nature";
            let parsedOptions: Array<{ key: string; text: string }> = [];
            if (q.current_version?.options && Array.isArray(q.current_version.options)) {
              parsedOptions = q.current_version.options.map((o: any) => ({
                key: o.key || o.label || "",
                text: o.text || ""
              }));
            }

            let correctAnswer = "A";
            if (q.current_version?.correct_answer) {
              correctAnswer = typeof q.current_version.correct_answer === "object"
                ? q.current_version.correct_answer.key || q.current_version.correct_answer.label || "A"
                : q.current_version.correct_answer;
            }

            return (
              <div key={q.id} className={`${subIdx > 0 ? "pt-5" : ""} space-y-4`}>
                {/* Question Info Header */}
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-5.5 w-5.5 rounded-full bg-slate-100 flex items-center justify-center text-[10.5px] font-black text-ink">
                      {subIdx + 1}
                    </span>
                    <span className="text-[10px] font-extrabold text-ink/50 bg-slate-50 px-2 py-0.5 rounded">
                      ID: #{q.id}
                    </span>
                    {q.question_nature && (
                      <span className="text-[9px] font-black uppercase bg-civic/5 text-civic px-2 py-0.5 rounded-full">
                        {subNatureName}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {q.status === "draft" && (
                      <button
                        onClick={() => handleUpdateQuestionStatus(q.id, "published")}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                        type="button"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Publish
                      </button>
                    )}
                    {q.status === "published" && (
                      <button
                        onClick={() => handleUpdateQuestionStatus(q.id, "draft")}
                        className="text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                        type="button"
                      >
                        Unpublish
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEditQuestion(q)}
                      className="text-[10px] font-bold text-ink/45 hover:text-civic flex items-center gap-1"
                      type="button"
                    >
                      <FileEdit className="h-3 w-3" />
                      Edit Q{subIdx + 1}
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="text-[10px] font-bold text-ink/45 hover:text-rose-600 flex items-center gap-1"
                      type="button"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete Q{subIdx + 1}
                    </button>
                  </div>
                </div>

                {/* Question Texts */}
                <div className="space-y-2 pl-7.5">
                  <p 
                    className="text-sm font-black text-ink leading-snug"
                    dangerouslySetInnerHTML={renderMathAndMarkdown(q.current_version?.question_statement || "")}
                  />
                  {q.current_version?.supplementary_statement && (
                    <p 
                      className="text-xs font-medium text-ink/75 bg-slate-50 border-l-2 border-line p-2.5 whitespace-pre-line font-serif rounded-r-lg"
                      dangerouslySetInnerHTML={renderMathAndMarkdown(q.current_version.supplementary_statement)}
                    />
                  )}
                  {q.current_version?.question_prompt && (
                    <p 
                      className="text-xs font-bold text-civic italic pl-1"
                      dangerouslySetInnerHTML={renderMathAndMarkdown(q.current_version.question_prompt)}
                    />
                  )}
                </div>

                {/* Options List */}
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 pl-7.5">
                  {parsedOptions.map((opt) => {
                    const isCorrect = opt.key === correctAnswer;
                    return (
                      <div 
                        key={opt.key}
                        className={`p-3 rounded-xl border text-xs font-semibold flex gap-2 transition-all ${
                          isCorrect 
                            ? "bg-emerald-50/40 border-emerald-300 text-emerald-800 ring-1 ring-emerald-300/30" 
                            : "bg-paper/30 border-line text-ink/75 hover:bg-paper/50"
                        }`}
                      >
                        <span className={`h-5 w-5 rounded-md flex items-center justify-center text-[10.5px] font-black border uppercase shrink-0 ${
                          isCorrect 
                            ? "bg-emerald-500 border-emerald-600 text-white" 
                            : "bg-surface border-line text-ink/40"
                        }`}>
                          {opt.key}
                        </span>
                        <span 
                          className="leading-snug pt-0.5"
                          dangerouslySetInnerHTML={renderMathAndMarkdown(opt.text)}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Pedagogical Explanation */}
                {q.current_version?.explanation && (
                  <div className="pt-1 border-t border-line/40 pl-7.5">
                    <button
                      type="button"
                      onClick={() => toggleExplanation(q.id)}
                      className="text-[11px] font-bold text-ink/50 hover:text-civic flex items-center gap-1 transition-all animate-in fade-in duration-200"
                    >
                      {expandedExplanationIds[q.id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {expandedExplanationIds[q.id] ? "Hide pedagogical explanation" : "View pedagogical explanation"}
                    </button>
                    {expandedExplanationIds[q.id] && (
                      <div className="mt-2 bg-paper rounded-xl p-4 text-xs border border-line/60 relative space-y-1 pl-6">
                        <span className="absolute left-2.5 top-5 h-1.5 w-1.5 rounded-full bg-civic/80" />
                        <h6 className="font-extrabold text-ink/70 text-[11px] uppercase tracking-wider">Pedagogical Explanation</h6>
                        <p 
                          className="text-ink/65 leading-relaxed font-sans whitespace-pre-wrap"
                          dangerouslySetInnerHTML={renderMathAndMarkdown(q.current_version.explanation)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const [editQuestionForm, setEditQuestionForm] = useState({
    question_statement: "",
    supplementary_statement: "",
    question_prompt: "",
    options: [
      { key: "A", text: "" },
      { key: "B", text: "" },
      { key: "C", text: "" },
      { key: "D", text: "" }
    ],
    correct_answer: "A",
    explanation: "",
    exam_id: "",
    exam_level_id: "",
    subject_node_id: "",
    source_node_id: "",
    topic_node_id: "",
    subtopic_node_id: "",
    question_nature_id: ""
  });

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // 1. Load initial taxonomy configurations
  useEffect(() => {
    const loadTaxonomy = async () => {
      if (!token) return;
      try {
        const exList = await authenticatedGet<Exam[]>("/api/v1/assessment/exams", token);
        setExams(exList || []);

        const nodesList = await authenticatedGet<TaxonomyNode[]>("/api/v1/assessment/taxonomy-nodes?limit=1000", token);
        setAllTaxonomyNodes(nodesList || []);

        const mainsNodes = await authenticatedGet<MainsTaxonomyNode[]>("/api/v1/assessment/mains/taxonomy-nodes?limit=1000", token);
        setMainsTaxonomyNodes(mainsNodes || []);
      } catch (err) {
        console.error("Failed to load taxonomy metadata", err);
      }
    };
    void loadTaxonomy();
  }, [token]);

  // Load levels for Edit Template Form
  const [editFormLevels, setEditFormLevels] = useState<ExamLevel[]>([]);
  useEffect(() => {
    const loadEditLevels = async () => {
      if (!token || !editForm.exam_id) {
        setEditFormLevels([]);
        return;
      }
      try {
        const lvlList = await authenticatedGet<ExamLevel[]>(`/api/v1/assessment/exams/${editForm.exam_id}/levels`, token);
        setEditFormLevels(lvlList || []);
      } catch (err) {
        console.error("Failed to load edit levels", err);
      }
    };
    void loadEditLevels();
  }, [editForm.exam_id, token]);

  // Load levels for Bulk Edit Form
  useEffect(() => {
    const loadBulkLevels = async () => {
      if (!token || !bulkForm.exam_id) {
        setBulkFormLevels([]);
        return;
      }
      try {
        const lvlList = await authenticatedGet<ExamLevel[]>(`/api/v1/assessment/exams/${bulkForm.exam_id}/levels`, token);
        setBulkFormLevels(lvlList || []);
      } catch (err) {
        console.error("Failed to load bulk form levels", err);
      }
    };
    void loadBulkLevels();
  }, [bulkForm.exam_id, token]);

  // Load Question Natures based on selected exam (or active exam filter)
  useEffect(() => {
    const loadNatures = async () => {
      if (!token) return;
      const targetExam = filters.examId || (exams[0] ? String(exams[0].id) : "");
      if (!targetExam) return;
      try {
        const res = await authenticatedGet<QuestionNature[]>(`/api/v1/assessment/question-natures?exam_id=${targetExam}`, token);
        setQuestionNatures(res || []);
      } catch (err) {
        console.error("Failed to load question natures", err);
      }
    };
    void loadNatures();
  }, [token, filters.examId, exams]);

  // 3. Load data matching filters
  const loadQuizzes = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        limit: "100",
        offset: "0"
      });
      if (filters.examId) queryParams.set("exam_id", filters.examId);

      if (activeRepo === "mains") {
        if (filters.status) queryParams.set("status", filters.status);
        queryParams.set("content_type", "mains");
        const res = await authenticatedGet<QuizTemplate[]>(`/api/v1/assessment/test-templates?${queryParams}`, token);
        
        let finalRes = res || [];
        if (filters.search.trim()) {
          const query = filters.search.toLowerCase();
          finalRes = finalRes.filter(q => 
            q.title.toLowerCase().includes(query) || 
            (q.description && q.description.toLowerCase().includes(query)) ||
            q.slug.toLowerCase().includes(query)
          );
        }
        if (filters.testType) {
          finalRes = finalRes.filter(q => q.test_type === filters.testType);
        }
        setQuizzes(finalRes);
      } else {
        // Load objective questions for GK and CSAT
        queryParams.set("content_type", activeRepo);
        if (filters.status) queryParams.set("status", filters.status);
        const res = await authenticatedGet<any[]>(`/api/v1/assessment/questions?${queryParams}`, token);
        
        let finalRes = res || [];
        if (filters.search.trim()) {
          const query = filters.search.toLowerCase();
          finalRes = finalRes.filter(q => 
            q.current_version?.question_statement?.toLowerCase().includes(query) ||
            q.current_version?.explanation?.toLowerCase().includes(query)
          );
        }
        setQuestions(finalRes);
      }
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to load records list: " + (err.message || err), "error");
    } finally {
      setLoading(false);
    }
  }, [filters, activeRepo, token]);

  useEffect(() => {
    setSelectedQuizIds([]);
    setSelectedQuestionIds([]);
    void loadQuizzes();
  }, [loadQuizzes, activeRepo]);

  // Checkbox selection state helpers
  const handleToggleSelect = (id: number) => {
    if (activeRepo === "mains") {
      setSelectedQuizIds(prev => 
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    } else {
      const questionObj = questions.find(q => q.id === id);
      if (questionObj && questionObj.passage_id) {
        const sisterQuestionIds = questions.filter(q => q.passage_id === questionObj.passage_id).map(q => q.id);
        const alreadySelected = sisterQuestionIds.every(x => selectedQuestionIds.includes(x));
        if (alreadySelected) {
          setSelectedQuestionIds(prev => prev.filter(x => !sisterQuestionIds.includes(x)));
        } else {
          setSelectedQuestionIds(prev => {
            const next = [...prev];
            sisterQuestionIds.forEach(x => {
              if (!next.includes(x)) next.push(x);
            });
            return next;
          });
        }
      } else {
        setSelectedQuestionIds(prev => 
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
      }
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      if (activeRepo === "mains") {
        setSelectedQuizIds(quizzes.map(q => q.id));
      } else {
        setSelectedQuestionIds(questions.map(q => q.id));
      }
    } else {
      if (activeRepo === "mains") {
        setSelectedQuizIds([]);
      } else {
        setSelectedQuestionIds([]);
      }
    }
  };

  // Bulk Edit Categories & Nature submit
  const handleBulkEditTaxonomySubmit = async () => {
    if (!token) return;
    
    if (activeRepo === "mains") {
      if (selectedQuizIds.length === 0) return;
      if (!bulkForm.exam_id) {
        showMessage("Target exam is required for bulk reassignment", "error");
        return;
      }
      setSavingBulk(true);
      try {
        const payload = {
          ids: selectedQuizIds,
          exam_id: Number(bulkForm.exam_id),
          exam_level_id: bulkForm.exam_level_id ? Number(bulkForm.exam_level_id) : undefined,
          subject_node_id: bulkForm.subject_node_id ? Number(bulkForm.subject_node_id) : undefined,
          topic_node_id: bulkForm.topic_node_id ? Number(bulkForm.topic_node_id) : null,
          subtopic_node_id: bulkForm.subtopic_node_id ? Number(bulkForm.subtopic_node_id) : null,
          status: bulkForm.status ? bulkForm.status : undefined
        };
        await authenticatedPost("/api/v1/assessment/admin/test-templates/bulk-taxonomy", token, payload);
        showMessage(`Successfully updated categories for ${selectedQuizIds.length} quizzes!`);
        setSelectedQuizIds([]);
        setBulkModalOpen(false);
        setBulkForm({
          exam_id: "",
          exam_level_id: "",
          subject_node_id: "",
          source_node_id: "",
          topic_node_id: "",
          subtopic_node_id: "",
          question_nature_id: "",
          status: ""
        });
        void loadQuizzes();
      } catch (err: any) {
        console.error(err);
        showMessage("Failed to update categories: " + (err.message || err), "error");
      } finally {
        setSavingBulk(false);
      }
    } else {
      if (selectedQuestionIds.length === 0) return;
      setSavingBulk(true);
      try {
        const payload = {
          ids: selectedQuestionIds,
          exam_id: bulkForm.exam_id ? Number(bulkForm.exam_id) : undefined,
          exam_level_id: bulkForm.exam_level_id ? Number(bulkForm.exam_level_id) : undefined,
          subject_node_id: bulkForm.subject_node_id ? Number(bulkForm.subject_node_id) : undefined,
          source_node_id: bulkForm.source_node_id === "null" ? null : (bulkForm.source_node_id ? Number(bulkForm.source_node_id) : undefined),
          topic_node_id: bulkForm.topic_node_id === "null" ? null : (bulkForm.topic_node_id ? Number(bulkForm.topic_node_id) : undefined),
          subtopic_node_id: bulkForm.subtopic_node_id === "null" ? null : (bulkForm.subtopic_node_id ? Number(bulkForm.subtopic_node_id) : undefined),
          question_nature_id: bulkForm.question_nature_id === "null" ? null : (bulkForm.question_nature_id ? Number(bulkForm.question_nature_id) : undefined),
          status: bulkForm.status ? bulkForm.status : undefined
        };
        await authenticatedPost("/api/v1/assessment/admin/questions/bulk-taxonomy", token, payload);
        showMessage(`Successfully updated categories & nature for ${selectedQuestionIds.length} questions!`);
        setSelectedQuestionIds([]);
        setBulkModalOpen(false);
        setBulkForm({
          exam_id: "",
          exam_level_id: "",
          subject_node_id: "",
          source_node_id: "",
          topic_node_id: "",
          subtopic_node_id: "",
          question_nature_id: "",
          status: ""
        });
        void loadQuizzes();
      } catch (err: any) {
        console.error(err);
        showMessage("Failed to update questions taxonomy: " + (err.message || err), "error");
      } finally {
        setSavingBulk(false);
      }
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (!token) return;
    
    if (activeRepo === "mains") {
      if (selectedQuizIds.length === 0) return;
      if (!window.confirm(`CRITICAL WARNING: Are you sure you want to permanently delete all ${selectedQuizIds.length} selected quizzes? This action is irreversible.`)) return;

      setLoading(true);
      try {
        for (const id of selectedQuizIds) {
          await authenticatedDelete(`/api/v1/assessment/test-templates/${id}`, token);
        }
        showMessage(`Successfully deleted ${selectedQuizIds.length} quizzes!`);
        setSelectedQuizIds([]);
        void loadQuizzes();
      } catch (err: any) {
        console.error(err);
        showMessage("Error deleting some quizzes: " + (err.message || err), "error");
      } finally {
        setLoading(false);
      }
    } else {
      if (selectedQuestionIds.length === 0) return;
      if (!window.confirm(`Are you sure you want to permanently delete all ${selectedQuestionIds.length} selected questions from the pool? This action is irreversible.`)) return;

      setLoading(true);
      try {
        for (const id of selectedQuestionIds) {
          await authenticatedDelete(`/api/v1/assessment/questions/${id}`, token);
        }
        showMessage(`Successfully deleted ${selectedQuestionIds.length} questions!`);
        setSelectedQuestionIds([]);
        void loadQuizzes();
      } catch (err: any) {
        console.error(err);
        showMessage("Error deleting some questions: " + (err.message || err), "error");
      } finally {
        setLoading(false);
      }
    }
  };

  // Cascading Bulk selectors
  const activeBulkNodes = useMemo(() => {
    if (!bulkForm.exam_id) return [];
    if (activeRepo === "mains") {
      return mainsTaxonomyNodes.filter(node => String(node.exam_id) === bulkForm.exam_id);
    } else {
      return allTaxonomyNodes.filter(
        node => String(node.exam_id) === bulkForm.exam_id && (node.content_type === activeRepo || !node.content_type)
      );
    }
  }, [allTaxonomyNodes, mainsTaxonomyNodes, bulkForm.exam_id, activeRepo]);

  const bulkSubjects = useMemo(() => {
    const nodeType = activeRepo === "mains" ? "paper" : "subject";
    return activeBulkNodes.filter(node => node.node_type === nodeType);
  }, [activeBulkNodes, activeRepo]);

  const bulkSourceBuckets = useMemo(() => {
    if (activeRepo === "mains") return [];
    if (!bulkForm.subject_node_id) return [];
    // Allow direct children of the selected subject node
    return activeBulkNodes.filter(node => String(node.parent_id) === bulkForm.subject_node_id);
  }, [activeBulkNodes, bulkForm.subject_node_id, activeRepo]);

  const bulkTopics = useMemo(() => {
    if (activeRepo === "mains") {
      if (!bulkForm.subject_node_id) return [];
      return activeBulkNodes.filter(node => node.node_type === "subject_area" && String(node.parent_id) === bulkForm.subject_node_id);
    } else {
      if (bulkForm.source_node_id) {
        return activeBulkNodes.filter(node => String(node.parent_id) === bulkForm.source_node_id);
      }
      if (bulkForm.subject_node_id) {
        return activeBulkNodes.filter(node => node.node_type === "topic" && String(node.parent_id) === bulkForm.subject_node_id);
      }
      return [];
    }
  }, [activeBulkNodes, bulkForm.subject_node_id, bulkForm.source_node_id, activeRepo]);

  const bulkSubtopics = useMemo(() => {
    if (!bulkForm.topic_node_id) return [];
    if (activeRepo === "mains") {
      return activeBulkNodes.filter(node => node.node_type === "theme" && String(node.parent_id) === bulkForm.topic_node_id);
    } else {
      return activeBulkNodes.filter(node => String(node.parent_id) === bulkForm.topic_node_id);
    }
  }, [activeBulkNodes, bulkForm.topic_node_id, activeRepo]);

  // Load mains preview details
  const handleViewQuiz = async (quizId: number) => {
    if (!token) return;
    setViewingQuizId(quizId);
    setLoadingDetail(true);
    setViewingDetail(null);
    try {
      const res = await authenticatedGet<QuizPaperDetail>(`/api/v1/assessment/test-templates/${quizId}/paper`, token);
      setViewingDetail(res);
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to load quiz details: " + (err.message || err), "error");
      setViewingQuizId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Edit template details form (Mains)
  const handleOpenEdit = (q: QuizTemplate) => {
    setEditingQuiz(q);
    setEditForm({
      title: q.title,
      slug: q.slug,
      description: q.description || "",
      test_type: q.test_type,
      duration_minutes: q.duration_minutes,
      total_marks: q.total_marks,
      access_type: q.access_type,
      status: q.status,
      exam_id: String(q.exam_id),
      exam_level_id: String(q.exam_level_id)
    });
  };

  const handleSaveEdit = async () => {
    if (!token || !editingQuiz) return;
    if (!editForm.title.trim() || !editForm.slug.trim()) {
      showMessage("Title and slug are required fields", "error");
      return;
    }

    setSavingEdit(true);
    try {
      const payload = {
        title: editForm.title.trim(),
        slug: editForm.slug.trim(),
        description: editForm.description.trim() || null,
        test_type: editForm.test_type,
        duration_minutes: Number(editForm.duration_minutes),
        total_marks: Number(editForm.total_marks),
        access_type: editForm.access_type,
        status: editForm.status,
        exam_id: Number(editForm.exam_id),
        exam_level_id: Number(editForm.exam_level_id)
      };

      await authenticatedPatch(`/api/v1/assessment/test-templates/${editingQuiz.id}`, token, payload);
      showMessage("Quiz template details updated successfully!");
      setEditingQuiz(null);
      void loadQuizzes();
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to save changes: " + (err.message || err), "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // Publish Mains template
  const handlePublishQuiz = async (quizId: number) => {
    if (!token || !window.confirm("Are you sure you want to publish this quiz? It will become visible to students.")) return;
    try {
      await authenticatedPatch(`/api/v1/assessment/test-templates/${quizId}`, token, { status: "published" });
      showMessage("Quiz successfully published and made live!");
      void loadQuizzes();
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to publish quiz: " + (err.message || err), "error");
    }
  };

  const handleUnpublishQuiz = async (quizId: number) => {
    if (!token || !window.confirm("Are you sure you want to unpublish this quiz? It will be moved to drafts.")) return;
    try {
      await authenticatedPatch(`/api/v1/assessment/test-templates/${quizId}`, token, { status: "draft" });
      showMessage("Quiz successfully unpublished and moved to drafts!");
      void loadQuizzes();
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to unpublish quiz: " + (err.message || err), "error");
    }
  };

  // Delete mains template
  const handleDeleteQuiz = async (quizId: number) => {
    if (!token || !window.confirm("CRITICAL WARNING: This will permanently delete this quiz template and its question links. Proceed?")) return;
    try {
      await authenticatedDelete(`/api/v1/assessment/test-templates/${quizId}`, token);
      showMessage("Quiz template deleted successfully!");
      void loadQuizzes();
      if (viewingQuizId === quizId) setViewingQuizId(null);
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to delete quiz: " + (err.message || err), "error");
    }
  };

  // Open Edit Question Modal (GK & CSAT)
  const handleOpenEditQuestion = (q: any) => {
    setEditingQuestion(q);
    
    let opts = [
      { key: "A", text: "" },
      { key: "B", text: "" },
      { key: "C", text: "" },
      { key: "D", text: "" }
    ];
    if (q.current_version?.options && Array.isArray(q.current_version.options)) {
      opts = q.current_version.options.map((o: any) => ({
        key: o.key || o.label || "",
        text: o.text || ""
      }));
    }

    let correctKey = "A";
    if (q.current_version?.correct_answer) {
      correctKey = typeof q.current_version.correct_answer === "object"
        ? q.current_version.correct_answer.key || q.current_version.correct_answer.label || "A"
        : q.current_version.correct_answer;
    }

    setEditQuestionForm({
      question_statement: q.current_version?.question_statement || "",
      supplementary_statement: q.current_version?.supplementary_statement || "",
      question_prompt: q.current_version?.question_prompt || "",
      options: opts,
      correct_answer: correctKey,
      explanation: q.current_version?.explanation || "",
      exam_id: String(q.exam_id || ""),
      exam_level_id: String(q.exam_level_id || ""),
      subject_node_id: String(q.subject_node_id || ""),
      source_node_id: String(q.source_node_id || ""),
      topic_node_id: String(q.topic_node_id || ""),
      subtopic_node_id: String(q.subtopic_node_id || ""),
      question_nature_id: String(q.question_nature_id || "")
    });
  };

  // Load cascading taxonomy and levels for Edit Question Form
  const editQuestionNodes = useMemo(() => {
    if (!editQuestionForm.exam_id) return [];
    return allTaxonomyNodes.filter(
      (node) => String(node.exam_id) === editQuestionForm.exam_id && (node.content_type === activeRepo || !node.content_type)
    );
  }, [allTaxonomyNodes, editQuestionForm.exam_id, activeRepo]);

  const editQuestionSubjects = useMemo(() => {
    return editQuestionNodes.filter((node) => node.node_type === "subject");
  }, [editQuestionNodes]);

  const editQuestionSourceBuckets = useMemo(() => {
    if (!editQuestionForm.subject_node_id) return [];
    // Allow direct children of the selected subject node
    return editQuestionNodes.filter((node) => String(node.parent_id) === editQuestionForm.subject_node_id);
  }, [editQuestionNodes, editQuestionForm.subject_node_id]);

  const editQuestionTopics = useMemo(() => {
    if (editQuestionForm.source_node_id) {
      return editQuestionNodes.filter((node) => String(node.parent_id) === editQuestionForm.source_node_id);
    }
    if (editQuestionForm.subject_node_id) {
      return editQuestionNodes.filter((node) => node.node_type === "topic" && String(node.parent_id) === editQuestionForm.subject_node_id);
    }
    return [];
  }, [editQuestionNodes, editQuestionForm.subject_node_id, editQuestionForm.source_node_id]);

  const editQuestionSubtopics = useMemo(() => {
    if (!editQuestionForm.topic_node_id) return [];
    return editQuestionNodes.filter((node) => String(node.parent_id) === editQuestionForm.topic_node_id);
  }, [editQuestionNodes, editQuestionForm.topic_node_id]);

  const [editQuestionLevels, setEditQuestionLevels] = useState<ExamLevel[]>([]);
  useEffect(() => {
    const loadLevels = async () => {
      if (!token || !editQuestionForm.exam_id) {
        setEditQuestionLevels([]);
        return;
      }
      try {
        const lvlList = await authenticatedGet<ExamLevel[]>(`/api/v1/assessment/exams/${editQuestionForm.exam_id}/levels`, token);
        setEditQuestionLevels(lvlList || []);
      } catch (err) {
        console.error("Failed to load levels for edit question form", err);
      }
    };
    void loadLevels();
  }, [editQuestionForm.exam_id, token]);

  const [editQuestionNatures, setEditQuestionNatures] = useState<QuestionNature[]>([]);
  useEffect(() => {
    const loadNatures = async () => {
      if (!token || !editQuestionForm.exam_id) {
        setEditQuestionNatures([]);
        return;
      }
      try {
        const res = await authenticatedGet<QuestionNature[]>(`/api/v1/assessment/question-natures?exam_id=${editQuestionForm.exam_id}`, token);
        setEditQuestionNatures(res || []);
      } catch (err) {
        console.error("Failed to load question natures for edit question form", err);
      }
    };
    void loadNatures();
  }, [editQuestionForm.exam_id, token]);

  const handleSaveQuestionEdit = async () => {
    if (!token || !editingQuestion) return;
    if (!editQuestionForm.question_statement.trim()) {
      showMessage("Question statement is required", "error");
      return;
    }

    setSavingEdit(true);
    try {
      // 1. Submit version changes (creates a new version and updates pointer)
      const versionPayload = {
        question_statement: editQuestionForm.question_statement.trim(),
        supplementary_statement: editQuestionForm.supplementary_statement.trim() || undefined,
        question_prompt: editQuestionForm.question_prompt.trim() || undefined,
        options: editQuestionForm.options.map(o => ({ key: o.key, label: o.key, text: o.text })),
        correct_answer: editQuestionForm.correct_answer,
        explanation: editQuestionForm.explanation.trim() || undefined
      };
      await authenticatedPost(`/api/v1/assessment/questions/${editingQuestion.id}/versions`, token, versionPayload);

      // 2. Submit taxonomy changes (PUT request)
      const taxonomyPayload = {
        exam_id: Number(editQuestionForm.exam_id),
        exam_level_id: Number(editQuestionForm.exam_level_id),
        subject_node_id: Number(editQuestionForm.subject_node_id),
        source_node_id: editQuestionForm.source_node_id ? Number(editQuestionForm.source_node_id) : null,
        topic_node_id: editQuestionForm.topic_node_id ? Number(editQuestionForm.topic_node_id) : null,
        subtopic_node_id: editQuestionForm.subtopic_node_id ? Number(editQuestionForm.subtopic_node_id) : null,
        question_nature_id: editQuestionForm.question_nature_id ? Number(editQuestionForm.question_nature_id) : null
      };
      await authenticatedPut(`/api/v1/assessment/questions/${editingQuestion.id}/taxonomy`, token, taxonomyPayload);

      showMessage("Question successfully updated!");
      setEditingQuestion(null);
      void loadQuizzes();
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to update question: " + (err.message || err), "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleUpdateQuestionStatus = async (qId: number, newStatus: string) => {
    if (!token) return;
    try {
      await authenticatedPatch(`/api/v1/assessment/questions/${qId}`, token, { status: newStatus });
      showMessage(`Question ${newStatus === "published" ? "published" : "unpublished"} successfully!`);
      void loadQuizzes();
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to update status: " + (err.message || err), "error");
    }
  };

  const handleDeleteQuestion = async (qId: number) => {
    if (!token || !window.confirm("Are you sure you want to permanently delete this question from the database?")) return;
    try {
      await authenticatedDelete(`/api/v1/assessment/questions/${qId}`, token);
      showMessage("Question deleted successfully!");
      void loadQuizzes();
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to delete question: " + (err.message || err), "error");
    }
  };

  const getTaxonomyPath = (q: any) => {
    const parts = [];
    if (q.subject_node_id) {
      const subject = allTaxonomyNodes.find(n => n.id === q.subject_node_id);
      if (subject) parts.push(subject.name);
    }
    if (q.topic_node_id) {
      const topic = allTaxonomyNodes.find(n => n.id === q.topic_node_id);
      if (topic) parts.push(topic.name);
    }
    if (q.subtopic_node_id) {
      const subtopic = allTaxonomyNodes.find(n => n.id === q.subtopic_node_id);
      if (subtopic) parts.push(subtopic.name);
    }
    return parts.join(" > ") || "General Study Node";
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Repository Tabs Selector */}
      {!hideRepoTabs && (
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl max-w-lg">
          <button
            type="button"
            onClick={() => setActiveRepo("gk")}
            className={`flex-1 py-2 text-center text-sm font-bold rounded-lg transition-all ${
              activeRepo === "gk"
                ? "bg-surface text-civic shadow-sm font-black"
                : "text-ink/65 hover:text-ink"
            }`}
          >
            GK Questions Library
          </button>
          <button
            type="button"
            onClick={() => setActiveRepo("aptitude")}
            className={`flex-1 py-2 text-center text-sm font-bold rounded-lg transition-all ${
              activeRepo === "aptitude"
                ? "bg-surface text-civic shadow-sm font-black"
                : "text-ink/65 hover:text-ink"
            }`}
          >
            CSAT & Aptitude
          </button>
          <button
            type="button"
            onClick={() => setActiveRepo("mains")}
            className={`flex-1 py-2 text-center text-sm font-bold rounded-lg transition-all ${
              activeRepo === "mains"
                ? "bg-surface text-civic shadow-sm font-black"
                : "text-ink/65 hover:text-ink"
            }`}
          >
            Mains Subjective
          </button>
        </div>
      )}


      {/* Notifications banner */}
      {message && (
        <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 border animate-in fade-in slide-in-from-top-4 duration-300 ${
          message.type === "success" 
            ? "bg-civic/5 text-civic border-civic/20" 
            : "bg-berry/5 text-berry border-berry/20"
        }`}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          {message.text}
        </div>
      )}

      {/* Filter and search parameters */}
      <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-lg font-black text-ink capitalize">
              {activeRepo === "mains" ? "Mains Assessment Repository" : `${activeRepo.toUpperCase()} Questions Library`}
            </h3>
            <p className="text-xs text-ink/60">
              {activeRepo === "mains" 
                ? "Review, publish drafts, inspect questions, and edit metadata of mains mock templates."
                : "Manage individual questions in the pool. Edit statements, option keys, explanations, and assign Question Natures."}
            </p>
          </div>
          <button
            onClick={loadQuizzes}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 px-4 rounded-xl border border-line bg-paper text-xs font-bold hover:border-civic transition-all"
            type="button"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          
          <label className="col-span-2 md:col-span-1 grid gap-1 text-[11px] font-bold text-ink">
            Search Text
            <span className="flex h-10 items-center rounded-lg border border-line px-3 bg-paper focus-within:bg-surface focus-within:border-civic transition-all">
              <Search className="h-3.5 w-3.5 text-ink/40 mr-1.5" />
              <input
                type="text"
                className="w-full bg-transparent text-xs font-medium outline-none text-ink placeholder:text-ink/40"
                placeholder={activeRepo === "mains" ? "Title, description, slug..." : "Question statement or keywords..."}
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </span>
          </label>

          <label className="grid gap-1 text-[11px] font-bold text-ink">
            Target Exam
            <select
              value={filters.examId}
              onChange={(e) => setFilters(prev => ({ ...prev, examId: e.target.value }))}
              className="h-10 rounded-lg border border-line bg-paper px-2 text-xs font-medium outline-none focus:border-civic focus:bg-surface transition-all"
            >
              <option value="">All Exams</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>

          {activeRepo === "mains" ? (
            <label className="grid gap-1 text-[11px] font-bold text-ink">
              Test Type
              <select
                value={filters.testType}
                onChange={(e) => setFilters(prev => ({ ...prev, testType: e.target.value }))}
                className="h-10 rounded-lg border border-line bg-paper px-2 text-xs font-medium outline-none focus:border-civic focus:bg-surface transition-all"
              >
                <option value="">All Types</option>
                <option value="quick_test">Quick Test</option>
                <option value="sectional_test">Sectional Test</option>
                <option value="full_length_test">Full Length</option>
                <option value="pyq_test">PYQ Test</option>
                <option value="mains_test">Mains Test</option>
                <option value="diagnostic_test">Diagnostic Test</option>
              </select>
            </label>
          ) : (
            <div className="bg-slate-50 border border-dashed border-line rounded-lg flex items-center justify-center text-[10px] text-ink/40 font-bold p-2">
              Objective Mode (No Template Type)
            </div>
          )}

          <label className="grid gap-1 text-[11px] font-bold text-ink">
            Status
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="h-10 rounded-lg border border-line bg-paper px-2 text-xs font-medium outline-none focus:border-civic focus:bg-surface transition-all"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="in_review">In Review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>

        </div>
      </div>

      {/* Select All Checkbox Bar */}
      {((activeRepo === "mains" ? quizzes.length : questions.length) > 0) && (
        <div className="flex items-center justify-between bg-surface border border-line px-5 py-3 rounded-2xl shadow-sm">
          <label className="flex items-center gap-2.5 text-xs font-bold text-ink cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4.5 w-4.5 rounded border-line text-civic focus:ring-civic cursor-pointer"
              checked={activeRepo === "mains" 
                ? (quizzes.length > 0 && selectedQuizIds.length === quizzes.length)
                : (questions.length > 0 && selectedQuestionIds.length === questions.length)}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            Select All {activeRepo.toUpperCase()} {activeRepo === "mains" ? "Quizzes" : "Questions"} on screen ({activeRepo === "mains" ? quizzes.length : questions.length})
          </label>
          {((activeRepo === "mains" ? selectedQuizIds.length : selectedQuestionIds.length) > 0) && (
            <span className="text-xs text-civic font-black bg-civic/10 px-3 py-1 rounded-full">
              {activeRepo === "mains" ? selectedQuizIds.length : selectedQuestionIds.length} selected
            </span>
          )}
        </div>
      )}

      {/* Main Content Render */}
      {loading ? (
        <div className="bg-surface border border-line rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="h-7 w-7 text-civic animate-spin" />
          <p className="text-sm font-bold text-ink/70">Fetching assessments database records...</p>
        </div>
      ) : activeRepo === "mains" ? (
        // ── MAINS TEMPLATE RENDER ──
        quizzes.length === 0 ? (
          <div className="bg-surface border border-line rounded-2xl p-10 text-center space-y-2">
            <HelpCircle className="h-10 w-10 text-ink/20 mx-auto" />
            <p className="text-sm font-bold text-ink">No templates found in MAINS repository.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {quizzes.map((q) => {
              const statusConfig = formatStatus(q.status);
              const isSelected = selectedQuizIds.includes(q.id);
              return (
                <div 
                  key={q.id}
                  className={`bg-surface border hover:border-civic/40 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4 transition-all hover:shadow-md ${
                    isSelected ? "border-civic bg-civic/5 ring-1 ring-civic/25" : "border-line"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2.5">
                        <input 
                          type="checkbox"
                          className="h-4.5 w-4.5 rounded border-line text-civic focus:ring-civic cursor-pointer"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(q.id)}
                        />
                        <span className={`text-[10px] font-black uppercase border px-2 py-0.5 rounded-full shrink-0 ${statusConfig.class}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold text-ink/40">
                        ID: #{q.id}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-base text-ink line-clamp-1 leading-snug">{q.title}</h4>
                      <p className="text-xs text-ink/60 line-clamp-2 mt-1">{q.description || "No description provided."}</p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] font-bold text-ink/75 pt-1">
                      <span className="flex items-center gap-1 bg-paper px-2 py-1 rounded-lg">
                        <BookOpen className="h-3 w-3 text-civic" />
                        {formatTestType(q.test_type)}
                      </span>
                      <span className="flex items-center gap-1 bg-paper px-2 py-1 rounded-lg">
                        <Clock className="h-3 w-3 text-civic" />
                        {q.duration_minutes} Mins
                      </span>
                      <span className="flex items-center gap-1 bg-paper px-2 py-1 rounded-lg">
                        <Award className="h-3 w-3 text-civic" />
                        {q.question_count} Qs / {q.total_marks} Marks
                      </span>
                      <span className="flex items-center gap-1 bg-paper px-2 py-1 rounded-lg capitalize">
                        {q.access_type === "free" ? <Unlock className="h-3 w-3 text-emerald-600" /> : <Lock className="h-3 w-3 text-berry" />}
                        {q.access_type}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-line/60 pt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleViewQuiz(q.id)}
                        className="h-8 w-8 rounded-lg border border-line flex items-center justify-center hover:border-civic hover:bg-civic/5 text-ink/80 hover:text-civic transition-all"
                        title="Preview Questions"
                        type="button"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(q)}
                        className="h-8 w-8 rounded-lg border border-line flex items-center justify-center hover:border-civic hover:bg-civic/5 text-ink/80 hover:text-civic transition-all"
                        title="Edit details"
                        type="button"
                      >
                        <FileEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuiz(q.id)}
                        className="h-8 w-8 rounded-lg border border-line flex items-center justify-center hover:border-berry hover:bg-berry/5 text-ink/80 hover:text-berry transition-all"
                        title="Delete quiz template"
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {q.status === "draft" && (
                      <button
                        onClick={() => handlePublishQuiz(q.id)}
                        className="h-8 rounded-lg bg-emerald-500 px-3 text-[11px] font-black uppercase text-white shadow hover:bg-emerald-600 transition-colors"
                      >
                        Publish
                      </button>
                    )}
                    {q.status === "published" && (
                      <button
                        onClick={() => handleUnpublishQuiz(q.id)}
                        className="h-8 rounded-lg border border-amber-500 text-amber-600 px-3 text-[11px] font-black uppercase hover:bg-amber-50 transition-colors"
                      >
                        Unpublish
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )) : (
        questions.length === 0 ? (
          <div className="bg-surface border border-line rounded-2xl p-10 text-center space-y-2 animate-in fade-in">
            <HelpCircle className="h-10 w-10 text-ink/20 mx-auto" />
            <p className="text-sm font-bold text-ink">No individual questions found in {activeRepo.toUpperCase()} library.</p>
            <p className="text-xs text-ink/50 max-w-sm mx-auto">Generate questions using AI or parse worksheets to ingest questions into the library pool.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedQuestions.map((group) => {
              if (group.type === "passage") {
                return renderPassageGroup(group);
              } else {
                const q = group.questions[0];
                const statusConfig = formatStatus(q.status);
                const isSelected = selectedQuestionIds.includes(q.id);
                const natureName = q.question_nature?.name || "No Nature";
                
                let parsedOptions: Array<{ key: string; text: string }> = [];
                if (q.current_version?.options && Array.isArray(q.current_version.options)) {
                  parsedOptions = q.current_version.options.map((o: any) => ({
                    key: o.key || o.label || "",
                    text: o.text || ""
                  }));
                }

                let correctAnswer = "A";
                if (q.current_version?.correct_answer) {
                  correctAnswer = typeof q.current_version.correct_answer === "object"
                    ? q.current_version.correct_answer.key || q.current_version.correct_answer.label || "A"
                    : q.current_version.correct_answer;
                }

                return (
                  <div 
                    key={q.id}
                    className={`bg-surface border rounded-2xl p-6 shadow-sm flex flex-col gap-4 transition-all hover:shadow-md ${
                      isSelected ? "border-civic bg-civic/5 ring-1 ring-civic/25" : "border-line hover:border-civic/30"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <input 
                          type="checkbox"
                          className="h-4.5 w-4.5 rounded border-line text-civic focus:ring-civic cursor-pointer"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(q.id)}
                        />
                        
                        <span className={`text-[10px] font-black uppercase border px-2 py-0.5 rounded-full shrink-0 ${statusConfig.class}`}>
                          {statusConfig.label}
                        </span>
                        
                        {q.question_nature && (
                          <span className="text-[10px] font-black uppercase bg-civic/10 text-civic px-2.5 py-0.5 rounded-full">
                            Nature: {natureName}
                          </span>
                        )}

                        <span className="text-[10px] font-extrabold text-ink/40 bg-slate-100 px-2 py-0.5 rounded">
                          {getTaxonomyPath(q)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        {q.is_ai_generated && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-civic/90 bg-civic/5 border border-civic/15 px-2 py-0.5 rounded-full">
                            <Sparkles className="h-3 w-3 text-civic" />
                            AI
                          </span>
                        )}
                        <span className="text-[10px] font-black text-ink/35">ID: #{q.id}</span>
                      </div>
                    </div>

                    {/* Question Prompt and Statements */}
                    <div className="space-y-2">
                      <p 
                        className="text-sm sm:text-base font-black text-ink leading-snug"
                        dangerouslySetInnerHTML={renderMathAndMarkdown(q.current_version?.question_statement || "")}
                      />
                      {q.current_version?.supplementary_statement && (
                        <p 
                          className="text-xs sm:text-sm font-medium text-ink/75 bg-slate-50 border-l-2 border-line p-2.5 whitespace-pre-line font-serif rounded-r-lg"
                          dangerouslySetInnerHTML={renderMathAndMarkdown(q.current_version.supplementary_statement)}
                        />
                      )}
                      {q.current_version?.question_prompt && (
                        <p 
                          className="text-xs font-bold text-civic italic pl-1"
                          dangerouslySetInnerHTML={renderMathAndMarkdown(q.current_version.question_prompt)}
                        />
                      )}
                    </div>

                    {/* Options List */}
                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 pl-1">
                      {parsedOptions.map((opt) => {
                        const isCorrect = opt.key === correctAnswer;
                        return (
                          <div 
                            key={opt.key}
                            className={`p-3.5 rounded-xl border text-xs font-semibold flex gap-2 transition-all ${
                              isCorrect 
                                ? "bg-emerald-50/40 border-emerald-300 text-emerald-800 ring-1 ring-emerald-300/30" 
                                : "bg-paper/30 border-line text-ink/75 hover:bg-paper/50"
                            }`}
                          >
                            <span className={`h-5 w-5 rounded-md flex items-center justify-center text-[10.5px] font-black border uppercase shrink-0 ${
                              isCorrect 
                                ? "bg-emerald-500 border-emerald-600 text-white" 
                                : "bg-surface border-line text-ink/40"
                            }`}>
                              {opt.key}
                            </span>
                            <span 
                              className="leading-snug pt-0.5"
                              dangerouslySetInnerHTML={renderMathAndMarkdown(opt.text)}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Pedagogical Explanation */}
                    {q.current_version?.explanation && (
                      <div className="pt-1 border-t border-line/40">
                        <button
                          type="button"
                          onClick={() => toggleExplanation(q.id)}
                          className="text-[11px] font-bold text-ink/50 hover:text-civic flex items-center gap-1 transition-all animate-in fade-in duration-200"
                        >
                          {expandedExplanationIds[q.id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {expandedExplanationIds[q.id] ? "Hide pedagogical explanation" : "View pedagogical explanation"}
                        </button>
                        {expandedExplanationIds[q.id] && (
                          <div className="mt-2 bg-paper rounded-xl p-4 text-xs border border-line/60 relative space-y-1 pl-6">
                            <span className="absolute left-2.5 top-5 h-1.5 w-1.5 rounded-full bg-civic/80" />
                            <h6 className="font-extrabold text-ink/70 text-[11px] uppercase tracking-wider">Pedagogical Explanation</h6>
                            <p 
                              className="text-ink/65 leading-relaxed font-sans whitespace-pre-wrap"
                              dangerouslySetInnerHTML={renderMathAndMarkdown(q.current_version.explanation)}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="border-t border-line/50 pt-3 flex justify-end gap-2">
                      {q.status === "draft" && (
                        <button
                          onClick={() => handleUpdateQuestionStatus(q.id, "published")}
                          className="inline-flex h-9 items-center gap-1.5 px-4 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-all shadow-sm"
                          type="button"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Publish
                        </button>
                      )}
                      {q.status === "published" && (
                        <button
                          onClick={() => handleUpdateQuestionStatus(q.id, "draft")}
                          className="inline-flex h-9 items-center gap-1.5 px-4 rounded-xl border border-amber-500 text-amber-600 text-xs font-bold hover:bg-amber-50 transition-all"
                          type="button"
                        >
                          Unpublish
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEditQuestion(q)}
                        className="inline-flex h-9 items-center gap-1.5 px-4 rounded-xl border border-line text-xs font-bold text-ink/80 hover:text-civic hover:border-civic/40 hover:bg-civic/5 transition-all"
                        type="button"
                      >
                        <FileEdit className="h-4.5 w-4.5" />
                        Quick Edit
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="inline-flex h-9 items-center gap-1.5 px-4 rounded-xl border border-line text-xs font-bold text-ink/80 hover:text-rose-600 hover:border-rose-600/30 hover:bg-rose-50 transition-all"
                        type="button"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                        Delete Question
                      </button>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )
      )}

      {/* VIEW PREVIEW PAPER MODAL (MAINS TEMPLATES ONLY) */}
      {viewingQuizId !== null && (
        <div className="fixed inset-0 bg-midnight/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-3fr rounded-2xl shadow-xl flex flex-col max-h-[85vh] border border-line animate-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-line flex justify-between items-center bg-paper rounded-t-2xl">
              <div>
                <span className="text-[10px] font-black text-civic uppercase tracking-wider">Inspect Assessment Paper</span>
                <h4 className="font-extrabold text-base text-ink mt-0.5">{viewingDetail?.title || "Loading paper details..."}</h4>
              </div>
              <button 
                onClick={() => setViewingQuizId(null)}
                className="h-8 w-8 rounded-full hover:bg-midnight/5 flex items-center justify-center transition-all"
                type="button"
              >
                <X className="h-4.5 w-4.5 text-ink/60" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetail ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 text-civic animate-spin" />
                  <p className="text-sm font-bold text-ink/60">Structuring sections, pulling passage questions and answer indices...</p>
                </div>
              ) : viewingDetail ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-4 bg-paper/60 border border-line/60 rounded-xl p-4 text-xs font-bold text-ink/75">
                    <div>
                      <span className="text-ink/40 block text-[10px] uppercase">Examination</span>
                      {viewingDetail.exam?.name || "Global"}
                    </div>
                    <div>
                      <span className="text-ink/40 block text-[10px] uppercase">Level</span>
                      {viewingDetail.exam_level?.name || "Global"}
                    </div>
                    <div>
                      <span className="text-ink/40 block text-[10px] uppercase">Test Type</span>
                      {formatTestType(viewingDetail.status)}
                    </div>
                    <div>
                      <span className="text-ink/40 block text-[10px] uppercase">Weightage</span>
                      {viewingDetail.questions.length} Qs / {viewingDetail.total_marks} Marks
                    </div>
                  </div>

                  {viewingDetail.sections.map((s, idx) => (
                    <div key={idx} className="border-l-4 border-civic pl-3.5 py-1">
                      <h5 className="font-extrabold text-sm text-ink">{s.title}</h5>
                      {s.instructions && <p className="text-xs text-ink/65 mt-0.5">{s.instructions}</p>}
                    </div>
                  ))}

                  <div className="space-y-5">
                    {groupedInspectorQuestions.map((item, groupIdx) => {
                      if (item.type === "independent") {
                        const { question: q, originalIndex: idx } = item;
                        const correctKey = typeof q.question_version.correct_answer === "object" && q.question_version.correct_answer !== null
                          ? (q.question_version.correct_answer as any).key
                          : q.question_version.correct_answer;

                        return (
                          <div key={q.id} className="border border-line rounded-xl p-5 space-y-4 bg-surface hover:shadow-sm transition-all">
                            <div className="flex items-start gap-2.5">
                              <span className="grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full bg-paper border border-line text-[10px] font-black text-ink">
                                {idx + 1}
                              </span>
                              <div className="space-y-1">
                                <p 
                                  className="text-sm font-extrabold text-ink leading-snug"
                                  dangerouslySetInnerHTML={renderMathAndMarkdown(q.question_version.question_statement)}
                                />
                                {q.question_version.supplementary_statement && (
                                  <p 
                                    className="text-xs font-semibold text-ink/70 leading-relaxed pl-1 border-l-2 border-line/80 whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={renderMathAndMarkdown(q.question_version.supplementary_statement)}
                                  />
                                )}
                                {q.question_version.question_prompt && (
                                  <p 
                                    className="text-xs font-bold text-civic italic"
                                    dangerouslySetInnerHTML={renderMathAndMarkdown(q.question_version.question_prompt)}
                                  />
                                )}
                              </div>
                            </div>

                            <div className="grid gap-2.5 sm:grid-cols-2 pl-8">
                              {q.question_version.options.map((opt) => {
                                const isCorrect = opt.key === correctKey;
                                return (
                                  <div 
                                    key={opt.key}
                                    className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                                      isCorrect 
                                        ? "bg-emerald-50/30 border-emerald-300 text-emerald-800" 
                                        : "bg-paper/40 border-line text-ink/80"
                                    }`}
                                  >
                                    <span className={`h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-black border uppercase shrink-0 ${
                                      isCorrect 
                                        ? "bg-emerald-500 border-emerald-600 text-white" 
                                        : "bg-surface border-line text-ink/50"
                                    }`}>
                                      {opt.key}
                                    </span>
                                    <span 
                                      className="leading-tight mt-0.5"
                                      dangerouslySetInnerHTML={renderMathAndMarkdown(opt.text)}
                                    />
                                  </div>
                                );
                              })}
                            </div>

                            {q.question_version.explanation && (
                              <div className="bg-paper rounded-xl p-4 text-xs space-y-1.5 border border-line/50 pl-6 relative">
                                <span className="absolute left-2.5 top-3.5 h-1.5 w-1.5 rounded-full bg-civic" />
                                <h6 className="font-extrabold text-ink/75">Pedagogical Explanation</h6>
                                <div 
                                  className="text-ink/65 leading-relaxed whitespace-pre-wrap"
                                  dangerouslySetInnerHTML={renderMathAndMarkdown(q.question_version.explanation)}
                                />
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        const { passage, questions } = item;
                        return (
                          <div key={`passage-group-${passage.id}-${groupIdx}`} className="border border-line rounded-xl p-5 space-y-5 bg-surface hover:shadow-sm transition-all">
                            {/* Passage header */}
                            <div className="bg-amber-50/20 border border-amber-200/50 rounded-2xl p-5 space-y-2">
                              <h5 className="font-black text-sm text-ink flex items-center gap-1.5">
                                <BookOpen className="h-4 w-4 text-civic" />
                                {passage.title || "Comprehension Reading Passage"}
                              </h5>
                              <div 
                                className="text-xs text-ink/80 leading-relaxed font-serif whitespace-pre-wrap"
                                dangerouslySetInnerHTML={renderMathAndMarkdown(passage.body)}
                              />
                            </div>

                            {/* Sub-questions */}
                            <div className="space-y-6 divide-y divide-line/60 pt-2">
                              {questions.map(({ question: q, originalIndex: idx }, subIdx) => {
                                const correctKey = typeof q.question_version.correct_answer === "object" && q.question_version.correct_answer !== null
                                  ? (q.question_version.correct_answer as any).key
                                  : q.question_version.correct_answer;

                                return (
                                  <div key={q.id} className={`${subIdx > 0 ? "pt-5" : ""} space-y-4`}>
                                    <div className="flex items-start gap-2.5">
                                      <span className="grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full bg-paper border border-line text-[10px] font-black text-ink">
                                        {idx + 1}
                                      </span>
                                      <div className="space-y-1">
                                        <p 
                                          className="text-sm font-extrabold text-ink leading-snug"
                                          dangerouslySetInnerHTML={renderMathAndMarkdown(q.question_version.question_statement)}
                                        />
                                        {q.question_version.supplementary_statement && (
                                          <p 
                                            className="text-xs font-semibold text-ink/70 leading-relaxed pl-1 border-l-2 border-line/80 whitespace-pre-wrap"
                                            dangerouslySetInnerHTML={renderMathAndMarkdown(q.question_version.supplementary_statement)}
                                          />
                                        )}
                                        {q.question_version.question_prompt && (
                                          <p 
                                            className="text-xs font-bold text-civic italic"
                                            dangerouslySetInnerHTML={renderMathAndMarkdown(q.question_version.question_prompt)}
                                          />
                                        )}
                                      </div>
                                    </div>

                                    <div className="grid gap-2.5 sm:grid-cols-2 pl-8">
                                      {q.question_version.options.map((opt) => {
                                        const isCorrect = opt.key === correctKey;
                                        return (
                                          <div 
                                            key={opt.key}
                                            className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                                              isCorrect 
                                                ? "bg-emerald-50/30 border-emerald-300 text-emerald-800" 
                                                : "bg-paper/40 border-line text-ink/80"
                                            }`}
                                          >
                                            <span className={`h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-black border uppercase shrink-0 ${
                                              isCorrect 
                                                ? "bg-emerald-500 border-emerald-600 text-white" 
                                                : "bg-surface border-line text-ink/50"
                                            }`}>
                                              {opt.key}
                                            </span>
                                            <span 
                                              className="leading-tight mt-0.5"
                                              dangerouslySetInnerHTML={renderMathAndMarkdown(opt.text)}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {q.question_version.explanation && (
                                      <div className="bg-paper rounded-xl p-4 text-xs space-y-1.5 border border-line/50 pl-6 relative">
                                        <span className="absolute left-2.5 top-3.5 h-1.5 w-1.5 rounded-full bg-civic" />
                                        <h6 className="font-extrabold text-ink/75">Pedagogical Explanation</h6>
                                        <div 
                                          className="text-ink/65 leading-relaxed whitespace-pre-wrap"
                                          dangerouslySetInnerHTML={renderMathAndMarkdown(q.question_version.explanation)}
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                </>
              ) : null}
            </div>

            <div className="p-4 border-t border-line flex justify-end gap-2 bg-paper rounded-b-2xl">
              <button
                onClick={() => setViewingQuizId(null)}
                className="h-10 px-6 bg-surface border border-line rounded-xl text-xs font-bold text-ink hover:border-civic transition-all"
                type="button"
              >
                Close Inspect
              </button>
              {viewingDetail && viewingDetail.status === "draft" && (
                <button
                  onClick={() => {
                    void handlePublishQuiz(viewingDetail.id);
                    setViewingQuizId(null);
                  }}
                  className="h-10 px-6 bg-civic text-white rounded-xl text-xs font-bold shadow-md hover:bg-civic/90 transition-all"
                  type="button"
                >
                  Publish Paper Live
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* EDIT MODAL DIALOG (MAINS TEMPLATES ONLY) */}
      {editingQuiz !== null && (
        <div className="fixed inset-0 bg-midnight/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-2xl shadow-xl flex flex-col border border-line animate-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-line flex justify-between items-center bg-paper rounded-t-2xl">
              <div>
                <h4 className="font-extrabold text-base text-ink">Edit Quiz Template Settings</h4>
                <p className="text-[10px] text-ink/50 mt-0.5">Template ID: #{editingQuiz.id}</p>
              </div>
              <button 
                onClick={() => setEditingQuiz(null)}
                className="h-8 w-8 rounded-full hover:bg-midnight/5 flex items-center justify-center transition-all"
                type="button"
              >
                <X className="h-4.5 w-4.5 text-ink/60" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 max-h-[70vh]">
              
              <label className="grid gap-1.5 text-xs font-black text-ink">
                Quiz Title
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="h-10 rounded-lg border border-line px-3 text-sm font-medium outline-none focus:border-civic"
                />
              </label>

              <label className="grid gap-1.5 text-xs font-black text-ink">
                URL Slug
                <input
                  type="text"
                  value={editForm.slug}
                  onChange={(e) => setEditForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                  className="h-10 rounded-lg border border-line px-3 text-sm font-mono outline-none focus:border-civic"
                />
              </label>

              <label className="grid gap-1.5 text-xs font-black text-ink">
                Description
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="min-h-[80px] rounded-lg border border-line p-3 text-sm font-medium outline-none focus:border-civic"
                />
              </label>

              <div className="grid gap-3 grid-cols-3">
                <label className="grid gap-1.5 text-xs font-black text-ink">
                  Test Type
                  <select
                    value={editForm.test_type}
                    onChange={(e) => setEditForm(prev => ({ ...prev, test_type: e.target.value }))}
                    className="h-10 rounded-lg border border-line bg-surface px-2 text-xs font-medium outline-none focus:border-civic"
                  >
                    <option value="quick_test">Quick Test</option>
                    <option value="sectional_test">Sectional Test</option>
                    <option value="full_length_test">Full Length</option>
                    <option value="pyq_test">PYQ Test</option>
                    <option value="mains_test">Mains Test</option>
                    <option value="diagnostic_test">Diagnostic Test</option>
                  </select>
                </label>

                <label className="grid gap-1.5 text-xs font-black text-ink">
                  Duration (mins)
                  <input
                    type="number"
                    value={editForm.duration_minutes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
                    className="h-10 rounded-lg border border-line px-2 text-xs font-medium outline-none focus:border-civic"
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-black text-ink">
                  Total Marks
                  <input
                    type="number"
                    value={editForm.total_marks}
                    onChange={(e) => setEditForm(prev => ({ ...prev, total_marks: Number(e.target.value) }))}
                    className="h-10 rounded-lg border border-line px-2 text-xs font-medium outline-none focus:border-civic"
                  />
                </label>
              </div>

              <div className="grid gap-3 grid-cols-2">
                <label className="grid gap-1.5 text-xs font-black text-ink">
                  Access Type
                  <select
                    value={editForm.access_type}
                    onChange={(e) => setEditForm(prev => ({ ...prev, access_type: e.target.value }))}
                    className="h-10 rounded-lg border border-line bg-surface px-2 text-xs font-medium outline-none focus:border-civic"
                  >
                    <option value="free">Free</option>
                    <option value="subscription">Subscription Required</option>
                    <option value="paid">One-time purchase</option>
                    <option value="private">Private</option>
                  </select>
                </label>

                <label className="grid gap-1.5 text-xs font-black text-ink">
                  Status
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    className="h-10 rounded-lg border border-line bg-surface px-2 text-xs font-medium outline-none focus:border-civic"
                  >
                    <option value="draft">Draft</option>
                    <option value="in_review">In Review</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
              </div>

              <div className="border-t border-line/60 pt-3 space-y-3">
                <label className="grid gap-1.5 text-xs font-black text-ink">
                  Target Examination
                  <select
                    value={editForm.exam_id}
                    onChange={(e) => setEditForm(prev => ({ ...prev, exam_id: e.target.value, exam_level_id: "" }))}
                    className="h-10 rounded-lg border border-line bg-surface px-3 text-xs font-medium outline-none focus:border-civic"
                  >
                    <option value="">-- Choose Exam --</option>
                    {exams.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1.5 text-xs font-black text-ink">
                  Exam Difficulty Level
                  <select
                    value={editForm.exam_level_id}
                    onChange={(e) => setEditForm(prev => ({ ...prev, exam_level_id: e.target.value }))}
                    disabled={!editForm.exam_id}
                    className="h-10 rounded-lg border border-line bg-surface px-3 text-xs font-medium outline-none focus:border-civic disabled:opacity-55"
                  >
                    <option value="">-- Choose Level --</option>
                    {editFormLevels.map(lvl => (
                      <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
                    ))}
                  </select>
                </label>
              </div>

            </div>

            <div className="p-4 border-t border-line flex justify-end gap-2 bg-paper rounded-b-2xl">
              <button
                onClick={() => setEditingQuiz(null)}
                className="h-10 px-5 bg-surface border border-line rounded-xl text-xs font-bold text-ink hover:border-civic transition-all"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="h-10 px-5 bg-civic text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:bg-civic/90 transition-all"
                type="button"
              >
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save Changes
              </button>
            </div>

          </div>
        </div>
      )}

      {/* QUICK EDIT QUESTION MODAL (GK / CSAT INDIVIDUAL QUESTIONS) */}
      <QuizManagerEditQuestionModal
        editingQuestion={editingQuestion}
        onClose={() => setEditingQuestion(null)}
        editQuestionForm={editQuestionForm}
        setEditQuestionForm={setEditQuestionForm}
        exams={exams}
        editQuestionLevels={editQuestionLevels}
        editQuestionSubjects={editQuestionSubjects}
        editQuestionSourceBuckets={editQuestionSourceBuckets}
        editQuestionTopics={editQuestionTopics}
        editQuestionSubtopics={editQuestionSubtopics}
        editQuestionNatures={editQuestionNatures}
        savingEdit={savingEdit}
        onSave={handleSaveQuestionEdit}
      />

      {/* FLOATING BULK ACTIONS BAR */}
      {((activeRepo === "mains" ? selectedQuizIds.length : selectedQuestionIds.length) > 0) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl py-3.5 px-6 flex items-center justify-between gap-6 z-50 text-white animate-in slide-in-from-bottom-6 duration-200">
          <span className="text-xs font-black">
            {activeRepo === "mains" ? selectedQuizIds.length : selectedQuestionIds.length} {activeRepo === "mains" ? "Quizzes" : "Questions"} Selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkModalOpen(true)}
              className="inline-flex h-9 items-center justify-center px-4 rounded-xl bg-civic hover:bg-civic/90 active:scale-[0.98] text-white text-xs font-bold shadow-sm transition-all"
              type="button"
            >
              Bulk Reassign
            </button>
            <button
              onClick={handleBulkDelete}
              className="inline-flex h-9 items-center justify-center px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-bold shadow-sm transition-all"
              type="button"
            >
              Bulk Delete
            </button>
            <button
              onClick={() => {
                setSelectedQuizIds([]);
                setSelectedQuestionIds([]);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* BULK CATEGORIES & NATURE REASSIGNMENT MODAL */}
      <QuizManagerBulkReassign
        bulkModalOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        activeRepo={activeRepo}
        selectedQuizIds={selectedQuizIds}
        selectedQuestionIds={selectedQuestionIds}
        exams={exams}
        bulkFormLevels={bulkFormLevels}
        bulkForm={bulkForm}
        setBulkForm={setBulkForm}
        bulkSubjects={bulkSubjects}
        bulkSourceBuckets={bulkSourceBuckets}
        bulkTopics={bulkTopics}
        bulkSubtopics={bulkSubtopics}
        questionNatures={questionNatures}
        savingBulk={savingBulk}
        onSubmit={handleBulkEditTaxonomySubmit}
      />

    </div>
  );
}
