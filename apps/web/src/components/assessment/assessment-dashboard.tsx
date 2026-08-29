"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
  Layers3,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Zap
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authenticatedGet, useAuth } from "../auth/auth-context";
import { SignInPanel } from "../auth/sign-in-panel";
import { PerformanceChart, type ChartPoint } from "./performance-chart";
import { PerformanceTree, flattenPerformanceTree, type PerformanceTreeNode } from "./performance-tree";
import { StartTestPill, useFreeTestsRemainingLabel } from "./start-test-pill";
import { useSubscription } from "../../lib/use-subscription";
import { tierAwareQuestionCount } from "../../lib/subscription-plans";
import type { StartTestCategory } from "../../lib/use-start-test";
import { FullTourSegment } from "../app/full-tour-segment";
import { isFullTourActiveForPage } from "../../lib/full-tour";

type ContentTab = "gk" | "aptitude" | "mains";
/** Objective tabs and Mains show different third views over the same shell. */
type DashboardView = "focus" | "syllabus" | "history" | "categories" | "answers";

/**
 * Walks a flattened performance-tree list (subject -> source_bucket -> topic
 * -> subtopic, all sharing one id space with student_topic_metrics) up from
 * any node to classify each ancestor by node_type. Used to turn "the user
 * clicked/is looking at node 4821" into the {subject_node_id, source_node_id,
 * topic_node_id, subtopic_node_id} shape /attempts/compiled expects.
 */
