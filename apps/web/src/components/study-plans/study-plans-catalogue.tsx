"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PLAN_TYPE_CLASS,
  PLAN_TYPE_LABEL,
  formatDuration,
  formatPlanPrice,
  studyPlanHref,
  type StudyPlanSummary,
  type StudyPlanType
} from "../../lib/study-plans";
import { browserBaseUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-context";

/**
 * The study-plan catalogue.
 *
 * Type is the primary axis because it is the first real decision a learner
 * makes — be taught, study alone, or only be tested — and until migration 055
 * the data could not express it at all. The facets below narrow within that.
 *
 * Markup and class names come from the approved design mockup; the styles live
 * in app/study-plans/study-plans-design.css, ported mechanically from it.
 */

type Facets = {
  type: StudyPlanType | null;
  stage: string | null;
  subject: string | null;
  length: "short" | "medium" | "long" | null;
};

const EMPTY_FACETS: Facets = { type: null, stage: null, subject: null, length: null };

const LENGTH_LABEL: Record<NonNullable<Facets["length"]>, string> = {
  short: "Under a month",
  medium: "1–3 months",
  long: "3 months +"
};

function lengthBucket(weeks: number): NonNullable<Facets["length"]> {
  if (weeks <= 4) return "short";
  if (weeks <= 12) return "medium";
  return "long";
}

async function browserJson<T>(path: string, token?: string): Promise<T> {
  const headers = new Headers({ accept: "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${browserBaseUrl}${path}`, { headers, cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

/** The per-type headline the three filter cards carry. */
const TYPE_CARDS: { type: StudyPlanType; heading: string; blurb: string }[] = [
  {
    type: "full_course",
    heading: "Taught, with video",
    blurb: "Recorded lectures and live classes, plus materials and tests inside the schedule."
  },
  {
    type: "self_prep",
    heading: "Study materials and tests",
    blurb: "Reading, revision and tests laid out week by week. No lectures — you set the pace."
  },
  {
    type: "test_series",
    heading: "Only tests and discussion",
    blurb: "A fixed test calendar with answer discussion after each paper."
  }
];

function priceLine(plan: StudyPlanSummary): { label: string; free: boolean } {
  if (plan.access_mode === "free" || Number(plan.price_amount_minor) === 0) {
    return { label: "Free", free: true };
  }
  if (plan.access_mode === "subscription" && plan.covered_by_subscription) {
    return { label: "Included", free: true };
  }
  return { label: formatPlanPrice(plan.price_amount_minor, plan.currency), free: false };
}

/** The type-specific stat chips — a course counts lectures, a series counts papers. */
function planChips(plan: StudyPlanSummary): string[] {
  const tests = Number(plan.test_count ?? 0);
  const items = Number(plan.item_count ?? 0);
  if (plan.plan_type === "full_course") {
    return [`${Math.max(0, items - tests)} lectures`, `${tests} tests`];
  }
  if (plan.plan_type === "test_series") {
    return [`${tests} tests`, "Discussion"];
  }
  return [`${Math.max(0, items - tests)} readings`, `${tests} tests`];
}

function PlanCard({ plan }: { plan: StudyPlanSummary }) {
  const price = priceLine(plan);
  const weeklyHours = Number(plan.weekly_hours ?? 0);
  const subline = [
    formatDuration(plan.duration_weeks),
    weeklyHours > 0 ? `${weeklyHours} h/week` : null,
    plan.subject_name,
    plan.level_label
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link className="sp-c sp-pcard" href={studyPlanHref(`/${plan.id}`)}>
      <div className="sp-pcard-body">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <span className={`sp-type ${PLAN_TYPE_CLASS[plan.plan_type]}`}>{PLAN_TYPE_LABEL[plan.plan_type]}</span>
          {plan.has_access ? (
            <span className="sp-pill sp-pill--inc">Enrolled</span>
          ) : plan.access_mode === "subscription" && !plan.covered_by_subscription ? (
            <span className="sp-pill sp-pill--lock">Needs subscription</span>
          ) : Number(plan.total_reviews ?? 0) > 0 ? (
            <span className="sp-pill">
              {Number(plan.average_rating ?? 0).toFixed(1)} ★ · {plan.total_reviews}
            </span>
          ) : null}
        </div>

        <h4>{plan.title}</h4>
        {subline && <p className="sp-sub">{subline}</p>}

        <div className="sp-meta">
          {planChips(plan).map((chip) => (
            <span className="sp-pill" key={chip}>
              {chip}
            </span>
          ))}
        </div>

        {plan.subtitle && <p style={{ margin: 0, fontSize: 12, color: "var(--sp-ink-soft)" }}>{plan.subtitle}</p>}
      </div>

      <div className="sp-pcard-foot">
        <span className={`sp-price${price.free ? " sp-price--free" : ""}`}>{price.label}</span>
        <span className={`sp-btn sp-btn--sm${plan.has_access ? " sp-btn--p" : ""}`}>
          {plan.has_access ? "Continue" : "View plan"}
        </span>
      </div>
    </Link>
  );
}

export function StudyPlansCatalogue({
  initialPlans,
  exams,
  examId
}: {
  initialPlans: StudyPlanSummary[];
  exams: { id: number; name: string }[];
  examId?: string;
}) {
  const { token, isInitialized } = useAuth();
  const [plans, setPlans] = useState(initialPlans);
  const [facets, setFacets] = useState<Facets>(EMPTY_FACETS);

  // The server render is anonymous so the page paints fast; once a token is
  // available the same list is refetched, which is what fills in has_access
  // and subscription coverage per plan.
  useEffect(() => {
    if (!isInitialized || !token) return;
    const search = new URLSearchParams({ limit: "60", offset: "0", status: "published" });
    if (examId) search.set("exam_id", examId);
    void browserJson<StudyPlanSummary[]>(`/api/v1/study-plans?${search}`, token)
      .then(setPlans)
      .catch(() => {});
  }, [token, isInitialized, examId]);

  const stages = useMemo(
    () => [...new Set(plans.map((plan) => plan.level_label).filter((value): value is string => Boolean(value)))],
    [plans]
  );
  const subjects = useMemo(
    () => [...new Set(plans.map((plan) => plan.subject_name).filter((value): value is string => Boolean(value)))],
    [plans]
  );

  const countsByType = useMemo(() => {
    const counts: Record<StudyPlanType, number> = { full_course: 0, self_prep: 0, test_series: 0 };
    for (const plan of plans) counts[plan.plan_type] = (counts[plan.plan_type] ?? 0) + 1;
    return counts;
  }, [plans]);

  const cheapestByType = useMemo(() => {
    const cheapest: Record<StudyPlanType, number | null> = {
      full_course: null,
      self_prep: null,
      test_series: null
    };
    for (const plan of plans) {
      const amount = Number(plan.price_amount_minor ?? 0);
      const current = cheapest[plan.plan_type];
      if (current === null || amount < current) cheapest[plan.plan_type] = amount;
    }
    return cheapest;
  }, [plans]);

  const visible = useMemo(
    () =>
      plans.filter((plan) => {
        if (facets.type && plan.plan_type !== facets.type) return false;
        if (facets.stage && plan.level_label !== facets.stage) return false;
        if (facets.subject && plan.subject_name !== facets.subject) return false;
        if (facets.length && lengthBucket(plan.duration_weeks) !== facets.length) return false;
        return true;
      }),
    [plans, facets]
  );

  const enrolledCount = plans.filter((plan) => plan.has_access).length;
  const toggle = <K extends keyof Facets>(key: K, value: Facets[K]) =>
    setFacets((current) => ({ ...current, [key]: current[key] === value ? null : value }));

  return (
    <div className="sp-root" style={{ background: "var(--sp-bg)", minHeight: "100vh" }}>
      <main
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "28px 20px 72px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontFamily: "var(--sp-body)",
          color: "var(--sp-ink)"
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div>
            <p
              style={{
                fontFamily: "var(--sp-mono)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: ".13em",
                textTransform: "uppercase",
                color: "var(--sp-ink-faint)",
                margin: 0
              }}
            >
              Guided preparation
            </p>
            <h2 style={{ fontSize: 24, marginTop: 3 }}>Study plans</h2>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--sp-ink-soft)" }}>
              Pick a plan, choose a start date, follow it day by day.
            </p>
          </div>
          {enrolledCount > 0 && (
            <Link className="sp-btn" href="/dashboard/purchases">
              My plans · {enrolledCount}
            </Link>
          )}
        </div>

        <div className="sp-cat-top">
          {TYPE_CARDS.map((card) => {
            const cheapest = cheapestByType[card.type];
            const count = countsByType[card.type] ?? 0;
            return (
              <button
                type="button"
                className="sp-cat-type"
                key={card.type}
                aria-pressed={facets.type === card.type}
                onClick={() => toggle("type", card.type)}
              >
                <span className={`sp-type ${PLAN_TYPE_CLASS[card.type]}`}>{PLAN_TYPE_LABEL[card.type]}</span>
                <h4>{card.heading}</h4>
                <p>{card.blurb}</p>
                <span className="sp-n">
                  {count} plan{count === 1 ? "" : "s"}
                  {cheapest !== null && count > 0
                    ? cheapest === 0
                      ? " · from free"
                      : ` · from ${formatPlanPrice(cheapest, "INR")}`
                    : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="sp-c">
          <div className="sp-facets">
            {exams.length > 1 && (
              <>
                <span className="sp-facet-lab">Exam</span>
                {exams.map((exam) => (
                  <Link
                    className="sp-facet"
                    data-on={String(exam.id) === examId ? "1" : "0"}
                    href={String(exam.id) === examId ? studyPlanHref() : `${studyPlanHref()}?exam_id=${exam.id}`}
                    key={exam.id}
                  >
                    {exam.name}
                  </Link>
                ))}
                <span style={{ width: 10 }} />
              </>
            )}

            {stages.length > 0 && (
              <>
                <span className="sp-facet-lab">Stage</span>
                {stages.map((stage) => (
                  <button
                    type="button"
                    className="sp-facet"
                    data-on={facets.stage === stage ? "1" : "0"}
                    key={stage}
                    onClick={() => toggle("stage", stage)}
                  >
                    {stage}
                  </button>
                ))}
                <span style={{ width: 10 }} />
              </>
            )}

            <span className="sp-facet-lab">Length</span>
            {(Object.keys(LENGTH_LABEL) as NonNullable<Facets["length"]>[]).map((bucket) => (
              <button
                type="button"
                className="sp-facet"
                data-on={facets.length === bucket ? "1" : "0"}
                key={bucket}
                onClick={() => toggle("length", bucket)}
              >
                {LENGTH_LABEL[bucket]}
              </button>
            ))}

            {subjects.length > 0 && (
              <>
                <span style={{ width: 10 }} />
                <span className="sp-facet-lab">Subject</span>
                {subjects.slice(0, 6).map((subject) => (
                  <button
                    type="button"
                    className="sp-facet"
                    data-on={facets.subject === subject ? "1" : "0"}
                    key={subject}
                    onClick={() => toggle("subject", subject)}
                  >
                    {subject}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <div
            className="sp-c"
            style={{ padding: "40px 20px", textAlign: "center", color: "var(--sp-ink-soft)", fontSize: 13.5 }}
          >
            {plans.length === 0
              ? "No published study plans yet."
              : "No plans match these filters."}
            {plans.length > 0 && (
              <button
                type="button"
                className="sp-btn sp-btn--sm"
                style={{ marginLeft: 10 }}
                onClick={() => setFacets(EMPTY_FACETS)}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="sp-grid3">
            {visible.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
