"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Send,
  Star,
  ExternalLink,
  FileCheck2,
  FileEdit,
  Sparkles,
  Award,
  Loader2,
  BookOpen,
  Plus,
  Upload,
  Trash2
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AttemptPaper, AttemptResponse, TestQuestionItem } from "../../lib/assessment";
import {
  isSameAnswer,
  optionKey,
  optionText,
  selectedAnswerKey
} from "../../lib/assessment";
import { authenticatedGet, authenticatedPost, authenticatedPut, useAuth } from "../auth/auth-context";
import { SignInPanel } from "../auth/sign-in-panel";

type AttemptEngineProps = {
  attemptId: string;
};

type LocalResponse = {
  selectedAnswer: unknown;
  status: AttemptResponse["status"];
  marked: boolean;
};

function responseMapFromPaper(paper: AttemptPaper): Map<number, LocalResponse> {
  return new Map(
    paper.questions.map((question) => [
      question.question_version_id,
      {
        selectedAnswer: question.response?.selected_answer ?? null,
        status: question.response?.status ?? "not_visited",
        marked: question.response?.is_marked_for_review ?? false
      }
    ])
  );
}

function secondsRemaining(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function timeLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function AttemptEngine({ attemptId }: AttemptEngineProps) {
  const router = useRouter();
  const { token } = useAuth();

  const [paper, setPaper] = useState<AttemptPaper | null>(null);
  const [responses, setResponses] = useState<Map<number, LocalResponse>>(new Map());
  const [activeIndex, setActiveIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Mains Answering Console States
  const [mainsAnswers, setMainsAnswers] = useState<Map<number, any>>(new Map());
  const [mainsDraft, setMainsDraft] = useState("");
  const [mainsFileUrl, setMainsFileUrl] = useState("");
  const [submittingMains, setSubmittingMains] = useState(false);

  // OCR scan states
  const [showOcrUpload, setShowOcrUpload] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrFiles, setOcrFiles] = useState<{ id: string; preview: string; base64: string; name: string }[]>([]);

  // Reset OCR states when active index changes
  useEffect(() => {
    setShowOcrUpload(false);
    setOcrFiles([]);
  }, [activeIndex]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newFiles: typeof ocrFiles = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        alert(`"${file.name}" is not an image file.`);
        continue;
      }
      const reader = new FileReader();
      const filePromise = new Promise<typeof ocrFiles[0]>((resolve) => {
        reader.onloadend = () => {
          resolve({
            id: Math.random().toString(36).substr(2, 9),
            preview: reader.result as string,
            base64: reader.result as string,
            name: file.name
          });
        };
      });
      reader.readAsDataURL(file);
      newFiles.push(await filePromise);
    }
    setOcrFiles(prev => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeOcrFile = (id: string) => {
    setOcrFiles(prev => prev.filter(f => f.id !== id));
  };

  const processAllPages = async () => {
    if (ocrFiles.length === 0 || !token) return;
    setIsOcrLoading(true);
    setMessage(null);
    try {
      const response = await authenticatedPost<{ extracted_text: string }>('/api/v1/assessment/mains/ocr', token, {
        images_base64: ocrFiles.map(f => f.base64)
      });
      setMainsDraft(prev => prev + (prev ? '\n\n' : '') + response.extracted_text);
      setShowOcrUpload(false);
      setOcrFiles([]);
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : "Failed to extract text from image.");
    } finally {
      setIsOcrLoading(false);
    }
  };

  const loadPaper = useCallback(async () => {
    if (!token) return;
    try {
      const record = await authenticatedGet<AttemptPaper>(`/api/v1/assessment/attempts/${attemptId}/paper`, token);
      setPaper(record);
      setResponses(responseMapFromPaper(record));
      setRemaining(secondsRemaining(record.expires_at));
      
      if (record.result?.id) {
        router.replace(`/assessment/results/${record.result.id}`);
        return;
      }

      // Fetch subjective answers if any exist for this attempt
      const subjectiveAnswers = await authenticatedGet<any[]>(`/api/v1/assessment/mains/attempts/${attemptId}/answers`, token);
      const answersMap = new Map<number, any>();
      subjectiveAnswers.forEach(ans => {
        answersMap.set(Number(ans.question_version_id), ans);
      });
      setMainsAnswers(answersMap);

      // Populate draft text for the active question
      const firstQ = record.questions[activeIndex];
      if (firstQ) {
        const firstAnswer = answersMap.get(Number(firstQ.question_version_id));
        setMainsDraft(firstAnswer?.student_answer_text || "");
        setMainsFileUrl(firstAnswer?.answer_file_url || "");
      }
    } catch (err) {
      console.error("Failed to load attempt paper:", err);
      setMessage("Failed to load attempt details. Please check your network connection.");
    }
  }, [attemptId, router, token]);

  useEffect(() => {
    void loadPaper();
  }, [loadPaper]);

  useEffect(() => {
    if (!paper?.expires_at) return;
    const timer = window.setInterval(() => {
      setRemaining(secondsRemaining(paper.expires_at));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paper?.expires_at]);

  // Synchronize draft response when index shifts
  useEffect(() => {
    if (paper && paper.questions[activeIndex]) {
      const activeQ = paper.questions[activeIndex];
      const ans = mainsAnswers.get(Number(activeQ.question_version_id));
      setMainsDraft(ans?.student_answer_text || "");
      setMainsFileUrl(ans?.answer_file_url || "");
    }
  }, [activeIndex, paper, mainsAnswers]);

  const activeQuestion = paper?.questions[activeIndex] ?? null;

  const activePassageQuestions = useMemo(() => {
    if (!activeQuestion || !activeQuestion.passage || !paper) return [];
    return paper.questions.filter(q => q.passage && q.passage.id === activeQuestion.passage?.id);
  }, [activeQuestion, paper]);

  // Question Status Helper matching required tags
  const questionStatus = useCallback((question: TestQuestionItem): "answered" | "review" | "skipped" | "not_visited" => {
    const response = responses.get(question.question_version_id);
    if (response?.marked) return "review";
    if (response?.status === "answered") return "answered";
    if (response?.status === "skipped") return "skipped";
    return "not_visited";
  }, [responses]);

  const summary = useMemo(() => {
    const values = paper?.questions ?? [];
    return {
      answered: values.filter((item) => questionStatus(item) === "answered").length,
      review: values.filter((item) => questionStatus(item) === "review").length,
      skipped: values.filter((item) => questionStatus(item) === "skipped").length,
      notVisited: values.filter((item) => questionStatus(item) === "not_visited").length
    };
  }, [paper?.questions, questionStatus]);

  if (!token) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-slate-800">Sign in to continue</h1>
          <p className="mt-2 text-sm text-slate-500">Attempts are saved to your coaching account.</p>
          <div className="mt-6"><SignInPanel /></div>
        </section>
      </main>
    );
  }

  if (!paper || !activeQuestion) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
        <span className="text-sm font-semibold text-slate-500">Loading exam canvas...</span>
      </main>
    );
  }

  // Save objective response
  async function saveResponse(question: TestQuestionItem, selectedAnswer: unknown, status: AttemptResponse["status"], marked: boolean): Promise<void> {
    if (!token) return;
    setSavingId(question.question_version_id);
    setMessage(null);
    setResponses((current) => {
      const next = new Map(current);
      next.set(question.question_version_id, { selectedAnswer, status, marked });
      return next;
    });
    try {
      await authenticatedPut(`/api/v1/assessment/attempts/${attemptId}/responses`, token, {
        question_version_id: question.question_version_id,
        selected_answer: selectedAnswer ?? undefined,
        status,
        is_marked_for_review: marked,
        time_spent_seconds: 0
      });
    } catch {
      setMessage("Autosave failed. Retry before submitting.");
    } finally {
      setSavingId(null);
    }
  }

  // Submit subjective answer response sheet
  async function handleMainsSubmit() {
    if (!token || !activeQuestion) return;
    if (!mainsDraft.trim() && !mainsFileUrl.trim()) {
      alert("Please write your answer or provide an answer copy link before submitting.");
      return;
    }
    setSubmittingMains(true);
    try {
      const payload = {
        question_version_id: activeQuestion.question_version_id,
        attempt_id: Number(attemptId),
        student_answer_text: mainsDraft.trim() || undefined,
        answer_file_url: mainsFileUrl.trim() || undefined
      };
      const responseRecord = await authenticatedPost<any>("/api/v1/assessment/mains/answers", token, payload);
      
      // Update local subjective answers
      setMainsAnswers(prev => {
        const next = new Map(prev);
        next.set(activeQuestion.question_version_id, responseRecord);
        return next;
      });

      // Update objective response status to show answered state on palette
      await authenticatedPut(`/api/v1/assessment/attempts/${attemptId}/responses`, token, {
        question_version_id: activeQuestion.question_version_id,
        status: "answered",
        time_spent_seconds: 0
      });

      setResponses((current) => {
        const next = new Map(current);
        next.set(activeQuestion.question_version_id, {
          selectedAnswer: null,
          status: "answered",
          marked: false
        });
        return next;
      });
    } catch (err: any) {
      console.error(err);
      alert("Failed to lock subjective response.");
    } finally {
      setSubmittingMains(false);
    }
  }

  // Submit entire test attempt
  async function submit(): Promise<void> {
    if (!token || !paper) return;
    if (!window.confirm("Submit this test now? You cannot change answers after submission.")) return;
    setMessage(null);
    try {
      const result = await authenticatedPost<{ id: number }>(`/api/v1/assessment/attempts/${attemptId}/submit`, token, {
        submit_idempotency_key: `submit-${attemptId}-${Date.now()}`,
        time_spent_seconds: Math.max(0, paper.test_template.duration_minutes * 60 - remaining)
      });
      router.push(`/assessment/results/${result.id}`);
    } catch {
      setMessage("Could not submit attempt. Please try again.");
    }
  }

  const activeResponse = responses.get(activeQuestion.question_version_id);
  const selectedKey = selectedAnswerKey(activeResponse?.selectedAnswer);
  
  const isSubjective = activeQuestion.question_format.question_family === "mains_subjective";
  const savedMainsAns = mainsAnswers.get(activeQuestion.question_version_id);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 lg:pb-16 space-y-6">
      {/* ── Status Bar ── */}
      <section className="sticky top-16 z-20 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-slate-800">{paper.test_template.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">Question {activeIndex + 1} of {paper.questions.length}</p>
          </div>
          <div className="grid grid-cols-4 sm:flex items-center gap-2 text-center text-[10px] font-black tracking-wide uppercase shrink-0">
            <span className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-emerald-600">{summary.answered} Done</span>
            <span className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-amber-600">{summary.review} Review</span>
            <span className="rounded-lg bg-slate-150/70 border border-slate-200 px-3 py-2 text-slate-500">{summary.skipped} Skip</span>
            <span className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-white normal-case">
              <Clock3 className="h-3.5 w-3.5 text-indigo-400" />
              {timeLabel(remaining)}
            </span>
          </div>
        </div>
      </section>

      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          {message}
        </div>
      )}

      {/* Main split grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        {/* Left main panel: question statement + answering */}
        <section className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">{activeQuestion.question_format.name}</span>
            <span className="rounded-md bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-[10px] font-black text-indigo-600">+{activeQuestion.marks} Marks</span>
            {Number(activeQuestion.negative_marks) > 0 && (
              <span className="rounded-md bg-rose-50 border border-rose-100 px-2.5 py-1 text-[10px] font-black text-rose-600">-{activeQuestion.negative_marks} Neg</span>
            )}
            {activeQuestion.question_version.created_by_user_id && (
              <span className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-[10px] font-black text-amber-700" title="This is a private question added by you. WayToIAS does not take responsibility for its correctness.">
                ⚠️ Your Question
              </span>
            )}
          </div>
          {activeQuestion.passage ? (
            <>
              <aside className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                {activeQuestion.passage.title && <h2 className="text-sm font-extrabold text-slate-800">{activeQuestion.passage.title}</h2>}
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{activeQuestion.passage.body}</p>
              </aside>

              <div className="space-y-6 pt-2">
                {activePassageQuestions.map((q, qIdx) => {
                  const qPaperIndex = paper.questions.findIndex(x => x.question_version_id === q.question_version_id);
                  const isCurrentlyActive = qPaperIndex === activeIndex;
                  const qResponse = responses.get(q.question_version_id);
                  const qSelectedKey = selectedAnswerKey(qResponse?.selectedAnswer);
                  
                  return (
                    <div 
                      key={q.id}
                      onClick={() => setActiveIndex(qPaperIndex)}
                      className={`space-y-4 rounded-2xl p-4 transition-all border ${
                        isCurrentlyActive 
                          ? "border-indigo-600 bg-indigo-50/10 shadow-sm" 
                          : "border-slate-100 bg-slate-50/30 hover:border-slate-200"
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                          isCurrentlyActive ? "bg-indigo-600 text-white" : "bg-slate-150 text-slate-600"
                        }`}>
                          Question {qPaperIndex + 1}
                        </span>
                        <span className="text-[10px] font-black text-slate-400">+{q.marks} Marks</span>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-sm font-bold leading-snug text-slate-900 md:text-base">
                          {q.question_version.question_statement}
                        </h3>
                        {q.question_version.supplementary_statement && (
                          <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-slate-500 bg-slate-50/40 p-3 rounded-xl italic">
                            {q.question_version.supplementary_statement}
                          </p>
                        )}
                        {q.question_version.question_prompt && (
                          <p className="text-xs sm:text-sm font-extrabold leading-relaxed text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                            {q.question_version.question_prompt}
                          </p>
                        )}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {q.question_version.options.map((option, optIdx) => {
                          const key = optionKey(option, optIdx);
                          const selected = qSelectedKey === key || isSameAnswer(qResponse?.selectedAnswer, key);
                          return (
                            <button
                              className={`flex min-h-12 items-start gap-3 rounded-xl border p-2.5 text-left text-xs leading-relaxed transition-all ${
                                selected
                                  ? "border-indigo-600 bg-indigo-50 text-slate-900 shadow-sm"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-indigo-400"
                              }`}
                              key={`${key}-${optIdx}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveIndex(qPaperIndex);
                                void saveResponse(q, key, "answered", qResponse?.marked ?? false);
                              }}
                              type="button"
                            >
                              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-black transition-colors ${
                                selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-550"
                              }`}>
                                {key}
                              </span>
                              <span className="mt-0.5">{optionText(option, optIdx)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <h2 className="text-lg font-black leading-snug text-slate-900 md:text-xl">
                  {activeIndex + 1}. {activeQuestion.question_version.question_statement}
                </h2>
                {activeQuestion.question_version.supplementary_statement && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-500 bg-slate-50/40 p-3.5 rounded-xl italic">
                    {activeQuestion.question_version.supplementary_statement}
                  </p>
                )}
                {activeQuestion.question_version.question_prompt && (
                  <p className="text-sm font-extrabold leading-relaxed text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-150">
                    {activeQuestion.question_version.question_prompt}
                  </p>
                )}
              </div>

              {/* Answering block based on content type (Subjective / Objective) */}
              <div className="mt-6">
                {isSubjective ? (
                  /* Subjective Mains Console Workspace */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <FileEdit className="h-4 w-4 text-indigo-600" />
                        Mains Answer Sheet Response
                      </label>
                      {savedMainsAns === undefined && (
                        <button
                          type="button"
                          onClick={() => setShowOcrUpload(!showOcrUpload)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {showOcrUpload ? 'Cancel Scan' : 'OCR Scan Answer'}
                        </button>
                      )}
                      <span className="text-xs font-bold text-slate-400">
                        Word Count: {mainsDraft.trim().split(/\s+/).filter(Boolean).length} words
                      </span>
                    </div>

                    {showOcrUpload && (
                      <div className="p-4 border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/50 space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center justify-center py-2 text-center">
                          <Upload className="h-8 w-8 text-indigo-600 mb-2" />
                          <h4 className="text-xs font-bold text-slate-800">Upload Handwritten Pages</h4>
                          <p className="text-[11px] text-slate-500 mb-3">Upload clear photos of your handwritten sheets to parse with Gemini.</p>
                          <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            Select Pages
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              multiple
                              onChange={handleFileChange}
                              disabled={isOcrLoading}
                            />
                          </label>
                        </div>

                        {ocrFiles.length > 0 && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {ocrFiles.map((file, idx) => (
                                <div key={file.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-indigo-100 shadow-sm">
                                  <div className="w-10 h-12 bg-slate-100 rounded border overflow-hidden shrink-0">
                                    <img src={file.preview} alt="Preview" className="w-full h-full object-cover" />
                                  </div>
                                  <div className="flex-grow min-w-0">
                                    <p className="text-xs font-bold text-slate-700 truncate">Page {idx + 1}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{file.name}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeOcrFile(file.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                    disabled={isOcrLoading}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={processAllPages}
                              disabled={isOcrLoading}
                              className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                              {isOcrLoading ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Reading sheets with Gemini...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Extract text from {ocrFiles.length} page(s)
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <textarea
                      value={mainsDraft}
                      onChange={(e) => setMainsDraft(e.target.value)}
                      disabled={savedMainsAns !== undefined}
                      placeholder="Structure your answer sheet here. Introduce the core context, list analytical arguments using bullet headings, and write a summary conclusion..."
                      className="w-full min-h-[240px] p-4 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-600 transition-all font-sans resize-y"
                    />

                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold text-slate-700">Answer Copy URL</span>
                      <input
                        type="url"
                        value={mainsFileUrl}
                        onChange={(e) => setMainsFileUrl(e.target.value)}
                        disabled={savedMainsAns !== undefined}
                        placeholder="Paste uploaded PDF, image, or document link"
                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-600"
                      />
                      <span className="block text-[11px] font-semibold text-slate-400">Use this when the answer is written on a scanned sheet or external document.</span>
                    </label>

                    {!savedMainsAns ? (
                      <button
                        onClick={handleMainsSubmit}
                        disabled={submittingMains || (!mainsDraft.trim() && !mainsFileUrl.trim())}
                        className="w-full inline-flex h-11 items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {submittingMains ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Lock & Submit Answer Response
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-3 bg-emerald-50 border border-emerald-155 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          Answer sheet locked and submitted for evaluator checking.
                        </div>

                        {savedMainsAns.answer_file_url && (
                          <a
                            href={savedMainsAns.answer_file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open submitted answer copy
                          </a>
                        )}

                        {savedMainsAns.evaluation_status === "pending" && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-bold text-amber-700">
                            Evaluation is pending. Marks and checked copy will appear after evaluator review.
                          </div>
                        )}

                        {/* Render Inline Evaluation Report */}
                        {savedMainsAns.evaluation_status === "evaluated" && (
                          <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-5 space-y-4 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                              <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                                <Sparkles className="h-4 w-4 text-indigo-600" />
                                Evaluator Scorecard
                              </h3>
                              <div className="text-right">
                                <span className="text-2xl font-black text-indigo-600">{savedMainsAns.score}</span>
                                <span className="text-xs text-slate-400 font-bold">/{savedMainsAns.max_score}</span>
                              </div>
                            </div>

                            {savedMainsAns.checked_copy_url && (
                              <a
                                href={savedMainsAns.checked_copy_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-50"
                              >
                                <FileCheck2 className="h-3.5 w-3.5" />
                                Open checked copy
                              </a>
                            )}

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-1.5">
                                <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-wide">Key Strengths</h4>
                                {savedMainsAns.strengths && savedMainsAns.strengths.length > 0 ? (
                                  <ul className="list-disc list-inside text-[10px] text-emerald-700 space-y-0.5 leading-relaxed">
                                    {savedMainsAns.strengths.map((s: string, idx: number) => <li key={idx}>{s}</li>)}
                                  </ul>
                                ) : (
                                  <p className="text-[10px] text-emerald-600">Structured layout maintained.</p>
                                )}
                              </div>

                              <div className="p-3 bg-rose-50/40 border border-rose-100 rounded-xl space-y-1.5">
                                <h4 className="text-[10px] font-black text-rose-800 uppercase tracking-wide">Areas of Improvement</h4>
                                {savedMainsAns.weaknesses && savedMainsAns.weaknesses.length > 0 ? (
                                  <ul className="list-disc list-inside text-[10px] text-rose-750 space-y-0.5 leading-relaxed">
                                    {savedMainsAns.weaknesses.map((w: string, idx: number) => <li key={idx}>{w}</li>)}
                                  </ul>
                                ) : (
                                  <p className="text-[10px] text-rose-600">Link relevant commissions/case laws.</p>
                                )}
                              </div>
                            </div>

                            {savedMainsAns.feedback && (
                              <div className="space-y-1.5">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Detailed feedback report</h4>
                                <div
                                  dangerouslySetInnerHTML={{ __html: savedMainsAns.feedback }}
                                  className="prose prose-sm max-h-[240px] overflow-y-auto pr-1 text-xs leading-relaxed text-slate-700 space-y-2 border border-slate-200/60 p-3 bg-white rounded-xl"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Objective MCQ Answering Workspace */
                  <div className="grid gap-3">
                    {activeQuestion.question_version.options.map((option, index) => {
                      const key = optionKey(option, index);
                      const selected = selectedKey === key || isSameAnswer(activeResponse?.selectedAnswer, key);
                      return (
                        <button
                          className={`flex min-h-14 items-start gap-3 rounded-2xl border p-3.5 text-left text-sm leading-relaxed transition-all ${
                            selected
                              ? "border-indigo-600 bg-indigo-50/60 text-slate-900 shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:border-indigo-400"
                          }`}
                          key={`${key}-${index}`}
                          onClick={() => void saveResponse(activeQuestion, key, "answered", activeResponse?.marked ?? false)}
                          type="button"
                        >
                          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-black transition-colors ${
                            selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                          }`}>
                            {key}
                          </span>
                          <span className="mt-0.5">{optionText(option, index)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Action Row */}
          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5 justify-between">
            <div className="flex gap-2">
              <button
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 disabled:opacity-50"
                disabled={activeIndex === 0}
                onClick={() => setActiveIndex((value) => Math.max(0, value - 1))}
                type="button"
              >
                <ArrowLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-750"
                onClick={() => {
                  if (isSubjective) {
                    alert("Click Lock & Submit Answer Response to save mains essay answers.");
                  } else {
                    void saveResponse(activeQuestion, activeResponse?.selectedAnswer ?? null, "skipped", false);
                  }
                }}
                type="button"
              >
                Skip
              </button>
              <button
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-750"
                onClick={() => void saveResponse(activeQuestion, activeResponse?.selectedAnswer ?? null, activeResponse?.status ?? "not_visited", true)}
                type="button"
              >
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                Review
              </button>
            </div>

            <button
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 text-xs font-bold text-white disabled:opacity-50 active:scale-95"
              disabled={activeIndex === paper.questions.length - 1}
              onClick={() => setActiveIndex((value) => Math.min(paper.questions.length - 1, value + 1))}
              type="button"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {savingId === activeQuestion.question_version_id && (
            <p className="text-[10px] font-bold text-indigo-500 animate-pulse">Syncing response metadata...</p>
          )}
        </section>

        {/* Right palette sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-[9.5rem] lg:self-start">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-slate-800">Question Palette</h2>
            <div className="grid grid-cols-5 gap-1.5">
              {paper.questions.map((question, index) => {
                const status = questionStatus(question);
                let colorClass = "border-slate-200 bg-white text-slate-700 hover:border-slate-400";
                
                if (index === activeIndex) {
                  colorClass = "border-slate-900 bg-slate-900 text-white shadow-sm";
                } else if (status === "answered") {
                  colorClass = "border-emerald-555 bg-emerald-50 text-emerald-700";
                } else if (status === "review") {
                  colorClass = "border-amber-555 bg-amber-50 text-amber-700";
                } else if (status === "skipped") {
                  colorClass = "border-slate-200 bg-slate-100 text-slate-500";
                }

                return (
                  <button
                    aria-label={`Question ${index + 1} ${status}`}
                    className={`grid h-9.5 place-items-center rounded-xl border text-xs font-black transition-all ${colorClass}`}
                    key={question.id}
                    onClick={() => setActiveIndex(index)}
                    type="button"
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            {/* Tag Legend Panel matching exact request */}
            <div className="border-t border-slate-100 pt-3.5 space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Status Legend</span>
              <div className="grid grid-cols-2 gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md border border-emerald-400 bg-emerald-50 shrink-0" />
                  Answered
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md border border-amber-400 bg-amber-50 shrink-0" />
                  Review
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md border border-slate-300 bg-slate-100 shrink-0" />
                  Skipped
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md border border-slate-200 bg-white shrink-0" />
                  Not Visited
                </div>
              </div>
            </div>
          </section>

          <button
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all active:scale-[0.98]"
            onClick={() => void submit()}
            type="button"
          >
            <Send className="h-4 w-4" />
            Finish & Submit Test
          </button>
        </aside>
      </div>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-3 lg:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-2">
          <button className="h-10 rounded-xl border border-slate-200 text-xs font-bold" onClick={() => setActiveIndex((value) => Math.max(0, value - 1))} type="button">Prev</button>
          <button className="h-10 rounded-xl border border-slate-200 text-xs font-bold" onClick={() => setActiveIndex((value) => Math.min(paper.questions.length - 1, value + 1))} type="button">Next</button>
          <button className="h-10 rounded-xl bg-slate-900 text-xs font-bold text-white" onClick={() => void submit()} type="button">Submit</button>
        </div>
      </div>
    </main>
  );
}