function resolveNodeScope(
  nodeId: number,
  byId: Map<number, PerformanceTreeNode>
): Pick<StartTestCategory, "subject_node_id" | "source_node_id" | "topic_node_id" | "subtopic_node_id"> {
  let subject: number | null = null;
  let source: number | null = null;
  let topic: number | null = null;
  let subtopic: number | null = null;
  let current: PerformanceTreeNode | undefined = byId.get(nodeId);
  let guard = 0;
  while (current && guard++ < 8) {
    if (current.node_type === "subtopic") subtopic = current.id;
    else if (current.node_type === "topic") topic = current.id;
    else if (current.node_type === "source_bucket") source = current.id;
    else if (current.node_type === "subject") subject = current.id;
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  // A node this cannot classify (not found in the tree, or missing a
  // node_type) still needs SOME subject_node_id to satisfy the request shape
  // — falling back to the node's own id keeps the request well-formed rather
  // than silently dropping the scope down to "everything".
  return { subject_node_id: subject ?? nodeId, source_node_id: source, topic_node_id: topic, subtopic_node_id: subtopic };
}

/** "Polity › Laxmikanth" — the ancestors of a node, nearest root first. */
function nodePath(node: PerformanceTreeNode, byId: Map<number, PerformanceTreeNode>): string {
  const names: string[] = [];
  let current = node.parent_id ? byId.get(node.parent_id) : undefined;
  let guard = 0;
  while (current && guard++ < 8) {
    names.unshift(current.name);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return names.join(" › ");
}

const DASHBOARD_TOUR_STEPS = [
  {
    selector: "#tour-dashboard-header",
    badge: "Tour · Step 11 of 12",
    title: "Your Performance Dashboard",
    body: "This is your scorecard — it tracks every test you've taken. Your accuracy trend, the topics to fix next, and subject-wise breakdowns all live here.",
  },
  {
    selector: "#tour-dashboard-new-test",
    badge: "Tour · Step 12 of 12",
    title: "Tour Complete!",
    body: "You've seen the full flow: Create a custom test → Take it → Review results → Track progress. Keep practicing daily here. Click 'Finish' to close the tour.",
  },
];

// ── Formatting ──────────────────────────────────────────────────────────────

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMarks(value: unknown): string {
  return toNumber(value).toFixed(1);
}

/** Accepts either a 0-1 ratio or an already-scaled 0-100 percentage. */
function toPercent(value: unknown): number {
  const num = toNumber(value);
  return Math.round(num <= 1 ? num * 100 : num);
}

function formatDateShort(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDateLong(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}

type Band = "good" | "warn" | "bad";

/** Objective accuracy bands — the 70/40 split the whole app colours by. */
function accuracyBand(percent: number): Band {
  return percent >= 70 ? "good" : percent >= 40 ? "warn" : "bad";
}

/** Mains marks bands — 55% of the paper's max is a strong answer, not 70%. */
function marksBand(percent: number): Band {
  return percent >= 55 ? "good" : percent >= 40 ? "warn" : "bad";
}

const BAND_BAR: Record<Band, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500"
};

const BAND_TEXT: Record<Band, string> = {
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-rose-600"
};

/** Marks as a share of the paper's maximum, tolerating a missing max_score. */
function marksPercent(score: unknown, maxScore: unknown, ratio?: unknown): number {
  const parsedRatio = Number(ratio);
  if (Number.isFinite(parsedRatio) && parsedRatio > 0) {
    return Math.max(0, Math.min(100, Math.round(parsedRatio <= 1 ? parsedRatio * 100 : parsedRatio)));
  }
  const parsedScore = toNumber(score);
  const parsedMax = toNumber(maxScore, 15);
  if (parsedMax <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((parsedScore / parsedMax) * 100)));
}

/**
 * How far the series has moved, and over how many days. The old page showed a
 * bare average with no sense of direction; this is what turns "62%" into
 * "62%, up 8 points". Anchors on the earliest point inside the last 30 days so
 * the number means something recent, falling back to the whole series for an
 * account that tests less often than that.
 */
function computeDelta(trend: any[], valueOf: (point: any) => number): { delta: number; days: number } | null {
  if (!Array.isArray(trend) || trend.length < 2) return null;
  const sorted = [...trend]
    .filter((point) => point?.result_date)
    .sort((a, b) => new Date(a.result_date).getTime() - new Date(b.result_date).getTime());
  if (sorted.length < 2) return null;

  const latest = sorted[sorted.length - 1];
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = sorted.filter((point) => new Date(point.result_date).getTime() >= cutoff);
  const baseline = recent.length >= 2 ? recent[0] : sorted[0];

  const days = Math.max(
    1,
    Math.round((new Date(latest.result_date).getTime() - new Date(baseline.result_date).getTime()) / (24 * 60 * 60 * 1000))
  );
  return { delta: valueOf(latest) - valueOf(baseline), days };
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// ── Shared pieces ───────────────────────────────────────────────────────────

function DeltaPill({ delta, days, unit }: { delta: number; days: number; unit: string }) {
  const rounded = Math.round(delta * 10) / 10;
  const flat = Math.abs(rounded) < 0.1;
  const tone = flat
    ? "border-slate-200 bg-slate-50 text-slate-500"
    : rounded > 0
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-rose-200 bg-rose-50 text-rose-700";
  const Icon = rounded >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${tone}`}>
      {!flat && <Icon className="h-3 w-3" aria-hidden="true" />}
      {flat ? "No change" : `${rounded > 0 ? "+" : ""}${rounded} ${unit}`} · {days}d
    </span>
  );
}

function StatCell({ value, label, tone }: { value: React.ReactNode; label: string; tone?: string }) {
  return (
    <div className="px-4 py-3">
      <p className={`text-lg font-black tabular-nums leading-tight ${tone ?? "text-slate-900"}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}

function ViewTab({
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
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
        active ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function Meter({ percent, band }: { percent: number; band: Band }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${BAND_BAR[band]}`} style={{ width: `${Math.max(3, Math.min(100, percent))}%` }} />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border-t border-slate-100 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-slate-400">{message}</p>
    </div>
  );
}

type BreakdownRow = {
  key: string;
  name: string;
  /** Subject a book belongs to, or the paper a theme sits in. */
  caption?: string | null;
  /** "142 / 302" for objective, "7 answers" for Mains. */
  countLabel: string;
  percent: number;
  band: Band;
  /** What the accuracy column prints — a percentage or a mark out of 15. */
  display: string;
  href?: string;
  action?: React.ReactNode;
};

/**
 * The subject/source (and, on Mains, paper/theme) breakdowns. The old page had
 * a book list but never a subject list, and rendered the book list as loose
 * flex rows where the numbers never lined up; a real table with tabular
 * numerals makes the columns comparable down the page.
 */
function BreakdownTable({
  title,
  hint,
  countHeading,
  valueHeading,
  rows,
  emptyMessage,
  icon
}: {
  title: string;
  hint: string;
  countHeading: string;
  valueHeading: string;
  rows: BreakdownRow[];
  emptyMessage: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
          {icon}
          {title}
        </h2>
        <p className="mt-0.5 text-xs font-medium text-slate-500">{hint}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">{title.replace("By ", "")}</th>
                <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">{countHeading}</th>
                <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">{valueHeading}</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    {row.href ? (
                      <Link href={row.href} className="text-[13px] font-bold text-slate-900 hover:text-indigo-600">
                        {row.name}
                      </Link>
                    ) : (
                      <span className="text-[13px] font-bold text-slate-900">{row.name}</span>
                    )}
                    {row.caption && (
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{row.caption}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-[11px] font-bold tabular-nums text-slate-500">
                    {row.countLabel}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-2.5">
                      <span className="hidden h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:block">
                        <span
                          className={`block h-full rounded-full ${BAND_BAR[row.band]}`}
                          style={{ width: `${Math.max(3, Math.min(100, row.percent))}%` }}
                        />
                      </span>
                      <span className={`w-10 text-right text-sm font-black tabular-nums ${BAND_TEXT[row.band]}`}>
                        {row.display}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Mains-only, and the most useful thing the Mains data produces: the
 * weaknesses an evaluator has written on more than one answer. It used to be
 * a narrow sidebar card; here it gets full width because it is the only part
 * of the page that says *why* the marks are what they are.
 */
function RecurringMistakes({ mistakes }: { mistakes: any[] }) {
  const items = Array.isArray(mistakes) ? mistakes.slice(0, 6) : [];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
            <AlertCircle className="h-4 w-4 text-rose-600" aria-hidden="true" />
            What the evaluator keeps writing
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Weaknesses flagged on two or more evaluated answers, most frequent first.
          </p>
        </div>
        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
          Evaluated answers only
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState message="Recurring mistakes appear once two evaluated answers share the same weakness." />
      ) : (
        <div>
          {items.map((mistake, index) => (
            <div
              key={`${mistake.normalized_mistake ?? mistake.mistake}-${index}`}
              className="flex items-start gap-3 border-t border-slate-100 px-5 py-3 first:border-t-0 hover:bg-slate-50"
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-rose-100 bg-rose-50 text-[10px] font-black text-rose-700">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold leading-snug text-slate-900">{mistake.mistake}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {mistake.occurrence_count ?? 0} times across {mistake.answer_count ?? 0} answers
                  {Array.isArray(mistake.categories) && mistake.categories.filter(Boolean).length > 0
                    ? ` · ${mistake.categories.filter(Boolean).slice(0, 3).join(", ")}`
                    : ""}
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-500">
                {formatMarks(mistake.avg_score)} avg
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

interface AssessmentDashboardProps {
  contentTypeFilter?: ContentTab;
}

export function AssessmentDashboard({ contentTypeFilter }: AssessmentDashboardProps = {}) {
  const { token, isInitialized } = useAuth();
  const { hasAnyActive } = useSubscription(token);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as ContentTab;
  const [activeTab, setActiveTab] = useState<ContentTab>(
    contentTypeFilter ?? (tabParam && ["gk", "aptitude", "mains"].includes(tabParam) ? tabParam : "gk")
  );
  const [view, setView] = useState<DashboardView>("focus");

  useEffect(() => {
    if (contentTypeFilter) {
      setActiveTab(contentTypeFilter);
      return;
    }
    const nextTab = searchParams.get("tab") as ContentTab;
    if (nextTab && ["gk", "aptitude", "mains"].includes(nextTab) && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [searchParams, activeTab, contentTypeFilter]);

  // Switching content type resets the view — "syllabus" has no meaning on
  // Mains, and "answers" has none on GK.
  useEffect(() => {
    setView("focus");
  }, [activeTab]);

  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);
  const [mainsAnswers, setMainsAnswers] = useState<any[]>([]);
  const [performanceTree, setPerformanceTree] = useState<PerformanceTreeNode[]>([]);
  // Only fetched to read its exam_id — the performance tree omits it, but
  // /attempts/compiled requires one. A single root node is enough.
  const [examId, setExamId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const stats = await authenticatedGet<any>("/api/v1/assessment/me/dashboard", token);
      setDashboardData(stats);

      if (activeTab === "mains") {
        const mainsList = await authenticatedGet<any[]>("/api/v1/assessment/mains/my-answers", token);
        setMainsAnswers(mainsList || []);
        setPerformanceTree([]);
      } else {
        const mcqList = await authenticatedGet<any[]>(
          `/api/v1/assessment/me/attempts?limit=15&content_type=${activeTab}`,
          token
        );
        setRecentAttempts(mcqList || []);

        // Rolled up subject/book/chapter/topic performance — a subject or chapter
        // shows the combined accuracy of everything tagged anywhere underneath it.
        // This is built from the same student_topic_metrics rows /me/topic-metrics
        // returns, so the page no longer fetches both.
        const tree = await authenticatedGet<PerformanceTreeNode[]>(
          `/api/v1/assessment/me/performance-tree?content_type=${activeTab}`,
          token
        );
        setPerformanceTree(tree || []);
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

  useEffect(() => {
    if (!token || activeTab === "mains") return;
    let cancelled = false;
    authenticatedGet<any[]>(`/api/v1/assessment/taxonomy-nodes?content_type=${activeTab}&root_only=true&limit=1`, token)
      .then((nodes) => {
        if (!cancelled) setExamId(nodes?.[0]?.exam_id ? Number(nodes[0].exam_id) : null);
      })
      .catch((err) => console.error("Failed to resolve exam id for start-test requests", err));
    return () => {
      cancelled = true;
    };
  }, [token, activeTab]);

  const flatNodes = useMemo(() => flattenPerformanceTree(performanceTree), [performanceTree]);

  const nodesById = useMemo(() => {
    const map = new Map<number, PerformanceTreeNode>();
    for (const node of flatNodes) map.set(node.id, node);
    return map;
  }, [flatNodes]);

  const freeTestsRemainingLabel = useFreeTestsRemainingLabel();

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 py-10">
        <main className="mx-auto max-w-3xl px-4">
          <div className="rounded-2xl border border-slate-200 bg-surface p-6 text-center shadow-sm">
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
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-surface shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-indigo-600 to-emerald-500" />
            <div className="p-6 text-center md:p-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl">
                📊
              </div>
              <h1 className="text-2xl font-black leading-tight text-slate-900">Your scorecard is waiting</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                Sign in to see your full attempt history, topic-wise accuracy trends, and the topics to fix next — all
                saved to your account.
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

  const isMains = activeTab === "mains";
  const stats = dashboardData ? dashboardData[activeTab] : null;
  const summary = stats?.summary ?? {};
  const trend: any[] = Array.isArray(stats?.trend) ? stats.trend : [];

  // ── Objective breakdowns ──────────────────────────────────────────────────
  const attempted = (node: PerformanceTreeNode) => node.correct_count + node.incorrect_count;

  // The focus queue deliberately holds only topic-level nodes: subjects and
  // books have their own tables below, so a weak subject no longer appears
  // three times on one screen the way it did before.
  const weakNodes = flatNodes.filter((node) => attempted(node) > 0 && node.accuracy < 0.6);
  const weakTopicNodes = weakNodes.filter((node) => node.node_type === "topic" || node.node_type === "subtopic");
  const focusNodes = (weakTopicNodes.length > 0 ? weakTopicNodes : weakNodes)
    .slice()
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  const strongNodes = flatNodes
    .filter(
      (node) =>
        attempted(node) >= 3 &&
        node.accuracy >= 0.7 &&
        (node.node_type === "topic" || node.node_type === "subtopic")
    )
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 4);

  const subjectNodes = flatNodes
    .filter((node) => node.node_type === "subject" && attempted(node) > 0)
    .sort((a, b) => a.accuracy - b.accuracy);

  const sourceNodes = flatNodes
    .filter((node) => node.node_type === "source_bucket" && attempted(node) > 0)
    .sort((a, b) => a.accuracy - b.accuracy);

  // ── Mains breakdowns ──────────────────────────────────────────────────────
  const categoryTrends: any[] = Array.isArray(stats?.category_trends) ? stats.category_trends : [];
  const categoryPercent = (category: any) =>
    marksPercent(category.avg_score, category.avg_max_score, category.avg_score_ratio);

  const mainsFocus = categoryTrends
    .filter((category) => ["topic", "subtopic", "theme"].includes(String(category.node_type)))
    .sort((a, b) => categoryPercent(a) - categoryPercent(b))
    .slice(0, 5);

  const mainsStrong = categoryTrends
    .filter((category) => categoryPercent(category) >= 55)
    .sort((a, b) => categoryPercent(b) - categoryPercent(a))
    .slice(0, 4);

  const mainsPapers = categoryTrends
    .filter((category) => category.node_type === "paper")
    .sort((a, b) => categoryPercent(a) - categoryPercent(b));

  const mainsThemes = categoryTrends
    .filter((category) => category.node_type === "theme" || category.node_type === "subject_area")
    .sort((a, b) => categoryPercent(a) - categoryPercent(b));

  const mainsMaxScore = toNumber(summary.avg_max_score, 0) > 0 ? toNumber(summary.avg_max_score) : 15;

  // ── Headline ──────────────────────────────────────────────────────────────
  const headlinePercent = isMains
    ? marksPercent(summary.avg_score, mainsMaxScore)
    : toPercent(summary.avg_accuracy);

  const delta = isMains
    ? computeDelta(trend, (point) => toNumber(point.avg_score))
    : computeDelta(trend, (point) => toPercent(point.avg_accuracy));

  const chartPoints: ChartPoint[] = trend
    .filter((point) => point?.result_date)
    .map((point) => ({
      date: point.result_date,
      value: isMains ? toNumber(point.avg_score) : toPercent(point.avg_accuracy),
      attempts: toNumber(point.attempts)
    }));

  /**
   * One plain sentence that reads the numbers for the student. Every clause is
   * conditional on data actually existing, so a brand-new account gets an
   * honest "not enough tests yet" rather than a confident lie.
   */
  function renderReading(): React.ReactNode {
    const direction = delta
      ? delta.delta > (isMains ? 0.3 : 1)
        ? "Climbing"
        : delta.delta < (isMains ? -0.3 : -1)
          ? "Slipping"
          : "Holding steady"
      : null;

    const opening = direction
      ? `${direction} over the last ${delta!.days} days.`
      : trend.length > 0
        ? "Not enough results yet to show a direction."
        : "No results recorded yet.";

    if (isMains) {
      const topMistake = Array.isArray(stats?.consistent_mistakes) ? stats.consistent_mistakes[0] : null;
      const pending = toNumber(summary.pending_count);
      return (
        <>
          {opening}{" "}
          {topMistake ? (
            <>
              Your most repeated evaluator note is <strong className="font-bold text-slate-900">“{topMistake.mistake}”</strong>, seen{" "}
              {topMistake.occurrence_count ?? 0} times.{" "}
            </>
          ) : null}
          {pending > 0 ? (
            <>
              <strong className="font-bold text-slate-900">
                {pending} answer{pending === 1 ? "" : "s"}
              </strong>{" "}
              still awaiting evaluation.
            </>
          ) : null}
        </>
      );
    }

    const laggingSubjects = subjectNodes.filter((node) => node.accuracy < 0.55).slice(0, 2);
    if (laggingSubjects.length === 0) {
      return <>{opening} No subject is under 55% — keep the cadence up.</>;
    }
    return (
      <>
        {opening}{" "}
        <strong className="font-bold text-slate-900">{joinNames(laggingSubjects.map((node) => node.name))}</strong>{" "}
        {laggingSubjects.length === 1 ? "is" : "are"} still under 55% — clearing{" "}
        {laggingSubjects.length === 1 ? "it" : "them"} would lift your overall accuracy the most.
      </>
    );
  }

  const categoryHref = (nodeId: number) => `/assessment/dashboard/categories/${nodeId}?tab=${activeTab}`;

  const practiceCategory = (nodeId: number, questionCount = 15): StartTestCategory => ({
    ...resolveNodeScope(nodeId, nodesById),
    question_count: tierAwareQuestionCount(questionCount, hasAnyActive, false),
    question_family: "objective"
  });

  // The weakest three topics, combined into one compiled request — split
  // fairly across however many are actually weak, and always capped to the
  // account's real tier limit.
  const recommendedNodes = focusNodes.slice(0, 3);
  const recommendedCategories: StartTestCategory[] =
    !isMains && recommendedNodes.length > 0
      ? recommendedNodes.map((node) => practiceCategory(node.id, Math.max(4, Math.round(20 / recommendedNodes.length))))
      : [];

  const viewCopy: Record<DashboardView, { title: string; hint: string }> = {
    focus: {
      title: "What to fix next",
      hint: isMains
        ? "The categories where your evaluated answers score lowest."
        : "Your weakest topics, hardest first. Each one starts a test scoped to itself."
    },
    syllabus: {
      title: "Syllabus performance",
      hint: "Every subject, book and chapter rolled up — a parent reflects everything tagged beneath it."
    },
    history: { title: "Test history", hint: "Your recent attempts. Open any one to review the questions you got wrong." },
    categories: { title: "Marks by category", hint: "Every paper, subject area, theme and topic your evaluated answers mapped to." },
    answers: { title: "Your answers", hint: "Everything you have submitted, newest first, including answers still in the queue." }
  };

  const secondaryView: DashboardView = isMains ? "categories" : "syllabus";
  const tertiaryView: DashboardView = isMains ? "answers" : "history";
  const activeCopy = viewCopy[view];

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-0.5">
      <main className="mx-auto max-w-7xl space-y-4 px-4 pt-5">
        {/* ── Header ── */}
        {!contentTypeFilter && (
          <div
            id="tour-dashboard-header"
            className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
          >
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                {isMains ? "UPSC Mains · Answer writing" : activeTab === "aptitude" ? "CSAT · Aptitude" : "General Studies · Prelims"}
              </p>
              <h1 className="mt-1 text-2xl font-black leading-tight text-slate-900 md:text-3xl">Performance</h1>
              <p className="mt-1 text-sm text-slate-500">
                {toNumber(summary.attempts)} {isMains ? "answers written" : "tests taken"}
                {trend.length > 0 ? ` · last result ${formatDateLong(trend[trend.length - 1].result_date)}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1" role="tablist" aria-label="Content type">
                {([
                  ["gk", "GK Prelims"],
                  ["aptitude", "CSAT"],
                  ["mains", "Mains"]
                ] as const).map(([key, label]) => (
                  <Link
                    key={key}
                    href={`/assessment/dashboard?tab=${key}`}
                    role="tab"
                    aria-selected={activeTab === key}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                      activeTab === key ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <button
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-surface px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                disabled={loading}
                onClick={loadData}
                type="button"
              >
                <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <Link
                id="tour-dashboard-new-test"
                href={isMains ? "/assessment/mains-hub" : "/assessment"}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                <Zap className="h-3.5 w-3.5" />
                {isMains ? "Write an answer" : "New test"}
              </Link>
            </div>
          </div>
        )}

        {message && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            <AlertCircle className="h-4 w-4" />
            {message}
          </div>
        )}

        {dashboardData && stats ? (
          <div className="space-y-4">
            {/* ── Readiness band ── */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
              <div className="grid lg:grid-cols-[minmax(280px,340px)_1fr]">
                <div className="flex flex-col gap-3.5 px-5 py-5">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      {isMains ? "Average mark" : "Overall accuracy"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-2.5">
                      <span className="text-5xl font-black tabular-nums leading-none tracking-tight text-slate-900">
                        {isMains ? formatMarks(summary.avg_score) : headlinePercent}
                      </span>
                      <span className="text-xl font-black text-slate-400">
                        {isMains ? `/ ${formatMarks(mainsMaxScore)}` : "%"}
                      </span>
                      {delta && <DeltaPill delta={delta.delta} days={delta.days} unit={isMains ? "marks" : "pts"} />}
                    </div>
                  </div>
                  <p className="max-w-[42ch] text-[13px] leading-relaxed text-slate-500">{renderReading()}</p>
                </div>

                <div className="flex flex-col px-5 py-4 lg:border-l lg:border-slate-100">
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-black text-slate-900">
                      {isMains ? "Marks by submission date" : "Accuracy by test date"}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {isMains ? "Evaluated only · last 10" : "Last 10 tests"}
                    </span>
                  </div>
                  <PerformanceChart
                    points={chartPoints}
                    max={isMains ? mainsMaxScore : 100}
                    goodAt={isMains ? mainsMaxScore * 0.55 : 70}
                    warnAt={isMains ? mainsMaxScore * 0.4 : 40}
                    formatValue={(value) => (isMains ? value.toFixed(1) : `${Math.round(value)}%`)}
                    emptyMessage={isMains ? "Submit more answers to see your trend." : "Complete more tests to see your trend."}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 sm:grid-cols-4">
                {isMains ? (
                  <>
                    <StatCell value={toNumber(summary.attempts)} label="Answers written" />
                    <StatCell value={toNumber(summary.evaluated_count)} label="Evaluated" />
                    <StatCell
                      value={toNumber(summary.pending_count)}
                      label="Awaiting evaluation"
                      tone={toNumber(summary.pending_count) > 0 ? "text-amber-600" : undefined}
                    />
                    <StatCell value={`${headlinePercent}%`} label="Of maximum marks" />
                  </>
                ) : (
                  <>
                    <StatCell value={toNumber(summary.attempts)} label="Tests taken" />
                    <StatCell
                      value={toNumber(summary.correct_count) + toNumber(summary.incorrect_count)}
                      label="Questions seen"
                    />
                    <StatCell
                      value={
                        <>
                          {toNumber(summary.correct_count)}
                          <span className="text-sm font-bold text-slate-400"> / {toNumber(summary.incorrect_count)}</span>
                        </>
                      }
                      label="Right / wrong"
                    />
                    <StatCell value={formatMarks(summary.avg_score)} label="Average score" />
                  </>
                )}
              </div>
            </section>

            {/* ── Focus / syllabus / history ── */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <Target className="h-4 w-4 text-rose-600" aria-hidden="true" />
                    {activeCopy.title}
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">{activeCopy.hint}</p>
                </div>
                <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1" role="tablist" aria-label="View">
                  <ViewTab active={view === "focus"} onClick={() => setView("focus")}>
                    Focus
                  </ViewTab>
                  <ViewTab active={view === secondaryView} onClick={() => setView(secondaryView)}>
                    {isMains ? "Categories" : "Syllabus"}
                  </ViewTab>
                  <ViewTab active={view === tertiaryView} onClick={() => setView(tertiaryView)}>
                    {isMains ? "Answers" : "History"}
                  </ViewTab>
                </div>
              </div>

              {/* FOCUS */}
              {view === "focus" && (
                <div>
                  {!isMains && recommendedCategories.length > 0 && examId && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50 px-5 py-3">
                      <p className="text-xs font-semibold text-slate-600">
                        <strong className="font-black text-slate-900">
                          Practice your {recommendedNodes.length === 1 ? "weakest topic" : `${recommendedNodes.length} weakest topics`}
                        </strong>{" "}
                        — {recommendedCategories.reduce((sum, category) => sum + category.question_count, 0)} questions, one attempt.
                      </p>
                      <StartTestPill
                        examId={examId}
                        categories={recommendedCategories}
                        label="Start now"
                        tone="primary"
                        title={`Weak-area test — ${new Date().toLocaleDateString("en-IN")}`}
                      />
                    </div>
                  )}

                  {isMains ? (
                    mainsFocus.length === 0 ? (
                      <EmptyState message="Once answers are evaluated and mapped to the syllabus, your weakest categories appear here." />
                    ) : (
                      mainsFocus.map((category, index) => {
                        const percent = categoryPercent(category);
                        const band = marksBand(percent);
                        return (
                          <div
                            key={`${category.node_type}-${category.category_id}`}
                            className="grid grid-cols-[26px_1fr_auto] items-center gap-3 border-t border-slate-100 px-5 py-3 first:border-t-0 hover:bg-slate-50 sm:grid-cols-[26px_1fr_120px_64px]"
                          >
                            <span className="text-center text-[11px] font-black tabular-nums text-slate-400">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-bold text-slate-900">
                                {category.category_name ?? "Unmapped category"}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {String(category.node_type ?? "category").replaceAll("_", " ")} · {category.attempts ?? 0} answer
                                {toNumber(category.attempts) === 1 ? "" : "s"}
                              </p>
                            </div>
                            <div className="hidden sm:block">
                              <Meter percent={percent} band={band} />
                              <p className="mt-1.5 text-[10px] font-bold tabular-nums text-slate-400">
                                latest {formatMarks(category.latest_score)}
                              </p>
                            </div>
                            <span className={`text-right text-base font-black tabular-nums ${BAND_TEXT[band]}`}>
                              {formatMarks(category.avg_score)}
                            </span>
                          </div>
                        );
                      })
                    )
                  ) : focusNodes.length === 0 ? (
                    <EmptyState message="Nothing weak enough to flag yet — complete a test and your weakest topics will appear here." />
                  ) : (
                    focusNodes.map((node, index) => {
                      const percent = Math.round(node.accuracy * 100);
                      const band = accuracyBand(percent);
                      const path = nodePath(node, nodesById);
                      return (
                        <div
                          key={node.id}
                          className="grid grid-cols-[26px_1fr_auto] items-center gap-3 border-t border-slate-100 px-5 py-3 first:border-t-0 hover:bg-slate-50 sm:grid-cols-[26px_1fr_120px_56px_auto]"
                        >
                          <span className="text-center text-[11px] font-black tabular-nums text-slate-400">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <Link href={categoryHref(node.id)} className="block truncate text-[13px] font-bold text-slate-900 hover:text-indigo-600">
                              {node.name}
                            </Link>
                            {path && <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{path}</p>}
                          </div>
                          <div className="hidden sm:block">
                            <Meter percent={percent} band={band} />
                            <p className="mt-1.5 text-[10px] font-bold tabular-nums text-slate-400">
                              {node.correct_count} / {attempted(node)} correct
                            </p>
                          </div>
                          <span className={`text-right text-base font-black tabular-nums ${BAND_TEXT[band]}`}>{percent}%</span>
                          {examId && (
                            <div className="hidden sm:block">
                              <StartTestPill
                                examId={examId}
                                categories={[practiceCategory(node.id)]}
                                tone="weak"
                                label="Practice"
                                title={`${node.name} practice`}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {(isMains ? mainsStrong.length > 0 : strongNodes.length > 0) && (
                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {isMains ? "Scoring well — no action needed" : "Holding steady — no action needed"}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {isMains
                          ? mainsStrong.map((category) => (
                              <span
                                key={`${category.node_type}-${category.category_id}`}
                                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-slate-800"
                              >
                                {category.category_name}
                                <b className="text-[11px] font-black tabular-nums text-emerald-700">
                                  {formatMarks(category.avg_score)}
                                </b>
                              </span>
                            ))
                          : strongNodes.map((node) => (
                              <Link
                                key={node.id}
                                href={categoryHref(node.id)}
                                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-slate-800 hover:border-emerald-300"
                              >
                                {node.name}
                                <b className="text-[11px] font-black tabular-nums text-emerald-700">
                                  {Math.round(node.accuracy * 100)}%
                                </b>
                              </Link>
                            ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SYLLABUS (objective) */}
              {view === "syllabus" && !isMains && (
                <div className="p-4">
                  <PerformanceTree
                    roots={performanceTree}
                    categoryHref={categoryHref}
                    emptyMessage="Complete a test and this will become your rolled-up syllabus performance map."
                  />
                </div>
              )}

              {/* CATEGORIES (Mains) */}
              {view === "categories" && isMains && (
                categoryTrends.length === 0 ? (
                  <EmptyState message="Category marks appear after evaluated answers are mapped to syllabus categories." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-5 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Category</th>
                          <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">Answers</th>
                          <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">Latest</th>
                          <th className="px-5 py-2 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">Average</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryTrends.map((category) => {
                          const percent = categoryPercent(category);
                          const band = marksBand(percent);
                          return (
                            <tr key={`${category.node_type}-${category.category_id}`} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="px-5 py-3">
                                <p className="text-[13px] font-bold text-slate-900">{category.category_name ?? "Unmapped category"}</p>
                                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  {String(category.node_type ?? "category").replaceAll("_", " ")}
                                </p>
                              </td>
                              <td className="px-3 py-3 text-right text-[11px] font-bold tabular-nums text-slate-500">
                                {category.attempts ?? 0}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-right text-[11px] font-bold tabular-nums text-slate-500">
                                {formatMarks(category.latest_score)} / {formatMarks(category.latest_max_score || mainsMaxScore)}
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center justify-end gap-2.5">
                                  <span className="hidden h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:block">
                                    <span className={`block h-full rounded-full ${BAND_BAR[band]}`} style={{ width: `${Math.max(3, percent)}%` }} />
                                  </span>
                                  <span className={`w-10 text-right text-sm font-black tabular-nums ${BAND_TEXT[band]}`}>
                                    {formatMarks(category.avg_score)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* HISTORY (objective) */}
              {view === "history" && !isMains && (
                recentAttempts.length === 0 ? (
                  <EmptyState message="No test attempts yet. Your completed tests will be listed here." />
                ) : (
                  recentAttempts.map((attempt) => {
                    const isDone = attempt.status === "completed" || attempt.status === "submitted";
                    const percent = toPercent(attempt.result?.accuracy);
                    const band = accuracyBand(percent);
                    return (
                      <div
                        key={attempt.id}
                        className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-slate-100 px-5 py-3 first:border-t-0 hover:bg-slate-50 sm:grid-cols-[1fr_110px_56px_auto]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-bold text-slate-900">
                            {attempt.test_template?.title ?? "Practice session"}
                          </p>
                          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {attempt.started_at ? formatDateLong(attempt.started_at) : "Date unknown"}
                            {isDone ? "" : " · in progress"}
                          </p>
                        </div>
                        {attempt.result ? (
                          <>
                            <div className="hidden sm:block">
                              <Meter percent={percent} band={band} />
                              <p className="mt-1.5 text-[10px] font-bold tabular-nums text-slate-400">
                                {attempt.result.correct_count ?? 0} correct · {formatMarks(attempt.result.score)} marks
                              </p>
                            </div>
                            <span className={`hidden text-right text-base font-black tabular-nums sm:block ${BAND_TEXT[band]}`}>
                              {percent}%
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="hidden sm:block" />
                            <span className="hidden text-right text-xs font-bold text-slate-400 sm:block">—</span>
                          </>
                        )}
                        <Link
                          href={isDone && attempt.result?.id ? `/assessment/results/${attempt.result.id}` : `/assessment/attempts/${attempt.id}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                        >
                          {isDone ? "Review" : "Resume"}
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                    );
                  })
                )
              )}

              {/* ANSWERS (Mains) */}
              {view === "answers" && isMains && (
                mainsAnswers.length === 0 ? (
                  <EmptyState message="No answers submitted yet. Everything you write will be listed here." />
                ) : (
                  mainsAnswers.slice(0, 15).map((answer) => {
                    const evaluated = answer.evaluation_status === "evaluated";
                    const percent = marksPercent(answer.score, answer.max_score || mainsMaxScore);
                    const band = marksBand(percent);
                    return (
                      <div
                        key={answer.id}
                        className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-slate-100 px-5 py-3 first:border-t-0 hover:bg-slate-50 sm:grid-cols-[1fr_110px_56px_auto]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-bold text-slate-900">
                            {answer.question_statement ?? answer.question_prompt ?? "Mains answer"}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {answer.paper_name ? `${answer.paper_name} · ` : ""}
                            {answer.submitted_at ? formatDateLong(answer.submitted_at) : "Date unknown"}
                          </p>
                        </div>
                        <div className="hidden sm:block">
                          <span
                            className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                              evaluated
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {evaluated ? "Evaluated" : "In queue"}
                          </span>
                        </div>
                        <span
                          className={`hidden text-right text-base font-black tabular-nums sm:block ${
                            evaluated ? BAND_TEXT[band] : "text-slate-400"
                          }`}
                        >
                          {evaluated ? formatMarks(answer.score) : "—"}
                        </span>
                        <Link
                          href={answer.result_id ? `/assessment/results/${answer.result_id}` : "/assessment/mains-hub"}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                        >
                          {evaluated ? "Read" : "View"}
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                    );
                  })
                )
              )}
            </section>

            {/* ── Breakdown tables ── */}
            <div className="grid gap-4 xl:grid-cols-2">
              {isMains ? (
                <>
                  <BreakdownTable
                    title="By paper"
                    hint="Mains has no books — the paper is the source."
                    countHeading="Answers"
                    valueHeading="Average"
                    icon={<Layers3 className="h-4 w-4 text-indigo-600" aria-hidden="true" />}
                    emptyMessage="Paper-level marks appear once answers are evaluated."
                    rows={mainsPapers.map((category) => {
                      const percent = categoryPercent(category);
                      return {
                        key: `paper-${category.category_id}`,
                        name: category.category_name ?? "Unmapped paper",
                        countLabel: String(category.attempts ?? 0),
                        percent,
                        band: marksBand(percent),
                        display: formatMarks(category.avg_score)
                      };
                    })}
                  />
                  <BreakdownTable
                    title="By theme"
                    hint="Syllabus themes across all papers, weakest first."
                    countHeading="Answers"
                    valueHeading="Average"
                    icon={<BookOpen className="h-4 w-4 text-indigo-600" aria-hidden="true" />}
                    emptyMessage="Theme-level marks appear once answers are evaluated."
                    rows={mainsThemes.map((category) => {
                      const percent = categoryPercent(category);
                      return {
                        key: `theme-${category.node_type}-${category.category_id}`,
                        name: category.category_name ?? "Unmapped theme",
                        caption: String(category.node_type ?? "").replaceAll("_", " "),
                        countLabel: String(category.attempts ?? 0),
                        percent,
                        band: marksBand(percent),
                        display: formatMarks(category.avg_score)
                      };
                    })}
                  />
                </>
              ) : (
                <>
                  <BreakdownTable
                    title="By subject"
                    hint="Weakest first, rolled up across every book."
                    countHeading="Attempted"
                    valueHeading="Accuracy"
                    icon={<Layers3 className="h-4 w-4 text-indigo-600" aria-hidden="true" />}
                    emptyMessage="Complete a test and your subject-wise accuracy appears here."
                    rows={subjectNodes.map((node) => {
                      const percent = Math.round(node.accuracy * 100);
                      return {
                        key: `subject-${node.id}`,
                        name: node.name,
                        countLabel: `${node.correct_count} / ${attempted(node)}`,
                        percent,
                        band: accuracyBand(percent),
                        display: `${percent}%`,
                        href: categoryHref(node.id),
                        action: examId ? (
                          <StartTestPill
                            examId={examId}
                            categories={[practiceCategory(node.id)]}
                            tone="neutral"
                            label="Practice"
                            title={`${node.name} practice`}
                          />
                        ) : null
                      };
                    })}
                  />
                  <BreakdownTable
                    title="By source"
                    hint="Every book you've attempted, weakest first."
                    countHeading="Attempted"
                    valueHeading="Accuracy"
                    icon={<BookOpen className="h-4 w-4 text-indigo-600" aria-hidden="true" />}
                    emptyMessage="Once questions tagged to a book are attempted, they are listed here."
                    rows={sourceNodes.map((node) => {
                      const percent = Math.round(node.accuracy * 100);
                      return {
                        key: `source-${node.id}`,
                        name: node.name,
                        caption: node.parent_id ? nodesById.get(node.parent_id)?.name ?? null : null,
                        countLabel: `${node.correct_count} / ${attempted(node)}`,
                        percent,
                        band: accuracyBand(percent),
                        display: `${percent}%`,
                        href: categoryHref(node.id),
                        action: examId ? (
                          <StartTestPill
                            examId={examId}
                            categories={[practiceCategory(node.id)]}
                            tone="neutral"
                            label="Practice"
                            title={`${node.name} practice`}
                          />
                        ) : null
                      };
                    })}
                  />
                </>
              )}
            </div>

            {isMains && <RecurringMistakes mistakes={stats.consistent_mistakes ?? []} />}

            {/* ── Revision ── */}
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-surface px-5 py-4 shadow-sm">
              <div>
                <h2 className="text-sm font-black text-slate-900">Revision test</h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Re-attempt the questions you have already got wrong.
                  {freeTestsRemainingLabel ? ` · ${freeTestsRemainingLabel} on the free plan` : ""}
                </p>
              </div>
              <Link
                href={
                  activeTab === "aptitude"
                    ? "/assessment/csat?view=revision"
                    : isMains
                      ? "/assessment/mains-hub?view=revision"
                      : "/assessment/gk?view=revision"
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                Start revision
              </Link>
            </section>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-surface p-12 text-center text-sm font-semibold text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
            <span>Loading your performance…</span>
          </div>
        )}
      </main>

      {isFullTourActiveForPage("dashboard") && <FullTourSegment pageKey="dashboard" steps={DASHBOARD_TOUR_STEPS} />}
    </div>
  );
}
