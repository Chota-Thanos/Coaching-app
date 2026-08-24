"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  Check,
  ChevronRight,
  FileText,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  Lock,
  Newspaper,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Timer,
  Users,
  Zap
} from "lucide-react";
import { useAuth, authenticatedGet } from "../auth/auth-context";
import { useSubscription } from "../../lib/use-subscription";
import { browserBaseUrl, resolveMediaUrl } from "../../lib/api";
import { CURRENT_AFFAIRS_HUBS, hubHref, articleHref } from "../../lib/current-affairs";
import {
  FREE_LIMITS,
  SUBSCRIPTION_MODULES,
  inactiveModules,
  isModuleActive,
  formatPrice,
  BILLING_INTERVAL_SHORT
} from "../../lib/subscription-plans";

const FREE_TEST_LIMIT = FREE_LIMITS.selfBuiltTests;
const FREE_MAX_NOTE_COLLECTIONS = FREE_LIMITS.noteRepositories;

/** CURRENT_AFFAIRS_HUBS is a non-empty literal, so the first entry always exists —
 *  it is the tab the card opens on and the fallback for an unknown hub path. */
const DEFAULT_HUB = CURRENT_AFFAIRS_HUBS[0]!;

const HUB_ICONS: Record<string, typeof Newspaper> = {
  "daily-news": Newspaper,
  concepts: Lightbulb,
  "prelims-pyq": HelpCircle,
  "editorial-summary": FileText,
  "mains-topic-notes": BookOpen,
  "mains-pyq": FileText
};

type TaxonomyNode = {
  id: number;
  parent_id: number | null;
  name: string;
  node_type: string;
  content_type: string | null;
};

type TopicMetric = {
  taxonomy_node_id: number;
  taxonomy_name: string;
  parent_id: number | null;
  node_type: string;
  avg_accuracy: number | string | null;
  question_count: number | string | null;
};

/** student_topic_metrics stores accuracy as a 0–1 ratio, but older rows were
 *  written as 0–100. Both shapes are live in the table, so normalise on read. */
