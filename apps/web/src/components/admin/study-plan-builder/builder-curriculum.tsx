"use client";

import { CalendarDays, Loader2, Pencil, Plus, Radio, Sparkles } from "lucide-react";
import { LIVE_STATUS_LABEL, stepIcon } from "./builder-shared";
import { formatStudyPlanItemType, type StudyPlanDetail, type StudyPlanItem } from "../../../lib/study-plans";

type CurriculumProps = {
  plan: StudyPlanDetail;
  busy: string | null;
  onAddStep: (weekNo: number, dayNo: number) => void;
  onOpenStep: (item: StudyPlanItem) => void;
  onEditWeek: (weekNo: number) => void;
};

/** Days that already carry a step, so "add" can suggest the next free one. */
function nextFreeDay(items: StudyPlanItem[]): number {
  const used = new Set(items.map((item) => item.day_no));
  for (let day = 1; day <= 7; day += 1) {
    if (!used.has(day)) return day;
  }
  return 1;
}

export function BuilderCurriculum({ plan, busy, onAddStep, onOpenStep, onEditWeek }: CurriculumProps) {
  const weeks = Array.from({ length: Math.max(1, plan.duration_weeks) }, (_, index) => index + 1);
  const itemsByWeek = new Map<number, StudyPlanItem[]>();
  for (const item of plan.items) {
    const current = itemsByWeek.get(item.week_no) ?? [];
    current.push(item);
    itemsByWeek.set(item.week_no, current);
  }

  const totalSteps = plan.items.length;

  return (
    <div className="mx-auto w-full max-w-5xl pb-20">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Curriculum</p>
          <h2 className="mt-1 text-3xl font-black leading-tight text-ink">
            {plan.duration_weeks} {plan.duration_weeks === 1 ? "week" : "weeks"}, {totalSteps}{" "}
            {totalSteps === 1 ? "step" : "steps"}
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Give each week a theme, then fill its days. A day can be reading, a lecture or a test.
          </p>
        </div>
      </header>

      <div className="space-y-4">
        {weeks.map((weekNo) => {
          const items = (itemsByWeek.get(weekNo) ?? []).sort((a, b) => a.day_no - b.day_no || a.display_order - b.display_order);
          const overview = plan.week_overviews?.find((entry) => entry.week_no === weekNo);

          return (
            <section className="overflow-hidden rounded-2xl border border-line bg-surface" key={weekNo}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-paper px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wider text-ink/45">Week {weekNo}</p>
                  {overview ? (
                    <>
                      <h3 className="mt-1 text-lg font-black leading-tight text-ink">{overview.title}</h3>
                      {overview.description && (
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/60">{overview.description}</p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-ink/40">No theme set for this week yet.</p>
                  )}
                </div>
                <button
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-black text-ink/70 hover:border-ink/25"
                  onClick={() => onEditWeek(weekNo)}
                  type="button"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {overview ? "Edit theme" : "Add a theme"}
                </button>
              </div>

              <div className="divide-y divide-line">
                {items.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm font-semibold text-ink/40">
                    Nothing scheduled for this week yet.
                  </p>
                ) : (
                  items.map((item) => (
                    <button
                      className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-paper"
                      key={item.id}
                      onClick={() => onOpenStep(item)}
                      type="button"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-paper text-civic ring-1 ring-line">
                        {stepIcon(item.item_type)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-ink/45">
                            Day {item.day_no}
                          </span>
                          <span className="text-[11px] font-black uppercase tracking-wider text-civic">
                            {formatStudyPlanItemType(item.item_type)}
                          </span>
                          {item.is_preview && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                              <Sparkles className="h-3 w-3" />
                              Free preview
                            </span>
                          )}
                          {item.live_class && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                                item.live_class.status === "live"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-civic/10 text-civic"
                              }`}
                            >
                              <Radio className="h-3 w-3" />
                              {LIVE_STATUS_LABEL[item.live_class.status] ?? item.live_class.status}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block truncate text-sm font-black text-ink">{item.title}</span>
                        <span className="mt-0.5 block text-xs font-semibold text-ink/45">
                          {item.test_template
                            ? `${item.test_template.title} · ${item.test_template.question_count ?? 0} questions`
                            : item.estimated_minutes
                              ? `${item.estimated_minutes} min`
                              : "No time set"}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-line bg-paper/60 px-5 py-3">
                <button
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-ink/25 px-3 text-xs font-black text-ink/60 hover:border-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                  disabled={Boolean(busy)}
                  onClick={() => onAddStep(weekNo, nextFreeDay(items))}
                  type="button"
                >
                  {busy === `add-${weekNo}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add a step to week {weekNo}
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {plan.duration_weeks > 0 && plan.items.length === 0 && (
        <p className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-6 text-sm font-semibold text-ink/45">
          <CalendarDays className="h-4 w-4" />
          Start with week 1, day 1 — the first thing a student will open.
        </p>
      )}
    </div>
  );
}
