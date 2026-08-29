"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  PLAN_TYPE_CLASS,
  PLAN_TYPE_LABEL,
  formatPlanPrice,
  studyPlanHref,
  type StudyPlanDetail,
  type StudyPlanItem,
  type StudyPlanType
} from "../../lib/study-plans";

/**
 * The plan detail page for someone who is not enrolled.
 *
 * A decision page, not a locked inventory. The old layout answered "does
 * content exist" by listing every week with a padlock; this answers the
 * questions a learner actually has — how long per day, what will I get, can I
 * try it — and states the week structure as a scannable table rather than a
 * 24-row accordion.
 *
 * Markup and class names come from the approved design mockup; styles live in
 * app/study-plans/study-plans-design.css, ported mechanically from it.
 */

const TEST_TYPES = new Set(["prelims_test", "csat_test", "mains_test"]);

function isTest(item: StudyPlanItem): boolean {
  return TEST_TYPES.has(item.item_type);
}

function isLecture(item: StudyPlanItem): boolean {
  return item.item_type === "live_lecture" || Boolean(item.lecture_url);
}

/** Groups items into their plan weeks, preserving plan order. */
function byWeek(items: StudyPlanItem[]): Map<number, StudyPlanItem[]> {
  const weeks = new Map<number, StudyPlanItem[]>();
  for (const item of items) {
    const bucket = weeks.get(item.week_no);
    if (bucket) bucket.push(item);
    else weeks.set(item.week_no, [item]);
  }
  return new Map([...weeks.entries()].sort((a, b) => a[0] - b[0]));
}

/** "7 readings · 2 topic tests" — what a week contains, in that plan's vocabulary. */
function weekContents(items: StudyPlanItem[], planType: StudyPlanType): string {
  const tests = items.filter(isTest).length;
  const lectures = items.filter(isLecture).length;
  const rest = items.length - tests - lectures;
  const parts: string[] = [];
  if (planType === "full_course") {
    if (lectures + rest > 0) parts.push(`${lectures + rest} lecture${lectures + rest === 1 ? "" : "s"}`);
  } else if (rest > 0) {
    parts.push(`${rest} reading${rest === 1 ? "" : "s"}`);
  }
  if (tests > 0) parts.push(`${tests} test${tests === 1 ? "" : "s"}`);
  return parts.join(" · ") || "—";
}

function weekMinutes(items: StudyPlanItem[]): number {
  return items.reduce((total, item) => total + Number(item.estimated_minutes ?? 0), 0);
}

function formatHours(minutes: number): string {
  if (minutes <= 0) return "—";
  const hours = minutes / 60;
  return hours >= 1 ? `${Math.round(hours)} h` : `${minutes} m`;
}

/** The type-specific fact strip — five things a buyer wants before anything else. */
function facts(plan: StudyPlanDetail): { value: string; label: string }[] {
  const items = plan.items ?? [];
  const tests = items.filter(isTest).length;
  const nonTests = items.length - tests;
  const weeklyHours = Number(plan.weekly_hours ?? 0);
  const totalQuestions = items
    .filter(isTest)
    .reduce((total, item) => total + Number(item.test_template?.question_count ?? 0), 0);

  const common = [
    { value: `${plan.duration_weeks} weeks`, label: "Duration" },
    { value: weeklyHours > 0 ? `${weeklyHours} h` : "—", label: "Per week" }
  ];

  if (plan.plan_type === "full_course") {
    return [
      ...common,
      { value: String(nonTests), label: "Lectures" },
      { value: formatHours(weekMinutes(items)), label: "Video" },
      { value: "Anytime", label: "Start date" }
    ];
  }
  if (plan.plan_type === "test_series") {
    return [
      ...common,
      { value: String(tests), label: "Tests" },
      { value: totalQuestions > 0 ? String(totalQuestions) : "—", label: "Questions" },
      { value: "Fixed", label: "Calendar" }
    ];
  }
  return [
    ...common,
    { value: String(nonTests), label: "Readings" },
    { value: String(tests), label: "Tests" },
    { value: "Anytime", label: "Start date" }
  ];
}

