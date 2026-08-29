import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSchedule, computeTracking, deriveTargetEndDate, planSlots, type TrackableItem } from "./tracking.js";

/** Three plan weeks, one item on each of days 1-3 — nine items, ids 1-9 in
 *  schedule order, with every third one a test. */
function makeItems(overrides: Partial<Record<number, Partial<TrackableItem>>> = {}): TrackableItem[] {
  const items: TrackableItem[] = [];
  let id = 1;
  for (let week = 1; week <= 3; week += 1) {
    for (let day = 1; day <= 3; day += 1) {
      items.push({
        id,
        week_no: week,
        day_no: day,
        item_type: day === 3 ? "prelims_test" : "reading",
        estimated_minutes: 40,
        progress: null,
        ...(overrides[id] ?? {})
      });
      id += 1;
    }
  }
  return items;
}

function complete(items: TrackableItem[], ids: number[], timeSpentSeconds = 2400): TrackableItem[] {
  return items.map((item) =>
    ids.includes(item.id)
      ? { ...item, progress: { status: "completed", time_spent_seconds: timeSpentSeconds } }
      : item
  );
}

describe("planSlots", () => {
  it("collapses items sharing a day into one slot, in plan order", () => {
    const slots = planSlots([
      { week_no: 2, day_no: 1 },
      { week_no: 1, day_no: 2 },
      { week_no: 1, day_no: 2 },
      { week_no: 1, day_no: 1 }
    ]);
    assert.deepEqual(slots, [
      { week_no: 1, day_no: 1 },
      { week_no: 1, day_no: 2 },
      { week_no: 2, day_no: 1 }
    ]);
  });
});

