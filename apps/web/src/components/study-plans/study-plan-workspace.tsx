"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  PLAN_TYPE_CLASS,
  PLAN_TYPE_LABEL,
  TRACKING_STATE_CLASS,
  TRACKING_STATE_LABEL,
  formatIsoDateLong,
  studyPlanHref,
  type StudyPlanDetail,
  type StudyPlanItem,
  type StudyPlanTracking
} from "../../lib/study-plans";

/**
 * The plan page once you are enrolled: a workspace, not a brochure.
 *
 * All three plan types share one health card — the pace and depth dials from
 * the design — because "am I keeping up" is the same question whatever the
 * plan contains. Below that they diverge, because a course is watched, a
 * self-paced plan is read, and a test series is a calendar.
 *
 * Mirrors the three workspace screens in the approved design mockup.
 */

const TEST_TYPES = new Set(["prelims_test", "csat_test", "mains_test"]);

function isTest(item: StudyPlanItem): boolean {
  return TEST_TYPES.has(item.item_type);
}

function itemIcon(item: StudyPlanItem): string {
  if (isTest(item)) return "✎";
  if (item.item_type === "live_lecture" || item.lecture_url) return "▶";
  return "📄";
}

function itemVerb(item: StudyPlanItem): string {
  if (isTest(item)) return "Take test";
  if (item.item_type === "live_lecture" || item.lecture_url) return "Watch";
  return "Read";
}

/** Which dial class the ported CSS uses for a 0-1 signal. */
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

function HealthCard({ plan, tracking }: { plan: StudyPlanDetail; tracking: StudyPlanTracking }) {
  const paceRatio = tracking.pace_ratio;
  const depthRatio = tracking.depth.score;

  const paceValue =
    tracking.days_behind > 0
      ? `${tracking.days_behind} day${tracking.days_behind === 1 ? "" : "s"} behind`
      : tracking.state === "ahead"
        ? "Ahead"
        : "On time";

  // Each type counts "keeping up" differently — a course counts lectures, a
  // series counts papers taken, a self-paced plan counts items due.
  const paceNote =
    plan.plan_type === "test_series"
      ? `${tracking.depth.tests_done} of ${tracking.depth.tests_due} released papers attempted.`
      : `${tracking.completed_due_items} of ${tracking.due_items} items due by today are done.`;

  const depthNote = (() => {
    const parts: string[] = [];
    if (tracking.depth.tests_due > 0) {
      const skipped = tracking.depth.tests_due - tracking.depth.tests_done;
      if (skipped > 0) parts.push(`${skipped} of ${tracking.depth.tests_due} due tests skipped`);
    }
    if (tracking.depth.average_accuracy !== null) {
      parts.push(
        `test average ${Math.round(tracking.depth.average_accuracy)}% against the plan's ${Math.round(tracking.depth.target_accuracy)}%`
      );
    }
    if (tracking.depth.rushed_items > 0) {
      parts.push(`${tracking.depth.rushed_items} item${tracking.depth.rushed_items === 1 ? "" : "s"} closed far under the estimate`);
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
          {tracking.days_behind > 0 && (
            <Link className="sp-btn sp-btn--sm" style={{ width: "fit-content" }} href={studyPlanHref(`/${plan.id}/reschedule`)}>
              Fix my schedule
            </Link>
          )}
        </div>

        <div className="sp-health-cell">
          <div className="sp-dial-row">
            <span className="sp-dial-name">Pace</span>
            <span className="sp-dial-val" style={{ color: toneColor(paceRatio) }}>
              {paceValue}
            </span>
          </div>
          <div className={`sp-dial ${dialClass(paceRatio)}`}>
            <i style={{ width: `${Math.round(paceRatio * 100)}%` }} />
          </div>
          <p className="sp-dial-note">{paceNote}</p>
        </div>

        <div className="sp-health-cell">
          <div className="sp-dial-row">
            <span className="sp-dial-name">Depth</span>
            <span className="sp-dial-val" style={{ color: toneColor(depthRatio) }}>
              {tracking.depth.label}
            </span>
          </div>
          <div className={`sp-dial ${dialClass(depthRatio)}`}>
            <i style={{ width: `${Math.round(depthRatio * 100)}%` }} />
          </div>
          <p className="sp-dial-note">{depthNote}</p>
        </div>
      </div>
    </div>
  );
}

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

  const currentWeek = tracking?.today.week_no ?? [...weeks.keys()][0] ?? 1;
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek);

  const todayItems = (plan.items ?? []).filter((item) => tracking?.today.item_ids.includes(item.id));
  const weekItems = weeks.get(selectedWeek) ?? [];
  const weekOverview = plan.week_overviews?.find((week) => week.week_no === selectedWeek);

  const scheduledFor = (item: StudyPlanItem) => scheduleByDay.get(`${item.week_no}:${item.day_no}`) ?? null;
  const isDone = (item: StudyPlanItem) => item.progress?.status === "completed";

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

        {/* Today */}
        {tracking && (
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
                      style={
                        isDone(item)
                          ? undefined
                          : { borderColor: "var(--sp-accent-line)", background: "var(--sp-accent-soft)" }
                      }
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
                      <button
                        type="button"
                        className={`sp-btn sp-btn--sm${isDone(item) ? "" : " sp-btn--p"}`}
                        disabled={busyItemId === item.id}
                        onClick={() => onToggleComplete(item)}
                      >
                        {busyItemId === item.id ? "…" : isDone(item) ? "Review" : "Start"}
                      </button>
                    </div>
                  ))
                )}

                {tracking.open_due_item_ids.length > 0 && (
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--sp-ink-soft)" }}>
                    {tracking.open_due_item_ids.length} earlier item
                    {tracking.open_due_item_ids.length === 1 ? " is" : "s are"} still open.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        const first = (plan.items ?? []).find((item) =>
                          tracking.open_due_item_ids.includes(item.id)
                        );
                        if (first) setSelectedWeek(first.week_no);
                      }}
                      style={{
                        background: "none",
                        border: 0,
                        padding: 0,
                        color: "var(--sp-accent-ink)",
                        fontWeight: 650,
                        cursor: "pointer",
                        font: "inherit"
                      }}
                    >
                      Catch up on those first →
                    </button>
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
                <div style={{ borderTop: "1px solid var(--sp-line-soft)", paddingTop: 11 }}>
                  <span className="sp-lab">Pace</span>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 12.5,
                      fontWeight: 650,
                      color: tracking.days_behind > 0 ? "var(--sp-warn)" : "var(--sp-good)"
                    }}
                  >
                    {tracking.days_behind > 0
                      ? `${tracking.days_behind} day${tracking.days_behind === 1 ? "" : "s"} behind schedule`
                      : "On schedule"}
                  </p>
                  {tracking.projected_end_date && (
                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--sp-ink-soft)" }}>
                      Finishing {formatIsoDateLong(tracking.projected_end_date)} at this rate.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Week rail + items */}
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
                  <span className="sp-s">
                    {allDone ? "Done" : `${done} / ${items.length}`}
                  </span>
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
            const date = scheduledFor(item);
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
                <button
                  type="button"
                  className={`sp-btn sp-btn--sm${isToday && !done ? " sp-btn--p" : ""}`}
                  disabled={busyItemId === item.id}
                  onClick={() => onToggleComplete(item)}
                >
                  {busyItemId === item.id ? "…" : done ? "Review" : "Open"}
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