/** What the plan includes, and — just as important — what it does not. */
function inclusions(plan: StudyPlanDetail): { text: string; bold: string; yes: boolean }[] {
  const items = plan.items ?? [];
  const tests = items.filter(isTest).length;
  const nonTests = items.length - tests;
  const resources = items.reduce((total, item) => total + (item.resources?.length ?? 0), 0);

  if (plan.plan_type === "full_course") {
    return [
      { bold: `${nonTests} recorded lectures`, text: "watch any time, downloadable slides", yes: true },
      { bold: "Live classes", text: "with the recording posted the same evening", yes: true },
      { bold: `${tests} tests`, text: "inside the schedule, with full solutions", yes: true },
      { bold: "Class notes and handouts", text: "for every lecture", yes: true },
      { bold: "", text: "Not included in any subscription — sold on its own", yes: false }
    ];
  }
  if (plan.plan_type === "test_series") {
    return [
      { bold: `${tests} papers`, text: "on a fixed calendar, open forever once released", yes: true },
      { bold: "Full solutions", text: "and a topic-wise breakdown into your scorecard", yes: true },
      { bold: "Discussion thread per paper", text: "— coming soon", yes: true },
      { bold: "", text: "No lectures and no study material — tests only", yes: false }
    ];
  }
  return [
    { bold: `${nonTests} study readings`, text: "with a summary sheet each", yes: true },
    { bold: `${tests} tests`, text: "placed after each block of reading", yes: true },
    { bold: `${resources} downloadable resources`, text: "across the plan", yes: true },
    { bold: "Progress and pace tracking", text: "against your own start date", yes: true },
    { bold: "", text: "No video lectures — this plan is reading-led", yes: false }
  ];
}

function sampleCopy(planType: StudyPlanType): { icon: string; badge: string; cta: string } {
  if (planType === "full_course") return { icon: "▶", badge: "Free sample lecture", cta: "Watch now" };
  if (planType === "test_series") return { icon: "✎", badge: "Free sample paper", cta: "Take the test" };
  return { icon: "📄", badge: "Free sample · no sign-up", cta: "Open the day" };
}

