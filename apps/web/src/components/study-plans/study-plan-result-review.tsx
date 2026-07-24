"use client";

import Link from "next/link";
import { BarChart3, CheckCircle2, CircleAlert, Clock3, Filter, Target, Trophy, XCircle, ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { optionKey, optionText } from "../../lib/study-plans";
import { authenticatedGet, useAuth } from "../auth/auth-context";
import { SignInPanel } from "../auth/sign-in-panel";
import { TopicHeatmap } from "../assessment/topic-heatmap";
import { TimeChart } from "../assessment/time-chart";
import { ErrorTagger } from "../assessment/error-tagger";

type Tab = "summary" | "questions" | "topics" | "time";
type QuestionFilter = "all" | "correct" | "incorrect" | "unattempted";

type StudyPlanResultReviewType = {
  id: number;
  attempt_id: number;
  score: number | string;
  max_score: number | string;
  accuracy: number | string;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unattempted_count: number;
  negative_marks: number | string;
  result_status: string;
  created_at: string;
  attempt: {
    id: number;
    plan_item_id: number | null;
    enrollment_id: number | null;
    status: string;
    started_at: string;
    submitted_at: string | null;
  };
  test_template: {
    id: number;
    title: string;
    duration_minutes: number;
    test_type: "prelims_test" | "csat_test" | "mains_test";
  };
  topic_breakdowns: Array<{
    id: number;
    taxonomy_node_id: number | null;
    taxonomy_name: string | null;
    taxonomy_content_type: string | null;
    question_nature_id: number | null;
    question_nature_name: string | null;
    total_questions: number;
    correct_count: number;
    incorrect_count: number;
    unattempted_count: number;
    score: number | string;
    accuracy: number | string;
    avg_time_seconds: number | string;
  }>;
  questions: Array<{
    id: number;
    test_template_id: number;
    display_order: number;
    question_family: "objective" | "mains_subjective";
    question_statement: string;
    supplementary_statement: string | null;
    question_prompt: string | null;
    options: unknown[];
    correct_answer?: unknown;
    explanation?: string | null;
    model_answer?: string | null;
    marks: number | string;
    negative_marks: number | string;
    source_payload?: Record<string, unknown> | null;
    response?: {
      id: number;
      selected_answer: unknown;
      answer_text: string | null;
      status: string;
      is_marked_for_review: boolean;
      time_spent_seconds?: number;
    } | null;
    score_item?: {
      outcome?: "correct" | "incorrect" | "unattempted";
      score?: number | string;
      selected_answer?: unknown;
      correct_answer?: unknown;
      time_spent_seconds?: number;
    } | null;
  }>;
};

function outcomeClass(outcome: string | undefined): string {
  if (outcome === "correct") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (outcome === "incorrect") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function outcomeLabel(outcome: string | undefined): string {
  if (outcome === "correct") return "✓ Correct";
  if (outcome === "incorrect") return "✗ Incorrect";
  return "— Unattempted";
}

function formatPercent(value: number | string | null | undefined): string {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) return "0%";
  const percent = numberValue <= 1 ? numberValue * 100 : numberValue;
  return `${Math.round(percent)}%`;
}

function formatMarks(value: number | string | null | undefined): string {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) return "0";
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(2);
}

function selectedAnswerKey(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const key = record.id ?? record.key ?? record.value ?? record.label;
    return key === undefined ? JSON.stringify(value) : String(key);
  }
  return String(value);
}

/* ── Score gauge ──────────────────────────────────────── */
function ScoreGauge({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0;
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-200" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="gauge-ring"
            style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-ink">{Math.round(pct)}%</span>
          <span className="text-[11px] font-semibold text-muted">score</span>
        </div>
      </div>
      <p className="mt-2 text-sm font-bold text-ink">
        {formatMarks(score)} / {formatMarks(maxScore)}
      </p>
    </div>
  );
}

