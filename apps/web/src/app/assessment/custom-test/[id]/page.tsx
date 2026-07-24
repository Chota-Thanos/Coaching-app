"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Layers,
  Award,
  Calendar,
  Play,
  PlusCircle,
  Trash2,
  Loader2,
  BookOpen,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronRight,
  BookOpenCheck
} from "lucide-react";
import { useAuth, authenticatedGet, authenticatedDelete, authenticatedPost } from "../../../../components/auth/auth-context";

type QuestionOption = {
  key: string;
  text: string;
};

type Question = {
  id: number;
  test_section_id: number;
  question_version_id: number;
  marks: string;
  negative_marks: string;
  display_order: number;
  question_id: number;
  question_statement: string;
  supplementary_statement?: string | null;
  question_prompt?: string | null;
  options?: string | QuestionOption[] | null;
  correct_answer?: string | { key: string } | null;
  explanation?: string | null;
};

type CategoryBreakdown = {
  subject_node_id: number;
  subject_name: string;
  topic_node_id: number;
  topic_name: string;
  question_count: number;
};

type CustomTestDetail = {
  id: number;
  title: string;
  description?: string;
  slug: string;
  test_type: string;
  duration_minutes: number;
  total_marks: number;
  question_count?: number;
  created_at: string;
  latest_attempt_id?: number | null;
  latest_attempt_status?: string | null;
  latest_result_id?: number | null;
  sections?: any[];
  questions?: Question[];
  category_breakdown?: CategoryBreakdown[];
};

