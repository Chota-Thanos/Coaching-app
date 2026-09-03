"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  PLAN_TYPE_CLASS,
  PLAN_TYPE_LABEL,
  TRACKING_STATE_CLASS,
  TRACKING_STATE_LABEL,
  formatIsoDate,
  formatIsoDateLong,
  studyPlanHref,
  type StudyPlanDetail,
  type StudyPlanItem,
  type StudyPlanTracking
} from "../../lib/study-plans";

/**
 * The plan page once you are enrolled.
 *
 * All three plan types share the health card and the Today panel, because "am
 * I keeping up" is the same question whatever the plan contains. Below that
 * they diverge completely, because the products are not the same shape: a
 * course is watched, a self-paced plan is read, and a test series is a
 * calendar. Mirrors the three workspace screens in the approved design.
 */

const TEST_TYPES = new Set(["prelims_test", "csat_test", "mains_test"]);

function isTest(item: StudyPlanItem): boolean {
  return TEST_TYPES.has(item.item_type);
}

function isLecture(item: StudyPlanItem): boolean {
  return item.item_type === "live_lecture" || Boolean(item.lecture_url);
}

function isDone(item: StudyPlanItem): boolean {
  return item.progress?.status === "completed";
}

function itemIcon(item: StudyPlanItem): string {
  if (isTest(item)) return "✎";
  if (isLecture(item)) return "▶";
  return "📄";
}

function itemVerb(item: StudyPlanItem): string {
  if (isTest(item)) return "Take test";
  if (isLecture(item)) return "Watch";
  return "Read";
}

function dialClass(ratio: number): string {
  if (ratio >= 0.85) return "sp-dial--good";
  if (ratio >= 0.5) return "sp-dial--warn";
  return "sp-dial--bad";
}

function toneColor(ratio: number): string {
  if (ratio >= 0.85) return "var(--sp-good)";
  if (ratio >= 0.5) return "var(--sp-warn)";
  return "var(--sp-bad)";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Shared ──────────────────────────────────────────────────────────────────

function HealthCard({ plan, tracking }: { plan: StudyPlanDetail; tracking: StudyPlanTracking }) {
  const paceValue =
    tracking.days_behind > 0
      ? `${tracking.days_behind} day${tracking.days_behind === 1 ? "" : "s"} behind`
      : tracking.state === "ahead"
        ? "Ahead"
        : "On time";

  // Each type counts "keeping up" differently — a series counts papers taken,
  // the others count items due.
  const paceNote =
    plan.plan_type === "test_series"
      ? `${tracking.depth.tests_done} of ${tracking.depth.tests_due} released papers attempted.`
      : `${tracking.completed_due_items} of ${tracking.due_items} items due by today are done.`;

  const depthNote = (() => {
    const parts: string[] = [];
    const skipped = tracking.depth.tests_due - tracking.depth.tests_done;
    if (skipped > 0) parts.push(`${skipped} of ${tracking.depth.tests_due} due tests skipped`);
    if (tracking.depth.average_accuracy !== null) {
      parts.push(
        `test average ${Math.round(tracking.depth.average_accuracy)}% against the plan's ${Math.round(tracking.depth.target_accuracy)}%`
      );
    }
    if (tracking.depth.rushed_items > 0) {
      parts.push(`${tracking.depth.rushed_items} closed far under the estimate`);
    }
    return parts.length > 0
      ? `${parts.join(", ")}.`.replace(/^./, (character) => character.toUpperCase())
      : "Nothing flagged yet — keep going.";
  })();

  return (
    <div className="sp-c" style={{ overflow: "hidden" }}>
      <div className="sp-health">
        <div className="sp-health-cell">
          <span className={`sp-state ${TRACKING_STATE_CLASS[tracking.state]}`}>
            {TRACKING_STATE_LABEL[tracking.state]}
          </span>
          <div>
            <p style={{ margin: 0, fontFamily: "var(--sp-display)", fontSize: 22, fontWeight: 780, letterSpacing: "-.02em" }}>
              Day {Math.min(tracking.elapsed_slots, tracking.total_slots)} of {tracking.total_slots}
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--sp-ink-soft)" }}>
              {tracking.projected_end_date ? (
                <>
                  Finishing{" "}
                  <strong style={{ color: tracking.days_behind > 0 ? "var(--sp-warn)" : "var(--sp-good)" }}>
                    {formatIsoDateLong(tracking.projected_end_date)}
                  </strong>{" "}
                  at this rate
                  {tracking.target_end_date ? ` · target ${formatIsoDateLong(tracking.target_end_date)}` : ""}
                </>
              ) : (
                "Schedule not set"
              )}
            </p>
          </div>
        </div>

        <div className="sp-health-cell">
          <div className="sp-dial-row">
            <span className="sp-dial-name">Pace</span>
            <span className="sp-dial-val" style={{ color: toneColor(tracking.pace_ratio) }}>
              {paceValue}
            </span>
          </div>
          <div className={`sp-dial ${dialClass(tracking.pace_ratio)}`}>
            <i style={{ width: `${Math.round(tracking.pace_ratio * 100)}%` }} />
          </div>
          <p className="sp-dial-note">{paceNote}</p>
        </div>

        <div className="sp-health-cell">
          <div className="sp-dial-row">
            <span className="sp-dial-name">Depth</span>
            <span className="sp-dial-val" style={{ color: toneColor(tracking.depth.score) }}>
              {tracking.depth.label}
            </span>
          </div>
          <div className={`sp-dial ${dialClass(tracking.depth.score)}`}>
            <i style={{ width: `${Math.round(tracking.depth.score * 100)}%` }} />
          </div>
          <p className="sp-dial-note">{depthNote}</p>
        </div>
      </div>
    </div>
  );
}

