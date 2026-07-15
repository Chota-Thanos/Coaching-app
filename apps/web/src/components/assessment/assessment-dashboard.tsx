"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  BookOpen,
  ExternalLink,
  ArrowUpRight,
  Layers3,
  Activity
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { authenticatedGet, useAuth } from "../auth/auth-context";
import { SignInPanel } from "../auth/sign-in-panel";
import { TrendGraph } from "./trend-graph";

// Formatting Helpers
function formatMarks(value: any): string {
  if (value === undefined || value === null) return "0.0";
  const num = Number(value);
  return isNaN(num) ? "0.0" : num.toFixed(1);
}

function formatPercent(value: any): string {
  if (value === undefined || value === null) return "0%";
  const num = Number(value);
  if (isNaN(num)) return "0%";
  const pct = num <= 1 ? Math.round(num * 100) : Math.round(num);
  return `${pct}%`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDateShort(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}

function AccuracyPill({ value }: { value: number | string }) {
  const n = Number(value ?? 0);
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  const color = pct >= 70 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : pct >= 40 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-rose-50 text-rose-700 border-rose-200";
  const Icon = pct >= 70 ? TrendingUp : pct >= 40 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${color}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {pct}% Accuracy
    </span>
  );
}

// Custom Trend Graph for Mains Subjective
function MainsTrendGraph({ trend }: { trend: any[] }) {
  if (!trend || trend.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl bg-slate-50 border border-dashed border-slate-200">
        <p className="text-xs text-slate-400">Submit more Mains questions to see your trend.</p>
      </div>
    );
  }

  const points = trend.slice(-10);
  const maxScore = 15; // standard scaling

  return (
    <div className="space-y-3">
      {/* Bars */}
      <div className="flex h-32 items-end gap-2 pt-2">
        {points.map((point, i) => {
          const score = Number(point.avg_score ?? 0);
          const scorePct = Math.min(100, Math.round((score / maxScore) * 100));
          const isLast = i === points.length - 1;
          const barColor =
            scorePct >= 55 ? "bg-emerald-500" : scorePct >= 40 ? "bg-amber-500" : "bg-rose-500";

          return (
            <div key={point.result_date} className="group relative flex flex-1 flex-col items-center justify-end h-full">
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full mb-1.5 hidden rounded-lg bg-slate-900 px-2 py-1 text-center group-hover:block z-10 shadow-md">
                <p className="text-[10px] font-black text-white">{score.toFixed(1)} / {maxScore}</p>
                <p className="text-[9px] text-slate-300 whitespace-nowrap">{point.attempts} paper{point.attempts !== 1 ? "s" : ""}</p>
              </div>

              {/* Bar */}
              <div
                className={`w-full rounded-t-md transition-all ${barColor} ${
                  isLast ? "opacity-100 ring-2 ring-offset-1 ring-rose-500/30" : "opacity-75 group-hover:opacity-100"
                }`}
                style={{ height: `${Math.max(scorePct, 8)}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Date labels */}
      <div className="flex gap-2">
        {points.map((point) => (
          <div key={point.result_date} className="flex-1 text-center">
            <p className="text-[9px] font-bold text-slate-400 leading-tight">
              {formatDateShort(point.result_date)}
            </p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-bold">
        <span className="flex items-center gap-1 text-emerald-700">
          <span className="h-2 w-3 rounded bg-emerald-500" /> Excellent (≥ 55%)
        </span>
        <span className="flex items-center gap-1 text-amber-700">
          <span className="h-2 w-3 rounded bg-amber-500" /> Average (40–55%)
        </span>
        <span className="flex items-center gap-1 text-rose-700">
          <span className="h-2 w-3 rounded bg-rose-500" /> Needs Work (&lt; 40%)
        </span>
      </div>
    </div>
  );
}

function marksPercent(score: any, maxScore: any, ratio?: any): number {
  const parsedRatio = Number(ratio);
  if (Number.isFinite(parsedRatio) && parsedRatio > 0) {
    return Math.max(0, Math.min(100, Math.round(parsedRatio <= 1 ? parsedRatio * 100 : parsedRatio)));
  }

  const parsedScore = Number(score ?? 0);
  const parsedMax = Number(maxScore ?? 15);
  if (!Number.isFinite(parsedScore) || !Number.isFinite(parsedMax) || parsedMax <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((parsedScore / parsedMax) * 100)));
}

function scoreTone(percent: number): string {
  if (percent >= 55) return "bg-emerald-500";
  if (percent >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function formatNodeType(value: any): string {
  return String(value ?? "category").replaceAll("_", " ");
}

function MainsCategoryTrendSection({ categories }: { categories: any[] }) {
  const items = Array.isArray(categories) ? categories.slice(0, 8) : [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-900">
            <Activity className="h-4.5 w-4.5 text-indigo-600" aria-hidden="true" />
            Category marks trend
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Mains scores grouped by paper, subject area, theme, topic, and subtopic.
          </p>
        </div>
        <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
          Evaluated only
        </span>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <BookOpen className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-slate-900">No category trend yet.</p>
          <p className="mt-1 text-xs text-slate-500">It appears after evaluated Mains answers are mapped to syllabus categories.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {items.map((category) => {
            const trend = Array.isArray(category.trend) ? category.trend.slice(-6) : [];
            const avgPercent = marksPercent(category.avg_score, category.avg_max_score, category.avg_score_ratio);
            const latestPercent = marksPercent(category.latest_score, category.latest_max_score);
            const barColor = scoreTone(avgPercent);

            return (
              <div
                key={`${category.node_type}-${category.category_id}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{category.category_name ?? "Unmapped category"}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {formatNodeType(category.node_type)} • {category.attempts ?? 0} answer{Number(category.attempts ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-700">
                    {avgPercent}%
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="font-black text-slate-900">{formatMarks(category.avg_score)} / {formatMarks(category.avg_max_score || 15)}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Average</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="font-black text-slate-900">{formatMarks(category.latest_score)} / {formatMarks(category.latest_max_score || 15)}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Latest</p>
                  </div>
                </div>

                <div className="mt-4 flex h-16 items-end gap-1.5">
                  {trend.length === 0 ? (
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-50 text-[10px] font-bold text-slate-400">
                      No dated trend
                    </div>
                  ) : (
                    trend.map((point: any) => {
                      const pointPercent = marksPercent(point.avg_score, point.avg_max_score, point.avg_score_ratio);
                      return (
                        <div key={point.result_date} className="group relative flex flex-1 flex-col items-center justify-end h-full">
                          <div className="pointer-events-none absolute bottom-full mb-1.5 hidden rounded-lg bg-slate-900 px-2 py-1 text-center shadow-md group-hover:block">
                            <p className="text-[10px] font-black text-white">{formatMarks(point.avg_score)} / {formatMarks(point.avg_max_score || 15)}</p>
                            <p className="whitespace-nowrap text-[9px] text-slate-300">{formatDateShort(point.result_date)}</p>
                          </div>
                          <div
                            className={`w-full rounded-t ${scoreTone(pointPercent)} opacity-80 transition-opacity group-hover:opacity-100`}
                            style={{ height: `${Math.max(8, pointPercent)}%` }}
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(4, latestPercent)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MainsMistakesPanel({ mistakes }: { mistakes: any[] }) {
  const items = Array.isArray(mistakes) ? mistakes.slice(0, 8) : [];

  return (
    <section className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-900">
        <AlertCircle className="h-4.5 w-4.5 text-rose-600" aria-hidden="true" />
        Consistent mistakes
      </h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        Repeated evaluator weakness notes across evaluated answers.
      </p>

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-xs font-bold text-slate-500">
            Recurring mistakes appear after at least two evaluated answers share the same weakness.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((mistake, index) => {
            const percent = marksPercent(mistake.avg_score, mistake.avg_max_score, mistake.avg_score_ratio);
            const categories = Array.isArray(mistake.categories) ? mistake.categories.filter(Boolean).slice(0, 3) : [];

            return (
              <div key={`${mistake.normalized_mistake}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-rose-50 text-[10px] font-black text-rose-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black leading-snug text-slate-900">{mistake.mistake}</p>
                    <p className="mt-1 text-[10px] font-bold text-slate-500">
                      Seen {mistake.occurrence_count ?? 0} times in {mistake.answer_count ?? 0} answers
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                    <div className={`h-full rounded-full ${scoreTone(percent)}`} style={{ width: `${Math.max(4, percent)}%` }} />
                  </div>
                  <span className="text-[10px] font-black text-slate-500">
                    {formatMarks(mistake.avg_score)} avg
                  </span>
                </div>

                {categories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {categories.map((name: string, idx: number) => (
                      <span key={`${name}-${idx}`} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface AssessmentDashboardProps {
  contentTypeFilter?: "gk" | "aptitude" | "mains";
}

export function AssessmentDashboard({ contentTypeFilter }: AssessmentDashboardProps = {}) {
  const { token, isInitialized } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as "gk" | "aptitude" | "mains";
  const [activeTab, setActiveTab] = useState<"gk" | "aptitude" | "mains">(
    contentTypeFilter ?? ((tabParam && ["gk", "aptitude", "mains"].includes(tabParam)) ? tabParam : "gk")
  );

  useEffect(() => {
    if (contentTypeFilter) {
      setActiveTab(contentTypeFilter);
      return;
    }
    const tabParam = searchParams.get("tab") as "gk" | "aptitude" | "mains";
    if (tabParam && ["gk", "aptitude", "mains"].includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams, activeTab, contentTypeFilter]);
  
  // Dashboard overall structure (GK, Aptitude, Mains compiled)
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  
  // Attempts list specifically for current tab
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);
  const [mainsAnswers, setMainsAnswers] = useState<any[]>([]);
  const [topicMetrics, setTopicMetrics] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      // 1. Fetch unified segmented dashboard stats
      const stats = await authenticatedGet<any>("/api/v1/assessment/me/dashboard", token);
      setDashboardData(stats);
      const metrics = await authenticatedGet<any[]>("/api/v1/assessment/me/topic-metrics", token);
      setTopicMetrics(metrics || []);

      // 2. Load attempts depending on activeTab
      if (activeTab === "mains") {
        const mainsList = await authenticatedGet<any[]>("/api/v1/assessment/mains/my-answers", token);
        setMainsAnswers(mainsList || []);
      } else {
        const mcqList = await authenticatedGet<any[]>(
          `/api/v1/assessment/me/attempts?limit=15&content_type=${activeTab}`,
          token
        );
        setRecentAttempts(mcqList || []);
      }
    } catch (err) {
      console.error(err);
      setMessage("Could not load your assessment progress details.");
    } finally {
      setLoading(false);
    }
  }, [token, activeTab]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 py-10">
        <main className="mx-auto max-w-3xl px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            <p className="text-sm font-semibold text-slate-400">Verifying session...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 py-10">
        <main className="mx-auto max-w-3xl px-4">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-indigo-600 to-emerald-500" />
            <div className="p-6 md:p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl">
                📊
              </div>
              <h1 className="text-2xl font-black text-slate-900 leading-tight">Your scorecard is waiting</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                Sign in to see your full attempt history, topic-wise accuracy trends, and weak-area heatmap — all saved to your account.
              </p>
              <div className="mx-auto mt-6 max-w-sm text-left">
                <SignInPanel />
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // Pick data matching active tab
  const currentTabStats = dashboardData ? dashboardData[activeTab] : null;
  const activeTopicMetrics = topicMetrics
    .filter((topic) => topic.content_type === activeTab && Number(topic.question_count ?? 0) > 0)
    .sort((a, b) => Number(a.avg_accuracy ?? 0) - Number(b.avg_accuracy ?? 0));

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-0.5">
      <main className="mx-auto max-w-7xl space-y-6 px-4 pt-5">
        {/* ── Top Dashboard Header ── */}
        {!contentTypeFilter && (
          <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-indigo-650">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Performance Radar
              </p>
              <h1 className="mt-1 text-2xl font-black leading-tight text-slate-900 md:text-3.5xl">Student Scorecard</h1>
              <p className="mt-1 text-sm text-slate-500">Explore complete subject reviews, identify weak areas, and evaluate Mains answers.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-60 hover:bg-slate-50"
                disabled={loading}
                onClick={loadData}
                type="button"
              >
                <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh Data
              </button>
              <Link
                href="/assessment"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm transition-colors"
              >
                <Zap className="h-4 w-4" />
                New Assessment
              </Link>
            </div>
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {message}
          </div>
        )}

        {/* ── Section Specific Tabs (GK, CSAT, Mains) ── */}
        {!contentTypeFilter && (
          <div className="flex gap-1 rounded-xl bg-slate-200/60 border border-slate-300/40 p-1.5 max-w-md shadow-sm">
            <Link
              className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all ${
                activeTab === "gk"
                  ? "bg-slate-900 text-white shadow-sm font-extrabold"
                  : "text-slate-650 hover:bg-white/50 hover:text-slate-900"
              }`}
              href="/assessment/dashboard?tab=gk"
            >
              GK Prelims
            </Link>
            <Link
              className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all ${
                activeTab === "aptitude"
                  ? "bg-slate-900 text-white shadow-sm font-extrabold"
                  : "text-slate-650 hover:bg-white/50 hover:text-slate-900"
              }`}
              href="/assessment/dashboard?tab=aptitude"
            >
              CSAT / Aptitude
            </Link>
            <Link
              className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all ${
                activeTab === "mains"
                  ? "bg-slate-900 text-white shadow-sm font-extrabold"
                  : "text-slate-650 hover:bg-white/50 hover:text-slate-900"
              }`}
              href="/assessment/dashboard?tab=mains"
            >
              UPSC Mains
            </Link>
          </div>
        )}

      {/* ── Tabbed View Dashboard Data ── */}
      {dashboardData && currentTabStats ? (
        <div className="space-y-6">
          
          {/* Summary Scorecard Grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {activeTab === "mains" ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xl">✍️</span>
                  <p className="mt-2 text-2xl font-black text-slate-900">{currentTabStats.summary.attempts}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-wide">Total Answers Written</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xl">✅</span>
                  <p className="mt-2 text-2xl font-black text-slate-900">{currentTabStats.summary.evaluated_count}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-wide">Evaluated Answers</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xl">⏳</span>
                  <p className="mt-2 text-2xl font-black text-slate-900">{currentTabStats.summary.pending_count}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-wide">Pending Evaluation</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xl">📈</span>
                  <p className="mt-2 text-2xl font-black text-slate-900">
                    {formatMarks(currentTabStats.summary.avg_score)} / 15
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-wide">Average Score</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xl">📋</span>
                  <p className="mt-2 text-2xl font-black text-slate-900">{currentTabStats.summary.attempts}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-wide">Tests Completed</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xl">🎯</span>
                  <p className="mt-2 text-2xl font-black text-slate-900">{formatMarks(currentTabStats.summary.avg_score)}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-wide">Average Score</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xl">📊</span>
                  <p className="mt-2 text-2xl font-black text-slate-900">{formatPercent(currentTabStats.summary.avg_accuracy)}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-wide">Average Accuracy</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4 justify-between">
                  <div>
                    <p className="text-2xl font-black text-slate-900">{currentTabStats.summary.correct_count}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Correct MCQs</p>
                  </div>
                  <div className="text-right border-l border-slate-100 pl-3">
                    <p className="text-sm font-extrabold text-rose-500">{currentTabStats.summary.incorrect_count}</p>
                    <p className="text-[10px] text-slate-400">Incorrect</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {activeTab !== "mains" && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-650">
                    <Layers3 className="h-4 w-4" aria-hidden="true" />
                    Category Performance Studio
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">Every attempted category becomes a review page</h2>
                  <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
                    Open any subject, topic, or subtopic to inspect the questions you attempted, outcome bars, and category-specific test history.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                  <p className="text-2xl font-black text-slate-950">{activeTopicMetrics.length}</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">attempted nodes</p>
                </div>
              </div>

              {activeTopicMetrics.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <Activity className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-900">No category attempts recorded yet.</p>
                  <p className="mt-1 text-xs text-slate-500">Complete a test and this area will become your category-wise improvement map.</p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {activeTopicMetrics.map((topic, idx) => {
                    const accuracy = Number(topic.avg_accuracy ?? 0);
                    const pct = accuracy <= 1 ? Math.round(accuracy * 100) : Math.round(accuracy);
                    const color =
                      pct >= 70
                        ? "from-emerald-500 to-teal-500"
                        : pct >= 40
                        ? "from-amber-500 to-orange-500"
                        : "from-rose-500 to-red-500";
                    const badge =
                      pct >= 70
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : pct >= 40
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-rose-50 text-rose-700 border-rose-200";

                    return (
                      <Link
                        key={`${topic.taxonomy_node_id}-${topic.question_nature_id ?? "all"}-${idx}`}
                        href={`/assessment/dashboard/categories/${topic.taxonomy_node_id}?tab=${activeTab}`}
                        className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950">{topic.taxonomy_name ?? "Unmapped Category"}</p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                              {(topic.node_type ?? "category").replaceAll("_", " ")}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${badge}`}>{pct}%</span>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
                        </div>
                        <div className="mt-4 flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-500">
                            {topic.correct_count ?? 0}/{topic.question_count ?? 0} correct-ready
                          </span>
                          <span className="inline-flex items-center gap-1 font-black text-indigo-600">
                            Open page <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            {/* Left side: Score Trend and Recent Attempts list */}
            <div className="space-y-6">
              
              {/* Trend Chart */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-wider">
                  <TrendingUp className="h-4.5 w-4.5 text-indigo-600" aria-hidden="true" />
                  Performance score trend
                </h2>
                {activeTab === "mains" ? (
                  <MainsTrendGraph trend={currentTabStats.trend} />
                ) : (
                  <TrendGraph trend={currentTabStats.trend} />
                )}
              </section>

              {activeTab === "mains" && (
                <MainsCategoryTrendSection categories={currentTabStats.category_trends ?? []} />
              )}
            </div>

            {/* Right side: Weakness Bank specific to active tab */}
            <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
              {activeTab === "mains" && (
                <MainsMistakesPanel mistakes={currentTabStats.consistent_mistakes ?? []} />
              )}

              <h2 className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-wider">
                <Target className="h-4.5 w-4.5 text-rose-600" aria-hidden="true" />
                Weakness Heatmap
              </h2>

              {currentTabStats.weak_topics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
                  <p className="text-2xl">🏆</p>
                  <p className="mt-2 text-xs font-bold text-slate-400 uppercase">Syllabus node strengths verified!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentTabStats.weak_topics.slice(0, 8).map((topic: any, i: number) => {
                    // GK / Aptitude checks accuracy percentage, Mains checks average score
                    const isMains = activeTab === "mains";
                    const score = Number(isMains ? topic.avg_score : topic.avg_accuracy ?? 0);
                    const pct = isMains ? Math.round((score / 15) * 100) : (score <= 1 ? Math.round(score * 100) : Math.round(score));
                    const severity = pct < 40 ? "rose" : pct < 55 ? "amber" : "slate";

                    return (
                      <div
                        key={`${topic.taxonomy_name}-${i}`}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm hover:border-slate-300 transition-colors"
                      >
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black ${
                          severity === "rose"
                            ? "bg-rose-50 text-rose-700 border border-rose-100"
                            : severity === "amber"
                            ? "bg-amber-50 text-amber-700 border border-amber-100"
                            : "bg-slate-50 text-slate-600"
                        }`}>
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-900">
                            {topic.taxonomy_name ?? "General Framework"}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`absolute inset-y-0 left-0 rounded-full ${
                                  severity === "rose" ? "bg-rose-500" : severity === "amber" ? "bg-amber-500" : "bg-slate-400"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">
                              {isMains ? `${score.toFixed(1)}/15` : `${pct}%`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <Link
                href={
                  activeTab === "aptitude"
                    ? "/assessment/csat?view=revision"
                    : activeTab === "mains"
                    ? "/assessment/mains-hub?view=revision"
                    : "/assessment/gk?view=revision"
                }
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm transition-colors mt-2"
              >
                Launch Revision Test
              </Link>
            </aside>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-400 flex flex-col items-center justify-center gap-2 animate-pulse">
          <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin" />
          <span>Synchronizing student metrics radar...</span>
        </div>
      )}
      </main>
    </div>
  );
}