export default function CustomTestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { token, isInitialized } = useAuth();
  
  const id = params.id as string;
  const contentParam = searchParams.get("content_type") || "gk";

  const [test, setTest] = useState<CustomTestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTestDetail = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authenticatedGet<CustomTestDetail>(
        `/api/v1/assessment/test-templates/${id}`,
        token
      );
      setTest(data);
    } catch (err: any) {
      setError(err.message || "Failed to load test details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized && token) {
      fetchTestDetail();
    }
  }, [token, isInitialized, id]);

  const handleStartAttempt = async () => {
    if (!token || !test) return;
    setStarting(true);
    setError(null);
    try {
      const attempt = await authenticatedPost<any>(
        `/api/v1/assessment/test-templates/${test.id}/attempts/start`,
        token,
        {}
      );
      router.push(`/assessment/attempts/${attempt.id ?? attempt}`);
    } catch (err: any) {
      setError(err.message || "Failed to start attempt.");
      setStarting(false);
    }
  };

  const handleDeleteTest = async () => {
    if (!token || !test || !window.confirm("Are you sure you want to delete this custom test template?")) return;
    setDeleting(true);
    setError(null);
    try {
      await authenticatedDelete(`/api/v1/assessment/test-templates/${test.id}`, token);
      router.push(`/assessment/custom-test?content_type=${contentParam}`);
    } catch (err: any) {
      setError(err.message || "Failed to delete custom test.");
      setDeleting(false);
    }
  };

  if (!isInitialized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12 flex flex-col items-center justify-center">
        <XCircle className="h-12 w-12 text-rose-500 mb-4" />
        <h3 className="text-lg font-black text-slate-800">Test not found</h3>
        <p className="text-xs text-slate-500 mt-2">The custom test does not exist or you do not have permission to view it.</p>
        <Link
          href={`/assessment/custom-test?content_type=${contentParam}`}
          className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-indigo-650 hover:bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition"
        >
          Back to list
        </Link>
      </div>
    );
  }

  const isMains = test.test_type === "mains_test";
  const typeLabel = isMains ? "Mains" : contentParam === "aptitude" ? "CSAT" : "GS";
  const badgeColor = isMains
    ? "bg-rose-50 text-rose-700 border-rose-100"
    : contentParam === "aptitude"
    ? "bg-amber-50 text-amber-700 border-amber-100"
    : "bg-indigo-50 text-indigo-700 border-indigo-100";

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header */}
      <div className="border-b border-line bg-surface px-4 py-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/assessment/custom-test?content_type=${contentParam}`}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-surface hover:bg-slate-50 transition"
            >
              <ArrowLeft className="h-5 w-5 text-slate-655" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Test Details</h1>
              <p className="text-xs text-slate-500">View breakdown, questions, and attempt history</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteTest}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/30 hover:bg-rose-50/30 hover:border-rose-350 px-4 py-2.5 text-xs font-bold text-rose-650 transition shrink-0 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span>Delete Template</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 mt-8">
        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Metadata & Breakdown */}
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-surface border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border rounded-md ${badgeColor}`}>
                  {typeLabel} Test
                </span>
                <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(test.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short"
                  })}
                </span>
              </div>

              <h2 className="text-lg font-black text-slate-900 leading-tight">{test.title}</h2>
              {test.description && (
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">{test.description}</p>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 mt-5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-center">
                  <Layers className="h-4 w-4 mx-auto text-slate-400 mb-1" />
                  <div className="text-sm font-black text-slate-800">{test.questions?.length ?? 0}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Questions</div>
                </div>
                <div className="text-center">
                  <Clock className="h-4 w-4 mx-auto text-slate-400 mb-1" />
                  <div className="text-sm font-black text-slate-800">{test.duration_minutes}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Minutes</div>
                </div>
                <div className="text-center">
                  <Award className="h-4 w-4 mx-auto text-slate-400 mb-1" />
                  <div className="text-sm font-black text-slate-800">{test.total_marks}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Marks</div>
                </div>
              </div>

              {/* Action Banner */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col gap-2">
                {test.latest_attempt_status === "in_progress" ? (
                  <Link
                    href={`/assessment/attempts/${test.latest_attempt_id}`}
                    className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm transition"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Continue Attempt</span>
                  </Link>
                ) : test.latest_attempt_status === "submitted" ? (
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/assessment/results/${test.latest_result_id}`}
                      className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-150 transition"
                    >
                      <BookOpenCheck className="h-4 w-4" />
                      <span>View Results Page</span>
                    </Link>
                    <button
                      onClick={handleStartAttempt}
                      disabled={starting}
                      className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition"
                    >
                      {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      <span>Start New Attempt</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/assessment/${contentParam === "aptitude" ? "csat" : contentParam}?test_template_id=${test.id}`}
                      className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
                    >
                      <PlusCircle className="h-4 w-4 text-slate-500" />
                      <span>Add More Questions</span>
                    </Link>
                    {(test.questions?.length ?? 0) > 0 ? (
                      <button
                        onClick={handleStartAttempt}
                        disabled={starting}
                        className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 hover:bg-slate-850 text-xs font-bold text-white shadow-sm transition disabled:bg-slate-100"
                      >
                        {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        <span>Attempt Test Now</span>
                      </button>
                    ) : (
                      <div className="text-center py-2 bg-amber-50/50 border border-amber-100 rounded-xl text-[11px] font-semibold text-amber-800 italic">
                        Add questions before attempting.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Category Breakdown Card */}
            <div className="bg-surface border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-slate-400" />
                Category Breakdown
              </h3>
              
              {!test.category_breakdown || test.category_breakdown.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No category data available.</p>
              ) : (
                <div className="space-y-3 mt-3">
                  {test.category_breakdown.map((cat, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-3 text-xs border-b border-slate-50 pb-2.5 last:border-0 last:pb-0">
                      <div>
                        <div className="font-extrabold text-slate-800">{cat.subject_name}</div>
                        {cat.topic_name && <div className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5 mt-0.5">
                          <ChevronRight className="h-2.5 w-2.5" />
                          {cat.topic_name}
                        </div>}
                      </div>
                      <span className="inline-flex h-5 items-center rounded-md bg-indigo-50 border border-indigo-100/50 px-2 text-[10px] font-black text-indigo-700 shrink-0">
                        {cat.question_count} Qs
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Question List */}
          <div className="lg:col-span-2 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-slate-400" />
                <span>Questions List ({test.questions?.length ?? 0})</span>
              </h3>
            </div>

            {!test.questions || test.questions.length === 0 ? (
              <div className="bg-surface border border-slate-200 rounded-2xl p-10 text-center">
                <HelpCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <h4 className="font-bold text-slate-800 text-sm">No questions in this test</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Go to the syllabus page and select categories to inject questions, or upload a document in the AI parser.
                </p>
                <Link
                  href={`/assessment/${contentParam === "aptitude" ? "csat" : contentParam}?test_template_id=${test.id}`}
                  className="mt-4 inline-flex items-center gap-1 rounded-xl border border-slate-200 hover:bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition"
                >
                  <PlusCircle className="h-3.5 w-3.5 text-slate-500" />
                  <span>Add from categories</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {test.questions.map((q, index) => {
                  let parsedOptions: QuestionOption[] = [];
                  if (q.options) {
                    try {
                      parsedOptions = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
                    } catch {
                      parsedOptions = [];
                    }
                  }

                  let parsedCorrectKey = "";
                  if (q.correct_answer) {
                    try {
                      parsedCorrectKey = typeof q.correct_answer === "string" 
                        ? JSON.parse(q.correct_answer)?.key ?? q.correct_answer
                        : (q.correct_answer as any)?.key ?? "";
                    } catch {
                      parsedCorrectKey = q.correct_answer as string;
                    }
                  }

                  return (
                    <div key={q.id} className="bg-surface border border-slate-200 rounded-2xl p-5 shadow-sm">
                      {/* Meta info */}
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider pb-2 border-b border-slate-50">
                        <span>Question {index + 1}</span>
                        <span>{q.marks} Marks</span>
                      </div>

                      {/* Statement */}
                      <div className="text-sm font-extrabold text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {q.question_statement}
                      </div>

                      {/* Supplementary text */}
                      {q.supplementary_statement && (
                        <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100/50 leading-relaxed whitespace-pre-wrap">
                          {q.supplementary_statement}
                        </div>
                      )}

                      {/* Prompt */}
                      {q.question_prompt && (
                        <div className="mt-2.5 text-xs font-bold text-slate-655">
                          {q.question_prompt}
                        </div>
                      )}

                      {/* Render Options if Objective */}
                      {!isMains && parsedOptions.length > 0 && (
                        <div className="mt-4 grid grid-cols-1 gap-2.5">
                          {parsedOptions.map((opt) => {
                            const isCorrect = opt.key.toUpperCase() === parsedCorrectKey.toUpperCase();
                            return (
                              <div
                                key={opt.key}
                                className={`flex items-start gap-3 p-3 rounded-xl border text-xs leading-relaxed transition ${
                                  isCorrect 
                                    ? "border-emerald-200 bg-emerald-50/40 text-emerald-850 font-semibold" 
                                    : "border-slate-150 bg-slate-50/30 text-slate-655"
                                }`}
                              >
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg font-black uppercase text-[10px] ${
                                  isCorrect ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                                }`}>
                                  {opt.key}
                                </span>
                                <div className="pt-0.5">{opt.text}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Explanation if Objective */}
                      {!isMains && q.explanation && (
                        <div className="mt-4 pt-3 border-t border-slate-100">
                          <div className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">Explanation</div>
                          <p className="mt-1 text-xs text-slate-655 leading-relaxed whitespace-pre-wrap">{q.explanation}</p>
                        </div>
                      )}

                      {/* Render Mains fields if subjective */}
                      {isMains && (
                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-3.5">
                          {q.explanation && (
                            <div>
                              <div className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">Model Answer / Guidelines</div>
                              <p className="mt-1 text-xs text-slate-655 leading-relaxed whitespace-pre-wrap">{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