type BodyProps = {
  plan: StudyPlanDetail;
  scheduleFor: (item: StudyPlanItem) => string | null;
  weeks: Map<number, StudyPlanItem[]>;
  tracking: StudyPlanTracking | null;
  onToggleComplete: (item: StudyPlanItem) => void;
  busyItemId: number | null;
};

// ── Self-paced: reading-led, week by week ───────────────────────────────────

function SelfPacedBody({ plan, scheduleFor, weeks, tracking, onToggleComplete, busyItemId }: BodyProps) {
  const firstWeek = tracking?.today.week_no ?? [...weeks.keys()][0] ?? 1;
  const [selectedWeek, setSelectedWeek] = useState<number>(firstWeek);
  const weekItems = weeks.get(selectedWeek) ?? [];
  const weekOverview = plan.week_overviews?.find((week) => week.week_no === selectedWeek);

  return (
    <div className="sp-c">
      <div className="sp-weekrail">
        {[...weeks.entries()].map(([weekNo, items]) => {
          const done = items.filter(isDone).length;
          const allDone = done === items.length && items.length > 0;
          return (
            <button
              type="button"
              className="sp-wchip"
              key={weekNo}
              data-on={selectedWeek === weekNo ? "1" : "0"}
              data-done={allDone ? "1" : "0"}
              onClick={() => setSelectedWeek(weekNo)}
            >
              <span className="sp-w">Week {weekNo}</span>
              <span className="sp-s">{allDone ? "Done" : `${done} / ${items.length}`}</span>
            </button>
          );
        })}
      </div>

      <div className="sp-ph" style={{ borderTop: "1px solid var(--sp-line-soft)" }}>
        <div>
          <h3>
            Week {selectedWeek}
            {weekOverview?.title ? ` — ${weekOverview.title}` : ""}
          </h3>
          {weekOverview?.description && <p className="sp-hint">{weekOverview.description}</p>}
        </div>
        <span className="sp-pill">
          {weekItems.filter(isDone).length} of {weekItems.length} done
        </span>
      </div>

      {weekItems.map((item) => {
        const date = scheduleFor(item);
        const done = isDone(item);
        const isToday = tracking?.today.item_ids.includes(item.id) ?? false;
        return (
          <div className="sp-irow" key={item.id} style={isToday ? { background: "var(--sp-accent-soft)" } : undefined}>
            <span className="sp-ic">{itemIcon(item)}</span>
            <div>
              <h5>
                Day {item.day_no} — {item.title}
              </h5>
              <p>
                {itemVerb(item)}
                {item.estimated_minutes ? ` · ${item.estimated_minutes} min` : ""}
                {item.resources && item.resources.length > 0 ? ` · ${item.resources.length} resources` : ""}
              </p>
            </div>
            <span className={`sp-st ${done ? "sp-st--done" : isToday ? "sp-st--now" : "sp-st--todo"}`}>
              {done ? "Completed" : isToday ? "Today" : date ? formatIsoDateLong(date) : "Unscheduled"}
            </span>
            <Link className={`sp-btn sp-btn--sm${isToday && !done ? " sp-btn--p" : ""}`} href={studyPlanHref(`/${plan.id}/items/${item.id}`)}>
              {done ? "Review" : "Open"}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

// ── Full course: watched, so the hero is what you were watching ─────────────

function CourseBody({ plan, weeks, tracking }: BodyProps) {
  const allItems = plan.items ?? [];
  // "Continue" is the first lecture that is not finished, in plan order.
  const resumeItem = allItems.find((item) => !isTest(item) && !isDone(item)) ?? null;

  const liveClasses = allItems
    .filter((item) => item.live_class && ["scheduled", "live"].includes(item.live_class.status))
    .sort((a, b) => (a.live_class!.scheduled_start > b.live_class!.scheduled_start ? 1 : -1))
    .slice(0, 3);

  const watchedCount = allItems.filter((item) => !isTest(item) && isDone(item)).length;
  const lectureCount = allItems.filter((item) => !isTest(item)).length;

  return (
    <>
      <div className={liveClasses.length > 0 ? "sp-split" : ""} style={liveClasses.length > 0 ? undefined : { display: "grid", gap: 12, alignItems: "start" }}>
        <div className="sp-c" style={{ overflow: "hidden" }}>
          {resumeItem ? (
            <>
              <div className="sp-player">
                <span className="sp-play">▶</span>
                <div className="sp-cap">
                  <p>
                    Continue · Week {resumeItem.week_no} · Day {resumeItem.day_no}
                  </p>
                  <h4>{resumeItem.title}</h4>
                </div>
              </div>
              <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontFamily: "var(--sp-mono)", fontSize: 10.5, color: "var(--sp-ink-faint)" }}>
                  {resumeItem.estimated_minutes ? `${resumeItem.estimated_minutes} min` : "Next up"}
                  {resumeItem.resources && resumeItem.resources.length > 0
                    ? ` · ${resumeItem.resources.length} resources`
                    : ""}
                </p>
                <Link className="sp-btn sp-btn--p sp-btn--sm" href={studyPlanHref(`/${plan.id}/items/${resumeItem.id}`)}>
                  Resume
                </Link>
              </div>
            </>
          ) : (
            <div style={{ padding: "26px 18px", textAlign: "center", color: "var(--sp-ink-soft)", fontSize: 13 }}>
              Every lecture in this course is done.
            </div>
          )}
        </div>

        {liveClasses.length > 0 && (
          <div className="sp-c" style={{ overflow: "hidden" }}>
            <div className="sp-ph">
              <div>
                <h3>Live classes</h3>
              </div>
            </div>
            <div style={{ padding: "13px 16px", display: "flex", flexDirection: "column", gap: 11 }}>
              {liveClasses.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    padding: "11px 13px",
                    border: `1px solid ${index === 0 ? "var(--sp-accent-line)" : "var(--sp-line)"}`,
                    background: index === 0 ? "var(--sp-accent-soft)" : "transparent",
                    borderRadius: 10
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "var(--sp-mono)",
                      fontSize: 9.5,
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                      color: index === 0 ? "var(--sp-accent-ink)" : "var(--sp-ink-faint)"
                    }}
                  >
                    {item.live_class!.status === "live"
                      ? "Live now"
                      : formatIsoDateLong(item.live_class!.scheduled_start)}
                  </p>
                  <p style={{ margin: "4px 0 0", fontFamily: "var(--sp-display)", fontSize: 13, fontWeight: 720 }}>
                    {item.live_class!.title}
                  </p>
                  {/* A class that has actually started is a door, not a
                      notice — this list used to name the session and leave
                      the learner with nowhere to click. */}
                  {item.live_class!.status === "live" && (
                    <Link
                      className="sp-btn sp-btn--p"
                      href={studyPlanHref(`/live/${item.live_class!.id}`)}
                      style={{ marginTop: 9 }}
                    >
                      Join the class
                    </Link>
                  )}
                </div>
              ))}
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--sp-ink-soft)" }}>
                Missed a live class? The recording counts the same — it is not a debt against your pace.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="sp-c" style={{ overflow: "hidden" }}>
        <div className="sp-ph">
          <div>
            <h3>Course content</h3>
            <p className="sp-hint">
              {plan.duration_weeks} weeks · {lectureCount} lectures
            </p>
          </div>
          <span className="sp-pill">
            {watchedCount} of {lectureCount} watched
          </span>
        </div>

        {[...weeks.entries()].map(([weekNo, items]) => {
          const overview = plan.week_overviews?.find((week) => week.week_no === weekNo);
          const done = items.filter(isDone).length;
          return (
            <div key={weekNo}>
              <div className="sp-sect">
                <h4>
                  Week {weekNo}
                  {overview?.title ? ` — ${overview.title}` : ""}
                </h4>
                <span>
                  {items.length} items · {done} of {items.length} done
                </span>
              </div>
              {items.map((item, index) => {
                const done = isDone(item);
                return (
                  <div className="sp-lec" key={item.id}>
                    <span className="sp-n">{done ? "✓" : isTest(item) ? "✎" : index + 1}</span>
                    <div>
                      <h5>{item.title}</h5>
                      <div className="sp-lecbar">
                        <i style={{ width: done ? "100%" : "0%" }} />
                      </div>
                    </div>
                    <span className="sp-dur">{item.estimated_minutes ? `${item.estimated_minutes} m` : "—"}</span>
                    <Link className="sp-btn sp-btn--sm" href={studyPlanHref(`/${plan.id}/items/${item.id}`)}>
                      {done ? "Rewatch" : isTest(item) ? "Take" : "Watch"}
                    </Link>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Test series: the calendar is the product ────────────────────────────────

function TestSeriesBody({ plan, scheduleFor, tracking }: BodyProps) {
  const today = todayIso();
  const papers = (plan.items ?? [])
    .filter(isTest)
    .map((item) => ({ item, date: scheduleFor(item) }))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const nextPaper = papers.find((paper) => (paper.date ?? "") >= today && !isDone(paper.item)) ?? null;
  const missed = papers.filter((paper) => paper.date !== null && paper.date < today && !isDone(paper.item));
  const attempted = papers.filter((paper) => isDone(paper.item)).reverse();

  // A window around today, so the grid shows what just happened and what is next.
  const windowPapers = papers.slice(
    Math.max(0, papers.findIndex((paper) => (paper.date ?? "") >= today) - 3),
    Math.max(7, papers.findIndex((paper) => (paper.date ?? "") >= today) + 4)
  );

  return (
    <>
      <div className="sp-split sp-split--wide">
        <div className="sp-c" style={{ overflow: "hidden" }}>
          <div className="sp-ph">
            <div>
              <h3>Next paper</h3>
            </div>
            {nextPaper?.date && <span className="sp-pill">Opens {formatIsoDateLong(nextPaper.date)}</span>}
          </div>
          {nextPaper ? (
            <div style={{ padding: "16px 18px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  background: "var(--sp-accent-soft)",
                  border: "1px solid var(--sp-accent-line)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--sp-display)",
                  fontWeight: 800,
                  fontSize: 19,
                  color: "var(--sp-accent-ink)"
                }}
              >
                {papers.indexOf(nextPaper) + 1}
              </div>
              <div style={{ flex: 1, minWidth: 190 }}>
                <h4 style={{ fontFamily: "var(--sp-display)", fontSize: 16, fontWeight: 750, margin: 0 }}>
                  {nextPaper.item.title}
                </h4>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--sp-ink-soft)" }}>
                  {nextPaper.item.test_template
                    ? `${nextPaper.item.test_template.duration_minutes} minutes`
                    : "Test"}
                </p>
              </div>
              <Link className="sp-btn sp-btn--p" href={studyPlanHref(`/${plan.id}/items/${nextPaper.item.id}`)}>
                Open
              </Link>
            </div>
          ) : (
            <div style={{ padding: "22px 18px", color: "var(--sp-ink-soft)", fontSize: 13 }}>
              No upcoming papers — you are at the end of the calendar.
            </div>
          )}

          <div className="sp-ph" style={{ borderTop: "1px solid var(--sp-line-soft)" }}>
            <div>
              <h3>Waiting for you</h3>
              <p className="sp-hint">Missed papers never close.</p>
            </div>
          </div>
          {missed.length === 0 ? (
            <div style={{ padding: "16px 18px", color: "var(--sp-ink-soft)", fontSize: 12.5 }}>
              Nothing missed. Every released paper has been attempted.
            </div>
          ) : (
            missed.map((paper) => (
              <div className="sp-paper" key={paper.item.id}>
                <span className="sp-date">{paper.date ? formatIsoDate(paper.date) : "—"}</span>
                <div>
                  <h5>{paper.item.title}</h5>
                  <p style={{ margin: "2px 0 0", fontFamily: "var(--sp-mono)", fontSize: 9.5, color: "var(--sp-bad)" }}>
                    Missed
                  </p>
                </div>
                <span className="sp-pill sp-pill--lock">Not attempted</span>
                <span className="sp-sc" style={{ color: "var(--sp-ink-faint)" }}>
                  —
                </span>
                <Link className="sp-btn sp-btn--p sp-btn--sm" href={studyPlanHref(`/${plan.id}/items/${paper.item.id}`)}>
                  Take now
                </Link>
              </div>
            ))
          )}
        </div>

        <div className="sp-c" style={{ overflow: "hidden" }}>
          <div className="sp-ph">
            <div>
              <h3>Where you stand</h3>
              <p className="sp-hint">Across {attempted.length} attempted papers</p>
            </div>
          </div>
          <div className="sp-rank">
            <div>
              <span className="sp-v">{tracking?.depth.tests_done ?? attempted.length}</span>
              <span className="sp-k">Papers taken</span>
            </div>
            <div>
              <span className="sp-v">{missed.length}</span>
              <span className="sp-k">Missed</span>
            </div>
            <div>
              <span className="sp-v">
                {tracking?.depth.average_accuracy !== null && tracking?.depth.average_accuracy !== undefined
                  ? `${Math.round(tracking.depth.average_accuracy)}%`
                  : "—"}
              </span>
              <span className="sp-k">Avg accuracy</span>
            </div>
          </div>
          <div style={{ padding: "12px 16px" }}>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--sp-ink-soft)", lineHeight: 1.5 }}>
              All-India rank per paper is not wired up yet — the plan detail response does not carry it. Scores live on
              each paper&apos;s own result page.
            </p>
          </div>
        </div>
      </div>

      <div className="sp-c" style={{ overflow: "hidden" }}>
        <div className="sp-ph">
          <div>
            <h3>The calendar</h3>
            <p className="sp-hint">Papers unlock on their date and stay open afterwards.</p>
          </div>
          <span className="sp-pill">{papers.length} papers</span>
        </div>
        <div className="sp-cal">
          {windowPapers.map((paper) => {
            const done = isDone(paper.item);
            const isMissed = paper.date !== null && paper.date < today && !done;
            const isToday = paper.date === today;
            const modifier = done
              ? "sp-cday--done"
              : isMissed
                ? "sp-cday--miss"
                : isToday
                  ? "sp-cday--now"
                  : "";
            return (
              <Link
                className={`sp-cday ${modifier}`}
                key={paper.item.id}
                href={studyPlanHref(`/${plan.id}/items/${paper.item.id}`)}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span className="sp-d">{paper.date ? formatIsoDate(paper.date) : "—"}</span>
                <span className="sp-t">{paper.item.title}</span>
              </Link>
            );
          })}
        </div>

        {attempted.slice(0, 6).map((paper) => (
          <div className="sp-paper" key={paper.item.id} style={{ borderTop: "1px solid var(--sp-line)" }}>
            <span className="sp-date">{paper.date ? formatIsoDate(paper.date) : "—"}</span>
            <div>
              <h5>{paper.item.title}</h5>
              <p style={{ margin: "2px 0 0", fontFamily: "var(--sp-mono)", fontSize: 9.5, color: "var(--sp-good)" }}>
                Attempted
              </p>
            </div>
            <span className="sp-pill sp-pill--inc">Done</span>
            <span className="sp-sc" style={{ color: "var(--sp-good)" }}>
              ✓
            </span>
            <Link
              className="sp-btn sp-btn--sm"
              href={
                paper.item.progress?.test_attempt_id
                  ? `/study-plans/attempts/${paper.item.progress.test_attempt_id}`
                  : studyPlanHref(`/${plan.id}/items/${paper.item.id}`)
              }
            >
              Result
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function StudyPlanWorkspace({
  plan,
  onToggleComplete,
  busyItemId
}: {
  plan: StudyPlanDetail;
  onToggleComplete: (item: StudyPlanItem) => void;
  busyItemId: number | null;
}) {
  const tracking = plan.tracking ?? null;

  const scheduleByDay = useMemo(() => {
    const map = new Map<string, string>();
    for (const slot of plan.schedule ?? []) map.set(`${slot.week_no}:${slot.day_no}`, slot.scheduled_date);
    return map;
  }, [plan.schedule]);

  const weeks = useMemo(() => {
    const grouped = new Map<number, StudyPlanItem[]>();
    for (const item of plan.items ?? []) {
      const bucket = grouped.get(item.week_no);
      if (bucket) bucket.push(item);
      else grouped.set(item.week_no, [item]);
    }
    return new Map([...grouped.entries()].sort((a, b) => a[0] - b[0]));
  }, [plan.items]);

  const scheduleFor = (item: StudyPlanItem) => scheduleByDay.get(`${item.week_no}:${item.day_no}`) ?? null;
  const todayItems = (plan.items ?? []).filter((item) => tracking?.today.item_ids.includes(item.id));

  const bodyProps: BodyProps = { plan, scheduleFor, weeks, tracking, onToggleComplete, busyItemId };

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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <span className={`sp-type ${PLAN_TYPE_CLASS[plan.plan_type]}`}>{PLAN_TYPE_LABEL[plan.plan_type]}</span>
            <h2 style={{ fontSize: 22, margin: "7px 0 0" }}>{plan.title}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--sp-ink-soft)" }}>
              {tracking
                ? `Started ${formatIsoDateLong(tracking.start_date)}${tracking.target_end_date ? ` · finishing ${formatIsoDateLong(tracking.target_end_date)}` : ""}`
                : "Enrolled"}
            </p>
          </div>
          <Link className="sp-btn sp-btn--sm" href={studyPlanHref()}>
            All plans
          </Link>
        </div>

        {tracking && <HealthCard plan={plan} tracking={tracking} />}

        {/* Today is shared: whatever the plan contains, "what do I do now" is
            the same question. Test series get their calendar instead, since a
            paper day is the whole day. */}
        {tracking && plan.plan_type !== "test_series" && (
          <div className="sp-c">
            <div className="sp-today">
              <div className="sp-today-l">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <h3 style={{ fontFamily: "var(--sp-display)", fontSize: 16, fontWeight: 750, margin: 0 }}>
                    Today · {formatIsoDateLong(tracking.today.date)}
                  </h3>
                  {tracking.today.week_no && (
                    <span className="sp-pill">
                      Week {tracking.today.week_no}, Day {tracking.today.day_no}
                    </span>
                  )}
                </div>

                {todayItems.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--sp-ink-soft)" }}>
                    Nothing scheduled for today — this is a rest day on your schedule.
                  </p>
                ) : (
                  todayItems.map((item) => (
                    <div
                      className="sp-task"
                      key={item.id}
                      style={isDone(item) ? undefined : { borderColor: "var(--sp-accent-line)", background: "var(--sp-accent-soft)" }}
                    >
                      <span className="sp-ck" data-done={isDone(item) ? "1" : "0"}>
                        {isDone(item) ? "✓" : ""}
                      </span>
                      <div>
                        <h5>
                          {itemVerb(item)} — {item.title}
                        </h5>
                        <p>
                          {item.estimated_minutes ? `${item.estimated_minutes} min` : "No estimate"}
                          {item.resources && item.resources.length > 0
                            ? ` · ${item.resources.length} resource${item.resources.length === 1 ? "" : "s"}`
                            : ""}
                        </p>
                      </div>
                      <Link
                        className={`sp-btn sp-btn--sm${isDone(item) ? "" : " sp-btn--p"}`}
                        href={studyPlanHref(`/${plan.id}/items/${item.id}`)}
                      >
                        {isDone(item) ? "Review" : "Start"}
                      </Link>
                    </div>
                  ))
                )}

                {tracking.open_due_item_ids.length > 0 && (
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--sp-ink-soft)" }}>
                    {tracking.open_due_item_ids.length} earlier item
                    {tracking.open_due_item_ids.length === 1 ? " is" : "s are"} still open.
                  </p>
                )}
              </div>

              <div className="sp-pace">
                <div>
                  <span className="sp-lab">Progress</span>
                  <div className="sp-big">
                    {tracking.percent_complete}
                    <span style={{ fontSize: 17, color: "var(--sp-ink-faint)" }}>%</span>
                  </div>
                </div>
                <div className="sp-ring">
                  <span style={{ width: `${tracking.percent_complete}%` }} />
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--sp-ink-soft)" }}>
                  {tracking.elapsed_slots} of {tracking.total_slots} days · {tracking.completed_items} of{" "}
                  {tracking.total_items} items
                </p>
              </div>
            </div>
          </div>
        )}

        {plan.plan_type === "full_course" ? (
          <CourseBody {...bodyProps} />
        ) : plan.plan_type === "test_series" ? (
          <TestSeriesBody {...bodyProps} />
        ) : (
          <SelfPacedBody {...bodyProps} />
        )}
      </main>
    </div>
  );
}
