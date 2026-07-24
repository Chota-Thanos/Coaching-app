"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Send, Star, AlertTriangle, Loader2, Upload, Trash2, Plus } from "lucide-react";
import {
  optionKey,
  optionText,
  type StudyPlanAttemptPaper,
  type StudyPlanQuestion
} from "../../lib/study-plans";
import { SignInPanel } from "../auth/sign-in-panel";
import { authenticatedGet, authenticatedPost, authenticatedPut, useAuth } from "../auth/auth-context";

type StudyPlanAttemptEngineProps = {
  attemptId: string;
};

type LocalResponse = {
  selectedAnswer: unknown;
  answerText: string;
  status: "not_visited" | "answered" | "skipped" | "marked_for_review" | string;
  marked: boolean;
};

function selectedAnswerKey(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const key = record.id ?? record.key ?? record.value ?? record.label;
    return key === undefined ? JSON.stringify(value) : String(key);
  }
  return String(value);
}

function readWordLimit(question: StudyPlanQuestion): number | null {
  const payload = question.source_payload && typeof question.source_payload === "object" ? question.source_payload : {};
  const limit = Number(payload.word_limit);
  return Number.isFinite(limit) && limit > 0 ? limit : null;
}

export function StudyPlanAttemptEngine({ attemptId }: StudyPlanAttemptEngineProps) {
  const router = useRouter();
  const { token, isInitialized } = useAuth();
  
  const [paper, setPaper] = useState<StudyPlanAttemptPaper | null>(null);
  const [responses, setResponses] = useState<Map<number, LocalResponse>>(new Map());
  const [activeIndex, setActiveIndex] = useState(0);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  // local text state for subjective questions
  const [textDrafts, setTextDrafts] = useState<Record<number, string>>({});

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
    if (ocrFiles.length === 0 || !token || !activeQuestion) return;
    setIsOcrLoading(true);
    setMessage(null);
    try {
      const response = await authenticatedPost<{ extracted_text: string }>('/api/v1/assessment/mains/ocr', token, {
        images_base64: ocrFiles.map(f => f.base64)
      });
      const currentVal = textDrafts[activeQuestion.id] ?? "";
      const newText = currentVal + (currentVal ? '\n\n' : '') + response.extracted_text;
      setTextDrafts(prev => ({ ...prev, [activeQuestion.id]: newText }));
      
      const activeResp = responses.get(activeQuestion.id);
      await saveResponse(activeQuestion, null, newText, newText.trim() ? "answered" : "not_visited", activeResp?.marked ?? false);
      
      setShowOcrUpload(false);
      setOcrFiles([]);
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : "Failed to extract text from image.");
    } finally {
      setIsOcrLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void authenticatedGet<StudyPlanAttemptPaper>(`/api/v1/study-plan-attempts/${attemptId}/paper`, token)
      .then((record) => {
        setPaper(record);
        
        if (record.status !== "in_progress" && record.result?.id) {
          router.replace(`/study-plans/results/${record.result.id}`);
          return;
        }

        const nextResponses = new Map<number, LocalResponse>();
        const nextDrafts: Record<number, string> = {};
        
        for (const question of record.questions) {
          const resp = question.response;
          nextResponses.set(question.id, {
            selectedAnswer: resp?.selected_answer ?? null,
            answerText: resp?.answer_text ?? "",
            status: resp?.status ?? "not_visited",
            marked: resp?.is_marked_for_review ?? false
          });
          nextDrafts[question.id] = resp?.answer_text ?? "";
        }
        setResponses(nextResponses);
        setTextDrafts(nextDrafts);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load attempt."));
  }, [attemptId, token, router]);

  const activeQuestion = paper?.questions[activeIndex] ?? null;

  const questionStatus = (question: StudyPlanQuestion): "answered" | "review" | "skipped" | "not_visited" => {
    const resp = responses.get(question.id);
    if (resp?.marked) return "review";
    if (resp?.status === "answered") return "answered";
    if (resp?.status === "skipped") return "skipped";
    return "not_visited";
  };

  const summary = useMemo(() => {
    const questions = paper?.questions ?? [];
    let answered = 0;
    let review = 0;
    let skipped = 0;
    let notVisited = 0;

    for (const q of questions) {
      const status = questionStatus(q);
      if (status === "answered") answered++;
      else if (status === "review") review++;
      else if (status === "skipped") skipped++;
      else notVisited++;
    }

    return { answered, review, skipped, notVisited };
  }, [paper?.questions, responses]);

  const saveResponse = async (
    question: StudyPlanQuestion,
    selectedAnswer: unknown,
    answerText: string,
    status: string,
    marked: boolean
  ) => {
    if (!token || paper?.status !== "in_progress") return;
    setSavingId(question.id);
    setMessage(null);
    setResponses((current) => {
      const next = new Map(current);
      next.set(question.id, { selectedAnswer, answerText, status, marked });
      return next;
    });
    try {
      await authenticatedPut(`/api/v1/study-plan-attempts/${attemptId}/responses`, token, {
        question_id: question.id,
        selected_answer: selectedAnswer ?? undefined,
        answer_text: answerText || undefined,
        status,
        is_marked_for_review: marked
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save response.");
    } finally {
      setSavingId(null);
    }
  };

  const submit = async () => {
    if (!token || !paper) return;
    if (!window.confirm("Submit this test now? You cannot change answers after submission.")) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await authenticatedPost<{ id: number; result_status: string; score: number | string; max_score: number | string }>(
        `/api/v1/study-plan-attempts/${attemptId}/submit`,
        token,
        {}
      );
      router.push(`/study-plans/results/${result.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit test.");
      setSubmitting(false);
    }
  };

  if (!isInitialized) {
    return (
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
        <span className="text-sm font-semibold text-slate-400">Loading attempt...</span>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-16 pt-8">
        <section className="rounded-lg border border-line bg-surface p-6 shadow-sm">
          <h1 className="text-2xl font-black text-ink">Sign in required</h1>
          <p className="mt-2 text-sm text-ink/65">Sign in to continue your study plan test.</p>
          <div className="mt-5">
            <SignInPanel />
          </div>
        </section>
      </main>
    );
  }

  if (!paper || !activeQuestion) {
    return (
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8">
        <p className="rounded-lg border border-line bg-surface p-6 text-center text-sm font-bold text-ink/50">
          {message ?? "Loading attempt..."}
        </p>
      </main>
    );
  }

  const activeResponse = responses.get(activeQuestion.id);
  const selectedKey = selectedAnswerKey(activeResponse?.selectedAnswer);
  
  const isSubjective = activeQuestion.question_family === "mains_subjective";
  const currentTextVal = textDrafts[activeQuestion.id] ?? "";

  const payload = activeQuestion.source_payload ?? {};
  const passageText = typeof payload.passage_text === "string" && payload.passage_text.trim() ? payload.passage_text : null;
  const passageTitle = typeof payload.passage_title === "string" ? payload.passage_title : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <main className="mx-auto max-w-7xl px-4 pt-6 space-y-6">
        {/* Back link */}
        <Link className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700" href="/study-plans">
          <ArrowLeft className="h-4 w-4" />
          Study plans
        </Link>

      {/* ── Status Bar ── */}
      <section className="sticky top-16 z-20 rounded-2xl border border-line bg-surface/95 backdrop-blur-md p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-slate-800">{paper.test_template.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">Question {activeIndex + 1} of {paper.questions.length}</p>
          </div>
          <div className="grid grid-cols-4 sm:flex items-center gap-2 text-center text-[10px] font-black tracking-wide uppercase shrink-0">
            <span className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-emerald-600">{summary.answered} Done</span>
            <span className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-amber-600">{summary.review} Review</span>
            <span className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-slate-500">{summary.skipped} Skip</span>
            <span className="rounded-lg bg-slate-900 border border-slate-900 px-3 py-2 text-white normal-case">
              {paper.test_template.duration_minutes} Mins
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
        <section className="bg-surface border border-line rounded-3xl p-5 md:p-6 shadow-soft space-y-6">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">
              {activeQuestion.question_family === "mains_subjective" ? "Mains Subjective" : "Objective MCQ"}
            </span>
            <span className="rounded-md bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
              +{activeQuestion.marks} Marks
            </span>
            {Number(activeQuestion.negative_marks) > 0 && (
              <span className="rounded-md bg-rose-50 border border-rose-100 px-2.5 py-1 text-[10px] font-bold text-rose-700">
                -{activeQuestion.negative_marks} Neg
              </span>
            )}
          </div>

          {passageText ? (
            /* Passage-based Split Layout */
            <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
              {/* Left Column: Passage Text (stays static as questions change) */}
              <aside className="rounded-2xl border border-line bg-paper/30 p-4 space-y-2 self-start md:sticky md:top-24">
                {passageTitle && <h3 className="text-sm font-black text-ink">{passageTitle}</h3>}
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink/75">{passageText}</p>
              </aside>

              {/* Right Column: Active Question + Options */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <h2 className="text-lg font-black leading-snug text-slate-900 md:text-xl">
                    {activeIndex + 1}. {activeQuestion.question_statement}
                  </h2>
                  {activeQuestion.question_prompt && (
                    <p className="text-sm font-extrabold leading-relaxed text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      {activeQuestion.question_prompt}
                    </p>
                  )}
                </div>

                <div className="grid gap-3">
                  {activeQuestion.options.map((option, index) => {
                    const key = optionKey(option, index);
                    const selected = selectedKey === key;
                    return (
                      <button
                        className={`flex min-h-14 items-start gap-3 rounded-2xl border p-3.5 text-left text-sm leading-relaxed transition-all ${
                          selected
                            ? "border-indigo-600 bg-indigo-50 text-slate-900 shadow-sm"
                            : "border-slate-200 bg-surface text-slate-700 hover:border-indigo-500/50"
                        }`}
                        key={key}
                        onClick={() => void saveResponse(activeQuestion, { key }, "", "answered", activeResponse?.marked ?? false)}
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
              </div>
            </div>
          ) : (
            /* Standard Question Layout */
            <>
              <div className="space-y-4">
                <h2 className="text-lg font-black leading-snug text-slate-900 md:text-xl">
                  {activeIndex + 1}. {activeQuestion.question_statement}
                </h2>
                {activeQuestion.supplementary_statement && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-500 bg-slate-50/40 p-3.5 rounded-xl italic">
                    {activeQuestion.supplementary_statement}
                  </p>
                )}
                {activeQuestion.question_prompt && (
                  <p className="text-sm font-extrabold leading-relaxed text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {activeQuestion.question_prompt}
                  </p>
                )}
              </div>

              <div className="mt-6">
                {isSubjective ? (
                  /* subjective mains workspace */
                  <div className="space-y-4">
                    {readWordLimit(activeQuestion) && (
                      <span className="inline-flex rounded-md bg-paper px-2 py-1 text-[11px] font-black text-ink/55">
                        {readWordLimit(activeQuestion)} words limit
                      </span>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wide text-ink/55">Answer Workspace</span>
                        {paper?.status === "in_progress" && (
                          <button
                            type="button"
                            onClick={() => setShowOcrUpload(!showOcrUpload)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {showOcrUpload ? 'Cancel Scan' : 'OCR Scan Answer'}
                          </button>
                        )}
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
                                  <div key={file.id} className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-indigo-100 shadow-sm">
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
                        className="min-h-60 w-full rounded-xl border border-slate-200 p-4 text-sm leading-relaxed outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition-all resize-y"
                        onBlur={() => saveResponse(activeQuestion, null, currentTextVal, currentTextVal.trim() ? "answered" : "not_visited", activeResponse?.marked ?? false)}
                        onChange={(event) => setTextDrafts((current) => ({ ...current, [activeQuestion.id]: event.target.value }))}
                        placeholder="Structure your introduction, elaborate key analytical details, and write a conclusion..."
                        value={currentTextVal}
                      />
                      <span className="block text-[11px] font-semibold text-ink/45">Your response auto-saves when you click out of the text field.</span>
                    </div>
                  </div>
                ) : (
                  /* objective options */
                  <div className="grid gap-3">
                    {activeQuestion.options.map((option, index) => {
                      const key = optionKey(option, index);
                      const selected = selectedKey === key;
                      return (
                        <button
                          className={`flex min-h-14 items-start gap-3 rounded-2xl border p-3.5 text-left text-sm leading-relaxed transition-all ${
                            selected
                              ? "border-indigo-600 bg-indigo-50 text-slate-900 shadow-sm"
                              : "border-slate-200 bg-surface text-slate-700 hover:border-indigo-500/50"
                          }`}
                          key={key}
                          onClick={() => void saveResponse(activeQuestion, { key }, "", "answered", activeResponse?.marked ?? false)}
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
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-4 text-xs font-bold text-slate-700 disabled:opacity-50"
                disabled={activeIndex === 0}
                onClick={() => setActiveIndex((value) => Math.max(0, value - 1))}
                type="button"
              >
                <ArrowLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-surface px-4 text-xs font-bold text-slate-755"
                onClick={() => {
                  if (isSubjective) {
                    void saveResponse(activeQuestion, null, currentTextVal, "skipped", false);
                  } else {
                    void saveResponse(activeQuestion, null, "", "skipped", false);
                  }
                }}
                type="button"
              >
                Skip
              </button>
              <button
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-surface px-4 text-xs font-bold text-slate-755"
                onClick={() => void saveResponse(activeQuestion, activeResponse?.selectedAnswer ?? null, activeResponse?.answerText ?? "", activeResponse?.status ?? "not_visited", true)}
                type="button"
              >
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                Review
              </button>
            </div>

            <button
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 transition px-5 text-xs font-bold text-white disabled:opacity-50 active:scale-95"
              disabled={activeIndex === paper.questions.length - 1}
              onClick={() => setActiveIndex((value) => Math.min(paper.questions.length - 1, value + 1))}
              type="button"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {savingId === activeQuestion.id && (
            <p className="text-[10px] font-bold text-indigo-600 animate-pulse">Syncing response...</p>
          )}
        </section>

        {/* Right palette sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-[9.5rem] lg:self-start">
          <section className="rounded-3xl border border-slate-200 bg-surface p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-slate-800">Question Palette</h2>
            <div className="grid grid-cols-5 gap-1.5">
              {paper.questions.map((question, index) => {
                const status = questionStatus(question);
                let colorClass = "border-slate-200 bg-surface text-slate-700 hover:border-indigo-500/50";
                
                if (index === activeIndex) {
                  colorClass = "border-slate-900 bg-slate-900 text-white shadow-sm";
                } else if (status === "answered") {
                  colorClass = "border-emerald-500 bg-emerald-50 text-emerald-700";
                } else if (status === "review") {
                  colorClass = "border-amber-500 bg-amber-50 text-amber-700";
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

            {/* Tag Legend Panel */}
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
                  <span className="h-3 w-3 rounded-md border border-slate-200 bg-surface shrink-0" />
                  Not Visited
                </div>
              </div>
            </div>
          </section>

          <button
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
            disabled={submitting}
            onClick={submit}
            type="button"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit test
          </button>
        </aside>
      </div>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-surface p-3 lg:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-2">
          <button className="h-10 rounded-xl border border-slate-200 text-xs font-bold" onClick={() => setActiveIndex((value) => Math.max(0, value - 1))} type="button">Prev</button>
          <button className="h-10 rounded-xl border border-slate-200 text-xs font-bold" onClick={() => setActiveIndex((value) => Math.min(paper.questions.length - 1, value + 1))} type="button">Next</button>
          <button className="h-10 rounded-xl bg-slate-900 text-xs font-bold text-white" onClick={submit} type="button">Submit</button>
        </div>
      </div>
    </main>
  </div>
  );
}
