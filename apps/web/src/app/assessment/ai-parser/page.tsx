"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  FileText,
  Loader2,
  Save,
  Upload,
  CheckCircle,
  FileDown
} from "lucide-react";
import { useAuth, authenticatedGet, authenticatedPost } from "../../../components/auth/auth-context";

type Exam = {
  id: number;
  name: string;
  slug: string;
};

type ExamLevel = {
  id: number;
  name: string;
};

type TaxonomyNode = {
  id: number;
  name: string;
  node_type: string;
  parent_id: number | null;
  content_type?: string;
};

type ParsedQuestion = {
  question_statement: string;
  supp_question_statement?: string;
  options: Array<{ label: string; text: string }>;
  correct_answer: string;
  explanation?: string;
  question_nature_id?: number | null;
};

type ParsedResult = {
  success: boolean;
  passage_title?: string;
  passage_text?: string;
  questions: ParsedQuestion[];
};

export default function AiParserPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
      </div>
    }>
      <AiParserInner />
    </Suspense>
  );
}

function AiParserInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, isInitialized } = useAuth();

  const testTemplateIdParam = searchParams.get("test_template_id");
  const initialTestTemplateId = testTemplateIdParam ? Number(testTemplateIdParam) : null;

  // Settings / Setup States
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [levels, setLevels] = useState<ExamLevel[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);

  // Taxonomy Selectors
  const [nodes, setNodes] = useState<TaxonomyNode[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyNode[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [topics, setTopics] = useState<TaxonomyNode[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  // Input States
  const [parseMode, setParseMode] = useState<"text" | "file">("file");
  const [rawText, setRawText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState("");

  const contentParam = searchParams.get("content_type");
  const defaultContentType = (contentParam === "aptitude" || contentParam === "mains") ? contentParam : "gk";
  const [contentType, setContentType] = useState<"gk" | "aptitude" | "mains">(defaultContentType);

  // Custom Test Selection States
  const [testTemplates, setTestTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [createNewTest, setCreateNewTest] = useState(false);
  const [newTestTitle, setNewTestTitle] = useState("");
  const [lockedTemplateTitle, setLockedTemplateTitle] = useState<string | null>(null);

  // Output / Result States
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Fetch Exams
  useEffect(() => {
    if (!token) return;
    const fetchExams = async () => {
      try {
        const data = await authenticatedGet<Exam[]>("/api/v1/assessment/exams", token);
        setExams(data || []);
        if (data && data.length > 0) {
          setSelectedExamId(data[0]?.id ?? null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load exams.");
      }
    };
    fetchExams();
  }, [token]);

  // 2. Fetch locked template details if template_id is passed
  useEffect(() => {
    if (!token || !initialTestTemplateId) return;
    const fetchLockedTemplate = async () => {
      try {
        const data = await authenticatedGet<any>(`/api/v1/assessment/test-templates/${initialTestTemplateId}`, token);
        if (data) {
          setLockedTemplateTitle(data.title);
        }
      } catch (err: any) {
        console.error("Failed to load locked test template", err);
      }
    };
    fetchLockedTemplate();
  }, [token, initialTestTemplateId]);

  // 3. Fetch user's private test templates (if not locked)
  useEffect(() => {
    if (!token || initialTestTemplateId) return;
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const data = await authenticatedGet<any[]>("/api/v1/assessment/test-templates?access_type=private", token);
        setTestTemplates(data || []);
      } catch (err: any) {
        console.error("Failed to load test templates", err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, [token, initialTestTemplateId]);

  // 4. Fetch Levels and Taxonomy Nodes when Exam or Content Type changes
  useEffect(() => {
    if (!token || !selectedExamId) return;
    const fetchExamData = async () => {
      try {
        const levelsData = await authenticatedGet<ExamLevel[]>(
          `/api/v1/assessment/exams/${selectedExamId}/levels?limit=50`,
          token
        );
        setLevels(levelsData || []);
        if (levelsData && levelsData.length > 0) {
          setSelectedLevelId(levelsData[0]?.id ?? null);
        }

        const url = contentType === "mains"
          ? `/api/v1/assessment/mains/taxonomy-nodes?exam_id=${selectedExamId}&limit=1000`
          : `/api/v1/assessment/taxonomy-nodes?exam_id=${selectedExamId}&limit=1000`;
        const nodesData = await authenticatedGet<TaxonomyNode[]>(url, token);
        setNodes(nodesData || []);
      } catch (err: any) {
        setError(err.message || "Failed to load exam levels and syllabus categories.");
      }
    };
    fetchExamData();
  }, [token, selectedExamId, contentType]);

  // Filter subjects based on content type
  useEffect(() => {
    if (contentType === "mains") {
      const papers = nodes.filter((n) => n.node_type === "paper");
      setSubjects(papers);
      setSelectedSubjectId(papers.length > 0 ? (papers[0]?.id ?? null) : null);
    } else {
      const subs = nodes.filter((n) => n.node_type === "subject" && n.content_type === contentType);
      setSubjects(subs);
      setSelectedSubjectId(subs.length > 0 ? (subs[0]?.id ?? null) : null);
    }
  }, [nodes, contentType]);

  // Filter topics based on selected subject
  useEffect(() => {
    if (selectedSubjectId === null) {
      setTopics([]);
      setSelectedTopicId(null);
      return;
    }
    const tops = nodes.filter((n) => n.parent_id === selectedSubjectId);
    setTopics(tops);
    setSelectedTopicId(tops.length > 0 ? (tops[0]?.id ?? null) : null);
  }, [nodes, selectedSubjectId]);

  // Convert file to base64 helper
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // 5. Handle Parse Request
  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setParsedResult(null);

    if (parseMode === "text" && !rawText.trim()) {
      setError("Please paste the raw text to parse.");
      return;
    }

    if (parseMode === "file" && !selectedFile) {
      setError("Please upload a PDF or text document.");
      return;
    }

    setParsing(true);

    try {
      let data: ParsedResult;

      if (parseMode === "text") {
        data = await authenticatedPost<ParsedResult>(
          "/api/v1/assessment/user/ai/parse-text",
          token,
          {
            raw_text: rawText.trim(),
            content_type: contentType,
            instructions: instructions.trim() || undefined
          }
        );
      } else {
        const base64 = await fileToBase64(selectedFile!);
        data = await authenticatedPost<ParsedResult>(
          "/api/v1/assessment/user/ai/parse-file",
          token,
          {
            base64_data: base64,
            filename: selectedFile!.name,
            mime_type: selectedFile!.type || "application/pdf",
            content_type: contentType,
            instructions: instructions.trim() || undefined
          }
        );
      }

      if (data && data.questions && data.questions.length > 0) {
        setParsedResult(data);
      } else {
        setError("AI could not extract any questions. Check document content and formatting.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to parse questions using AI.");
    } finally {
      setParsing(false);
    }
  };

  // 6. Handle Save Request
  const handleSaveQuestions = async () => {
    if (!token || !parsedResult || !selectedExamId || !selectedLevelId || !selectedSubjectId) return;

    let targetTemplateId = initialTestTemplateId;

    if (!targetTemplateId) {
      if (createNewTest) {
        if (!newTestTitle.trim()) {
          setError("Please provide a name for the new custom test.");
          return;
        }
      } else if (!selectedTemplateId) {
        setError("Please select a target custom test or choose to create a new one.");
        return;
      } else {
        targetTemplateId = selectedTemplateId;
      }
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (!targetTemplateId && createNewTest) {
        const createRes = await authenticatedPost<{ id: number }>(
          "/api/v1/assessment/user/custom-tests",
          token,
          {
            title: newTestTitle.trim(),
            exam_id: selectedExamId,
            exam_level_id: selectedLevelId,
            question_ids: [],
            test_type: contentType === "mains" ? "mains_test" : "sectional_test"
          }
        );
        targetTemplateId = createRes.id;
      }

      await authenticatedPost("/api/v1/assessment/user/ai/save-questions", token, {
        exam_id: selectedExamId,
        exam_level_id: selectedLevelId,
        subject_node_id: selectedSubjectId,
        topic_node_id: selectedTopicId || undefined,
        passage_title: parsedResult.passage_title || undefined,
        passage_text: parsedResult.passage_text || undefined,
        questions: parsedResult.questions,
        test_template_id: targetTemplateId || undefined
      });

      setSuccessMsg(`Successfully saved ${parsedResult.questions.length} questions to your custom test!`);
      setTimeout(() => {
        router.push("/assessment");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to save parsed questions.");
      setSaving(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <div className="border-b border-line bg-white px-4 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/assessment"
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">AI Test Parser</h1>
              <p className="text-xs text-slate-500">Parse questions from raw texts, PDFs, or Word files into your private library</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 mt-8">
        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Configurations & Upload */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-indigo-650" />
                <span>Upload & Parse Setup</span>
              </h2>

              {/* Setup form */}
              <form onSubmit={handleParse} className="space-y-4">
                <div className="block text-xs font-bold text-slate-655 space-y-1.5">
                  <span>Syllabus Content Type</span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setContentType("gk")}
                      className={`h-10 rounded-xl border text-[11px] font-bold transition ${
                        contentType === "gk"
                          ? "border-indigo-650 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      GS
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentType("aptitude")}
                      className={`h-10 rounded-xl border text-[11px] font-bold transition ${
                        contentType === "aptitude"
                          ? "border-indigo-650 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      CSAT
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentType("mains")}
                      className={`h-10 rounded-xl border text-[11px] font-bold transition ${
                        contentType === "mains"
                          ? "border-indigo-650 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Mains
                    </button>
                  </div>
                </div>

                <div className="block text-xs font-bold text-slate-655 space-y-1.5">
                  <span>Input Method</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setParseMode("file")}
                      className={`h-10 rounded-xl border font-bold transition ${
                        parseMode === "file"
                          ? "border-indigo-650 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Upload File (PDF/Doc)
                    </button>
                    <button
                      type="button"
                      onClick={() => setParseMode("text")}
                      className={`h-10 rounded-xl border font-bold transition ${
                        parseMode === "text"
                          ? "border-indigo-650 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Paste Raw Text
                    </button>
                  </div>
                </div>

                {parseMode === "file" ? (
                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-655">Select Document</span>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-6 text-center cursor-pointer hover:bg-slate-50 transition">
                      <Upload className="h-8 w-8 text-slate-400 mb-2" />
                      <span className="text-xs font-bold text-slate-700">
                        {selectedFile ? selectedFile.name : "Choose PDF or Word file"}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">Maximum size: 10MB</span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="block text-xs font-bold text-slate-655 space-y-1.5">
                    <span>Paste Text Here</span>
                    <textarea
                      placeholder="Paste questions, passages, or syllabus contents here to parse..."
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      rows={8}
                      className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                    />
                  </label>
                )}

                <label className="block text-xs font-bold text-slate-655 space-y-1.5">
                  <span>Custom AI Parsing Instructions (Optional)</span>
                  <input
                    type="text"
                    placeholder="e.g. Set difficulty high / exclude answers"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                  />
                </label>

                <button
                  type="submit"
                  disabled={parsing}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {parsing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Parsing Document...</span>
                    </>
                  ) : (
                    <>
                      <BrainCircuit className="h-4 w-4" />
                      <span>Parse Document</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Panel - Parse Preview & Save */}
          <div className="lg:col-span-2 space-y-6">
            {parsedResult ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-6">
                <div className="flex items-start justify-between flex-wrap gap-4 border-b border-slate-150 pb-3">
                  <div>
                    <h2 className="text-base font-black text-slate-900">Parsed Questions Preview</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Verify the parsed questions below. Select category mappings to save them to your pool.
                    </p>
                  </div>
                </div>

                {/* Taxonomy Mappings */}
                <div className="bg-slate-50 rounded-2xl border border-slate-150 p-4 space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Target Library Location
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {initialTestTemplateId ? (
                      <div className="col-span-2">
                        <label className="block text-[11px] font-black uppercase text-slate-505 space-y-1">
                          <span>Target Custom Test (Locked)</span>
                          <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100/80 flex items-center px-3 text-xs font-bold text-slate-700">
                            {lockedTemplateTitle || `Custom Test (ID: ${initialTestTemplateId})`}
                          </div>
                        </label>
                      </div>
                    ) : (
                      <div className="col-span-2 space-y-3">
                        <label className="block text-[11px] font-black uppercase text-slate-505 space-y-1">
                          <span>Target Custom Test</span>
                          <select
                            value={createNewTest ? "new" : (selectedTemplateId ?? "")}
                            onChange={(e) => {
                              if (e.target.value === "new") {
                                setCreateNewTest(true);
                                setSelectedTemplateId(null);
                              } else {
                                setCreateNewTest(false);
                                setSelectedTemplateId(e.target.value ? Number(e.target.value) : null);
                              }
                            }}
                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-650"
                          >
                            <option value="">— Select Target Test —</option>
                            {testTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.title} ({template.test_type === "mains_test" ? "Mains" : "MCQ"})
                              </option>
                            ))}
                            <option value="new">— Create New Custom Test —</option>
                          </select>
                        </label>

                        {createNewTest && (
                          <label className="block text-[11px] font-black uppercase text-slate-505 space-y-1">
                            <span>New Test Title</span>
                            <input
                              type="text"
                              placeholder="e.g. History Test revision"
                              value={newTestTitle}
                              onChange={(e) => setNewTestTitle(e.target.value)}
                              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-650"
                            />
                          </label>
                        )}
                      </div>
                    )}

                    <label className="block text-[11px] font-black uppercase text-slate-500 space-y-1">
                      <span>Exam Profile</span>
                      <select
                        value={selectedExamId ?? ""}
                        onChange={(e) => setSelectedExamId(Number(e.target.value))}
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-650"
                      >
                        {exams.map((exam) => (
                          <option key={exam.id} value={exam.id}>
                            {exam.name}
                          </option>
                        ))}
                      </select>
                    </label>
 
                    <label className="block text-[11px] font-black uppercase text-slate-505 space-y-1">
                      <span>Exam Level</span>
                      <select
                        value={selectedLevelId ?? ""}
                        onChange={(e) => setSelectedLevelId(Number(e.target.value))}
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-650"
                      >
                        {levels.map((lvl) => (
                          <option key={lvl.id} value={lvl.id}>
                            {lvl.name}
                          </option>
                        ))}
                      </select>
                    </label>
 
                    <label className="block text-[11px] font-black uppercase text-slate-505 space-y-1">
                      <span>Subject Category</span>
                      <select
                        value={selectedSubjectId ?? ""}
                        onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-650"
                      >
                        <option value="">Select Subject</option>
                        {subjects.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    </label>
 
                    <label className="block text-[11px] font-black uppercase text-slate-505 space-y-1">
                      <span>Topic Category (Optional)</span>
                      <select
                        value={selectedTopicId ?? ""}
                        onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : null)}
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-650"
                      >
                        <option value="">Select Topic</option>
                        {topics.map((top) => (
                          <option key={top.id} value={top.id}>
                            {top.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {/* Passage wrapper if present */}
                {parsedResult.passage_text && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/20 p-4 space-y-2">
                    <h4 className="text-xs font-black uppercase text-indigo-750">
                      Reading Passage: {parsedResult.passage_title || "Extracted Passage"}
                    </h4>
                    <p className="text-xs leading-relaxed text-slate-700 italic">
                      {parsedResult.passage_text}
                    </p>
                  </div>
                )}

                {/* Questions Preview List */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Extracted Questions ({parsedResult.questions.length})
                  </h3>

                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                    {parsedResult.questions.map((q, idx) => (
                      <div key={idx} className="border border-slate-150 rounded-xl p-4 bg-slate-50/30 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded">
                            Question {idx + 1}
                          </span>
                          <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded">
                            Correct: {q.correct_answer.toUpperCase()}
                          </span>
                        </div>

                        <p className="text-sm font-bold text-slate-900 leading-relaxed">
                          {q.question_statement}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          {q.options.map((opt) => (
                            <div
                              key={opt.label}
                              className={`flex items-center gap-2 p-2 rounded-lg border font-semibold ${
                                q.correct_answer.toLowerCase() === opt.label.toLowerCase()
                                  ? "border-emerald-200 bg-emerald-50/30 text-emerald-800"
                                  : "border-slate-100 bg-slate-50 text-slate-600"
                              }`}
                            >
                              <span className="font-bold">{opt.label.toUpperCase()}.</span>
                              <span>{opt.text}</span>
                            </div>
                          ))}
                        </div>

                        {q.explanation && (
                          <div className="text-xs text-slate-500 bg-slate-100/50 rounded-lg p-2.5">
                            <span className="font-bold text-slate-700">Explanation: </span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save Questions Action */}
                <div className="pt-4 border-t border-slate-150">
                  <button
                    type="button"
                    onClick={handleSaveQuestions}
                    disabled={saving || !selectedSubjectId}
                    className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {saving ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    <span>Save to Private Library</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-32 text-center shadow-sm">
                <FileText className="mx-auto h-12 w-12 text-slate-350" />
                <p className="mt-4 text-sm font-black text-slate-800">No questions parsed yet</p>
                <p className="text-xs text-slate-450 mt-1 max-w-sm mx-auto">
                  Upload a PDF document or paste some question text on the left, then click Parse.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