describe("buildSchedule", () => {
  it("assigns one slot per calendar day when every day is a study day", () => {
    // 2026-08-31 is a Monday.
    const { slots, endDate } = buildSchedule(makeItems(), "2026-08-31", [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(slots.length, 9);
    assert.equal(slots[0]?.scheduled_date, "2026-08-31");
    assert.equal(endDate, "2026-09-08");
  });

  it("skips non-study days, pushing the finish date out", () => {
    // Mon-Sat only: the 9 slots skip Sunday 6 September.
    const { slots, endDate } = buildSchedule(makeItems(), "2026-08-31", [1, 2, 3, 4, 5, 6]);
    assert.equal(slots.length, 9);
    assert.ok(!slots.some((slot) => slot.scheduled_date === "2026-09-06"));
    assert.equal(endDate, "2026-09-09");
  });

  it("falls back to every day when study_days is empty or malformed", () => {
    const { endDate } = buildSchedule(makeItems(), "2026-08-31", []);
    assert.equal(endDate, "2026-09-08");
    const { endDate: fromJunk } = buildSchedule(makeItems(), "2026-08-31", ["x", 0, 99] as unknown);
    assert.equal(fromJunk, "2026-09-08");
  });

  it("returns no end date for a plan with no items", () => {
    assert.equal(deriveTargetEndDate([], "2026-08-31", [1, 2, 3, 4, 5, 6, 7]), null);
  });
});

describe("computeTracking", () => {
  const base = {
    startDate: "2026-08-31",
    studyDays: [1, 2, 3, 4, 5, 6, 7],
    targetEndDate: "2026-09-08",
    targetAccuracy: 70,
    averageAccuracy: null as number | null,
    lastActivityAt: null as string | null
  };

  it("is on time when everything due is done", () => {
    // Third study day: items 1-3 are due.
    const items = complete(makeItems(), [1, 2, 3]);
    const tracking = computeTracking({ ...base, items, now: new Date("2026-09-02T10:00:00Z") });
    assert.equal(tracking.state, "on_time");
    assert.equal(tracking.days_behind, 0);
    assert.equal(tracking.due_items, 3);
    assert.equal(tracking.completed_due_items, 3);
  });

  it("counts days behind as open study days, not open items", () => {
    // Two scheduled days untouched, so two days behind.
    const items = complete(makeItems(), [1]);
    const tracking = computeTracking({ ...base, items, now: new Date("2026-09-02T10:00:00Z") });
    assert.equal(tracking.days_behind, 2);
    assert.equal(tracking.state, "slipping");
    assert.deepEqual(tracking.open_due_item_ids, [2, 3]);
  });

  it("escalates to behind, then at risk", () => {
    const items = makeItems();
    const behind = computeTracking({ ...base, items, now: new Date("2026-09-03T10:00:00Z") });
    assert.equal(behind.days_behind, 4);
    assert.equal(behind.state, "behind");

    const atRisk = computeTracking({ ...base, items, now: new Date("2026-09-08T10:00:00Z") });
    assert.equal(atRisk.state, "at_risk");
  });

  it("reports ahead when future work is already done", () => {
    const items = complete(makeItems(), [1, 2]);
    const tracking = computeTracking({ ...base, items, now: new Date("2026-08-31T10:00:00Z") });
    assert.equal(tracking.state, "ahead");
    assert.equal(tracking.days_behind, 0);
  });

  it("stops calling a dormant learner behind and calls them stalled", () => {
    const items = complete(makeItems(), [1]);
    const tracking = computeTracking({
      ...base,
      items,
      lastActivityAt: "2026-08-31",
      now: new Date("2026-09-10T10:00:00Z")
    });
    assert.equal(tracking.state, "stalled");
  });

  it("marks depth down for skipped tests", () => {
    // Both readings done, the day-3 test skipped.
    const items = complete(makeItems(), [1, 2]);
    const tracking = computeTracking({ ...base, items, now: new Date("2026-09-02T10:00:00Z") });
    assert.equal(tracking.depth.tests_due, 1);
    assert.equal(tracking.depth.tests_done, 0);
    assert.ok(tracking.depth.score < 0.6, `expected a low depth score, got ${tracking.depth.score}`);
  });

  it("flags items completed far under their estimate as rushed", () => {
    // 40-minute items closed in 60 seconds.
    const items = complete(makeItems(), [1, 2, 3], 60);
    const tracking = computeTracking({ ...base, items, now: new Date("2026-09-02T10:00:00Z") });
    assert.equal(tracking.depth.rushed_items, 3);
    assert.equal(tracking.state, "on_time");
    assert.ok(tracking.depth.score < 1, "rushing everything should not read as thorough");
  });

  it("does not treat unmeasured time as rushing", () => {
    const items = complete(makeItems(), [1, 2, 3], 0);
    const tracking = computeTracking({ ...base, items, now: new Date("2026-09-02T10:00:00Z") });
    assert.equal(tracking.depth.rushed_items, 0);
  });

  it("scales depth by test accuracy against the plan benchmark", () => {
    const items = complete(makeItems(), [1, 2, 3]);
    const strong = computeTracking({ ...base, items, averageAccuracy: 80, now: new Date("2026-09-02T10:00:00Z") });
    const weak = computeTracking({ ...base, items, averageAccuracy: 35, now: new Date("2026-09-02T10:00:00Z") });
    assert.ok(strong.depth.score > weak.depth.score);
    assert.equal(strong.depth.target_accuracy, 70);
  });

  it("surfaces today's slot and its items", () => {
    const tracking = computeTracking({ ...base, items: makeItems(), now: new Date("2026-09-02T10:00:00Z") });
    assert.equal(tracking.today.week_no, 1);
    assert.equal(tracking.today.day_no, 3);
    assert.deepEqual(tracking.today.item_ids, [3]);
  });

  it("handles a plan whose start date is in the future", () => {
    const tracking = computeTracking({ ...base, items: makeItems(), now: new Date("2026-08-20T10:00:00Z") });
    assert.equal(tracking.due_items, 0);
    assert.equal(tracking.days_behind, 0);
    assert.equal(tracking.state, "on_time");
  });
});
