"use client";

import { Sparkles, CheckCircle2, AlertCircle, LayoutList, FileText, Plus } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { authenticatedGet, authenticatedPost, useAuth } from "../../auth/auth-context";
import { RichTextMarkdownEditor } from "../rich-text-editor";
import { QuizCreatorAIWorkspace } from "./quiz-creator-ai-workspace";
import { QuizCreatorAIParser } from "./quiz-creator-ai-parser";
import { QuizCreatorTaxonomyPanel } from "./quiz-creator-taxonomy-panel";
import { QuizCreatorQuestionCard } from "./quiz-creator-question-card";
import { AdminQuizManager } from "./admin-quiz-manager";

type Option = {
  label: string;
  text: string;
  is_correct: boolean;
};

type GeneratedQuestion = {
  question_statement: string;
  supp_question_statement?: string;
  question_prompt?: string;
  options: Option[];
  correct_answer: string;
  explanation: string;
  question_nature_id?: string | number;
  exam_id?: number;
  exam_level_id?: number;
  subject_node_id?: number;
  source_node_id?: number;
  topic_node_id?: number;
  subtopic_node_id?: number;
};

type GeneratedQuizResponse = {
  passage_title?: string;
  passage_text?: string;
  questions?: GeneratedQuestion[];
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

type TaxonomyNode = {
  id: number;
  exam_id: number;
  parent_id?: number | null;
  node_type: string;
  name: string;
  slug: string;
  content_type?: "gk" | "aptitude";
};

type QuestionNature = {
  id: number;
  exam_id: number;
  name: string;
  slug: string;
};

export function AdminQuizCreator({
  initialContentType = "gk",
  hideContentTypeSelector = false
}: {
  initialContentType?: "gk" | "aptitude";
  hideContentTypeSelector?: boolean;
} = {}) {
  const { token } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"ai" | "manual" | "parse">("ai");
  const [parseInput, setParseInput] = useState("");
  const [parseGenerating, setParseGenerating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Inputs for AI Ingestion Workspace
  const [workspaceInput, setWorkspaceInput] = useState("");
  const [quizType, setQuizType] = useState<string>(initialContentType === "aptitude" ? "maths" : "gk");
  const [count, setCount] = useState<number>(3);
  const [instructions, setInstructions] = useState("");
  const [creatorContentType, setCreatorContentType] = useState<"gk" | "aptitude">(initialContentType);
  
  // Style Profile states
  const [styleProfiles, setStyleProfiles] = useState<any[]>([]);
  const [selectedStyleProfileId, setSelectedStyleProfileId] = useState<string>("");

  const filteredStyleProfiles = useMemo(() => {
    let target = "premium_gk_quiz";
    if (quizType === "maths") target = "premium_maths_quiz";
    else if (quizType === "passage") target = "premium_passage_quiz";
    return styleProfiles.filter(p => p.content_type === target && p.is_active);
  }, [styleProfiles, quizType]);
  
  // API settings for saving questions
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [examLevels, setExamLevels] = useState<ExamLevel[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>("");
  
  // Cascading Taxonomy States
  const [allTaxonomyNodes, setAllTaxonomyNodes] = useState<TaxonomyNode[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedSourceBucketId, setSelectedSourceBucketId] = useState<string>("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string>("");

  // Quiz content states
  const [generating, setGenerating] = useState(false);
  const [quizData, setQuizData] = useState<GeneratedQuizResponse | null>(null);
  const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<number[]>([]);
  const [selectedNatureId, setSelectedNatureId] = useState<string>("");
  
  // Feedback states
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Load configuration metadata on mount
  useEffect(() => {
    const loadConfig = async () => {
      if (!token) return;
      try {
        const exList = await authenticatedGet<Exam[]>("/api/v1/assessment/exams", token);
        setExams(exList || []);
        if (exList && exList.length > 0 && exList[0]) {
          setSelectedExamId(String(exList[0].id));
        }

        const nodesList = await authenticatedGet<TaxonomyNode[]>("/api/v1/assessment/taxonomy-nodes?limit=1000", token);
        setAllTaxonomyNodes(nodesList || []);
      } catch (err) {
        console.error("Error loading assessment configs:", err);
      }
    };
    void loadConfig();
  }, [token]);

  useEffect(() => {
    const loadStyleProfiles = async () => {
      if (!token) return;
      try {
        const records = await authenticatedGet<any[]>("/api/v1/assessment/admin/ai/style-profiles", token);
        setStyleProfiles(records || []);
      } catch (err) {
        console.error("Failed to load style profiles:", err);
      }
    };
    void loadStyleProfiles();
  }, [token]);

  const [questionNatures, setQuestionNatures] = useState<QuestionNature[]>([]);
  useEffect(() => {
    const loadNatures = async () => {
      if (!token || !selectedExamId) return;
      try {
        const list = await authenticatedGet<QuestionNature[]>(`/api/v1/assessment/question-natures?exam_id=${selectedExamId}`, token);
        setQuestionNatures(list || []);
      } catch (err) {
        console.error("Failed to load question natures", err);
      }
    };
    void loadNatures();
  }, [selectedExamId, token]);

  // Load levels when examId changes
  useEffect(() => {
    const loadLevels = async () => {
      if (!token || !selectedExamId) return;
      try {
        const lvlList = await authenticatedGet<ExamLevel[]>(`/api/v1/assessment/exams/${selectedExamId}/levels`, token);
        setExamLevels(lvlList || []);
        if (lvlList && lvlList.length > 0 && lvlList[0]) {
          setSelectedLevelId(String(lvlList[0].id));
        } else {
          setSelectedLevelId("");
        }
      } catch (err) {
        console.error("Failed to load levels:", err);
        setExamLevels([]);
      }
    };
    void loadLevels();
  }, [selectedExamId, token]);

  // Dynamic filter for cascading categories based on active exam and creator content type
  const examNodes = useMemo(() => {
    if (!selectedExamId) return [];
    return allTaxonomyNodes.filter(
      (node) => String(node.exam_id) === selectedExamId && (node.content_type === creatorContentType || !node.content_type)
    );
  }, [allTaxonomyNodes, selectedExamId, creatorContentType]);

  const activeSubjects = useMemo(() => {
    return examNodes.filter((node) => node.node_type === "subject");
  }, [examNodes]);

  const activeSourceBuckets = useMemo(() => {
    if (!selectedSubjectId) return [];
    // Allow direct children of the selected subject, regardless of node type
    return examNodes.filter((node) => String(node.parent_id) === selectedSubjectId);
  }, [examNodes, selectedSubjectId]);

  const activeTopics = useMemo(() => {
    // If a source bucket is selected, show its children
    if (selectedSourceBucketId) {
      return examNodes.filter((node) => String(node.parent_id) === selectedSourceBucketId);
    }
    // If NO source bucket is selected, default to direct topic children of the subject
    if (selectedSubjectId) {
      return examNodes.filter((node) => node.node_type === "topic" && String(node.parent_id) === selectedSubjectId);
    }
    return [];
  }, [examNodes, selectedSourceBucketId, selectedSubjectId]);

  const activeSubtopics = useMemo(() => {
    if (!selectedTopicId) return [];
    // Allow any child of the selected topic node
    return examNodes.filter((node) => String(node.parent_id) === selectedTopicId);
  }, [examNodes, selectedTopicId]);

  // Automatically reset dependent selections when parent changes
  const handleExamChange = (examId: string) => {
    setSelectedExamId(examId);
    setSelectedSubjectId("");
    setSelectedSourceBucketId("");
    setSelectedTopicId("");
    setSelectedSubtopicId("");
  };

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedSourceBucketId("");
    setSelectedTopicId("");
    setSelectedSubtopicId("");
  };

  const handleSourceBucketChange = (sourceBucketId: string) => {
    setSelectedSourceBucketId(sourceBucketId);
    setSelectedTopicId("");
    setSelectedSubtopicId("");
  };

  const handleTopicChange = (topicId: string) => {
    setSelectedTopicId(topicId);
    setSelectedSubtopicId("");
  };

  // Execute AI generation
  const initializeDraftQuestions = (
    res: GeneratedQuizResponse,
    curExamId = selectedExamId,
    curLevelId = selectedLevelId,
    curSubjectId = selectedSubjectId,
    curSourceId = selectedSourceBucketId,
    curTopicId = selectedTopicId,
    curSubtopicId = selectedSubtopicId
  ): GeneratedQuizResponse => {
    const suggestedSubjectId = (res as any).subject_node_id ? String((res as any).subject_node_id) : curSubjectId;
    const questions = (res.questions || []).map(q => ({
      ...q,
      exam_id: q.exam_id || (curExamId ? Number(curExamId) : undefined),
      exam_level_id: q.exam_level_id || (curLevelId ? Number(curLevelId) : undefined),
      subject_node_id: q.subject_node_id || (suggestedSubjectId ? Number(suggestedSubjectId) : undefined),
      source_node_id: q.source_node_id || (curSourceId ? Number(curSourceId) : undefined),
      topic_node_id: q.topic_node_id || (curTopicId ? Number(curTopicId) : undefined),
      subtopic_node_id: q.subtopic_node_id || (curSubtopicId ? Number(curSubtopicId) : undefined),
      question_nature_id: q.question_nature_id || ""
    }));
    return { ...res, questions };
  };

  // Execute AI generation
  const handleGenerate = async () => {
    if (!workspaceInput.trim() || !token) {
      showMessage("Please enter a prompt or reference context", "error");
      return;
    }

    setGenerating(true);
    setQuizData(null);
    setSelectedQuestionIndices([]);
    try {
      const res = await authenticatedPost<GeneratedQuizResponse>("/api/v1/assessment/admin/ai/generate-quiz", token, {
        quiz_type: quizType,
        prompt: workspaceInput,
        ai_provider: "openai",
        ai_model: "gpt-4o-mini",
        instructions: instructions || undefined,
        count: count,
        content_type: creatorContentType,
        style_profile_id: selectedStyleProfileId ? Number(selectedStyleProfileId) : undefined
      });
      
      // Auto-select subject if returned by Router agent
      const suggestedSubjectId = res && (res as any).subject_node_id ? String((res as any).subject_node_id) : selectedSubjectId;
      if (res && (res as any).subject_node_id) {
        setSelectedSubjectId(String((res as any).subject_node_id));
      }
      
      const mapped = initializeDraftQuestions(
        res,
        selectedExamId,
        selectedLevelId,
        suggestedSubjectId,
        selectedSourceBucketId,
        selectedTopicId,
        selectedSubtopicId
      );
      setQuizData(mapped);
      setSelectedQuestionIndices(mapped.questions ? mapped.questions.map((_, i) => i) : []);
      
      showMessage("Quiz questions generated successfully! Review below.");
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to generate quiz: " + (err.message || err), "error");
    } finally {
      setGenerating(false);
    }
  };

  // Execute AI Parsing
  const handleParse = async () => {
    if (!workspaceInput.trim() || !token) {
      showMessage("Please paste some raw quiz text to parse", "error");
      return;
    }

    setGenerating(true);
    setQuizData(null);
    setSelectedQuestionIndices([]);
    try {
      const res = await authenticatedPost<GeneratedQuizResponse>("/api/v1/assessment/admin/ai/parse", token, {
        raw_text: workspaceInput,
        ai_provider: "openai",
        ai_model: "gpt-4o-mini",
        instructions: instructions || undefined,
        content_type: creatorContentType
      });
      
      // Auto-select subject if returned by Router agent
      const suggestedSubjectId = res && (res as any).subject_node_id ? String((res as any).subject_node_id) : selectedSubjectId;
      if (res && (res as any).subject_node_id) {
        setSelectedSubjectId(String((res as any).subject_node_id));
      }

      const mapped = initializeDraftQuestions(
        res,
        selectedExamId,
        selectedLevelId,
        suggestedSubjectId,
        selectedSourceBucketId,
        selectedTopicId,
        selectedSubtopicId
      );
      setQuizData(mapped);
      setSelectedQuestionIndices(mapped.questions ? mapped.questions.map((_, i) => i) : []);

      showMessage("Questions parsed successfully! Review below.");
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to parse worksheet: " + (err.message || err), "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleApplyToSelected = () => {
    if (!quizData || !quizData.questions || selectedQuestionIndices.length === 0) {
      showMessage("No draft questions selected", "error");
      return;
    }
    const updatedQs = [...quizData.questions];
    selectedQuestionIndices.forEach(idx => {
      updatedQs[idx] = {
        ...updatedQs[idx],
        exam_id: selectedExamId ? Number(selectedExamId) : undefined,
        exam_level_id: selectedLevelId ? Number(selectedLevelId) : undefined,
        subject_node_id: selectedSubjectId ? Number(selectedSubjectId) : undefined,
        source_node_id: selectedSourceBucketId ? Number(selectedSourceBucketId) : undefined,
        topic_node_id: selectedTopicId ? Number(selectedTopicId) : undefined,
        subtopic_node_id: selectedSubtopicId ? Number(selectedSubtopicId) : undefined,
        question_nature_id: selectedNatureId ? Number(selectedNatureId) : undefined
      } as GeneratedQuestion;
    });
    setQuizData({ ...quizData, questions: updatedQs });
    showMessage("Applied bulk taxonomy & nature to checked questions!");
  };

  // Save selected questions as Draft Test Template (Release)
  const handleReleaseSelected = async () => {
    if (!token || !quizData || !quizData.questions) return;
    if (selectedQuestionIndices.length === 0) {
      showMessage("Please select questions to release first", "error");
      return;
    }

    setSaving(true);
    try {
      const selectedQs = quizData.questions.filter((_, idx) => selectedQuestionIndices.includes(idx));
      
      const payload = {
        exam_id: Number(selectedExamId),
        exam_level_id: Number(selectedLevelId),
        subject_node_id: Number(selectedSubjectId),
        source_node_id: selectedSourceBucketId ? Number(selectedSourceBucketId) : undefined,
        topic_node_id: selectedTopicId ? Number(selectedTopicId) : undefined,
        subtopic_node_id: selectedSubtopicId ? Number(selectedSubtopicId) : undefined,
        passage_title: quizData.passage_title || undefined,
        passage_text: quizData.passage_text || undefined,
        status: "published",
        questions: selectedQs.map(q => ({
          question_statement: q.question_statement,
          supp_question_statement: q.supp_question_statement,
          question_prompt: q.question_prompt,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          question_nature_id: q.question_nature_id ? Number(q.question_nature_id) : undefined,
          // Question-level overrides
          exam_id: q.exam_id,
          exam_level_id: q.exam_level_id,
          subject_node_id: q.subject_node_id,
          source_node_id: q.source_node_id,
          topic_node_id: q.topic_node_id,
          subtopic_node_id: q.subtopic_node_id
        }))
      };

      await authenticatedPost("/api/v1/assessment/admin/ai/save-draft", token, payload);
      showMessage(`Successfully published ${selectedQs.length} questions to the pool!`);
      
      // Remove released questions from the list
      const remainingQs = quizData.questions.filter((_, idx) => !selectedQuestionIndices.includes(idx));
      if (remainingQs.length === 0) {
        setQuizData(null);
        setWorkspaceInput("");
        setInstructions("");
      } else {
        setQuizData({ ...quizData, questions: remainingQs });
      }
      setSelectedQuestionIndices([]);

      // Redirect to the appropriate library page
      const targetTab = creatorContentType === "aptitude" ? "csat-questions" : "objective-questions";
      router.push(`/admin/assessment/${targetTab}`);
    } catch (err: any) {
      console.error(err);
      showMessage("Failed to save draft: " + (err.message || err), "error");
    } finally {
      setSaving(false);
    }
  };

  // Initialize a manual blank quiz template
  const startManualQuiz = () => {
    const initialQ = {
      question_statement: "Write your question statement here...",
      options: [
        { label: "A", text: "Option A", is_correct: true },
        { label: "B", text: "Option B", is_correct: false },
        { label: "C", text: "Option C", is_correct: false },
        { label: "D", text: "Option D", is_correct: false }
      ],
      correct_answer: "A",
      explanation: "Provide a detailed explanation here...",
      question_nature_id: "",
      exam_id: selectedExamId ? Number(selectedExamId) : undefined,
      exam_level_id: selectedLevelId ? Number(selectedLevelId) : undefined,
      subject_node_id: selectedSubjectId ? Number(selectedSubjectId) : undefined,
      source_node_id: selectedSourceBucketId ? Number(selectedSourceBucketId) : undefined,
      topic_node_id: selectedTopicId ? Number(selectedTopicId) : undefined,
      subtopic_node_id: selectedSubtopicId ? Number(selectedSubtopicId) : undefined
    };
    setQuizData({ questions: [initialQ] });
    setSelectedQuestionIndices([0]);
  };

  // Add question to manual builder list
  const addBlankQuestion = () => {
    const newQuestion = {
      question_statement: "Write your question statement here...",
      options: [
        { label: "A", text: "", is_correct: true },
        { label: "B", text: "", is_correct: false },
        { label: "C", text: "", is_correct: false },
        { label: "D", text: "", is_correct: false }
      ],
      correct_answer: "A",
      explanation: "",
      question_nature_id: "",
      exam_id: selectedExamId ? Number(selectedExamId) : undefined,
      exam_level_id: selectedLevelId ? Number(selectedLevelId) : undefined,
      subject_node_id: selectedSubjectId ? Number(selectedSubjectId) : undefined,
      source_node_id: selectedSourceBucketId ? Number(selectedSourceBucketId) : undefined,
      topic_node_id: selectedTopicId ? Number(selectedTopicId) : undefined,
      subtopic_node_id: selectedSubtopicId ? Number(selectedSubtopicId) : undefined
    };
    setQuizData(prev => {
      const qs = prev?.questions ? [...prev.questions, newQuestion] : [newQuestion];
      const newIdx = qs.length - 1;
      setSelectedQuestionIndices(curr => [...curr, newIdx]);
      return { ...prev, questions: qs };
    });
  };

  // Delete specific question from draft
  const deleteQuestion = (idx: number) => {
    if (!quizData || !quizData.questions) return;
    const updated = quizData.questions.filter((_, i) => i !== idx);
    setQuizData({ ...quizData, questions: updated });
    setSelectedQuestionIndices(curr => curr.filter(i => i !== idx).map(i => (i > idx ? i - 1 : i)));
  };

  const updateQuestion = (idx: number, field: keyof GeneratedQuestion, value: any) => {
    if (!quizData || !quizData.questions) return;
    const updated = [...quizData.questions];
    updated[idx] = { ...updated[idx], [field]: value } as GeneratedQuestion;
    setQuizData({ ...quizData, questions: updated });
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    if (!quizData || !quizData.questions) return;
    const updatedQs = [...quizData.questions];
    const q = updatedQs[qIdx];
    if (!q) return;
    const updatedOpts = [...q.options];
    updatedOpts[optIdx] = { ...updatedOpts[optIdx], text: value } as Option;
    updatedQs[qIdx] = { ...q, options: updatedOpts };
    setQuizData({ ...quizData, questions: updatedQs });
  };

  const handleAnswerChange = (idx: number, val: string) => {
    if (!quizData || !quizData.questions) return;
    const updatedQs = [...quizData.questions];
    const q = updatedQs[idx];
    if (!q) return;
    updatedQs[idx] = {
      ...q,
      correct_answer: val,
      options: q.options.map(o => ({ ...o, is_correct: o.label === val }))
    };
    setQuizData({ ...quizData, questions: updatedQs });
  };

  // Execute parsing worksheet
  const handleParseImporterSubmit = async () => {
    if (!token || !parseInput.trim()) return;
    setParseGenerating(true);
    setSelectedQuestionIndices([]);
    try {
      const res = await authenticatedPost<{ questions: GeneratedQuestion[]; passage_title?: string; passage_text?: string }>(
        "/api/v1/assessment/admin/ai/parse-questions",
        token,
        {
          raw_text: parseInput,
          content_type: creatorContentType,
          exam_id: selectedExamId ? Number(selectedExamId) : undefined
        }
      );
      if (res?.questions?.length) {
        const mapped = initializeDraftQuestions(res, selectedExamId, selectedLevelId, selectedSubjectId, selectedSourceBucketId, selectedTopicId, selectedSubtopicId);
        setQuizData(mapped);
        setSelectedQuestionIndices(mapped.questions ? mapped.questions.map((_, i) => i) : []);
        setMode("manual");
      }
    } catch (err) {
      console.error("Parse failed", err);
    } finally {
      setParseGenerating(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !token) return;

    setUploadingFile(true);
    setMessage(null);
    setSelectedQuestionIndices([]);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await authenticatedPost<any>(
        "/api/v1/assessment/admin/ai/parse-file",
        token,
        {
          base64_data: base64Data,
          filename: file.name,
          mime_type: file.type || "application/octet-stream",
          content_type: creatorContentType,
          exam_id: selectedExamId ? Number(selectedExamId) : undefined
        }
      );

      if (res?.questions?.length) {
        const mapped = initializeDraftQuestions(res, selectedExamId, selectedLevelId, selectedSubjectId, selectedSourceBucketId, selectedTopicId, selectedSubtopicId);
        setQuizData(mapped);
        setSelectedQuestionIndices(mapped.questions ? mapped.questions.map((_, i) => i) : []);
        setMode("manual");
        showMessage(`Successfully parsed ${res.questions.length} questions from ${file.name}!`);
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

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 border ${
          message.type === "success" 
            ? "bg-civic/5 text-civic border-civic/20" 
            : "bg-berry/5 text-berry border-berry/20"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* ── Section Workspace Selection ── */}
      {!hideContentTypeSelector && (
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl max-w-md">
          <button
            type="button"
            onClick={() => {
              setCreatorContentType("gk");
              handleExamChange(selectedExamId);
              setQuizType("gk");
            }}
            className={`flex-1 py-2 text-center text-sm font-bold rounded-lg transition-all ${
              creatorContentType === "gk"
                ? "bg-white text-civic shadow-sm font-black"
                : "text-ink/60 hover:text-ink"
            }`}
          >
            General Knowledge (GK) Hub
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatorContentType("aptitude");
              handleExamChange(selectedExamId);
              setQuizType("maths");
            }}
            className={`flex-1 py-2 text-center text-sm font-bold rounded-lg transition-all ${
              creatorContentType === "aptitude"
                ? "bg-white text-civic shadow-sm font-black"
                : "text-ink/60 hover:text-ink"
            }`}
          >
            CSAT & Aptitude Hub
          </button>
        </div>
      )}


      {/* ── Source Selection Tabs ── */}
      <div className="flex gap-1 border border-line rounded-2xl p-1 bg-paper/40">
        {([
          { key: "manual", label: "Manual Entry", icon: <LayoutList className="h-4 w-4" /> },
          { key: "ai", label: "AI Generate", icon: <Sparkles className="h-4 w-4" /> },
          { key: "parse", label: "AI Parse / Worksheet", icon: <FileText className="h-4 w-4" /> },
        ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => {
              setMode(key);
              if (key === "manual") startManualQuiz();
              else setQuizData(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold rounded-xl transition-all ${
              mode === key
                ? "bg-white text-civic shadow-sm border border-line"
                : "text-ink/65 hover:text-ink"
            }`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* AI WORKSPACE TABS */}
      {mode === "ai" && (
        <QuizCreatorAIWorkspace
          workspaceInput={workspaceInput}
          setWorkspaceInput={setWorkspaceInput}
          quizType={quizType}
          setQuizType={setQuizType}
          count={count}
          setCount={setCount}
          instructions={instructions}
          setInstructions={setInstructions}
          generating={generating}
          handleGenerate={handleGenerate}
          handleParse={handleParse}
          styleProfiles={filteredStyleProfiles}
          selectedStyleProfileId={selectedStyleProfileId}
          setSelectedStyleProfileId={setSelectedStyleProfileId}
        />
      )}

      {mode === "parse" && (
        <QuizCreatorAIParser
          parseInput={parseInput}
          setParseInput={setParseInput}
          parseGenerating={parseGenerating}
          uploadingFile={uploadingFile}
          exams={exams}
          selectedExamId={selectedExamId}
          handleExamChange={handleExamChange}
          creatorContentType={creatorContentType}
          setCreatorContentType={setCreatorContentType}
          onParseSubmit={handleParseImporterSubmit}
          onFileUpload={handleFileUpload}
        />
      )}

      {/* MANUAL WORKSPACE ACTIONS CARD */}
      {mode === "manual" && quizData && (
        <div className="bg-white border border-line rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-black text-ink flex items-center gap-2">
                <LayoutList className="h-5 w-5 text-civic" />
                Manual Quiz Workspace
              </h2>
              <p className="text-xs text-ink/65 mt-1">
                Directly author questions, option choices, and explanations. Choose the layout pattern below.
              </p>
            </div>
            <button
              onClick={addBlankQuestion}
              className="h-10 px-4 rounded-xl bg-civic text-white hover:bg-civic/90 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              type="button"
            >
              <Plus className="h-4 w-4" />
              Add Question
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 bg-slate-50 p-1.5 rounded-xl border border-line">
            <button
              type="button"
              onClick={() => {
                if (quizData.passage_text !== undefined) {
                  const { passage_title, passage_text, ...rest } = quizData;
                  setQuizData(rest);
                }
              }}
              className={`py-2 text-center text-xs font-bold rounded-lg transition-all ${
                quizData.passage_text === undefined
                  ? "bg-white text-civic shadow-sm border border-line/40 font-black"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              {creatorContentType === "aptitude" 
                ? "Maths & Aptitude MCQs (Independent)" 
                : "Standard Independent MCQs (GK)"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (quizData.passage_text === undefined) {
                  setQuizData({
                    ...quizData,
                    passage_title: creatorContentType === "aptitude" 
                      ? "Reading Comprehension / Logical Reasoning Puzzle"
                      : "Reading Passage / Comprehension Context",
                    passage_text: creatorContentType === "aptitude"
                      ? "Provide the reading passage or logical reasoning constraints puzzle statement here..."
                      : "Provide the passage text here..."
                  });
                }
              }}
              className={`py-2 text-center text-xs font-bold rounded-lg transition-all ${
                quizData.passage_text !== undefined
                  ? "bg-white text-civic shadow-sm border border-line/40 font-black"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              {creatorContentType === "aptitude"
                ? "Paragraph/Puzzle-Linked MCQs (Logical Reasoning / Comprehension)"
                : "Passage-Linked MCQs (Reading Comprehension)"}
            </button>
          </div>
        </div>
      )}

      {/* Preview and Save Workspace */}
      {quizData && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
          {/* Left panel: Saving settings & database configurations */}
          <QuizCreatorTaxonomyPanel
            exams={exams}
            selectedExamId={selectedExamId}
            handleExamChange={handleExamChange}
            examLevels={examLevels}
            selectedLevelId={selectedLevelId}
            setSelectedLevelId={setSelectedLevelId}
            selectedSubjectId={selectedSubjectId}
            handleSubjectChange={handleSubjectChange}
            activeSubjects={activeSubjects}
            selectedSourceBucketId={selectedSourceBucketId}
            handleSourceBucketChange={handleSourceBucketChange}
            activeSourceBuckets={activeSourceBuckets}
            selectedTopicId={selectedTopicId}
            handleTopicChange={handleTopicChange}
            activeTopics={activeTopics}
            selectedSubtopicId={selectedSubtopicId}
            setSelectedSubtopicId={setSelectedSubtopicId}
            activeSubtopics={activeSubtopics}
            questionNatures={questionNatures}
            selectedNatureId={selectedNatureId}
            setSelectedNatureId={setSelectedNatureId}
            onApplyToSelected={handleApplyToSelected}
            onReleaseSelected={handleReleaseSelected}
            selectedCount={selectedQuestionIndices.length}
            saving={saving}
          />

          {/* Right panel: Questions Preview layout */}
          <div className="space-y-4 animate-in fade-in duration-300">
            <h4 className="font-extrabold text-base text-ink flex items-center justify-between">
              <span>Quiz Content & Preview</span>
              <span className="text-xs font-normal text-ink/50">({quizData.questions?.length || 0} questions)</span>
            </h4>

            {/* Select All Checkbox Bar */}
            {quizData.questions && quizData.questions.length > 0 && (
              <div className="flex items-center justify-between bg-white border border-line px-5 py-3 rounded-2xl shadow-sm animate-in fade-in duration-300">
                <label className="flex items-center gap-2.5 text-xs font-bold text-ink cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4.5 w-4.5 rounded border-line text-civic focus:ring-civic cursor-pointer"
                    checked={selectedQuestionIndices.length === quizData.questions.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedQuestionIndices(quizData.questions!.map((_, i) => i));
                      } else {
                        setSelectedQuestionIndices([]);
                      }
                    }}
                  />
                  Select All Draft Questions ({quizData.questions.length})
                </label>
                {selectedQuestionIndices.length > 0 && (
                  <span className="text-xs text-civic font-black bg-civic/10 px-3 py-1 rounded-full animate-in zoom-in duration-200">
                    {selectedQuestionIndices.length} selected
                  </span>
                )}
              </div>
            )}

            {/* Passage details if applicable */}
            {quizData.passage_text !== undefined && (
              <div className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-3 relative">
                <button
                  type="button"
                  onClick={() => {
                    const { passage_title, passage_text, ...rest } = quizData;
                    setQuizData(rest);
                  }}
                  className="absolute top-4 right-4 text-xs font-bold text-rose-500 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded"
                >
                  Remove Passage
                </button>
                <label className="grid gap-1 text-xs font-bold text-ink">
                  Passage Title
                  <input
                    type="text"
                    className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic w-[calc(100%-120px)]"
                    value={quizData.passage_title || ""}
                    onChange={(e) => setQuizData({ ...quizData, passage_title: e.target.value })}
                  />
                </label>
                
                <RichTextMarkdownEditor
                  label="Passage Body Text"
                  value={quizData.passage_text}
                  onChange={(val) => setQuizData({ ...quizData, passage_text: val })}
                  minHeightClass="min-h-[160px]"
                />
              </div>
            )}

            {/* Questions list */}
            <div className="space-y-4">
              {(quizData.questions || []).map((q, idx) => (
                <QuizCreatorQuestionCard
                  key={idx}
                  q={q}
                  idx={idx}
                  questionNatures={questionNatures}
                  allTaxonomyNodes={allTaxonomyNodes}
                  isSelected={selectedQuestionIndices.includes(idx)}
                  onToggleSelect={() => {
                    setSelectedQuestionIndices(curr =>
                      curr.includes(idx) ? curr.filter(i => i !== idx) : [...curr, idx]
                    );
                  }}
                  deleteQuestion={deleteQuestion}
                  updateQuestion={updateQuestion}
                  updateOption={updateOption}
                  onAnswerChange={handleAnswerChange}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Drafts Section */}
      <div className="mt-12 pt-8 border-t border-line">
        <h3 className="text-xl font-black text-ink mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-civic" />
          Saved Drafts
        </h3>
        <p className="text-sm text-ink/60 mb-6">
          Resume work on your unpublished questions. You can edit them or publish them to the live pool.
        </p>
        <AdminQuizManager 
          initialRepo={creatorContentType} 
          hideRepoTabs={true} 
          forceStatus="draft" 
          defaultTab="questions" 
        />
      </div>
    </div>
  );
}
