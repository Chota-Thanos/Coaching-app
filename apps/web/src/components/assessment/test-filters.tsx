"use client";

import { Filter } from "lucide-react";
import type { Exam, ExamLevel } from "../../lib/assessment";

type TestFiltersProps = {
  exams: Exam[];
  levels: ExamLevel[];
  selectedExam?: string;
  selectedLevel?: string;
  selectedAccess?: string;
};

export function TestFilters({
  exams,
  levels,
  selectedExam,
  selectedLevel,
  selectedAccess
}: TestFiltersProps) {
  return (
    <form action="/assessment/tests" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_1fr_auto]" method="get">
      <label className="grid gap-1 text-sm font-bold text-ink">
        Exam
        <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600" defaultValue={selectedExam ?? ""} name="exam_id">
          <option value="">All exams</option>
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm font-bold text-ink">
        Level
        <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600" defaultValue={selectedLevel ?? ""} name="exam_level_id">
          <option value="">All levels</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm font-bold text-ink">
        Access
        <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600" defaultValue={selectedAccess ?? ""} name="access_type">
          <option value="">All access</option>
          <option value="free">Free</option>
          <option value="subscription">Plan</option>
          <option value="paid">Paid</option>
        </select>
      </label>

      <button className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-indigo-600 transition-colors cursor-pointer" type="submit">
        <Filter aria-hidden="true" className="h-4 w-4" />
        Apply
      </button>
    </form>
  );
}
