"use client";

import { useMemo, useState } from "react";
import { PLAN_TYPE_CLASS, PLAN_TYPE_LABEL, type StudyPlanDetail } from "../../lib/study-plans";

/**
 * The step between "I want this plan" and "the plan has started".
 *
 * Enrolment used to be one click that recorded nothing about time. Here the
 * plan fixes its own length and the learner fixes the start and which weekdays
 * they study — and the consequence of that choice is stated immediately,
 * because a six-day week genuinely finishes later than the plan's nominal
 * duration and the tracker would otherwise mark them late every Sunday.
 *
 * Mirrors the schedule-setup screen in the approved design mockup.
 */

const WEEKDAYS: { iso: number; label: string }[] = [
  { iso: 1, label: "Mon" },
  { iso: 2, label: "Tue" },
  { iso: 3, label: "Wed" },
  { iso: 4, label: "Thu" },
  { iso: 5, label: "Fri" },
  { iso: 6, label: "Sat" },
  { iso: 7, label: "Sun" }
];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextMonday(): string {
  const date = new Date();
  const delta = (8 - (date.getDay() === 0 ? 7 : date.getDay())) % 7 || 7;
  date.setDate(date.getDate() + delta);
  return date.toISOString().slice(0, 10);
}

function formatLong(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(
      new Date(`${iso}T00:00:00`)
    );
  } catch {
    return iso;
  }
}

function formatShort(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(
      new Date(`${iso}T00:00:00`)
    );
  } catch {
    return iso;
  }
}

/**
 * Mirrors the server's schedule derivation (api study-plans/tracking.ts) so the
 * finish date can be shown live as the learner toggles days, before anything is
 * written. The server recomputes it authoritatively on enrol.
 */
