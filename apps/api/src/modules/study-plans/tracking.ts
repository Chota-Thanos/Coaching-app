/**
 * Schedule derivation and progress tracking for enrolled study plans.
 *
 * Plan content is stored relative (week_no, day_no) and always has been. The
 * enrollment now carries a start_date and the weekdays the learner actually
 * studies, which is the only thing needed to turn that relative content into
 * real dates — and therefore the only thing needed to answer "what is due
 * today" and "am I behind".
 *
 * Two independent signals come out of here, and they are deliberately not
 * merged into one score:
 *
 *   pace  — are you where the calendar says you should be?
 *   depth — was the work you ticked off actually done?
 *
 * A learner who marks every reading complete in ninety seconds and skips every
 * test is perfectly on pace and in trouble. One number cannot say that.
 */

export type StudyWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type TrackingState = "ahead" | "on_time" | "slipping" | "behind" | "at_risk" | "stalled";

export type ScheduleSlot = {
  week_no: number;
  day_no: number;
  /** ISO date (YYYY-MM-DD). */
  scheduled_date: string;
};

export type TrackableItem = {
  id: number;
  week_no: number;
  day_no: number;
  item_type: string;
  estimated_minutes: number | null;
  progress: { status: string; time_spent_seconds?: number | null } | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const TEST_ITEM_TYPES = new Set(["prelims_test", "csat_test", "mains_test"]);
/** Completing an item in under this share of its estimate reads as skimming. */
const RUSHED_THRESHOLD = 0.25;
/** Days without any activity before "behind" stops being a useful label. */
const STALL_DAYS = 7;

function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  // Dates here are calendar days, never instants — parsing them as UTC
  // midnight keeps arithmetic free of the server's timezone.
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

/** ISO weekday, Monday = 1 through Sunday = 7. */
function isoWeekday(date: Date): StudyWeekday {
  const jsDay = date.getUTCDay();
  return (jsDay === 0 ? 7 : jsDay) as StudyWeekday;
}

function normalizeStudyDays(days: unknown): StudyWeekday[] {
  const parsed = Array.isArray(days)
    ? days.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    : [];
  // An enrollment with no usable study days would schedule nothing at all, so
  // fall back to every day rather than producing an empty plan.
  return (parsed.length > 0 ? [...new Set(parsed)] : [1, 2, 3, 4, 5, 6, 7]).sort() as StudyWeekday[];
}

/** The distinct (week, day) slots a plan's items occupy, in plan order. */
export function planSlots(items: Pick<TrackableItem, "week_no" | "day_no">[]): { week_no: number; day_no: number }[] {
  const seen = new Set<string>();
  const slots: { week_no: number; day_no: number }[] = [];
  for (const item of items) {
    const key = `${item.week_no}:${item.day_no}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ week_no: item.week_no, day_no: item.day_no });
  }
  return slots.sort((a, b) => a.week_no - b.week_no || a.day_no - b.day_no);
}

/**
 * Lays the plan's day-slots onto real dates, one slot per study day starting
 * from start_date. A learner studying six days a week finishes later than the
 * plan's nominal duration — that is correct, and saying so up front is the
 * whole point of asking which days they study.
 */
export function buildSchedule(
  items: Pick<TrackableItem, "week_no" | "day_no">[],
  startDate: string,
  studyDays: unknown
): { slots: ScheduleSlot[]; byDate: Map<string, { week_no: number; day_no: number }>; endDate: string | null } {
  const days = normalizeStudyDays(studyDays);
  const slots = planSlots(items);
  const scheduled: ScheduleSlot[] = [];
  const byDate = new Map<string, { week_no: number; day_no: number }>();

  if (slots.length === 0) return { slots: scheduled, byDate, endDate: null };

  const cursor = parseIsoDate(startDate);
  let assigned = 0;
  // Bounded so a pathological study_days value can never spin forever; ten
  // years is far past any real plan.
  for (let guard = 0; guard < 3650 && assigned < slots.length; guard += 1) {
    if (days.includes(isoWeekday(cursor))) {
      const slot = slots[assigned];
      if (slot) {
        const iso = toIsoDate(cursor);
        scheduled.push({ ...slot, scheduled_date: iso });
        byDate.set(iso, slot);
        assigned += 1;
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { slots: scheduled, byDate, endDate: scheduled[scheduled.length - 1]?.scheduled_date ?? null };
}

/** The date the remaining work would finish if it started again today. */
function projectEnd(remainingSlots: number, from: Date, studyDays: StudyWeekday[]): string | null {
  if (remainingSlots <= 0) return toIsoDate(from);
  const cursor = new Date(from.getTime());
  let placed = 0;
  let last: string | null = null;
  for (let guard = 0; guard < 3650 && placed < remainingSlots; guard += 1) {
    if (studyDays.includes(isoWeekday(cursor))) {
      last = toIsoDate(cursor);
      placed += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return last;
}

export type PlanTracking = {
  state: TrackingState;
  start_date: string;
  target_end_date: string | null;
  projected_end_date: string | null;
  /** Study days' worth of work that is due and still open. */
  days_behind: number;
  total_slots: number;
  elapsed_slots: number;
  completed_items: number;
  total_items: number;
  due_items: number;
  completed_due_items: number;
  open_due_item_ids: number[];
  percent_complete: number;
  /** 0-1, how much of what is due has been done. */
  pace_ratio: number;
  depth: {
    /** 0-1 composite of the three signals below. */
    score: number;
    label: string;
    tests_due: number;
    tests_done: number;
    rushed_items: number;
    average_accuracy: number | null;
    target_accuracy: number;
  };
  today: {
    date: string;
    week_no: number | null;
    day_no: number | null;
    item_ids: number[];
  };
};

export function computeTracking(options: {
  items: TrackableItem[];
  startDate: string;
  studyDays: unknown;
  targetEndDate: string | null;
  targetAccuracy: number;
  averageAccuracy: number | null;
  lastActivityAt: string | null;
  /** Injectable so the caller (and tests) control "today". */
  now?: Date;
}): PlanTracking {
  const { items, startDate, targetEndDate, targetAccuracy, averageAccuracy, lastActivityAt } = options;
  const days = normalizeStudyDays(options.studyDays);
  const now = options.now ?? new Date();
  const todayIso = toIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));

  const { slots } = buildSchedule(items, startDate, days);
  const dateBySlot = new Map(slots.map((slot) => [`${slot.week_no}:${slot.day_no}`, slot.scheduled_date]));
  const scheduledDate = (item: TrackableItem) => dateBySlot.get(`${item.week_no}:${item.day_no}`) ?? null;

  const isComplete = (item: TrackableItem) => item.progress?.status === "completed";

  const dueItems = items.filter((item) => {
    const date = scheduledDate(item);
    return date !== null && date <= todayIso;
  });
  const completedDue = dueItems.filter(isComplete);
  const openDue = dueItems.filter((item) => !isComplete(item));
  const completedAll = items.filter(isComplete);
  const completedAhead = completedAll.filter((item) => {
    const date = scheduledDate(item);
    return date !== null && date > todayIso;
  });

  // "Two days behind" means two study days' worth of work is still open, which
  // is what a learner actually feels — not a count of individual items.
  const behindDates = new Set(
    openDue.map((item) => scheduledDate(item)).filter((date): date is string => date !== null)
  );
  const daysBehind = behindDates.size;

  const elapsedSlots = slots.filter((slot) => slot.scheduled_date <= todayIso).length;
  const remainingSlots = slots.length - slots.filter((slot) => {
    const slotItems = items.filter((item) => item.week_no === slot.week_no && item.day_no === slot.day_no);
    return slotItems.length > 0 && slotItems.every(isComplete);
  }).length;

  const projectedEnd = projectEnd(remainingSlots, parseIsoDate(todayIso), days);

  const daysSinceActivity = lastActivityAt
    ? Math.floor((parseIsoDate(todayIso).getTime() - parseIsoDate(lastActivityAt).getTime()) / DAY_MS)
    : null;

  // Past the target by more than a fifth of the plan's own length is the point
  // at which the original date stops being worth showing as achievable. The
  // three-day floor matters: on a short plan a fifth is barely a day, which
  // would escalate a learner to "at risk" for being two days late on a
  // three-week plan.
  const OVERRUN_FLOOR_DAYS = 3;
  const overrunLimit = targetEndDate
    ? parseIsoDate(targetEndDate).getTime() +
      Math.max(OVERRUN_FLOOR_DAYS, slots.length * 0.2) * DAY_MS
    : null;
  const overrunning =
    overrunLimit !== null && projectedEnd !== null && parseIsoDate(projectedEnd).getTime() > overrunLimit;

  let state: TrackingState;
  if (daysSinceActivity !== null && daysSinceActivity >= STALL_DAYS && openDue.length > 0) {
    state = "stalled";
  } else if (daysBehind >= 7 || overrunning) {
    state = "at_risk";
  } else if (daysBehind >= 3) {
    state = "behind";
  } else if (daysBehind >= 1) {
    state = "slipping";
  } else if (completedAhead.length > 0) {
    state = "ahead";
  } else {
    state = "on_time";
  }

  // ── Depth ────────────────────────────────────────────────────────────────
  const testsDue = dueItems.filter((item) => TEST_ITEM_TYPES.has(item.item_type));
  const testsDone = testsDue.filter(isComplete);
  const rushed = completedAll.filter((item) => {
    const estimate = Number(item.estimated_minutes ?? 0);
    const spent = Number(item.progress?.time_spent_seconds ?? 0);
    // Only judge items that carry an estimate and recorded any time at all —
    // a zero here means "not measured", not "instant".
    if (estimate <= 0 || spent <= 0) return false;
    return spent < estimate * 60 * RUSHED_THRESHOLD;
  });

  const testCompletion = testsDue.length > 0 ? testsDone.length / testsDue.length : 1;
  const accuracyRatio =
    averageAccuracy !== null && targetAccuracy > 0
      ? Math.max(0, Math.min(1, averageAccuracy / targetAccuracy))
      : 1;
  const rushedRatio = completedAll.length > 0 ? rushed.length / completedAll.length : 0;
  const depthScore = Math.max(0, Math.min(1, testCompletion * 0.5 + accuracyRatio * 0.3 + (1 - rushedRatio) * 0.2));
  const depthLabel =
    depthScore >= 0.8 ? "Thorough" : depthScore >= 0.6 ? "Good" : depthScore >= 0.4 ? "Needs care" : "At risk";

  const todaySlot = slots.find((slot) => slot.scheduled_date === todayIso) ?? null;
  const todayItems = todaySlot
    ? items.filter((item) => item.week_no === todaySlot.week_no && item.day_no === todaySlot.day_no)
    : [];

  return {
    state,
    start_date: startDate,
    target_end_date: targetEndDate,
    projected_end_date: projectedEnd,
    days_behind: daysBehind,
    total_slots: slots.length,
    elapsed_slots: elapsedSlots,
    completed_items: completedAll.length,
    total_items: items.length,
    due_items: dueItems.length,
    completed_due_items: completedDue.length,
    open_due_item_ids: openDue.map((item) => item.id),
    percent_complete: items.length > 0 ? Math.round((completedAll.length / items.length) * 100) : 0,
    pace_ratio: dueItems.length > 0 ? completedDue.length / dueItems.length : 1,
    depth: {
      score: depthScore,
      label: depthLabel,
      tests_due: testsDue.length,
      tests_done: testsDone.length,
      rushed_items: rushed.length,
      average_accuracy: averageAccuracy,
      target_accuracy: targetAccuracy
    },
    today: {
      date: todayIso,
      week_no: todaySlot?.week_no ?? null,
      day_no: todaySlot?.day_no ?? null,
      item_ids: todayItems.map((item) => item.id)
    }
  };
}

/**
 * The target end date a plan implies for a given start — used at enrolment,
 * then stored so later "on time" claims compare against what was agreed rather
 * than against a moving line.
 */
export function deriveTargetEndDate(
  items: Pick<TrackableItem, "week_no" | "day_no">[],
  startDate: string,
  studyDays: unknown
): string | null {
  return buildSchedule(items, startDate, studyDays).endDate;
}
