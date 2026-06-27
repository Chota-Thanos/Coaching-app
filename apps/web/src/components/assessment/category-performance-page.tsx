"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart3, CheckCircle2, Clock3, FileQuestion, Target, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { authenticatedGet, useAuth } from "../auth/auth-context";
import { SignInPanel } from "../auth/sign-in-panel";

type CategoryPerformancePageProps = {
  nodeId: string;
};

function numberValue(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function formatPercent(value: unknown): string {
  const raw = numberValue(value);
  const pct = raw <= 1 ? raw * 100 : raw;
  return `${Math.round(pct)}%`;
}

function accuracyTone(value: unknown): { text: string; bar: string; bg: string; border: string } {
  const raw = numberValue(value);
  const pct = raw <= 1 ? raw * 100 : raw;
  if (pct >= 70) return { text: "text-emerald-700", bar: "bg-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (pct >= 40) return { text: "text-amber-700", bar: "bg-amber-500", bg: "bg-amber-50", border: "border-amber-200" };
  return { text: "text-rose-700", bar: "bg-rose-500", bg: "bg-rose-50", border: "border-rose-200" };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not submitted";
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}

function outcomeConfig(outcome: string) {
  if (outcome === "correct") {
    return { label: "Correct", icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (outcome === "incorrect") {
    return { label: "Incorrect", icon: XCircle, className: "border-rose-200 bg-rose-50 text-rose-700" };
  }
  return { label: "Skipped", icon: FileQuestion, className: "border-slate-200 bg-slate-50 text-slate-500" };
}

function ChildCategoryCard({ child, backTab }: { child: any; backTab: string }) {
  const childSummary = child.summary || {};
  const accuracy = numberValue(childSummary.accuracy);
  const totalQs = numberValue(childSummary.total_questions);
  const tone = accuracyTone(accuracy);
  const pct = Math.round(accuracy <= 1 ? accuracy * 100 : accuracy);

  return (
    <Link
      href={`/assessment/dashboard/categories/${child.id}?tab=${backTab}`}
      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-650 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900 group-hover:text-indigo-600">{child.name}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
            {totalQs} question{totalQs !== 1 ? "s" : ""} attempted
          </p>
        </div>
        {totalQs > 0 ? (
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${tone.bg} ${tone.text} ${tone.border}`}>
            {pct}%
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-[9px] font-black text-slate-500">
            Unattempted
          </span>
        )}
      </div>
      {totalQs > 0 && (
        <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
        </div>
      )}
    </Link>
  );
}

export function CategoryPerformancePage({ nodeId }: CategoryPerformancePageProps) {
  const { token, isInitialized } = useAuth();
  const searchParams = useSearchParams();
  const backTab = searchParams.get("tab") ?? "gk";
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "correct" | "incorrect" | "unattempted">("all");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    authenticatedGet<any>(`/api/v1/assessment/me/categories/${nodeId}/performance`, token)
      .then(setData)
      .catch((err) => {
        console.error(err);
        setMessage("Could not load category performance.");
      })
      .finally(() => setLoading(false));
  }, [nodeId, token]);

  const summary = data?.summary ?? {};
  const category = data?.category ?? {};
  const questions = (data?.questions ?? []) as any[];
  const attempts = (data?.attempts ?? []) as any[];
  const filteredQuestions = useMemo(() => {
    if (filter === "all") return questions;
    return questions.filter((question) => (question.outcome ?? "unattempted") === filter);
  }, [filter, questions]);

  if (!isInitialized) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-center text-sm font-semibold text-slate-400">
        Loading session...
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-slate-900">Category Performance</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to inspect your category-wise attempts and question history.</p>
          <div className="mt-6">
            <SignInPanel />
          </div>
        </section>
      </main>
    );
  }

  const tone = accuracyTone(summary.accuracy);
  const correct = numberValue(summary.correct_count);
  const incorrect = numberValue(summary.incorrect_count);
  const skipped = numberValue(summary.unattempted_count);
  const total = numberValue(summary.total_questions);

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-7xl space-y-6 px-4 pt-5">
        <Link
          href={`/assessment/dashboard?tab=${backTab}`}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Performance Dashboard
        </Link>

        {message && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {message}
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-slate-900 bg-slate-950 text-white shadow-xl">
          <div className="bg-[radial-gradient(circle_at_top_right,_rgba(79,70,229,0.45),_transparent_30%),linear-gradient(135deg,#0f172a,#111827)] p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-200">
                  <Target className="h-4 w-4" aria-hidden="true" />
                  Category Performance Page
                </p>
                <h1 className="mt-3 text-3xl font-black leading-tight md:text-5xl">
                  {category.name ?? "Category"}
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300">
                  A complete record of questions attempted inside this category, including subtopics and lower-level nodes.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 md:min-w-96">
                <HeroMetric label="Accuracy" value={formatPercent(summary.accuracy)} />
                <HeroMetric label="Questions" value={String(total)} />
                <HeroMetric label="Attempts" value={String(numberValue(summary.attempts))} />
              </div>
            </div>
            <div className="mt-7 h-3 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(3, Math.min(100, numberValue(summary.accuracy) * 100))}%` }} />
            </div>
          </div>
        </section>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-400 shadow-sm">
            Loading category records...
          </div>
        )}

        {data && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-950">Outcome Split</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">Correct, incorrect, and skipped questions inside this category.</p>
                  </div>
                  <BarChart3 className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                </div>
                <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-100">
                  <div className="flex h-full">
                    {total === 0 ? (
                      <div className="h-full flex-1 bg-slate-200" />
                    ) : (
                      <>
                        {correct > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(correct / total) * 100}%` }} />}
                        {incorrect > 0 && <div className="h-full bg-rose-500" style={{ width: `${(incorrect / total) * 100}%` }} />}
                        {skipped > 0 && <div className="h-full bg-slate-400" style={{ width: `${(skipped / total) * 100}%` }} />}
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <OutcomeTile label="Correct" value={correct} className="border-emerald-200 bg-emerald-50 text-emerald-700" />
                  <OutcomeTile label="Incorrect" value={incorrect} className="border-rose-200 bg-rose-50 text-rose-700" />
                  <OutcomeTile label="Skipped" value={skipped} className="border-slate-200 bg-slate-50 text-slate-600" />
                </div>
              </section>

              {/* Subcategories breakdown */}
              {data.children && data.children.length > 0 && (() => {
                const strongTopics = data.children
                  .filter((c: any) => numberValue(c.summary?.total_questions) > 0 && numberValue(c.summary?.accuracy) >= 0.7)
                  .sort((a: any, b: any) => numberValue(b.summary?.accuracy) - numberValue(a.summary?.accuracy));

                const weakTopics = data.children
                  .filter((c: any) => numberValue(c.summary?.total_questions) > 0 && numberValue(c.summary?.accuracy) < 0.7)
                  .sort((a: any, b: any) => numberValue(b.summary?.accuracy) - numberValue(a.summary?.accuracy));

                const unattemptedTopics = data.children
                  .filter((c: any) => numberValue(c.summary?.total_questions) === 0)
                  .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));

                return (
                  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-6">
                    <div>
                      <h2 className="text-lg font-black text-slate-950">Subcategory Performance</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        Detailed analysis of lower-level categories, sorted from strongest to weakest.
                      </p>
                    </div>

                    {/* Strong Topics */}
                    {strongTopics.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Strong Areas (Accuracy &ge; 70%)</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {strongTopics.map((child: any) => (
                            <ChildCategoryCard key={child.id} child={child} backTab={backTab} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Weak Topics */}
                    {weakTopics.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                          <Target className="h-4 w-4 text-amber-600" />
                          <span>Weak Areas / Needs Improvement (Accuracy &lt; 70%)</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {weakTopics.map((child: any) => (
                            <ChildCategoryCard key={child.id} child={child} backTab={backTab} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unattempted Topics */}
                    {unattemptedTopics.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                          <FileQuestion className="h-4 w-4" />
                          <span>Unattempted Topics</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {unattemptedTopics.map((child: any) => (
                            <ChildCategoryCard key={child.id} child={child} backTab={backTab} />
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })()}

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-slate-950">Question Record</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">Every question attempted in this category at any level.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["all", `All (${total})`],
                      ["correct", `Correct (${correct})`],
                      ["incorrect", `Incorrect (${incorrect})`],
                      ["unattempted", `Skipped (${skipped})`]
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFilter(value as typeof filter)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                          filter === value
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {filteredQuestions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-400">
                      No questions match this filter.
                    </div>
                  ) : (
                    filteredQuestions.map((question) => {
                      const outcome = outcomeConfig(question.outcome ?? "unattempted");
                      const Icon = outcome.icon;
                      return (
                        <article key={`${question.attempt_id}-${question.question_version_id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black ${outcome.className}`}>
                              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              {outcome.label}
                            </span>
                            <span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500">
                              {formatDate(question.submitted_at)}
                            </span>
                            {question.topic_name && (
                              <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">
                                {question.topic_name}
                              </span>
                            )}
                          </div>
                          <h3 className="mt-3 text-sm font-bold leading-6 text-slate-950">{question.question_statement}</h3>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                            <span>{question.test_title}</span>
                            <span>{numberValue(question.score).toFixed(1)} marks</span>
                            <span>{numberValue(question.time_spent_seconds)}s</span>
                            {question.subtopic_name && <span>{question.subtopic_name}</span>}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">Attempt Bars</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Category accuracy inside each submitted test.</p>
                <div className="mt-5 space-y-4">
                  {attempts.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-400">No attempt bars available.</p>
                  ) : (
                    attempts.slice(0, 12).map((attempt) => {
                      const attemptTone = accuracyTone(attempt.accuracy);
                      const pct = Math.round(numberValue(attempt.accuracy) * 100);
                      return (
                        <div key={attempt.attempt_id}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-xs font-black text-slate-900">{attempt.test_title}</p>
                            <span className={`text-xs font-black ${attemptTone.text}`}>{pct}%</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${attemptTone.bar}`} style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">Improvement Focus</h2>
                <div className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
                  <p className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 h-4 w-4 text-amber-500" aria-hidden="true" />
                    Average time: {Math.round(numberValue(summary.avg_time_seconds))}s/question
                  </p>
                  <p className="flex items-start gap-2">
                    <Target className="mt-0.5 h-4 w-4 text-rose-500" aria-hidden="true" />
                    Re-attempt incorrect and skipped questions before increasing difficulty.
                  </p>
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-center">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-300">{label}</p>
    </div>
  );
}

function OutcomeTile({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wider opacity-80">{label}</p>
    </div>
  );
}