function projectFinish(slotCount: number, startIso: string, studyDays: number[]): string | null {
  if (slotCount <= 0 || studyDays.length === 0) return null;
  const cursor = new Date(`${startIso}T00:00:00Z`);
  let placed = 0;
  let last: string | null = null;
  for (let guard = 0; guard < 3650 && placed < slotCount; guard += 1) {
    const day = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
    if (studyDays.includes(day)) {
      last = cursor.toISOString().slice(0, 10);
      placed += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return last;
}

export function StudyPlanScheduleSetup({
  plan,
  onStart,
  onCancel,
  busy,
  message
}: {
  plan: StudyPlanDetail;
  onStart: (startDate: string, studyDays: number[]) => void;
  onCancel: () => void;
  busy: boolean;
  message: string | null;
}) {
  const [startDate, setStartDate] = useState(isoToday());
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);

  // One slot per distinct plan day — the unit the schedule is laid out in.
  const slotCount = useMemo(() => {
    const seen = new Set<string>();
    for (const item of plan.items ?? []) seen.add(`${item.week_no}:${item.day_no}`);
    return seen.size;
  }, [plan.items]);

  const totalMinutes = useMemo(
    () => (plan.items ?? []).reduce((total, item) => total + Number(item.estimated_minutes ?? 0), 0),
    [plan.items]
  );

  const finish = projectFinish(slotCount, startDate, studyDays);
  const nominalFinish = projectFinish(slotCount, startDate, [1, 2, 3, 4, 5, 6, 7]);
  const stretchedDays =
    finish && nominalFinish
      ? Math.round(
          (new Date(`${finish}T00:00:00Z`).getTime() - new Date(`${nominalFinish}T00:00:00Z`).getTime()) /
            86400000
        )
      : 0;

  const perDayMinutes = slotCount > 0 ? Math.round(totalMinutes / slotCount) : 0;
  const perDay =
    perDayMinutes >= 60
      ? `≈ ${Math.floor(perDayMinutes / 60)} h ${perDayMinutes % 60 ? `${perDayMinutes % 60} m` : ""}`.trim()
      : `≈ ${perDayMinutes} m`;

  const toggleDay = (iso: number) =>
    setStudyDays((current) =>
      current.includes(iso) ? current.filter((day) => day !== iso) : [...current, iso].sort()
    );

  const startOptions = [
    { iso: isoToday(), icon: "▶", title: "Today", note: "Week 1 Day 1 opens now" },
    { iso: nextMonday(), icon: "🗓", title: formatShort(nextMonday()), note: "Start with a clean week" }
  ];

  return (
    <div className="sp-root" style={{ background: "var(--sp-bg)", minHeight: "100vh" }}>
      <main
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: "28px 20px 72px",
          fontFamily: "var(--sp-body)",
          color: "var(--sp-ink)"
        }}
      >
        <div className="sp-c">
          <div className="sp-ph">
            <div>
              <h3>When do you want to do this?</h3>
              <p className="sp-hint">You can change all of it later — the plan adapts, it doesn&apos;t reset.</p>
            </div>
            <span className={`sp-type ${PLAN_TYPE_CLASS[plan.plan_type]}`}>
              {PLAN_TYPE_LABEL[plan.plan_type]} · {plan.duration_weeks} weeks
            </span>
          </div>

          <div className="sp-setup">
            <div style={{ padding: "17px 19px", display: "flex", flexDirection: "column", gap: 17 }}>
              <div>
                <p className="sp-facet-lab" style={{ display: "block", marginBottom: 8 }}>
                  Start date
                </p>
                <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                  {startOptions.map((option) => (
                    <button
                      type="button"
                      className="sp-opt"
                      data-on={startDate === option.iso ? "1" : "0"}
                      style={{ flex: 1, minWidth: 150 }}
                      key={option.iso}
                      onClick={() => setStartDate(option.iso)}
                    >
                      <span style={{ fontSize: 17 }}>{option.icon}</span>
                      <span>
                        <b>{option.title}</b>
                        <span>{option.note}</span>
                      </span>
                    </button>
                  ))}
                  <label className="sp-opt" style={{ flex: 1, minWidth: 150 }}>
                    <span style={{ fontSize: 17 }}>⋯</span>
                    <span>
                      <b>Pick a date</b>
                      <input
                        type="date"
                        value={startDate}
                        min={isoToday()}
                        onChange={(event) => setStartDate(event.target.value)}
                        style={{
                          display: "block",
                          marginTop: 4,
                          border: "1px solid var(--sp-line)",
                          borderRadius: 6,
                          padding: "3px 6px",
                          fontSize: 11.5,
                          background: "var(--sp-panel)",
                          color: "var(--sp-ink)",
                          fontFamily: "var(--sp-mono)"
                        }}
                      />
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <p className="sp-facet-lab" style={{ display: "block", marginBottom: 8 }}>
                  Which days will you study?
                </p>
                <div className="sp-dow">
                  {WEEKDAYS.map((day) => (
                    <button
                      type="button"
                      key={day.iso}
                      data-on={studyDays.includes(day.iso) ? "1" : "0"}
                      onClick={() => toggleDay(day.iso)}
                      aria-pressed={studyDays.includes(day.iso)}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <p style={{ margin: "9px 0 0", fontSize: 12.5, color: "var(--sp-ink-soft)" }}>
                  {studyDays.length === 0 ? (
                    "Pick at least one study day."
                  ) : (
                    <>
                      {studyDays.length} day{studyDays.length === 1 ? "" : "s"} a week. The plan holds {slotCount} day
                      {slotCount === 1 ? "" : "s"} of work, so it lands on{" "}
                      <strong style={{ color: "var(--sp-ink)" }}>{formatShort(finish)}</strong>
                      {stretchedDays > 0
                        ? ` — ${stretchedDays} day${stretchedDays === 1 ? "" : "s"} past the ${plan.duration_weeks}-week mark.`
                        : "."}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div
              style={{
                padding: "17px 19px",
                display: "flex",
                flexDirection: "column",
                gap: 13,
                background: "var(--sp-panel-2)"
              }}
            >
              <div>
                <span className="sp-dial-name">Your schedule</span>
                <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    ["Starts", formatShort(startDate)],
                    ["Finishes", formatShort(finish)],
                    ["Study days", `${studyDays.length} a week`],
                    ["Per study day", perDay]
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                      <span style={{ color: "var(--sp-ink-soft)" }}>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--sp-line-soft)", paddingTop: 12 }}>
                <p style={{ margin: 0, fontSize: 12, color: "var(--sp-ink-soft)", lineHeight: 1.5 }}>
                  This becomes your target. If you fall behind, the plan will offer to shift these dates rather than
                  quietly leaving you late.
                </p>
              </div>
              {message && (
                <p style={{ margin: 0, fontSize: 12, color: "var(--sp-bad)", fontWeight: 650 }}>{message}</p>
              )}
              <button
                type="button"
                className="sp-btn sp-btn--p"
                style={{ justifyContent: "center" }}
                disabled={busy || studyDays.length === 0}
                onClick={() => onStart(startDate, studyDays)}
              >
                {busy ? "Starting…" : "Start the plan"}
              </button>
              <button type="button" className="sp-btn" style={{ justifyContent: "center" }} onClick={onCancel}>
                Back
              </button>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--sp-ink-faint)", textAlign: "center" }}>
                Starting {formatLong(startDate)}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