export function StudyPlanDecisionPage({
  plan,
  isSignedIn,
  onEnrol,
  busy,
  message
}: {
  plan: StudyPlanDetail;
  isSignedIn: boolean;
  onEnrol: () => void;
  busy: boolean;
  message: string | null;
}) {
  const weeks = useMemo(() => byWeek(plan.items ?? []), [plan.items]);
  const sample = (plan.items ?? []).find((item) => item.is_preview) ?? null;
  const sampleText = sampleCopy(plan.plan_type);
  const totalMinutes = weekMinutes(plan.items ?? []);
  const isFree = plan.access_mode === "free" || Number(plan.price_amount_minor) === 0;
  const covered = plan.covered_by_subscription === true;

  return (
    <div className="sp-root" style={{ background: "var(--sp-bg)", minHeight: "100vh" }}>
      <main
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "24px 20px 72px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontFamily: "var(--sp-body)",
          color: "var(--sp-ink)"
        }}
      >
        <Link
          href={studyPlanHref()}
          style={{
            fontFamily: "var(--sp-mono)",
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--sp-ink-faint)",
            textDecoration: "none"
          }}
        >
          ← All study plans
        </Link>

        {/* Header + fact strip */}
        <div className="sp-c">
          <div style={{ padding: "18px 20px" }}>
            <span className={`sp-type ${PLAN_TYPE_CLASS[plan.plan_type]}`}>{PLAN_TYPE_LABEL[plan.plan_type]}</span>
            <h2 style={{ fontSize: 26, margin: "9px 0 0", letterSpacing: "-.02em" }}>{plan.title}</h2>
            {plan.subtitle && (
              <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--sp-ink-soft)", maxWidth: "62ch" }}>
                {plan.subtitle}
              </p>
            )}
          </div>
          <div className="sp-facts">
            {facts(plan).map((fact) => (
              <div className="sp-fact" key={fact.label}>
                <span className="sp-v">{fact.value}</span>
                <span className="sp-k">{fact.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Free sample — a real openable item, not a locked list */}
        {sample && (
          <div className="sp-sample">
            <div className="sp-thumb">{sampleText.icon}</div>
            <div>
              <span className="sp-pill sp-pill--inc">{sampleText.badge}</span>
              <h4 style={{ marginTop: 7 }}>
                Week {sample.week_no}, Day {sample.day_no} — {sample.title}
              </h4>
              <p>
                {sample.estimated_minutes ? `${sample.estimated_minutes} minutes. ` : ""}
                Open it before deciding — no sign-up needed.
              </p>
            </div>
            <Link className="sp-btn sp-btn--p" href={studyPlanHref(`/${plan.id}/items/${sample.id}`)}>
              {sampleText.cta}
            </Link>
          </div>
        )}

        {/* Week table */}
        <div className="sp-c">
          <div className="sp-ph">
            <div>
              <h3>{plan.plan_type === "test_series" ? "The test calendar" : "What each week looks like"}</h3>
              <p className="sp-hint">
                {plan.plan_type === "test_series"
                  ? "Papers unlock on their date; every paper stays open afterwards."
                  : "Every week, and what sits inside it."}
              </p>
            </div>
            <span className="sp-pill">
              {plan.items?.length ?? 0} items · {formatHours(totalMinutes)} total
            </span>
          </div>
          <table className="sp-wt">
            <thead>
              <tr>
                <th>Week</th>
                <th>Theme</th>
                <th>What&apos;s inside</th>
                <th style={{ textAlign: "right" }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {[...weeks.entries()].map(([weekNo, items]) => {
                const overview = plan.week_overviews?.find((week) => week.week_no === weekNo);
                return (
                  <tr key={weekNo}>
                    <td className="sp-wk">Week {weekNo}</td>
                    <td className="sp-th">{overview?.title ?? `Week ${weekNo}`}</td>
                    <td>
                      {weekContents(items, plan.plan_type)}
                      <br />
                      <span style={{ color: "var(--sp-ink-faint)", fontSize: 11.5 }}>
                        {items
                          .slice(0, 4)
                          .map((item) => item.title)
                          .join(", ")}
                        {items.length > 4 ? "…" : ""}
                      </span>
                    </td>
                    <td className="sp-hrs">{formatHours(weekMinutes(items))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Inclusions */}
        <div className="sp-c">
          <div className="sp-ph">
            <h3>What&apos;s included</h3>
          </div>
          <div className="sp-inc">
            {inclusions(plan).map((line, index) => (
              <div className={line.yes ? undefined : "sp-no"} key={`${line.bold}-${index}`}>
                <span className="sp-ic">{line.yes ? "✓" : "✕"}</span>
                <span>
                  {line.bold && <b>{line.bold}</b>}
                  {line.bold ? " — " : ""}
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {message && (
          <div className="sp-note" style={{ margin: 0 }}>
            {message}
          </div>
        )}

        {/* Buy bar */}
        <div className="sp-buybar">
          <div className="sp-l">
            <strong style={{ fontFamily: "var(--sp-display)", fontSize: 15 }}>
              {isFree
                ? "Free — start whenever you like"
                : covered
                  ? "Included with your subscription"
                  : plan.access_mode === "subscription"
                    ? "Included with a subscription"
                    : `${formatPlanPrice(plan.price_amount_minor, plan.currency)} · one-time`}
            </strong>
            <p>
              {covered || isFree
                ? "You'll pick a start date and which days you study on the next screen."
                : plan.access_mode === "subscription"
                  ? `Subscribe to unlock this plan, or buy it on its own for ${formatPlanPrice(plan.price_amount_minor, plan.currency)}.`
                  : "Lifetime access once enrolled."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            {!isSignedIn ? (
              <Link className="sp-btn sp-btn--p sp-btn--lg" href={`/login?next=${studyPlanHref(`/${plan.id}`)}`}>
                Sign in to enrol
              </Link>
            ) : (
              <>
                {plan.access_mode === "subscription" && !covered && (
                  <Link className="sp-btn" href="/pricing">
                    See subscription
                  </Link>
                )}
                <button type="button" className="sp-btn sp-btn--p sp-btn--lg" disabled={busy} onClick={onEnrol}>
                  {busy
                    ? "Starting…"
                    : isFree || covered
                      ? "Start this plan"
                      : `Enrol · ${formatPlanPrice(plan.price_amount_minor, plan.currency)}`}
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
