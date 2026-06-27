"use client";

import { Save, Plus, Trash2, ArrowLeft, Loader2, Sparkles, FileText, LayoutList, Edit2, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { authenticatedGet, authenticatedPost, authenticatedPatch, useAuth } from "../../auth/auth-context";
import { RichTextMarkdownEditor } from "../rich-text-editor";
import { useKaTeX, renderMathAndMarkdown } from "./katex-renderer";
import { AdminQuizManager } from "./admin-quiz-manager";


type AdminMainsQuestionCreatorProps = {
  questionId: number | null;
  onBack: () => void;
  onSaved: () => void;
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

type QuestionFormat = {
  id: number;
  question_family: string;
  slug: string;
  name: string;
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
  name: string;
  slug: string;
};

export function AdminMainsQuestionCreator({ questionId, onBack, onSaved }: AdminMainsQuestionCreatorProps) {
  const { token } = useAuth();
  const router = useRouter();
  useKaTeX();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sourceMode, setSourceMode] = useState<"manual" | "ai" | "parse">("manual");
  const [parseInput, setParseInput] = useState("");
  const [parseLoading, setParseLoading] = useState(false);

  // Exams & Levels
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [examLevels, setExamLevels] = useState<ExamLevel[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>("");
  const [formats, setFormats] = useState<QuestionFormat[]>([]);
  const [natures, setNatures] = useState<QuestionNature[]>([]);
  const [selectedNatureId, setSelectedNatureId] = useState<string>("");

  // Cascading Taxonomy Nodes
  const [allTaxonomyNodes, setAllTaxonomyNodes] = useState<MainsTaxonomyNode[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string>("");
  const [selectedSubjectAreaId, setSelectedSubjectAreaId] = useState<string>("");
  const [selectedThemeId, setSelectedThemeId] = useState<string>("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string>("");

  // Base Form States
  const [status, setStatus] = useState<"draft" | "in_review" | "approved" | "published" | "archived">("draft");
  const [isAiGenerated, setIsAiGenerated] = useState(false);

  // Version States
  const [questionStatement, setQuestionStatement] = useState("");
  const [supplementaryStatement, setSupplementaryStatement] = useState("");
  const [questionPrompt, setQuestionPrompt] = useState("Write a detailed answer to the question in the space provided.");
  const [explanation, setExplanation] = useState("");

  // Details States
  const [wordLimit, setWordLimit] = useState<number>(250);
  const [marks, setMarks] = useState<number>(15);
  const [directive, setDirective] = useState("Discuss");
  const [modelAnswer, setModelAnswer] = useState("");
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [newKeyPoint, setNewKeyPoint] = useState("");

  // AI Drafting States
  const [aiDraftTopic, setAiDraftTopic] = useState("");
  const [aiDraftInstructions, setAiDraftInstructions] = useState("");
  const [isDraftingAI, setIsDraftingAI] = useState(false);

  // Draft List Staging States
  type DraftedMainsQuestion = {
    question_statement: string;
    supplementary_statement?: string;
    question_prompt?: string;
    explanation?: string;
    word_limit: number;
    marks: number;
    directive: string;
    model_answer: string;
    key_points: string[];
    exam_id?: number;
    exam_level_id?: number;
    paper_node_id?: number;
    subject_area_node_id?: number;
    theme_node_id?: number;
    topic_node_id?: number;
    subtopic_node_id?: number;
    question_nature_id?: number;
    is_ai_generated?: boolean;
  };

  const [draftedQuestions, setDraftedQuestions] = useState<DraftedMainsQuestion[]>([]);
  const updateDraftQuestion = (idx: number, field: keyof DraftedMainsQuestion, value: any) => {
    setDraftedQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [activeDraftEditIdx, setActiveDraftEditIdx] = useState<number | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [createdQuestion, setCreatedQuestion] = useState<{ id: number; statement: string } | null>(null);

  const resetForm = () => {
    setStatus("draft");
    setIsAiGenerated(false);
    setQuestionStatement("");
    setSupplementaryStatement("");
    setQuestionPrompt("Write a detailed answer to the question in the space provided.");
    setExplanation("");
    setWordLimit(250);
    setMarks(15);
    setDirective("Discuss");
    setModelAnswer("");
    setKeyPoints([]);
    setNewKeyPoint("");
    setSelectedExamId("");
    setSelectedLevelId("");
    setSelectedNatureId("");
    setSelectedPaperId("");
    setSelectedSubjectAreaId("");
    setSelectedThemeId("");
    setSelectedTopicId("");
    setSelectedSubtopicId("");
  };

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4500);
  };

  const initializeDraftedMainsQuestions = (qs: any[]): DraftedMainsQuestion[] => {
    return qs.map(q => ({
      question_statement: q.question_statement || "",
      supplementary_statement: q.supplementary_statement || "",
      question_prompt: q.question_prompt || "Write a detailed answer to the question in the space provided.",
      explanation: q.explanation || "",
      word_limit: Number(q.word_limit) || 250,
      marks: Number(q.marks) || 15,
      directive: q.directive || "Discuss",
      model_answer: q.model_answer || "",
      key_points: q.key_points || [],
      exam_id: q.exam_id || (selectedExamId ? Number(selectedExamId) : undefined),
      exam_level_id: q.exam_level_id || (selectedLevelId ? Number(selectedLevelId) : undefined),
      paper_node_id: q.paper_node_id || (selectedPaperId ? Number(selectedPaperId) : undefined),
      subject_area_node_id: q.subject_area_node_id || (selectedSubjectAreaId ? Number(selectedSubjectAreaId) : undefined),
      theme_node_id: q.theme_node_id || (selectedThemeId ? Number(selectedThemeId) : undefined),
      topic_node_id: q.topic_node_id || (selectedTopicId ? Number(selectedTopicId) : undefined),
      subtopic_node_id: q.subtopic_node_id || (selectedSubtopicId ? Number(selectedSubtopicId) : undefined),
      question_nature_id: q.question_nature_id || (selectedNatureId ? Number(selectedNatureId) : undefined),
      is_ai_generated: true
    }));
  };

  const handleAiDraftQuestion = async () => {
    if (!token || !aiDraftTopic.trim()) return;
    setIsDraftingAI(true);
    setDraftedQuestions([]);
    setSelectedIndices([]);
    try {
      const res = await authenticatedPost<any>("/api/v1/assessment/admin/ai/draft-mains-question", token, {
        topic: aiDraftTopic,
        instructions: aiDraftInstructions || undefined,
        ai_provider: "openai",
        ai_model: "gpt-4o-mini"
      });

      if (res?.questions?.length) {
        const mapped = initializeDraftedMainsQuestions(res.questions);
        setDraftedQuestions(mapped);
        setSelectedIndices(mapped.map((_, i) => i));
        showMessage(`Successfully drafted ${res.questions.length} Mains questions!`);
      } else {
        showMessage("No questions could be drafted. Check input.", "error");
      }
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to draft Mains question: " + (err.message || err), "error");
    } finally {
      setIsDraftingAI(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !token) return;

    setUploadingFile(true);
    setMessage(null);
    setSelectedIndices([]);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await authenticatedPost<any>(
        "/api/v1/assessment/admin/ai/parse-mains-file",
        token,
        {
          base64_data: base64Data,
          filename: file.name,
          mime_type: file.type || "application/octet-stream",
          instructions: aiDraftInstructions || undefined
        }
      );

      if (res?.questions?.length) {
        const mapped = initializeDraftedMainsQuestions(res.questions);
        setDraftedQuestions(mapped);
        setSelectedIndices(mapped.map((_, i) => i));
        showMessage(`Successfully parsed ${res.questions.length} Mains questions from ${file.name}!`);
      } else {
        showMessage("No questions could be parsed from the file.", "error");
      }
    } catch (err: any) {
      console.error("File parsing failed", err);
      showMessage("Failed to parse file: " + (err.message || err), "error");
    } finally {
      setUploadingFile(false);
      event.target.value = "";
    }
  };

  const handleParseImporterSubmit = async () => {
    if (!parseInput.trim() || !token) return;
    setParseLoading(true);
    setSelectedIndices([]);
    try {
      const res = await authenticatedPost<any>("/api/v1/assessment/admin/ai/draft-mains-question", token, {
        topic: parseInput.trim(),
        instructions: "Parse and extract the mains question as given. Use the exact text.",
        ai_provider: "openai",
        ai_model: "gpt-4o-mini"
      });

      if (res?.questions?.length) {
        const mapped = initializeDraftedMainsQuestions(res.questions);
        setDraftedQuestions(mapped);
        setSelectedIndices(mapped.map((_, i) => i));
        setParseInput("");
        showMessage(`Successfully parsed ${res.questions.length} Mains questions!`);
      } else {
        showMessage("No questions could be parsed.", "error");
      }
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to parse: " + (err.message || err), "error");
    } finally {
      setParseLoading(false);
    }
  };

  const handleApplyBulkTaxonomy = () => {
    if (selectedIndices.length === 0) return;
    setDraftedQuestions(prev => prev.map((q, idx) => {
      if (!selectedIndices.includes(idx)) return q;
      return {
        ...q,
        exam_id: selectedExamId ? Number(selectedExamId) : undefined,
        exam_level_id: selectedLevelId ? Number(selectedLevelId) : undefined,
        paper_node_id: selectedPaperId ? Number(selectedPaperId) : undefined,
        subject_area_node_id: selectedSubjectAreaId ? Number(selectedSubjectAreaId) : undefined,
        theme_node_id: selectedThemeId ? Number(selectedThemeId) : undefined,
        topic_node_id: selectedTopicId ? Number(selectedTopicId) : undefined,
        subtopic_node_id: selectedSubtopicId ? Number(selectedSubtopicId) : undefined,
        question_nature_id: selectedNatureId ? Number(selectedNatureId) : undefined
      };
    }));
    showMessage("Applied bulk taxonomy & nature to checked questions!");
  };

  const handleReleaseSelected = async () => {
    if (!token || selectedIndices.length === 0) return;
    setSaving(true);
    let succeededCount = 0;
    const errors: string[] = [];
    const succeededIndices: number[] = [];

    const defaultFormatId = formats[0]?.id || 1;

    for (const idx of selectedIndices) {
      const q = draftedQuestions[idx];
      if (!q) continue;

      try {
        const payload = {
          question_format_id: defaultFormatId,
          status: status || "draft",
          is_ai_generated: q.is_ai_generated || false,
          version: {
            question_statement: q.question_statement,
            supplementary_statement: q.supplementary_statement || null,
            question_prompt: q.question_prompt || null,
            explanation: q.explanation || null,
            statements_facts: [],
            content_json: {}
          },
          details: {
            word_limit: Number(q.word_limit) || 250,
            marks: Number(q.marks) || 15,
            directive: q.directive || "Discuss",
            model_answer: q.model_answer || null,
            key_points: q.key_points || [],
            answer_framework: {},
            evaluation_rubric: {}
          },
          taxonomy: q.exam_id && q.exam_level_id ? {
            exam_id: Number(q.exam_id),
            exam_level_id: Number(q.exam_level_id),
            paper_node_id: q.paper_node_id ? Number(q.paper_node_id) : undefined,
            subject_area_node_id: q.subject_area_node_id ? Number(q.subject_area_node_id) : undefined,
            theme_node_id: q.theme_node_id ? Number(q.theme_node_id) : undefined,
            topic_node_id: q.topic_node_id ? Number(q.topic_node_id) : undefined,
            subtopic_node_id: q.subtopic_node_id ? Number(q.subtopic_node_id) : undefined,
            question_nature_id: q.question_nature_id ? Number(q.question_nature_id) : undefined
          } : undefined
        };

        await authenticatedPost("/api/v1/assessment/mains/questions", token, payload);
        succeededCount++;
        succeededIndices.push(idx);
      } catch (err: any) {
        console.error(err);
        errors.push(q.question_statement.slice(0, 30) + "...: " + (err.message || err));
      }
    }

    setDraftedQuestions(prev => prev.filter((_, idx) => !succeededIndices.includes(idx)));
    setSelectedIndices([]);

    if (errors.length > 0) {
      showMessage(`Released ${succeededCount} questions. Failed some: ${errors.join(", ")}`, "error");
    } else {
      showMessage(`Successfully released ${succeededCount} Mains questions to the library!`);
      // Redirect to the Mains questions library page
      router.push("/admin/assessment/mains-questions");
    }
    setSaving(false);
  };

  // Load configuration metadata on mount
  useEffect(() => {
    const loadConfig = async () => {
      if (!token) return;
      try {
        const exList = await authenticatedGet<Exam[]>("/api/v1/assessment/exams", token);
        setExams(exList || []);
        if (exList && exList.length > 0 && exList[0] && !questionId) {
          setSelectedExamId(String(exList[0].id));
        }

        const formatList = await authenticatedGet<QuestionFormat[]>("/api/v1/assessment/question-formats", token);
        const subjectiveFormats = (formatList || []).filter(f => f.question_family === "mains_subjective");
        setFormats(subjectiveFormats);

        const nodesList = await authenticatedGet<MainsTaxonomyNode[]>("/api/v1/assessment/mains/taxonomy-nodes?limit=1000", token);
        setAllTaxonomyNodes(nodesList || []);
      } catch (err) {
        console.error("Error loading creator configurations", err);
      }
    };
    void loadConfig();
  }, [token, questionId]);

  // Load levels & natures when examId changes
  useEffect(() => {
    const loadLevelsAndNatures = async () => {
      if (!token || !selectedExamId) return;
      try {
        const lvlList = await authenticatedGet<ExamLevel[]>(`/api/v1/assessment/exams/${selectedExamId}/levels`, token);
        setExamLevels(lvlList || []);
        if (lvlList && lvlList.length > 0 && lvlList[0] && !selectedLevelId) {
          setSelectedLevelId(String(lvlList[0].id));
        }

        const natList = await authenticatedGet<QuestionNature[]>(`/api/v1/assessment/question-natures?exam_id=${selectedExamId}`, token);
        setNatures(natList || []);
        if (natList && natList.length > 0 && natList[0] && !selectedNatureId) {
          setSelectedNatureId(String(natList[0].id));
        }
      } catch (err) {
        console.error("Failed to load levels & natures", err);
      }
    };
    void loadLevelsAndNatures();
  }, [selectedExamId, token]);

  // Edit pre-population
  useEffect(() => {
    const loadQuestionData = async () => {
      if (!token || !questionId) return;
      setLoading(true);
      setCreatedQuestion(null);
      try {
        const q = await authenticatedGet<any>(`/api/v1/assessment/mains/questions/${questionId}`, token);
        if (q) {
          setStatus(q.status);
          setIsAiGenerated(q.is_ai_generated);

          // Version
          const ver = q.current_version || {};
          setQuestionStatement(ver.question_statement || "");
          setSupplementaryStatement(ver.supplementary_statement || "");
          setQuestionPrompt(ver.question_prompt || "");
          setExplanation(ver.explanation || "");

          // Details
          const det = q.mains_details || {};
          setWordLimit(det.word_limit || 250);
          setMarks(Number(det.marks) || 15);
          setDirective(det.directive || "Discuss");
          setModelAnswer(det.model_answer || "");
          setKeyPoints(det.key_points || []);

          // Taxonomy link
          const link = q.taxonomy_links?.[0] || {};
          if (link.exam_id) {
            setSelectedExamId(String(link.exam_id));
            setSelectedLevelId(String(link.exam_level_id));
            setSelectedNatureId(link.question_nature_id ? String(link.question_nature_id) : "");
            setSelectedPaperId(link.paper_node_id ? String(link.paper_node_id) : "");
            setSelectedSubjectAreaId(link.subject_area_node_id ? String(link.subject_area_node_id) : "");
            setSelectedThemeId(link.theme_node_id ? String(link.theme_node_id) : "");
            setSelectedTopicId(link.topic_node_id ? String(link.topic_node_id) : "");
            setSelectedSubtopicId(link.subtopic_node_id ? String(link.subtopic_node_id) : "");
          }
        }
      } catch (err) {
        console.error("Failed to fetch Mains question details", err);
      } finally {
        setLoading(false);
      }
    };
    void loadQuestionData();
  }, [questionId, token]);

  // Cascading categories based on selected exam and type hierarchies
  const examNodes = useMemo(() => {
    if (!selectedExamId) return [];
    return allTaxonomyNodes.filter((node) => String(node.exam_id) === selectedExamId);
  }, [allTaxonomyNodes, selectedExamId]);

  const activePapers = useMemo(() => {
    return examNodes.filter((node) => node.node_type === "paper");
  }, [examNodes]);

  const activeSubjectAreas = useMemo(() => {
    if (!selectedPaperId) return [];
    return examNodes.filter((node) => node.node_type === "subject_area" && String(node.parent_id) === selectedPaperId);
  }, [examNodes, selectedPaperId]);

  const activeThemes = useMemo(() => {
    if (!selectedSubjectAreaId) return [];
    return examNodes.filter((node) => node.node_type === "theme" && String(node.parent_id) === selectedSubjectAreaId);
  }, [examNodes, selectedSubjectAreaId]);

  const activeTopics = useMemo(() => {
    if (!selectedThemeId) return [];
    return examNodes.filter((node) => node.node_type === "topic" && String(node.parent_id) === selectedThemeId);
  }, [examNodes, selectedThemeId]);

  const activeSubtopics = useMemo(() => {
    if (!selectedTopicId) return [];
    return examNodes.filter((node) => node.node_type === "subtopic" && String(node.parent_id) === selectedTopicId);
  }, [examNodes, selectedTopicId]);

  // Handle cascading clears
  const handleExamChange = (examId: string) => {
    setSelectedExamId(examId);
    setSelectedLevelId("");
    setSelectedNatureId("");
    setSelectedPaperId("");
    setSelectedSubjectAreaId("");
    setSelectedThemeId("");
    setSelectedTopicId("");
    setSelectedSubtopicId("");
  };

  const handlePaperChange = (paperId: string) => {
    setSelectedPaperId(paperId);
    setSelectedSubjectAreaId("");
    setSelectedThemeId("");
    setSelectedTopicId("");
    setSelectedSubtopicId("");
  };

  const handleSubjectAreaChange = (subjectAreaId: string) => {
    setSelectedSubjectAreaId(subjectAreaId);
    setSelectedThemeId("");
    setSelectedTopicId("");
    setSelectedSubtopicId("");
  };

  const handleThemeChange = (themeId: string) => {
    setSelectedThemeId(themeId);
    setSelectedTopicId("");
    setSelectedSubtopicId("");
  };

  const handleTopicChange = (topicId: string) => {
    setSelectedTopicId(topicId);
    setSelectedSubtopicId("");
  };

  const addKeyPoint = () => {
    if (!newKeyPoint.trim()) return;
    setKeyPoints([...keyPoints, newKeyPoint.trim()]);
    setNewKeyPoint("");
  };

  const removeKeyPoint = (idx: number) => {
    setKeyPoints(keyPoints.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!questionStatement.trim()) {
      alert("Please provide the question statement.");
      return;
    }

    const defaultFormatId = formats[0]?.id || 1;

    const payload = {
      question_format_id: defaultFormatId,
      status,
      is_ai_generated: isAiGenerated,
      version: {
        question_statement: questionStatement,
        supplementary_statement: supplementaryStatement || null,
        question_prompt: questionPrompt || null,
        explanation: explanation || null,
        statements_facts: [],
        content_json: {}
      },
      details: {
        word_limit: Number(wordLimit) || 250,
        marks: Number(marks) || 15,
        directive: directive || "Discuss",
        model_answer: modelAnswer || null,
        key_points: keyPoints,
        answer_framework: {},
        evaluation_rubric: {}
      },
      taxonomy: selectedExamId && selectedLevelId ? {
        exam_id: Number(selectedExamId),
        exam_level_id: Number(selectedLevelId),
        paper_node_id: selectedPaperId ? Number(selectedPaperId) : undefined,
        subject_area_node_id: selectedSubjectAreaId ? Number(selectedSubjectAreaId) : undefined,
        theme_node_id: selectedThemeId ? Number(selectedThemeId) : undefined,
        topic_node_id: selectedTopicId ? Number(selectedTopicId) : undefined,
        subtopic_node_id: selectedSubtopicId ? Number(selectedSubtopicId) : undefined,
        question_nature_id: selectedNatureId ? Number(selectedNatureId) : undefined
      } : undefined
    };

    setSaving(true);
    try {
      if (questionId) {
        // Edit update
        await authenticatedPatch(`/api/v1/assessment/mains/questions/${questionId}`, token, {
          question_format_id: payload.question_format_id,
          status: payload.status,
          is_ai_generated: payload.is_ai_generated,
          details: payload.details,
          taxonomy: payload.taxonomy
        });
        
        // Also push a new version update
        await authenticatedPost(`/api/v1/assessment/mains/questions/${questionId}/versions`, token, payload.version);
        
        alert("Question updated successfully!");
        onSaved();
      } else {
        // Create new
        const res = await authenticatedPost<any>("/api/v1/assessment/mains/questions", token, payload);
        alert("Mains question created successfully!");
        setCreatedQuestion({ id: res.id, statement: payload.version.question_statement });
        resetForm();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save Mains question. Verify taxonomy selection requirements.");
    } finally {
      setSaving(false);
    }
  };

  if (draftedQuestions.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <button
            onClick={() => {
              if (window.confirm("Discard all drafted questions in staging?")) {
                setDraftedQuestions([]);
                setSelectedIndices([]);
              }
            }}
            className="h-10 w-10 grid place-items-center rounded-xl border border-line hover:bg-paper transition-all"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-lg font-black text-ink font-sans">Mains Staging Workspace</h2>
            <p className="text-xs text-ink/60 mt-0.5">Review, edit, and release drafted mains subjective questions.</p>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 border animate-in fade-in duration-300 ${
            message.type === "success" 
              ? "bg-civic/5 text-civic border-civic/20" 
              : "bg-berry/5 text-berry border-berry/20"
          }`}>
            <AlertCircle className="h-4 w-4 shrink-0" />
            {message.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
          {/* Left Panel: Cascading Taxonomy & Release */}
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm h-fit space-y-5">
            <h4 className="font-extrabold text-base text-ink border-b border-line pb-2 flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-civic" />
              Staging Bulk Actions
            </h4>

            <div className="space-y-4">
              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Syllabus Exam
                <select
                  value={selectedExamId}
                  onChange={(e) => handleExamChange(e.target.value)}
                  className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                >
                  <option value="">-- Choose Exam --</option>
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Difficulty Exam Level
                <select
                  value={selectedLevelId}
                  onChange={(e) => setSelectedLevelId(e.target.value)}
                  className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                  disabled={!selectedExamId}
                >
                  <option value="">-- Choose Level --</option>
                  {examLevels.map(lvl => (
                    <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Question Nature
                <select
                  value={selectedNatureId}
                  onChange={(e) => setSelectedNatureId(e.target.value)}
                  className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                  disabled={!selectedExamId}
                >
                  <option value="">-- Choose Nature --</option>
                  {natures.map(n => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </label>

              <div className="border border-line/60 p-3 rounded-lg bg-slate-50 space-y-3">
                <span className="text-[11px] font-black text-ink uppercase tracking-wider block font-bold">UPSC Mains Syllabus Mapping</span>

                <label className="grid gap-1 text-[11px] font-bold text-ink">
                  Syllabus Paper (Paper)
                  <select
                    value={selectedPaperId}
                    onChange={(e) => handlePaperChange(e.target.value)}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                    disabled={!selectedExamId}
                  >
                    <option value="">-- Choose Paper --</option>
                    {activePapers.map(node => (
                      <option key={node.id} value={node.id}>{node.name}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] font-bold text-ink">
                  Subject Area
                  <select
                    value={selectedSubjectAreaId}
                    onChange={(e) => handleSubjectAreaChange(e.target.value)}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                    disabled={!selectedPaperId}
                  >
                    <option value="">-- Choose Subject Area --</option>
                    {activeSubjectAreas.map(node => (
                      <option key={node.id} value={node.id}>{node.name}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] font-bold text-ink">
                  Theme
                  <select
                    value={selectedThemeId}
                    onChange={(e) => handleThemeChange(e.target.value)}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                    disabled={!selectedSubjectAreaId}
                  >
                    <option value="">-- Choose Theme --</option>
                    {activeThemes.map(node => (
                      <option key={node.id} value={node.id}>{node.name}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] font-bold text-ink">
                  Topic
                  <select
                    value={selectedTopicId}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                    disabled={!selectedThemeId}
                  >
                    <option value="">-- Choose Topic --</option>
                    {activeTopics.map(node => (
                      <option key={node.id} value={node.id}>{node.name}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] font-bold text-ink">
                  Subtopic
                  <select
                    value={selectedSubtopicId}
                    onChange={(e) => setSelectedSubtopicId(e.target.value)}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                    disabled={!selectedTopicId}
                  >
                    <option value="">-- Choose Subtopic --</option>
                    {activeSubtopics.map(node => (
                      <option key={node.id} value={node.id}>{node.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="pt-2 space-y-2 border-t border-line/60">
                <button
                  onClick={handleApplyBulkTaxonomy}
                  disabled={selectedIndices.length === 0}
                  className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-civic text-civic bg-white font-bold text-xs hover:bg-civic/5 transition-all disabled:opacity-50"
                  type="button"
                >
                  Apply to Checked ({selectedIndices.length})
                </button>

                <button
                  onClick={handleReleaseSelected}
                  disabled={saving || selectedIndices.length === 0}
                  className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-civic text-white font-bold text-sm shadow-sm hover:bg-civic/90 active:scale-[0.98] transition-all disabled:opacity-50"
                  type="button"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Release Selected ({selectedIndices.length})
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Checklist of Draft cards */}
          <div className="space-y-4">
            <h4 className="font-extrabold text-base text-ink flex items-center justify-between font-sans">
              <span>Staging Preview</span>
              <span className="text-xs font-normal text-ink/50">({draftedQuestions.length} draft questions)</span>
            </h4>

            {/* Select All Checkbox Bar */}
            {draftedQuestions.length > 0 && (
              <div className="flex items-center justify-between bg-white border border-line px-5 py-3 rounded-2xl shadow-sm">
                <label className="flex items-center gap-2.5 text-xs font-bold text-ink cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4.5 w-4.5 rounded border-line text-civic focus:ring-civic cursor-pointer"
                    checked={selectedIndices.length === draftedQuestions.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIndices(draftedQuestions.map((_, i) => i));
                      } else {
                        setSelectedIndices([]);
                      }
                    }}
                  />
                  Select All Draft Questions ({draftedQuestions.length})
                </label>
                {selectedIndices.length > 0 && (
                  <span className="text-xs text-civic font-black bg-civic/10 px-3 py-1 rounded-full">
                    {selectedIndices.length} selected
                  </span>
                )}
              </div>
            )}

            {/* Questions list */}
            <div className="space-y-4">
              {draftedQuestions.map((q, idx) => {
                const isSelected = selectedIndices.includes(idx);
                const isEditing = activeDraftEditIdx === idx;
                
                // Resolve path name
                const getMainsTaxonomyPath = () => {
                  const parts = [];
                  if (q.paper_node_id) {
                    const paper = allTaxonomyNodes.find(n => n.id === q.paper_node_id);
                    if (paper) parts.push(paper.name);
                  }
                  if (q.subject_area_node_id) {
                    const sa = allTaxonomyNodes.find(n => n.id === q.subject_area_node_id);
                    if (sa) parts.push(sa.name);
                  }
                  if (q.theme_node_id) {
                    const theme = allTaxonomyNodes.find(n => n.id === q.theme_node_id);
                    if (theme) parts.push(theme.name);
                  }
                  return parts.join(" > ") || "General Study Node";
                };

                const nat = natures.find(n => n.id === q.question_nature_id);

                return (
                  <div 
                    key={idx}
                    className={`bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-4 transition-all hover:shadow-md ${
                      isSelected ? "border-civic bg-civic/5 ring-1 ring-civic/25" : "border-line hover:border-civic/30"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <input 
                          type="checkbox"
                          className="h-4.5 w-4.5 rounded border-line text-civic focus:ring-civic cursor-pointer"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedIndices(curr =>
                              curr.includes(idx) ? curr.filter(i => i !== idx) : [...curr, idx]
                            );
                          }}
                        />
                        
                        <span className="text-[10px] font-black uppercase bg-slate-100 text-ink/70 px-2 py-0.5 rounded-full shrink-0">
                          Q{idx + 1} (Draft)
                        </span>

                        {nat && (
                          <span className="text-[10px] font-black uppercase bg-civic/10 text-civic px-2.5 py-0.5 rounded-full">
                            Nature: {nat.name}
                          </span>
                        )}

                        <span className="text-[10px] font-extrabold text-ink/40 bg-slate-100 px-2 py-0.5 rounded">
                          {getMainsTaxonomyPath()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveDraftEditIdx(isEditing ? null : idx)}
                          className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                            isEditing 
                              ? "bg-civic text-white border-civic" 
                              : "border-line bg-paper text-ink/80 hover:border-civic hover:text-civic"
                          }`}
                        >
                          <Edit2 className="h-3 w-3" />
                          {isEditing ? "Done Editing" : "Edit In-Place"}
                        </button>
                        
                        <button
                          onClick={() => {
                            setDraftedQuestions(prev => prev.filter((_, i) => i !== idx));
                            setSelectedIndices(curr => curr.filter(i => i !== idx).map(i => (i > idx ? i - 1 : i)));
                          }}
                          className="h-7 w-7 rounded-lg border border-line bg-paper text-ink/50 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center transition-all"
                          title="Delete Question"
                          type="button"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <p 
                        className="text-sm sm:text-base font-black text-ink leading-snug"
                        dangerouslySetInnerHTML={renderMathAndMarkdown(q.question_statement || "No question statement entered.")}
                      />
                      {q.supplementary_statement && (
                        <div 
                          className="text-xs sm:text-sm font-medium text-ink/75 bg-slate-50 border-l-2 border-line p-2.5 whitespace-pre-line font-serif rounded-r-lg"
                          dangerouslySetInnerHTML={renderMathAndMarkdown(q.supplementary_statement)}
                        />
                      )}
                      {q.question_prompt && (
                        <p 
                          className="text-xs font-bold text-civic italic pl-1"
                          dangerouslySetInnerHTML={renderMathAndMarkdown(q.question_prompt)}
                        />
                      )}
                    </div>

                    {/* Mains details pills */}
                    <div className="flex flex-wrap gap-2 text-[11px] font-bold text-ink/75">
                      <span className="bg-paper px-2.5 py-1 rounded-lg">
                        Directive: {q.directive}
                      </span>
                      <span className="bg-paper px-2.5 py-1 rounded-lg">
                        Marks: {q.marks}
                      </span>
                      <span className="bg-paper px-2.5 py-1 rounded-lg">
                        Word Limit: {q.word_limit} words
                      </span>
                    </div>

                    {/* Expandable Model Answer & key points preview */}
                    {q.model_answer && (
                      <div className="pt-1 border-t border-line/40 space-y-2 font-sans">
                        <details className="group">
                          <summary className="text-[11px] font-bold text-ink/50 hover:text-civic flex items-center gap-1 cursor-pointer outline-none select-none list-none">
                            <span className="transition-transform group-open:rotate-180">▼</span>
                            View model answer framework & rubric checks
                          </summary>
                          <div className="mt-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                            <div className="text-xs text-ink/75 bg-slate-50 border border-line p-3.5 rounded-xl whitespace-pre-line font-serif leading-relaxed">
                              <h5 className="font-extrabold text-xs text-ink mb-1.5">Model Answer Framework:</h5>
                              {q.model_answer}
                            </div>
                            {q.key_points && q.key_points.length > 0 && (
                              <div className="bg-slate-50 border border-line p-3.5 rounded-xl space-y-1.5">
                                <h5 className="font-extrabold text-xs text-ink">Rubric Checks:</h5>
                                <ul className="list-disc pl-4 text-xs text-ink/70 space-y-0.5">
                                  {q.key_points.map((pt, pIdx) => (
                                    <li key={pIdx}>{pt}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    )}

                    {/* Inline edit drawer */}
                    {isEditing && (
                      <div className="border-t-2 border-dashed border-line/70 pt-5 mt-2 space-y-4 animate-in slide-in-from-top-4 duration-300">
                        <h5 className="text-xs font-black text-civic uppercase tracking-widest font-sans">In-Place Editor Workspace</h5>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="grid gap-1 text-xs font-bold text-ink">
                            Directive
                            <select
                              value={q.directive}
                              onChange={(e) => updateDraftQuestion(idx, "directive", e.target.value)}
                              className="h-10 rounded-lg border border-line bg-white px-3 text-xs"
                            >
                              <option value="Discuss">Discuss</option>
                              <option value="Analyze">Analyze</option>
                              <option value="Evaluate">Evaluate</option>
                              <option value="Critically Examine">Critically Examine</option>
                              <option value="Elucidate">Elucidate</option>
                              <option value="Explain">Explain</option>
                            </select>
                          </label>

                          <label className="grid gap-1 text-xs font-bold text-ink">
                            Max Marks
                            <input
                              type="number"
                              value={q.marks}
                              onChange={(e) => updateDraftQuestion(idx, "marks", Number(e.target.value))}
                              className="h-10 rounded-lg border border-line bg-white px-3 text-xs"
                            />
                          </label>

                          <label className="grid gap-1 text-xs font-bold text-ink">
                            Word Limit
                            <input
                              type="number"
                              value={q.word_limit}
                              onChange={(e) => updateDraftQuestion(idx, "word_limit", Number(e.target.value))}
                              className="h-10 rounded-lg border border-line bg-white px-3 text-xs"
                            />
                          </label>
                        </div>

                        <label className="grid gap-1 text-xs font-bold text-ink">
                          Question Statement *
                          <textarea
                            value={q.question_statement}
                            onChange={(e) => updateDraftQuestion(idx, "question_statement", e.target.value)}
                            className="w-full min-h-[60px] rounded-lg border border-line p-3 text-xs"
                          />
                        </label>

                        <label className="grid gap-1 text-xs font-bold text-ink">
                          Supplementary Context
                          <textarea
                            value={q.supplementary_statement || ""}
                            onChange={(e) => updateDraftQuestion(idx, "supplementary_statement", e.target.value)}
                            className="w-full min-h-[60px] rounded-lg border border-line p-3 text-xs"
                          />
                        </label>

                        <label className="grid gap-1 text-xs font-bold text-ink">
                          Prompt
                          <input
                            type="text"
                            value={q.question_prompt || ""}
                            onChange={(e) => updateDraftQuestion(idx, "question_prompt", e.target.value)}
                            className="h-10 rounded-lg border border-line px-3 text-xs"
                          />
                        </label>

                        <RichTextMarkdownEditor
                          label="Model Answer / Framework"
                          value={q.model_answer}
                          onChange={(val) => updateDraftQuestion(idx, "model_answer", val)}
                          minHeightClass="min-h-[140px]"
                        />

                        {/* Nature select */}
                        <label className="grid gap-1 text-xs font-bold text-ink">
                          Question Nature
                          <select
                            value={q.question_nature_id || ""}
                            onChange={(e) => updateDraftQuestion(idx, "question_nature_id", e.target.value ? Number(e.target.value) : undefined)}
                            className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none"
                          >
                            <option value="">-- Choose Nature --</option>
                            {natures.map(n => (
                              <option key={n.id} value={n.id}>{n.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      {/* Drafts Section */}
      {!questionId && (
        <div className="mt-12 pt-8 border-t border-line">
          <h3 className="text-xl font-black text-ink mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-civic" />
            Saved Drafts
          </h3>
          <p className="text-sm text-ink/60 mb-6">
            Resume work on your unpublished questions. You can edit them or publish them to the live pool.
          </p>
          <AdminQuizManager 
            initialRepo="mains" 
            hideRepoTabs={true} 
            forceStatus="draft" 
            defaultTab="questions" 
          />
        </div>
      )}
    </div>
  );
}

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 text-civic animate-spin" />
        <span className="text-sm font-semibold text-ink/65">Loading question information...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <button
          onClick={onBack}
          className="h-10 w-10 grid place-items-center rounded-xl border border-line hover:bg-paper transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-black text-ink">{questionId ? "Edit Mains Question" : "Add Mains Question"}</h2>
          <p className="text-xs text-ink/60 mt-0.5">Define grading weights, model answer guidelines, and syllabus mapping.</p>
        </div>
      </div>

      {createdQuestion && (
        <div className="bg-civic/5 border border-civic/20 text-civic p-4 rounded-xl text-sm font-bold flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5 text-civic" />
            <span>Mains question created successfully!</span>
          </div>
          <div className="text-xs text-ink/75 font-normal pl-6.5 truncate max-w-full">
            "{createdQuestion.statement}"
          </div>
          <div className="flex gap-4 pl-6.5 mt-1">
            <a
              href={`/assessment/mains/${createdQuestion.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-civic hover:text-civic/80 underline font-black"
            >
              View Student Practice Page <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {/* ── 3-Source Tabs ── */}
      <div className="flex gap-1 border border-line rounded-2xl p-1 bg-paper/40">
        {([
          { key: "manual", label: "Manual Entry", icon: <LayoutList className="h-4 w-4" /> },
          { key: "ai", label: "AI Generate", icon: <Sparkles className="h-4 w-4" /> },
          { key: "parse", label: "AI Parse / Worksheet", icon: <FileText className="h-4 w-4" /> },
        ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSourceMode(key)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold rounded-xl transition-all ${
              sourceMode === key
                ? "bg-white text-civic shadow-sm border border-line"
                : "text-ink/65 hover:text-ink"
            }`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* AI GENERATE MODE */}
      {sourceMode === "ai" && (
        <div className="border border-indigo-100 bg-indigo-50/30 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-black text-indigo-950 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            AI Mains Question Generator
          </h3>
          <p className="text-xs text-indigo-900/70">
            Input a topic or issue, and AI will draft the question statement, directive, marks allocation, model answer guidelines, and rubric checks. Review and edit, then switch to Manual Entry to finalize.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[11px] font-bold text-indigo-900">
              Topic / Subject Issue *
              <input
                type="text"
                placeholder="e.g. GST and federal cooperation in India"
                value={aiDraftTopic}
                onChange={(e) => setAiDraftTopic(e.target.value)}
                className="h-9 rounded-lg border border-line px-3 text-xs bg-white focus:border-indigo-500 outline-none"
              />
            </label>
            <label className="grid gap-1 text-[11px] font-bold text-indigo-900">
              Extra Instructions (Optional)
              <input
                type="text"
                placeholder="e.g. Focus on Article 279A, 15 marks"
                value={aiDraftInstructions}
                onChange={(e) => setAiDraftInstructions(e.target.value)}
                className="h-9 rounded-lg border border-line px-3 text-xs bg-white focus:border-indigo-500 outline-none"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={isDraftingAI || !aiDraftTopic.trim()}
            onClick={async () => {
              await handleAiDraftQuestion();
              if (aiDraftTopic) setSourceMode("manual");
            }}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 transition-all disabled:opacity-55"
          >
            {isDraftingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isDraftingAI ? "Drafting..." : "Draft & Fill Form →"}
          </button>
        </div>
      )}

      {/* AI PARSE MODE */}
      {sourceMode === "parse" && (
        <div className="border border-line bg-white rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="text-base font-black text-ink flex items-center gap-2">
                <FileText className="h-5 w-5 text-civic" />
                AI Parse / Worksheet Importer
              </h3>
              <p className="text-xs text-ink/65 mt-0.5">
                Paste raw mains questions or upload a syllabus document/past paper. AI will extract multiple questions and place them in the staging workspace.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 pt-2">
            {/* Left: Text pasting */}
            <div className="space-y-4">
              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Paste Raw Mains Question Text
                <textarea
                  value={parseInput}
                  onChange={(e) => setParseInput(e.target.value)}
                  disabled={parseLoading}
                  placeholder={`e.g.:
Q1. Discuss the impact of climate change on Indian monsoon. (15 marks, 250 words)

Q2. Critically examine the role of self-help groups in rural India. (10 marks, 150 words)`}
                  className="w-full min-h-[160px] rounded-xl border border-line p-3 text-xs outline-none focus:border-civic font-mono leading-relaxed"
                />
              </label>
              <button
                type="button"
                disabled={parseLoading || !parseInput.trim()}
                onClick={handleParseImporterSubmit}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-civic text-white font-bold text-sm px-6 shadow-md hover:bg-civic/90 transition-all disabled:opacity-50"
              >
                {parseLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <FileText className="h-4.5 w-4.5" />}
                Parse Question List
              </button>
            </div>

            {/* Right: Document Upload */}
            <div className="flex flex-col justify-center border-2 border-dashed border-line rounded-xl p-6 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-all relative">
              <label className="flex flex-col items-center justify-center h-full w-full cursor-pointer font-sans">
                {uploadingFile ? (
                  <Loader2 className="h-8 w-8 text-civic animate-spin mb-2" />
                ) : (
                  <FileText className="h-8 w-8 text-ink/30 mb-2" />
                )}
                <span className="text-xs font-bold text-ink/85">
                  {uploadingFile ? "Uploading & Analyzing Document..." : "Upload Past Paper or Syllabus Document"}
                </span>
                <span className="text-[10px] text-ink/40 mt-1 text-center">
                  Accepts PDF, DOCX, TXT, MD (Max 10MB)
                </span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploadingFile || parseLoading}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL FORM */}
      {sourceMode === "manual" && (
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[2fr_1fr]">

          {/* Left Side: Question Text & Rubric */}
        <div className="space-y-6 bg-white border border-line rounded-2xl p-6 shadow-sm">
          

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Grading Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold"
              >
                <option value="draft">Draft</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="published">Published</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Grading Type Directive
              <select
                value={directive}
                onChange={(e) => setDirective(e.target.value)}
                className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold"
              >
                <option value="Discuss">Discuss</option>
                <option value="Analyze">Analyze</option>
                <option value="Evaluate">Evaluate</option>
                <option value="Critically Examine">Critically Examine</option>
                <option value="Elucidate">Elucidate</option>
                <option value="Explain">Explain</option>
              </select>
            </label>
          </div>

          <RichTextMarkdownEditor
            label="Question Statement (Core Directive) *"
            value={questionStatement}
            onChange={setQuestionStatement}
            placeholder="e.g. Critically examine the impact of GST on federal cooperation in India. (15 Marks, 250 Words)"
            required
            minHeightClass="min-h-[140px]"
          />

          <label className="grid gap-1.5 text-xs font-bold text-ink">
            Supplementary Context / Reference quotes (Optional)
            <textarea
              value={supplementaryStatement}
              onChange={(e) => setSupplementaryStatement(e.target.value)}
              className="min-h-16 rounded-lg border border-line p-3 text-sm"
              placeholder="e.g. 'Cooperative federalism is not a one-way street...' - Quote/Facts reference"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-ink">
            Student directive instructions (Optional)
            <input
              type="text"
              value={questionPrompt}
              onChange={(e) => setQuestionPrompt(e.target.value)}
              className="h-11 rounded-lg border border-line px-3 text-sm"
              placeholder="e.g. Write your answer response in the text block."
            />
          </label>

          <div className="border-t border-line/60 my-4"></div>

          <RichTextMarkdownEditor
            label="Grading Model Answer / Structured Framework (Reference Guide) *"
            value={modelAnswer}
            onChange={setModelAnswer}
            placeholder="Provide details of points, legal sections, introduction layout, and final balance statement."
            required
            minHeightClass="min-h-[220px]"
          />

          {/* Key points rubric checklist */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-ink block">Key Grading Rubric Elements (Checks for evaluation)</label>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyPoint}
                onChange={(e) => setNewKeyPoint(e.target.value)}
                className="flex-1 h-10 rounded-lg border border-line px-3 text-sm"
                placeholder="e.g. Must mention Article 279A constitutional mandate"
              />
              <button
                type="button"
                onClick={addKeyPoint}
                className="h-10 px-4 rounded-lg bg-civic text-white text-xs font-bold"
              >
                Add Rubric Check
              </button>
            </div>

            {keyPoints.length > 0 && (
              <div className="space-y-2 border border-line/60 p-3 rounded-lg bg-paper/20">
                {keyPoints.map((point, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-white border border-line p-2.5 rounded-lg">
                    <span className="font-semibold text-ink">{point}</span>
                    <button
                      type="button"
                      onClick={() => removeKeyPoint(idx)}
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Taxonomy and Metrics */}
        <div className="space-y-6">
          
          {/* Question metrics card */}
          <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-ink border-b border-line pb-2">Grading parameters</h3>
            
            <div className="grid gap-3 grid-cols-2">
              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Max Marks *
                <input
                  type="number"
                  value={marks}
                  onChange={(e) => setMarks(Number(e.target.value))}
                  className="h-10 rounded-lg border border-line px-3 text-sm font-semibold bg-white"
                  required
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Word Limit *
                <input
                  type="number"
                  value={wordLimit}
                  onChange={(e) => setWordLimit(Number(e.target.value))}
                  className="h-10 rounded-lg border border-line px-3 text-sm font-semibold bg-white"
                  required
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-ink pt-2">
              <input
                type="checkbox"
                checked={isAiGenerated}
                onChange={(e) => setIsAiGenerated(e.target.checked)}
                className="h-4 w-4"
              />
              Mark as AI-generated question
            </label>
          </div>

          {/* Cascading Mains Taxonomy selector */}
          <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-ink border-b border-line pb-2">UPSC Mains Syllabus Mapping</h3>

            <label className="grid gap-1 text-xs font-bold text-ink">
              Syllabus Exam *
              <select
                value={selectedExamId}
                onChange={(e) => handleExamChange(e.target.value)}
                className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                required
              >
                <option value="">-- Choose Exam --</option>
                {exams.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-bold text-ink">
              Difficulty Exam Level *
              <select
                value={selectedLevelId}
                onChange={(e) => setSelectedLevelId(e.target.value)}
                className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                disabled={!selectedExamId}
                required
              >
                <option value="">-- Choose Level --</option>
                {examLevels.map(lvl => (
                  <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
                ))}
              </select>
            </label>

            <div className="border-t border-line/60 my-2"></div>

            <label className="grid gap-1 text-xs font-bold text-ink">
              Syllabus Paper (Paper)
              <select
                value={selectedPaperId}
                onChange={(e) => handlePaperChange(e.target.value)}
                className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                disabled={!selectedExamId}
              >
                <option value="">-- Choose Paper (e.g. GS1) --</option>
                {activePapers.map(node => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-bold text-ink">
              Subject Area
              <select
                value={selectedSubjectAreaId}
                onChange={(e) => handleSubjectAreaChange(e.target.value)}
                className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                disabled={!selectedPaperId}
              >
                <option value="">-- Choose Subject Area --</option>
                {activeSubjectAreas.map(node => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-bold text-ink">
              Theme
              <select
                value={selectedThemeId}
                onChange={(e) => handleThemeChange(e.target.value)}
                className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                disabled={!selectedSubjectAreaId}
              >
                <option value="">-- Choose Theme --</option>
                {activeThemes.map(node => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-bold text-ink">
              Topic
              <select
                value={selectedTopicId}
                onChange={(e) => handleTopicChange(e.target.value)}
                className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                disabled={!selectedThemeId}
              >
                <option value="">-- Choose Topic --</option>
                {activeTopics.map(node => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-bold text-ink">
              Subtopic
              <select
                value={selectedSubtopicId}
                onChange={(e) => setSelectedSubtopicId(e.target.value)}
                className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                disabled={!selectedTopicId}
              >
                <option value="">-- Choose Subtopic --</option>
                {activeSubtopics.map(node => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </label>

            <div className="border-t border-line/60 my-2"></div>

            <label className="grid gap-1 text-xs font-bold text-ink">
              Question Nature (Optional classification)
              <select
                value={selectedNatureId}
                onChange={(e) => setSelectedNatureId(e.target.value)}
                className="h-10 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-civic"
                disabled={!selectedExamId}
              >
                <option value="">-- Choose Nature --</option>
                {natures.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-civic text-white font-bold text-sm shadow-md hover:bg-civic/90 active:scale-[0.98] transition-all"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {questionId ? "Save Question Updates" : "Publish Mains Question"}
          </button>
        </div>
        </form>
      )}

      {/* Drafts Section */}
      {!questionId && (
        <div className="mt-12 pt-8 border-t border-line">
          <h3 className="text-xl font-black text-ink mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-civic" />
            Saved Drafts
          </h3>
          <p className="text-sm text-ink/60 mb-6">
            Resume work on your unpublished questions. You can edit them or publish them to the live pool.
          </p>
          <AdminQuizManager 
            initialRepo="mains" 
            hideRepoTabs={true} 
            forceStatus="draft" 
            defaultTab="questions" 
          />
        </div>
      )}
    </div>
  );
}
