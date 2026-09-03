"use client";

import Link from "next/link";
import { ClipboardList, TriangleAlert } from "lucide-react";
import { isTestStep } from "./builder-shared";
import { formatStudyPlanItemType, type StudyPlanDetail, type StudyPlanItem } from "../../../lib/study-plans";

type TestsProps = {
  plan: StudyPlanDetail;
  onOpenStep: (item: StudyPlanItem) => void;
};

export function BuilderTests({ plan, onOpenStep }: TestsProps) {
  const testItems = plan.items
    .filter((item) => isTestStep(item.item_type))
    .sort((a, b) => a.week_no - b.week_no || a.day_no - b.day_no);

  return (
    <div className="mx-auto w-full max-w-4xl pb-20">
      <header className="mb-6">
        <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Tests</p>
        <h2 className="mt-1 text-3xl font-black leading-tight text-ink">
          {testItems.length === 0
            ? "No tests in this plan yet"
            : `${testItems.length} ${testItems.length === 1 ? "test" : "tests"} across the plan`}
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          Each test step carries its own paper. A test with no questions is invisible work for a student — fill them in
          before publishing.
        </p>
      </header>

      {testItems.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm font-semibold text-ink/45">
          Add a prelims, CSAT or mains step from the curriculum, and it will appear here.
        </p>
      ) : (
        <div className="space-y-3">
          {testItems.map((item) => {
            const questionCount = item.test_template?.question_count ?? 0;
            const empty = questionCount === 0;
            return (
              <div
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4"
                key={item.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-ink/45">
                      Week {item.week_no} · Day {item.day_no}
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-wider text-civic">
                      {formatStudyPlanItemType(item.item_type)}
                    </span>
                    {item.test_template?.status === "draft" && (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-700">Draft</span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-black text-ink">{item.title}</p>
                  <p
                    className={`mt-0.5 inline-flex items-center gap-1 text-xs font-bold ${
                      empty ? "text-amber-700" : "text-ink/50"
                    }`}
                  >
                    {empty && <TriangleAlert className="h-3.5 w-3.5" />}
                    {empty ? "No questions written yet" : `${questionCount} questions`}
                    {item.test_template?.duration_minutes ? ` · ${item.test_template.duration_minutes} min` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-black text-ink/70 hover:border-ink/25"
                    onClick={() => onOpenStep(item)}
                    type="button"
                  >
                    Step settings
                  </button>
                  {item.test_template_id && (
                    <Link
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-civic px-3 text-xs font-black text-white"
                      href={`/admin/study-plans/tests/${item.test_template_id}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      {empty ? "Write questions" : "Manage questions"}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