/* ── Tab button ───────────────────────────────────────── */
function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Main component ───────────────────────────────────── */
export function StudyPlanResultReview({ resultId }: { resultId: string }) {
  const { token, isInitialized } = useAuth();
  const [review, setReview] = useState<StudyPlanResultReviewType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [qFilter, setQFilter] = useState<QuestionFilter>("all");

  const loadReview = useCallback(async () => {
    if (!token) return;
    try {
      const record = await authenticatedGet<StudyPlanResultReviewType>(
        `/api/v1/study-plan-results/${resultId}/review`,
        token
      );
      setReview(record);
    } catch (error) {
      console.error(error);
      setMessage("Could not load this study plan result review.");
    }
  }, [resultId, token]);

  useEffect(() => {
    if (isInitialized && token) {
      void loadReview();
    }
  }, [isInitialized, token, loadReview]);

  // Configure MathJax
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).MathJax = {
        tex: {
          inlineMath: [['$', '$'], ['\\(', '\\)']],
          displayMath: [['$$', '$$'], ['\\[', '\\]']]
        },
        options: {
          ignoreHtmlClass: 'tex2jax_ignore',
          processHtmlClass: 'tex2jax_process'
        }
      };
    }
  }, []);

  // Typeset math formula text whenever data renders or tab changes
  useEffect(() => {
    if (!review) return;
    const scriptId = "mathjax-script-cdn";
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
      script.async = true;
      document.head.appendChild(script);
      script.onload = () => {
        if ((window as any).MathJax && typeof (window as any).MathJax.typesetPromise === "function") {
          (window as any).MathJax.typesetPromise().catch((err: any) => console.error("MathJax init error:", err));
        }
      };
    } else {
      if ((window as any).MathJax) {
        setTimeout(() => {
          if ((window as any).MathJax && typeof (window as any).MathJax.typesetPromise === "function") {
            (window as any).MathJax.typesetPromise().catch((err: any) => console.error("MathJax typesetting error:", err));
          }
        }, 150);
      }
    }
  }, [tab, review, qFilter]);

  const questions = review?.questions ?? [];

  /* Filtered questions */
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (qFilter === "all") return true;
      const outcome = q.score_item?.outcome;
      if (qFilter === "correct") return outcome === "correct";
      if (qFilter === "incorrect") return outcome === "incorrect";
      if (qFilter === "unattempted") return !outcome || outcome === "unattempted";
      return true;
    });
  }, [questions, qFilter]);

  const groupedItems = useMemo(() => {
    const items: Array<
      | { type: "independent"; question: typeof questions[0]; originalIndex: number }
      | { type: "passage"; passage: { title: string | null; body: string }; questions: Array<{ question: typeof questions[0]; originalIndex: number }> }
    > = [];
    if (!review) return items;

    const passageMap = new Map<string, { type: "passage"; passage: { title: string | null; body: string }; questions: Array<{ question: typeof questions[0]; originalIndex: number }> }>();

    filteredQuestions.forEach((q) => {
      const originalIndex = questions.findIndex((x) => x.id === q.id);
      const payload = (q.source_payload && typeof q.source_payload === "object" ? q.source_payload : {}) as Record<string, unknown>;
      const passageText = typeof payload.passage_text === "string" && payload.passage_text.trim() ? payload.passage_text : null;
      const passageTitle = typeof payload.passage_title === "string" ? payload.passage_title : null;

      if (passageText) {
        const existing = passageMap.get(passageText);
        if (existing) {
          existing.questions.push({ question: q, originalIndex });
        } else {
          const group: { type: "passage"; passage: { title: string | null; body: string }; questions: Array<{ question: typeof q; originalIndex: number }> } = {
            type: "passage",
            passage: { title: passageTitle, body: passageText },
            questions: [{ question: q, originalIndex }]
          };
          passageMap.set(passageText, group);
          items.push(group);
        }
      } else {
        items.push({
          type: "independent",
          question: q,
          originalIndex
        });
      }
    });

    return items;
  }, [filteredQuestions, review, questions]);

  const testTypeLabel = (type: string) => {
    if (type === "prelims_test") return "Prelims GK Test";
    if (type === "csat_test") return "CSAT Test";
    if (type === "mains_test") return "Mains Subjective Test";
    return type.replace(/_/g, " ");
  };

  if (!isInitialized) {
    return (
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 flex flex-col items-center justify-center py-20 gap-3">
        <span className="text-sm font-semibold text-ink/50">Loading result review...</span>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h1 className="text-2xl font-black text-ink">Sign in to review</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Result reports are private to your account.</p>
          <div className="mt-5">
            <SignInPanel />
          </div>
        </section>
      </main>
    );
  }

  if (!review) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <p className="rounded-2xl border border-line bg-surface p-6 text-sm font-semibold text-muted">
          {message ?? "Loading result…"}
        </p>
      </main>
    );
  }

  const weakTopics = (review.topic_breakdowns ?? []).filter((t) => Number(t.accuracy) < 0.6);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <main className="mx-auto max-w-7xl space-y-5 px-4 pt-5">
        {/* Back button */}
        <Link className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700" href="/study-plans">
          <ArrowLeft className="h-4 w-4" />
          Back to Study Plans
        </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface px-5 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
            Study Plan Test Result Review
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <h1 className="text-xl font-black leading-snug text-slate-900 md:text-2xl">
              {review.test_template.title}
            </h1>
            <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider border ${
              review.test_template.test_type === "mains_test"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : review.test_template.test_type === "csat_test"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {testTypeLabel(review.test_template.test_type)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-card">
        <TabButton active={tab === "summary"} onClick={() => setTab("summary")}>
          <Trophy className="h-4 w-4" aria-hidden="true" />
          Summary
        </TabButton>
        <TabButton active={tab === "questions"} onClick={() => setTab("questions")}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Questions ({review.questions.length})
        </TabButton>
        <TabButton active={tab === "topics"} onClick={() => setTab("topics")}>
          <Target className="h-4 w-4" aria-hidden="true" />
          Topics
        </TabButton>
        <TabButton active={tab === "time"} onClick={() => setTab("time")}>
          <Clock3 className="h-4 w-4" aria-hidden="true" />
          Time Analysis
        </TabButton>
      </div>

      {/* ── Tab: Summary ──────────────────────────────── */}
      {tab === "summary" && (
        <div className="tab-content space-y-5">
          <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
            {/* Score gauge */}
            <div className="flex items-center justify-center rounded-2xl border border-line bg-surface p-8 shadow-card">
              <ScoreGauge score={Number(review.score)} maxScore={Number(review.max_score)} />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              {[
                { label: "Score", value: `${formatMarks(review.score)} / ${formatMarks(review.max_score)}`, icon: "🎯" },
                { label: "Accuracy", value: formatPercent(review.accuracy), icon: "📊" },
                { label: "Correct", value: review.correct_count, icon: "✅" },
                { label: "Incorrect", value: review.incorrect_count, icon: "❌" },
                { label: "Unattempted", value: review.unattempted_count, icon: "⬜" },
                { label: "Negative", value: `-${formatMarks(review.negative_marks)}`, icon: "⚠️" },
              ].map(({ label, value, icon }) => (
                <div key={label} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4 shadow-card">
                  <span className="text-base">{icon}</span>
                  <span className="mt-1 text-xl font-black text-ink">{value}</span>
                  <span className="text-xs font-semibold text-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Weak topics summary */}
          {weakTopics.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-base font-black text-ink">
                <Target className="h-4 w-4 text-berry" aria-hidden="true" />
                Priority Revision Areas
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {weakTopics.slice(0, 4).map((topic) => (
                  <div
                    key={`${topic.taxonomy_name}-${topic.question_nature_name}`}
                    className="flex items-start gap-3 rounded-2xl border border-berry/15 bg-berry/5 p-4"
                  >
                    <span className="mt-0.5 text-lg">🔴</span>
                    <div>
                      <p className="text-sm font-bold text-ink">{topic.taxonomy_name ?? "Unmapped"}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatPercent(topic.accuracy)} accuracy · {topic.total_questions} questions
                      </p>
                      <p className="mt-1.5 text-xs leading-5 text-muted">
                        Revise this topic before your next test.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Questions ─────────────────────────────── */}
      {tab === "questions" && (
        <div className="tab-content space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3 shadow-card">
            <Filter className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            {(["all", "correct", "incorrect", "unattempted"] as QuestionFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setQFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-all ${
                  qFilter === f
                    ? f === "correct"
                      ? "bg-emerald-600 text-white"
                      : f === "incorrect"
                        ? "bg-rose-600 text-white"
                        : "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f} ({f === "all"
                  ? review.questions.length
                  : f === "correct"
                    ? review.correct_count
                    : f === "incorrect"
                      ? review.incorrect_count
                      : review.unattempted_count})
              </button>
            ))}
          </div>

          <div className="grid gap-4">
            {groupedItems.map((item, groupIdx) => {
              if (item.type === "independent") {
                const { question, originalIndex } = item;
                const outcome = question.score_item?.outcome;
                const selected = selectedAnswerKey(
                  question.response?.selected_answer ?? question.score_item?.selected_answer
                );
                const correct = selectedAnswerKey(
                  question.correct_answer ?? question.score_item?.correct_answer
                );
                const timeSpent = question.score_item?.time_spent_seconds ?? 0;

                return (
                  <article
                    key={question.id}
                    className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft"
                  >
                    {/* Question header */}
                    <div className="flex items-center justify-between gap-3 border-b border-line/50 bg-paper px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${outcomeClass(outcome)}`}>
                          {outcomeLabel(outcome)}
                        </span>
                        <span className="text-xs font-semibold text-muted">
                          Q{originalIndex + 1}
                        </span>
                        {timeSpent > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-muted">
                            <Clock3 className="h-3 w-3" aria-hidden="true" />
                            {Math.round(Number(timeSpent))}s
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-black text-ink">
                        {formatMarks(question.score_item?.score)} pts
                      </span>
                    </div>

                    {/* Question body */}
                    <div className="p-4">
                      <h3 className="text-sm font-bold leading-snug text-ink md:text-base">
                        {question.question_statement}
                      </h3>
                      {question.supplementary_statement && (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                          {question.supplementary_statement}
                        </p>
                      )}
                      {question.question_prompt && (
                        <p className="mt-2 text-sm font-bold text-ink">
                          {question.question_prompt}
                        </p>
                      )}

                      {/* Options */}
                      <div className="mt-4 grid gap-2">
                        {question.options.map((option, optIndex) => {
                          const key = optionKey(option, optIndex);
                          const isSelected = selected === key;
                          const isCorrect = correct === key;
                          return (
                            <div
                              key={`${question.id}-${key}`}
                              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm leading-6 transition-colors ${
                                isCorrect
                                  ? "border-emerald/40 bg-emerald/8"
                                  : isSelected
                                    ? "border-berry/40 bg-berry/8"
                                    : "border-line bg-paper/50"
                              }`}
                            >
                              <span
                                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black ${
                                  isCorrect
                                    ? "bg-emerald text-white"
                                    : isSelected
                                      ? "bg-berry text-white"
                                      : "bg-paper text-ink"
                                }`}
                              >
                                {key}
                              </span>
                              <span className="flex-1 text-ink">{optionText(option, optIndex)}</span>
                              {isCorrect && (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald" aria-hidden="true" />
                              )}
                              {isSelected && !isCorrect && (
                                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-berry" aria-hidden="true" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {question.explanation && (
                        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                          <p className="flex items-center gap-2 text-xs font-bold text-indigo-600">
                            <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                            Explanation
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                            {question.explanation}
                          </p>
                        </div>
                      )}

                      {/* Error tagger */}
                      <ErrorTagger questionId={question.id} />
                    </div>
                  </article>
                );
              } else {
                const { passage, questions } = item;
                return (
                  <article
                    key={`passage-group-${groupIdx}`}
                    className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft"
                  >
                    <div className="bg-paper border-b border-line/50 px-4 py-2 text-xs font-black text-muted uppercase tracking-wider">
                      Passage-Based Question Group
                    </div>

                    <div className="p-4 space-y-6">
                      <aside className="rounded-xl border border-line bg-paper p-4">
                        {passage.title && (
                          <h3 className="text-sm font-black text-ink">{passage.title}</h3>
                        )}
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                          {passage.body}
                        </p>
                      </aside>

                      <div className="space-y-6 divide-y divide-line/60">
                        {questions.map(({ question: q, originalIndex }, subIdx) => {
                          const outcome = q.score_item?.outcome;
                          const selected = selectedAnswerKey(
                            q.response?.selected_answer ?? q.score_item?.selected_answer
                          );
                          const correct = selectedAnswerKey(
                            q.correct_answer ?? q.score_item?.correct_answer
                          );
                          const timeSpent = q.response?.time_spent_seconds ?? q.score_item?.time_spent_seconds ?? 0;

                          return (
                            <div key={q.id} className={subIdx > 0 ? "pt-6" : ""}>
                              <div className="flex flex-wrap items-center justify-between gap-3 bg-paper/50 rounded-xl border border-line/50 px-3.5 py-2 mb-4">
                                <div className="flex items-center gap-2">
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${outcomeClass(outcome)}`}>
                                    {outcomeLabel(outcome)}
                                  </span>
                                  <span className="text-xs font-semibold text-muted">
                                    Q{originalIndex + 1}
                                  </span>
                                  {timeSpent > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] text-muted">
                                      <Clock3 className="h-3 w-3" aria-hidden="true" />
                                      {Math.round(Number(timeSpent))}s
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs font-black text-ink">
                                  {formatMarks(q.score_item?.score)} pts
                                </span>
                              </div>

                              <h3 className="text-sm font-bold leading-snug text-ink md:text-base">
                                {q.question_statement}
                              </h3>
                              {q.supplementary_statement && (
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                                  {q.supplementary_statement}
                                </p>
                              )}
                              {q.question_prompt && (
                                <p className="mt-2 text-sm font-bold text-ink">
                                  {q.question_prompt}
                                </p>
                              )}

                              <div className="mt-4 grid gap-2">
                                {q.options.map((option, optIndex) => {
                                  const key = optionKey(option, optIndex);
                                  const isSelected = selected === key;
                                  const isCorrect = correct === key;
                                  return (
                                    <div
                                      key={`${q.id}-${key}`}
                                      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm leading-6 transition-colors ${
                                        isCorrect
                                          ? "border-emerald-200 bg-emerald-50/50"
                                          : isSelected
                                            ? "border-rose-250 bg-rose-50/50"
                                            : "border-slate-200 bg-slate-50/30"
                                      }`}
                                    >
                                      <span
                                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                                          isCorrect
                                            ? "bg-emerald-600 text-white"
                                            : isSelected
                                              ? "bg-rose-600 text-white"
                                              : "bg-slate-100 text-slate-600"
                                        }`}
                                      >
                                        {key}
                                      </span>
                                      <span className="flex-1 text-slate-800">{optionText(option, optIndex)}</span>
                                      {isCorrect && (
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                                      )}
                                      {isSelected && !isCorrect && (
                                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {q.explanation && (
                                <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                                  <p className="flex items-center gap-2 text-xs font-bold text-indigo-600">
                                    <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                                    Explanation
                                  </p>
                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                    {q.explanation}
                                  </p>
                                </div>
                              )}

                              <ErrorTagger questionId={q.id} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              }
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Topics ───────────────────────────────── */}
      {tab === "topics" && (
        <div className="tab-content">
          <TopicHeatmap topics={review.topic_breakdowns ?? []} />
        </div>
      )}

      {/* ── Tab: Time ─────────────────────────────────── */}
      {tab === "time" && (
        <div className="tab-content">
          <TimeChart
            questions={review.questions as any}
            durationMinutes={review.test_template.duration_minutes}
          />
        </div>
      )}
      </main>
    </div>
  );
}