function toPercent(raw: unknown): number {
  const value = Number(raw ?? 0);
  if (!Number.isFinite(value)) return 0;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "recently";
  const diffHours = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

function formatSessionTime(iso?: string | null): string {
  if (!iso) return "Scheduled";
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function StudentDashboard() {
  const { token, user } = useAuth();
  const { hasAnyActive, hasEntitlement, subscriptions, entitlements, loading: loadingPlan } =
    useSubscription(token);

  const [stats, setStats] = useState<any>(null);
  const [topicMetrics, setTopicMetrics] = useState<TopicMetric[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyNode[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [reading, setReading] = useState<any>(null);
  const [activeHub, setActiveHub] = useState<string>(DEFAULT_HUB.path);
  const [hubArticles, setHubArticles] = useState<Record<string, any[]>>({});
  const [hubLoading, setHubLoading] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [billingPlans, setBillingPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    // One settled batch rather than a chain: a single failing endpoint used to
    // abort every fetch after it and leave the whole dashboard blank.
    const load = async () => {
      setLoading(true);
      const authed = <T,>(path: string) => authenticatedGet<T>(path, token);
      const publicJson = async <T,>(path: string): Promise<T> => {
        const res = await fetch(`${browserBaseUrl}${path}`);
        if (!res.ok) throw new Error(`${path} responded ${res.status}`);
        return res.json();
      };

      const [
        statsRes,
        metricsRes,
        attemptsRes,
        requestsRes,
        mentorsRes,
        collectionsRes,
        readingRes,
        plansRes,
        billingPlansRes,
        taxonomyRes
      ] = await Promise.allSettled([
        authed<any>("/api/v1/assessment/me/dashboard"),
        authed<TopicMetric[]>("/api/v1/assessment/me/topic-metrics"),
        authed<any[]>("/api/v1/assessment/me/attempts?limit=10"),
        authed<any[]>("/api/v1/mentorship/requests?mode=user"),
        authed<any[]>("/api/v1/mentorship/profiles"),
        authed<any[]>("/api/v1/current-affairs/me/collections"),
        authed<any>("/api/v1/current-affairs/me/reading-dashboard?limit=5"),
        publicJson<any[]>("/api/v1/study-plans?status=published&limit=6"),
        publicJson<any[]>("/api/v1/billing/plans"),
        publicJson<TaxonomyNode[]>("/api/v1/assessment/taxonomy-nodes?content_type=gk&limit=2000")
      ]);

      if (cancelled) return;

      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (metricsRes.status === "fulfilled") setTopicMetrics(metricsRes.value ?? []);
      if (attemptsRes.status === "fulfilled") setAttempts(attemptsRes.value ?? []);
      if (requestsRes.status === "fulfilled") setRequests(requestsRes.value ?? []);
      if (mentorsRes.status === "fulfilled") setMentors(mentorsRes.value ?? []);
      if (collectionsRes.status === "fulfilled") setCollections(collectionsRes.value ?? []);
      if (readingRes.status === "fulfilled") setReading(readingRes.value ?? null);
      if (plansRes.status === "fulfilled") setPlans(plansRes.value ?? []);
      if (billingPlansRes.status === "fulfilled") setBillingPlans(billingPlansRes.value ?? []);
      if (taxonomyRes.status === "fulfilled") setTaxonomy(taxonomyRes.value ?? []);

      for (const result of [
        statsRes,
        metricsRes,
        attemptsRes,
        requestsRes,
        mentorsRes,
        collectionsRes,
        readingRes,
        plansRes,
        billingPlansRes,
        taxonomyRes
      ]) {
        if (result.status === "rejected") console.error("Dashboard fetch failed", result.reason);
      }

      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Each tab pulls its own latest articles the first time it is opened, and the
  // result is cached — fetching all six kinds up front cost six requests for
  // five lists nobody had asked to see yet.
  useEffect(() => {
    if (hubArticles[activeHub]) return;
    const hub = CURRENT_AFFAIRS_HUBS.find((h) => h.path === activeHub);
    if (!hub) return;
    let cancelled = false;

    const load = async () => {
      setHubLoading(activeHub);
      try {
        const search = new URLSearchParams({ content_kind: hub.contentKind, limit: "5" });
        if (hub.articleRole) search.set("article_role", hub.articleRole);
        const res = await fetch(`${browserBaseUrl}/api/v1/current-affairs/frontend/articles?${search}`);
        if (!res.ok) throw new Error(`articles responded ${res.status}`);
        const data = await res.json();
        if (!cancelled) setHubArticles((prev) => ({ ...prev, [activeHub]: data.items ?? [] }));
      } catch (err) {
        console.error("Failed to load articles for", activeHub, err);
        if (!cancelled) setHubArticles((prev) => ({ ...prev, [activeHub]: [] }));
      } finally {
        if (!cancelled) setHubLoading(null);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeHub, hubArticles]);

  // ─── Derived: headline numbers ─────────────────────────────────────────────
  const username = user?.username ?? "Student";
  const gkAttempts = Number(stats?.gk?.summary?.attempts ?? 0);
  const csatAttempts = Number(stats?.aptitude?.summary?.attempts ?? 0);
  const totalTests = gkAttempts + csatAttempts;
  const gkAccuracy = toPercent(stats?.gk?.summary?.avg_accuracy);
  const csatAccuracy = toPercent(stats?.aptitude?.summary?.avg_accuracy);
  const overallAccuracy =
    totalTests > 0
      ? Math.round((gkAccuracy * gkAttempts + csatAccuracy * csatAttempts) / totalTests)
      : 0;

  const freeTestsRemaining = useMemo(() => {
    const record = entitlements.find((e) => e.entitlement_key === "assessment.free_tests_remaining");
    return record?.limit_value ?? null;
  }, [entitlements]);

  const activePlan = subscriptions.find((s) => s.status === "active");
  const modulesToOffer = inactiveModules(entitlements);
  const activeModules = SUBSCRIPTION_MODULES.filter((m) => isModuleActive(m, entitlements));

  /** Cheapest active price for a plan code, for the "from ₹x/mo" line. */
  const cheapestPrice = (planCode: string) => {
    const plan = billingPlans.find((p: any) => p.code === planCode);
    const prices = (plan?.prices ?? []).filter((pr: any) => pr.is_active);
    if (!prices.length) return null;
    return prices.reduce((lowest: any, pr: any) =>
      Number(pr.amount_minor) < Number(lowest.amount_minor) ? pr : lowest
    );
  };
  const hasNotesPremium =
    hasEntitlement("current_affairs.notes_workspace") ||
    hasEntitlement("current_affairs.editorial_access");

  // ─── Derived: what to practise ─────────────────────────────────────────────
  const rankedTopics = useMemo(
    () =>
      topicMetrics
        .filter((t) => Number(t.question_count ?? 0) >= 3)
        .sort((a, b) => toPercent(a.avg_accuracy) - toPercent(b.avg_accuracy)),
    [topicMetrics]
  );
  const weakTopics = rankedTopics.slice(0, 3);
  const drillTopics = weakTopics.slice(0, 2);
  const drillHref = drillTopics.length
    ? `/assessment/custom-test/create?content_type=gk&nodes=${drillTopics
        .map((t) => t.taxonomy_node_id)
        .join(",")}`
    : "/assessment/custom-test/create?content_type=gk";

  const inProgressAttempt = attempts.find((a) => a.status === "in_progress" && !a.result);
  const lastCompleted = attempts.find((a) => a.status !== "in_progress" && a.result);

  // ─── Derived: syllabus coverage ────────────────────────────────────────────
  // Cells are `topic` nodes; columns are the `subject` they roll up to. A topic
  // counts as attempted when any metric row sits on it or on one of its
  // descendants, so a question tagged at subtopic level still lights its topic.
  const coverage = useMemo(() => {
    if (!taxonomy.length) return null;
    const byId = new Map(taxonomy.map((n) => [Number(n.id), n]));

    const ancestorOfType = (nodeId: number | null, type: string): TaxonomyNode | null => {
      let current = nodeId === null ? null : byId.get(Number(nodeId)) ?? null;
      let guard = 0;
      while (current && guard++ < 12) {
        if (current.node_type === type) return current;
        current = current.parent_id === null ? null : byId.get(Number(current.parent_id)) ?? null;
      }
      return null;
    };

    // node id → best-known accuracy, rolled up to the owning topic
    const accuracyByTopic = new Map<number, { total: number; questions: number }>();
    for (const metric of topicMetrics) {
      const own = byId.get(Number(metric.taxonomy_node_id));
      const topic =
        own?.node_type === "topic" ? own : ancestorOfType(Number(metric.taxonomy_node_id), "topic");
      if (!topic) continue;
      const questions = Number(metric.question_count ?? 0);
      const entry = accuracyByTopic.get(Number(topic.id)) ?? { total: 0, questions: 0 };
      entry.total += toPercent(metric.avg_accuracy) * questions;
      entry.questions += questions;
      accuracyByTopic.set(Number(topic.id), entry);
    }

    const subjects = new Map<number, { name: string; cells: { id: number; state: string }[] }>();
    for (const node of taxonomy) {
      if (node.node_type !== "topic") continue;
      const subject = ancestorOfType(Number(node.id), "subject");
      if (!subject) continue;
      const bucket =
        subjects.get(Number(subject.id)) ??
        { name: subject.name, cells: [] as { id: number; state: string }[] };
      const hit = accuracyByTopic.get(Number(node.id));
      let state = "empty";
      if (hit && hit.questions > 0) {
        const pct = Math.round(hit.total / hit.questions);
        state = pct >= 70 ? "strong" : pct >= 55 ? "mid" : "weak";
      }
      bucket.cells.push({ id: Number(node.id), state });
      subjects.set(Number(subject.id), bucket);
    }

    const columns = [...subjects.values()].filter((s) => s.cells.length > 0);
    if (!columns.length) return null;
    const all = columns.flatMap((c) => c.cells);
    return {
      columns: columns.sort((a, b) => b.cells.length - a.cells.length).slice(0, 7),
      total: all.length,
      attempted: all.filter((c) => c.state !== "empty").length
    };
  }, [taxonomy, topicMetrics]);

  // ─── Derived: mentorship ───────────────────────────────────────────────────
  const upcomingSession = [...requests]
    .filter(
      (r) => r.session_status === "scheduled" && r.session_starts_at && new Date(r.session_starts_at) > new Date()
    )
    .sort((a, b) => new Date(a.session_starts_at).getTime() - new Date(b.session_starts_at).getTime())[0];
  const pendingEvaluation = requests.find((r) => r.evaluation_status === "pending");

  // ─── Derived: the current affairs tabs ─────────────────────────────────────
  const activeHubDef = CURRENT_AFFAIRS_HUBS.find((h) => h.path === activeHub) ?? DEFAULT_HUB;
  const activeArticles = hubArticles[activeHub] ?? [];
  const readSlugs = useMemo(() => {
    const seen = new Set<string>();
    for (const item of reading?.continue_reading ?? []) {
      if (item?.master_article?.slug) seen.add(item.master_article.slug);
    }
    for (const item of reading?.recently_read ?? []) {
      if (item?.master_article?.slug) seen.add(item.master_article.slug);
    }
    return seen;
  }, [reading]);
  const readCount = activeArticles.filter((a: any) => readSlugs.has(a.slug)).length;
  const dueRevisions = reading?.due_revisions ?? [];

  // ─── Derived: study plans ──────────────────────────────────────────────────
  const enrolledPlan = plans.find((p) => p.has_access && p.enrolled_at);
  const latestPlans = plans.filter((p) => p !== enrolledPlan).slice(0, 3);

  const featuredMentors = mentors.slice(0, 4);

  if (loading && !stats) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-civic border-t-transparent" />
          <p className="text-xs font-bold text-slate-500">Loading your dashboard…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper pb-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-9 sm:px-6 lg:px-11">
        {/* ══ Greeting ══════════════════════════════════════════════════════ */}
        <section className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              {enrolledPlan?.duration_weeks ? ` · ${enrolledPlan.title}` : ""}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-ink">Namaste, {username}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            {totalTests > 0 && (
              <>
                <div className="text-right">
                  <p className="text-xl font-extrabold tracking-tight text-ink">{overallAccuracy}%</p>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Accuracy</p>
                </div>
                <span className="h-8 w-px bg-line" />
                <div className="text-right">
                  <p className="text-xl font-extrabold tracking-tight text-ink">{totalTests}</p>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Tests</p>
                </div>
                <span className="h-8 w-px bg-line" />
              </>
            )}
            <Link
              href="/assessment/custom-test/create"
              className="inline-flex items-center gap-2 rounded-xl bg-civic px-5 py-3 text-sm font-bold text-white shadow-card transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              Create a test
              {!hasAnyActive && freeTestsRemaining !== null && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11.5px] font-extrabold">
                  {freeTestsRemaining} free left
                </span>
              )}
            </Link>
          </div>
        </section>

        {/* ══ Quick links ═══════════════════════════════════════════════════ */}
        <section className="flex flex-wrap items-center gap-3">
          {[
            { href: "/current-affairs/daily-news", icon: Newspaper, label: "Today's news", tone: "text-emerald-600" },
            { href: "/assessment/dashboard", icon: BarChart3, label: "Scorecard", tone: "text-civic" },
            { href: "/current-affairs/workspace", icon: FolderOpen, label: "My notes", tone: "text-amber-600" },
            { href: "/assessment/gk?view=revision", icon: Bookmark, label: "Bookmarks", tone: "text-rose-600" },
            { href: "/mentors", icon: Users, label: "Find a mentor", tone: "text-purple-600" },
            { href: "/study-plans", icon: BookOpenCheck, label: "Study plans", tone: "text-civic" },
            { href: "/current-affairs/prelims-pyq", icon: HelpCircle, label: "PYQ bank", tone: "text-emerald-600" },
            { href: "/assessment/mains-hub", icon: FileText, label: "Mains practice", tone: "text-slate-500" }
          ].map(({ href, icon: Icon, label, tone }) => (
            <Link
              key={label}
              href={href}
              className="inline-flex items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-[13.5px] font-semibold text-slate-700 shadow-card transition hover:border-civic/40 hover:text-ink"
            >
              <Icon className={`h-4 w-4 ${tone}`} />
              {label}
            </Link>
          ))}
        </section>

        {/* ══ Plan band ═════════════════════════════════════════════════════ */}
        {!loadingPlan && (
          <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    hasAnyActive ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-base font-semibold text-ink">
                  {hasAnyActive ? activePlan?.plan?.name ?? "Premium" : "What is left on your free plan"}
                </h2>
                {hasAnyActive ? (
                  <>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-extrabold text-emerald-700">
                      Active
                    </span>
                    {/* Naming the modules matters when someone bought only one of
                        the two — the plan name alone does not say which. */}
                    {activeModules.map((module) => (
                      <span
                        key={module.id}
                        className="rounded-full bg-civic/10 px-2.5 py-1 text-[11.5px] font-bold text-civic"
                      >
                        {module.name}
                      </span>
                    ))}
                    {activePlan?.ends_at && (
                      <span className="text-xs text-slate-400">
                        Renews {new Date(activePlan.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-extrabold text-emerald-700">
                    Reading is unlimited
                  </span>
                )}
              </div>
              <Link
                href={hasAnyActive ? "/dashboard/purchases" : "/pricing"}
                className={`shrink-0 rounded-xl px-5 py-2.5 text-[13px] font-bold transition ${
                  hasAnyActive
                    ? "border border-line text-slate-700 hover:border-civic/40"
                    : "bg-civic text-white hover:brightness-110"
                }`}
              >
                {hasAnyActive ? "Manage plan" : "Upgrade"}
              </Link>
            </div>

            <div className="grid grid-cols-1 divide-y divide-line/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <PlanCell
                icon={<Zap className="h-4 w-4 text-civic" />}
                label="Tests you build"
                value={hasAnyActive ? "Unlimited" : `${freeTestsRemaining ?? FREE_TEST_LIMIT} of ${FREE_TEST_LIMIT} left`}
                note={
                  hasAnyActive
                    ? "Up to 100 questions per test, 25 per Mains test."
                    : "A one-time allowance, not monthly. Up to 50 questions per test."
                }
                meter={
                  hasAnyActive
                    ? null
                    : { used: FREE_TEST_LIMIT - (freeTestsRemaining ?? FREE_TEST_LIMIT), total: FREE_TEST_LIMIT, tone: "bg-civic" }
                }
              />
              <PlanCell
                icon={<Newspaper className="h-4 w-4 text-emerald-600" />}
                label="Current Affairs"
                value="All 6 sections"
                note="Reading is unlimited on every plan — there is no daily article cap."
                meter={null}
              />
              <PlanCell
                icon={<FolderOpen className="h-4 w-4 text-amber-600" />}
                label="Note repositories"
                value={
                  hasNotesPremium
                    ? "No caps"
                    : `${Math.max(0, FREE_MAX_NOTE_COLLECTIONS - collections.length)} of ${FREE_MAX_NOTE_COLLECTIONS} left`
                }
                note={
                  hasNotesPremium
                    ? "Unlimited repositories and saves. AI Notes Helper on."
                    : "10 articles per repository. Reading them costs nothing."
                }
                meter={
                  hasNotesPremium
                    ? null
                    : { used: Math.min(collections.length, FREE_MAX_NOTE_COLLECTIONS), total: FREE_MAX_NOTE_COLLECTIONS, tone: "bg-amber-500" }
                }
              />
            </div>
          </section>
        )}

        {/* ══ Module upgrade cards — only for what is not bought yet ════════ */}
        {!loadingPlan && modulesToOffer.length > 0 && (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {modulesToOffer.map((module) => {
              const price = cheapestPrice(module.planCode);
              return (
                <div
                  key={module.id}
                  className="flex flex-col gap-4 rounded-2xl border border-civic/25 bg-civic/[0.04] p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-civic shadow-card">
                        <Sparkles className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-[17px] font-bold text-ink">{module.cardTitle}</h3>
                        <p className="mt-0.5 text-[13px] text-slate-500">{module.tagline}</p>
                      </div>
                    </div>
                    {price && (
                      <div className="shrink-0 text-right">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">From</p>
                        <p className="text-[17px] font-extrabold tracking-tight text-ink">
                          {formatPrice(Number(price.amount_minor), price.currency)}
                          <span className="text-[12px] font-semibold text-slate-400">
                            {BILLING_INTERVAL_SHORT[price.billing_interval] ?? ""}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <ul className="flex flex-col gap-2">
                    {module.features.slice(0, 3).map((feature) => (
                      <li key={feature.label} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-civic" strokeWidth={2.5} />
                        <span className="text-[13.5px] leading-snug text-slate-700">
                          {feature.label}
                          <span className="text-slate-400"> — now {feature.free}</span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto flex items-center gap-3">
                    <Link
                      href={`/pricing?plan=${module.planCode}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-civic px-5 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110"
                    >
                      Subscribe
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href="/pricing"
                      className="text-[13px] font-semibold text-slate-600 hover:text-ink"
                    >
                      Compare all plans
                    </Link>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ══ Practice | Current Affairs ════════════════════════════════════ */}
        <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          {/* Practice */}
          <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-7 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Self-Preparation</p>
                <h2 className="mt-1.5 text-xl font-bold text-ink">
                  {inProgressAttempt ? "Pick up where you stopped" : "Today's drill is ready"}
                </h2>
              </div>
              <span className="shrink-0 rounded-full bg-civic/10 px-3 py-1.5 text-xs font-bold text-civic">
                {inProgressAttempt ? "In progress" : "Built for you"}
              </span>
            </div>

            {inProgressAttempt ? (
              <div className="flex items-center gap-5 rounded-2xl bg-midnight p-5 text-white">
                <div className="min-w-0 flex-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/55">Test in progress</p>
                  <p className="mt-1.5 truncate text-[17px] font-bold leading-snug">
                    {inProgressAttempt.test_template?.title ?? "Practice test"}
                  </p>
                  <p className="mt-1 text-[12.5px] text-white/65">
                    Started {formatRelativeTime(inProgressAttempt.started_at)}
                  </p>
                </div>
                <Link
                  href={`/assessment/attempts/${inProgressAttempt.id}`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-paper px-5 py-3.5 text-[13.5px] font-extrabold text-ink"
                >
                  <Play className="h-4 w-4" />
                  Resume
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-5 rounded-2xl bg-midnight p-5 text-white">
                <div className="min-w-0 flex-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/55">
                    {drillTopics.length
                      ? drillTopics.map((t) => t.taxonomy_name).join(" · ")
                      : "Mixed General Studies"}
                  </p>
                  <p className="mt-1.5 text-[17px] font-bold leading-snug">
                    {drillTopics.length
                      ? `20 questions from your ${drillTopics.length === 1 ? "weakest topic" : "two weakest topics"}`
                      : "Start with a 20-question mixed test"}
                  </p>
                  <p className="mt-1 text-[12.5px] text-white/65">
                    {drillTopics.length
                      ? `You are at ${drillTopics.map((t) => `${toPercent(t.avg_accuracy)}%`).join(" and ")} here`
                      : "We will pick your weak topics once you have some attempts"}
                  </p>
                </div>
                <Link
                  href={drillHref}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-paper px-5 py-3.5 text-[13.5px] font-extrabold text-ink"
                >
                  <Play className="h-4 w-4" />
                  Start
                </Link>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Or pick another</p>
              <DrillRow
                href={lastCompleted ? `/assessment/results/${lastCompleted.id}?filter=incorrect` : "/assessment/gk?view=performance"}
                icon={<RotateCcw className="h-4 w-4" />}
                tone="bg-rose-50 text-rose-600"
                title="Redo the ones you got wrong"
                note={lastCompleted ? `From ${lastCompleted.test_template?.title ?? "your last test"}` : "Available after your first test"}
              />
              <DrillRow
                href="/assessment/custom-test/create?content_type=gk&quick=10"
                icon={<Timer className="h-4 w-4" />}
                tone="bg-amber-50 text-amber-600"
                title="10-minute sprint"
                note="10 mixed GS questions, timed"
              />
              <DrillRow
                href="/current-affairs/prelims-pyq"
                icon={<HelpCircle className="h-4 w-4" />}
                tone="bg-emerald-50 text-emerald-600"
                title="Previous year questions"
                note="Prelims PYQs by subject and year"
              />
            </div>

            <div className="mt-auto flex items-center gap-3 border-t border-line/60 pt-4">
              <Link
                href="/assessment/custom-test/create"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-civic px-4 py-3 text-[13.5px] font-bold text-civic transition hover:bg-civic/5"
              >
                <Plus className="h-4 w-4" />
                Create a test
              </Link>
              <Link
                href="/assessment/test-series"
                className="flex flex-1 items-center justify-center rounded-xl border border-line px-4 py-3 text-[13.5px] font-bold text-slate-700 transition hover:border-civic/40"
              >
                Browse test series
              </Link>
            </div>
          </div>

          {/* Current affairs — every type, latest first */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex items-end justify-between gap-4 border-b border-line px-7 pb-4 pt-5">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <h2 className="mt-1 text-[23px] font-extrabold tracking-tight text-ink">Current Affairs</h2>
              </div>
              {activeArticles.length > 0 && (
                <div className="shrink-0 text-right">
                  <p className="text-[12.5px] font-bold text-emerald-600">
                    {readCount} of {activeArticles.length} read
                  </p>
                  <div className="mt-1.5 h-1.5 w-24 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${(readCount / activeArticles.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* type tabs — scrolls sideways rather than wrapping into two rows */}
            <div className="flex gap-1.5 overflow-x-auto border-b border-line/60 px-5 py-2.5">
              {CURRENT_AFFAIRS_HUBS.map((hub) => {
                const isActive = hub.path === activeHub;
                return (
                  <button
                    key={hub.path}
                    type="button"
                    onClick={() => setActiveHub(hub.path)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition ${
                      isActive ? "bg-civic/10 text-ink" : "text-slate-500 hover:bg-paper hover:text-ink"
                    }`}
                  >
                    {hub.shortLabel}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col px-7">
              {hubLoading === activeHub ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-civic border-t-transparent" />
                </div>
              ) : activeArticles.length > 0 ? (
                activeArticles.map((article: any, index: number) => (
                  <Link
                    key={article.id ?? article.slug}
                    href={articleHref(article.slug)}
                    className={`flex items-start gap-3 py-3.5 transition hover:opacity-80 ${
                      index < activeArticles.length - 1 ? "border-b border-line/60" : ""
                    }`}
                  >
                    {readSlugs.has(article.slug) ? (
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-[1.5px] border-slate-200" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink">{article.title}</p>
                      <p className="mt-1 flex items-center gap-2 text-[11.5px] text-slate-400">
                        {article.category?.name && <span className="truncate">{article.category.name}</span>}
                        {article.category?.name && article.publication_date && <span>·</span>}
                        {article.publication_date && (
                          <span className="shrink-0">
                            {new Date(article.publication_date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short"
                            })}
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                  </Link>
                ))
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-500">Nothing published in {activeHubDef.shortLabel} yet.</p>
                </div>
              )}
            </div>

            <div className="mt-auto flex items-center gap-4 border-t border-line/60 bg-slate-50 px-7 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-ink">
                  {dueRevisions.length > 0
                    ? `${dueRevisions.length} saved article${dueRevisions.length === 1 ? "" : "s"} due for revision`
                    : activeHubDef.label}
                </p>
                <p className="mt-0.5 truncate text-[12.5px] text-slate-500">
                  {dueRevisions.length > 0
                    ? dueRevisions
                        .slice(0, 2)
                        .map((r: any) => r.master_article?.title)
                        .filter(Boolean)
                        .join(" · ")
                    : "Reading is unlimited on every plan"}
                </p>
              </div>
              <Link
                href={hubHref(activeHubDef)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110"
              >
                All {activeHubDef.shortLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ══ All six Current Affairs sections ══════════════════════════════ */}
        <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-7 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="flex items-center gap-3.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Newspaper className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-ink">All six Current Affairs sections</h2>
                <p className="mt-0.5 text-[13.5px] text-slate-500">
                  Every section is free to read on every plan. There is no daily article cap.
                </p>
              </div>
            </div>
            <Link
              href="/current-affairs/daily-news"
              className="inline-flex shrink-0 items-center gap-1.5 text-[13.5px] font-bold text-emerald-600 hover:underline"
            >
              Browse the archive <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
            {(["prelims", "mains"] as const).map((family) => (
              <div key={family} className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    For {family === "prelims" ? "Prelims" : "Mains"}
                  </p>
                  <span className="h-px flex-1 bg-line/60" />
                </div>
                {CURRENT_AFFAIRS_HUBS.filter((hub) => hub.contentFamily === family).map((hub) => {
                  const Icon = HUB_ICONS[hub.path] ?? Newspaper;
                  return (
                    <Link
                      key={hub.path}
                      href={hubHref(hub)}
                      className="flex items-center gap-3.5 rounded-xl border border-line/60 p-3.5 transition hover:border-civic/30"
                    >
                      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14.5px] font-semibold text-ink">{hub.shortLabel}</p>
                        <p className="truncate text-[12.5px] text-slate-500">{hub.label}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">
                        Free
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {/* ══ Scorecard ═════════════════════════════════════════════════════ */}
        {totalTests > 0 && (
          <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 px-7 py-4">
              <div className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgb(209_250_229)]" />
                <h2 className="text-[17px] font-semibold text-ink">Your scorecard</h2>
                <span className="text-[12.5px] text-slate-400">Across {totalTests} tests</span>
              </div>
              <Link
                href="/assessment/dashboard"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-civic hover:underline"
              >
                Open full scorecard <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 divide-y divide-line/60 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
              <div className="flex items-center gap-5 p-6 lg:col-span-4">
                <AccuracyDial value={overallAccuracy} />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <StatRow label="General Studies" value={`${gkAccuracy}%`} />
                  <StatRow label="CSAT / Aptitude" value={`${csatAccuracy}%`} />
                  <StatRow
                    label="Mains evaluated"
                    value={stats?.mains?.summary?.avg_score ? Number(stats.mains.summary.avg_score).toFixed(1) : "—"}
                  />
                  <StatRow label="Awaiting review" value={String(stats?.mains?.summary?.pending_count ?? 0)} />
                </div>
              </div>

              <div className="p-6 lg:col-span-8">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Where you are losing marks
                </p>
                {weakTopics.length > 0 ? (
                  <div className="mt-4 space-y-3.5">
                    {weakTopics.map((topic) => {
                      const pct = toPercent(topic.avg_accuracy);
                      return (
                        <div key={topic.taxonomy_node_id} className="flex items-center gap-4">
                          <span className="w-44 shrink-0 truncate text-sm font-semibold text-slate-700">
                            {topic.taxonomy_name}
                          </span>
                          <div className="h-2 flex-1 rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${pct < 55 ? "bg-rose-500" : "bg-amber-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-24 shrink-0 text-right text-[13px] text-slate-500">
                            {pct}% · {Number(topic.question_count ?? 0)} Qs
                          </span>
                        </div>
                      );
                    })}
                    <Link
                      href={drillHref}
                      className="mt-1 inline-flex items-center gap-2 rounded-xl bg-civic px-4 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Build a test on these
                    </Link>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    Answer a few more questions and your weakest topics will show up here.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ══ Syllabus coverage ═════════════════════════════════════════════ */}
        {coverage && (
          <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-7 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <h3 className="text-[17px] font-semibold text-ink">Syllabus coverage</h3>
                <span className="text-[13px] text-slate-500">
                  {coverage.attempted} of {coverage.total} GS topics attempted ·{" "}
                  {coverage.total - coverage.attempted} never touched
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <Legend className="bg-civic" label="Strong" />
                <Legend className="bg-indigo-300" label="Getting there" />
                <Legend className="bg-rose-500" label="Weak" />
                <Legend className="bg-slate-200" label="Never attempted" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
              {coverage.columns.map((column) => (
                <div key={column.name} className="flex flex-col gap-2.5">
                  <p className="truncate text-[12.5px] font-semibold text-slate-600">{column.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {column.cells.slice(0, 24).map((cell) => (
                      <span
                        key={cell.id}
                        className={`h-5 w-5 rounded ${
                          cell.state === "strong"
                            ? "bg-civic"
                            : cell.state === "mid"
                              ? "bg-indigo-300"
                              : cell.state === "weak"
                                ? "bg-rose-500"
                                : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {coverage.total > coverage.attempted && (
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-civic/25 bg-civic/5 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">
                    {coverage.total - coverage.attempted} topics you have not touched yet
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-slate-600">
                    Pick a few and build a test straight from them.
                  </p>
                </div>
                <Link
                  href="/assessment/custom-test/create?content_type=gk"
                  className="shrink-0 rounded-xl bg-civic px-5 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110"
                >
                  Fill the gaps
                </Link>
              </div>
            )}
          </section>
        )}

        {/* ══ Mentorship | Notes ════════════════════════════════════════════ */}
        <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-7 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                  <GraduationCap className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-ink">Mentorship</h2>
                  <p className="mt-0.5 text-[13.5px] text-slate-500">People who have cleared it</p>
                </div>
              </div>
              {upcomingSession && (
                <span className="shrink-0 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700">
                  {formatSessionTime(upcomingSession.session_starts_at)}
                </span>
              )}
            </div>

            <p className="text-[14.5px] leading-relaxed text-slate-600">
              Send a Mains answer for a written evaluation, or book a 1:1 call with a verified mentor to talk
              through strategy and your weak areas.
            </p>

            <div className="flex flex-col gap-2.5">
              {upcomingSession && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-line/60 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-purple-50 text-[13px] font-extrabold text-purple-700">
                      {(upcomingSession.mentor_name ?? "M").slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {upcomingSession.mentor_name ?? "Your mentor"}
                      </p>
                      <p className="text-xs text-slate-400">{formatSessionTime(upcomingSession.session_starts_at)}</p>
                    </div>
                  </div>
                  <Link
                    href="/mentorship"
                    className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-slate-600"
                  >
                    Details
                  </Link>
                </div>
              )}
              {pendingEvaluation && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-line/60 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-500">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">Answer in review</p>
                      <p className="text-xs text-slate-400">
                        Submitted {formatRelativeTime(pendingEvaluation.updated_at ?? pendingEvaluation.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-amber-600">Pending</span>
                </div>
              )}
              {!upcomingSession && !pendingEvaluation && (
                <div className="rounded-xl border border-dashed border-line p-4">
                  <p className="text-[13.5px] text-slate-500">
                    Nothing booked yet. Mentorship is priced per session — no plan required.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-3">
              <Link
                href="/mentorship"
                className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-600"
              >
                Book an evaluation
              </Link>
              <Link
                href="/mentors"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-ink"
              >
                Find a mentor <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-7 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <FolderOpen className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-ink">Notes</h2>
                  <p className="mt-0.5 text-[13.5px] text-slate-500">
                    Turn what you read into your own material
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                {collections.length} {collections.length === 1 ? "repository" : "repositories"}
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              <NoteFeatureRow
                title="Repositories"
                note={
                  hasNotesPremium
                    ? "Unlimited on your plan"
                    : `Up to ${FREE_MAX_NOTE_COLLECTIONS}, with 10 articles in each`
                }
                premium={hasNotesPremium}
              />
              <NoteFeatureRow
                title="Highlights & notes on articles"
                note={hasNotesPremium ? "No per-article cap" : "20 highlights and 10 notes per article"}
                premium={hasNotesPremium}
              />
              <NoteFeatureRow title="Tags, collections & export" note="Take a repository out as a document" premium={false} />
              <NoteFeatureRow
                title="AI Notes Helper"
                note="Study notes and quizzes from your saved articles"
                premium
                locked={!hasNotesPremium}
              />
            </div>

            {collections.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                {collections.slice(0, 2).map((collection: any) => (
                  <div key={collection.id} className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-ink">{collection.name}</p>
                    <p className="text-xs text-slate-400">{collection.item_count ?? 0} articles</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-3">
              <Link
                href="/current-affairs/workspace/create"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white transition hover:brightness-110"
              >
                <Plus className="h-4 w-4" />
                Create notes
              </Link>
              <Link
                href="/current-affairs/workspace"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-ink"
              >
                Open workspace <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ══ Study plan ════════════════════════════════════════════════════ */}
        {enrolledPlan ? (
          <section className="flex flex-wrap items-center gap-6 rounded-2xl border border-line bg-surface px-7 py-6 shadow-card">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-civic/10 text-civic">
              <BookOpenCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold text-ink">{enrolledPlan.title}</h3>
                <span className="text-[13px] text-slate-500">
                  {enrolledPlan.duration_weeks ? `${enrolledPlan.duration_weeks} weeks` : ""}
                  {enrolledPlan.test_count ? ` · ${enrolledPlan.test_count} tests` : ""}
                </span>
              </div>
              {enrolledPlan.subtitle && (
                <p className="mt-1.5 truncate text-[13px] text-slate-500">{enrolledPlan.subtitle}</p>
              )}
            </div>
            <Link
              href={`/study-plans/${enrolledPlan.id}`}
              className="shrink-0 rounded-xl border border-line px-5 py-3 text-[13.5px] font-bold text-slate-700 transition hover:border-civic/40"
            >
              Open plan
            </Link>
          </section>
        ) : (
          <section className="flex flex-wrap items-center gap-6 rounded-2xl border border-dashed border-line bg-surface px-7 py-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-civic/10 text-civic">
              <BookOpenCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-ink">You are not on a study plan yet</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">
                A plan decides what you do each morning, so you are not choosing from the whole syllabus on your own.
              </p>
            </div>
            <Link
              href="/study-plans"
              className="shrink-0 rounded-xl bg-civic px-5 py-3 text-[13.5px] font-bold text-white transition hover:brightness-110"
            >
              Browse plans
            </Link>
          </section>
        )}

        {/* ══ Featured mentors ══════════════════════════════════════════════ */}
        {featuredMentors.length > 0 && (
          <section className="flex flex-col gap-5">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div className="flex flex-wrap items-baseline gap-3.5">
                <h2 className="text-lg font-semibold text-ink">Featured mentors</h2>
                <span className="text-[13px] text-slate-400">Verified, and taking bookings</span>
              </div>
              <Link href="/mentors" className="text-[13.5px] font-bold text-purple-700 hover:underline">
                See all mentors
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {featuredMentors.map((mentor: any) => {
                const image = resolveMediaUrl(mentor.profile_image_url);
                return (
                  <div
                    key={mentor.id}
                    className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-6 shadow-card"
                  >
                    <div className="flex items-center gap-3.5">
                      {image ? (
                        <img src={image} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-50 text-[15px] font-extrabold text-purple-700">
                          {(mentor.display_name ?? "M").slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-bold text-ink">{mentor.display_name}</p>
                        <p className="truncate text-[12.5px] text-slate-500">
                          {mentor.headline ?? (mentor.years_experience ? `${mentor.years_experience} yrs experience` : "Mentor")}
                        </p>
                      </div>
                    </div>
                    {mentor.specialization_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {mentor.specialization_tags.slice(0, 2).map((tag: string) => (
                          <span
                            key={tag}
                            className="rounded-md bg-slate-100 px-2.5 py-0.5 text-[11.5px] font-semibold text-slate-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {mentor.is_verified && (
                      <div className="flex items-center gap-2 text-[12.5px] text-slate-500">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-bold text-ink">Verified</span>
                        {mentor.city && <span>· {mentor.city}</span>}
                      </div>
                    )}
                    <Link
                      href={`/mentors/${mentor.id}`}
                      className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-purple-600"
                    >
                      View profile
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ══ Latest study plans ════════════════════════════════════════════ */}
        {latestPlans.length > 0 && (
          <section className="flex flex-col gap-5">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div className="flex flex-wrap items-baseline gap-3.5">
                <h2 className="text-lg font-semibold text-ink">Latest study plans</h2>
                <span className="text-[13px] text-slate-400">Structured, week by week</span>
              </div>
              <Link href="/study-plans" className="text-[13.5px] font-bold text-civic hover:underline">
                Browse all plans
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {latestPlans.map((plan: any) => (
                <div
                  key={plan.id}
                  className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-6 shadow-card"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-civic/10 px-3 py-1 text-[11.5px] font-extrabold text-civic">
                      {plan.exam_name ?? plan.level_label ?? "Plan"}
                    </span>
                    {plan.duration_weeks && (
                      <span className="text-[12.5px] text-slate-400">{plan.duration_weeks} weeks</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-[17px] font-semibold leading-snug text-ink">{plan.title}</h3>
                    {plan.subtitle && (
                      <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-slate-500">
                        {plan.subtitle}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 border-t border-line/60 pt-3.5 text-[12.5px] text-slate-600">
                    {plan.item_count > 0 && <span>{plan.item_count} items in the schedule</span>}
                    {plan.test_count > 0 && <span>{plan.test_count} tests included</span>}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-slate-400">
                      {plan.total_reviews > 0 ? `${plan.total_reviews} reviews` : "New"}
                    </span>
                    <Link
                      href={`/study-plans/${plan.id}`}
                      className="rounded-xl border border-line px-4 py-2 text-[12.5px] font-bold text-slate-700 transition hover:border-civic/40"
                    >
                      View plan
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ══ Also in your account ══════════════════════════════════════════ */}
        <section className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold text-slate-400">Also in your account</span>
          {[
            { href: "/assessment/dashboard", label: "Scorecard" },
            { href: "/assessment/test-series", label: "Test Series" },
            { href: "/assessment/gk?view=revision", label: "Bookmarks & Revision" },
            { href: "/dashboard/purchases", label: "Purchases" },
            { href: "/become-mentor", label: "Become a Mentor" }
          ].map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              className="rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-slate-600 transition hover:border-civic/40 hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}

/* ── small building blocks ─────────────────────────────────────────────── */

function PlanCell({
  icon,
  label,
  value,
  note,
  meter
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  meter: { used: number; total: number; tone: string } | null;
}) {
  return (
    <div className="flex flex-col gap-3 p-6">
      <div className="flex items-center gap-2.5">
        {icon}
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      </div>
      <p className="text-[22px] font-extrabold tracking-tight text-ink">{value}</p>
      {meter && (
        <div className="flex gap-1.5">
          {Array.from({ length: meter.total }).map((_, index) => (
            <span
              key={index}
              className={`h-2 flex-1 rounded-full ${index < meter.used ? "bg-slate-200" : meter.tone}`}
            />
          ))}
        </div>
      )}
      <p className="text-[12.5px] leading-relaxed text-slate-500">{note}</p>
    </div>
  );
}

function DrillRow({
  href,
  icon,
  tone,
  title,
  note
}: {
  href: string;
  icon: React.ReactNode;
  tone: string;
  title: string;
  note: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-xl border border-line/60 p-3.5 transition hover:border-civic/30"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${tone}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="truncate text-[12.5px] text-slate-500">{note}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
    </Link>
  );
}

function NoteFeatureRow({
  title,
  note,
  premium,
  locked = false
}: {
  title: string;
  note: string;
  premium: boolean;
  locked?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3.5 rounded-xl border p-3.5 ${
        premium ? "border-civic/25 bg-civic/5" : "border-line/60"
      }`}
    >
      <span
        className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] ${
          premium ? "bg-surface text-civic" : "bg-slate-100 text-slate-500"
        }`}
      >
        {locked ? <Lock className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="truncate text-[12.5px] text-slate-500">{note}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
          premium ? "bg-civic/10 text-civic" : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {premium ? "Premium" : "Free"}
      </span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[13px]">
      <span className="text-slate-600">{label}</span>
      <span className="font-bold text-ink">{value}</span>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-[11px] w-[11px] rounded-[3px] ${className}`} />
      {label}
    </span>
  );
}

function AccuracyDial({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 50;
  const filled = Math.max(0, Math.min(100, value)) / 100;
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24 shrink-0">
      <circle cx="60" cy="60" r="50" fill="none" strokeWidth="13" className="stroke-slate-100" />
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        strokeWidth="13"
        strokeLinecap="round"
        stroke="#4f46e5"
        strokeDasharray={`${circumference * filled} ${circumference}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="57" textAnchor="middle" className="fill-ink" fontSize="25" fontWeight="800">
        {value}%
      </text>
      <text x="60" y="75" textAnchor="middle" className="fill-slate-400" fontSize="9.5" fontWeight="600">
        ACCURACY
      </text>
    </svg>
  );
}
