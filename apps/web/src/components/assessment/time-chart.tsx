import { Clock3 } from "lucide-react";
import type { TestQuestionItem } from "../../lib/assessment";

type TimeChartProps = {
  questions: TestQuestionItem[];
  durationMinutes: number;
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function outcomeColor(outcome: string | undefined): string {
  if (outcome === "correct") return "bg-emerald-500";
  if (outcome === "incorrect") return "bg-rose-500";
  return "bg-slate-350";
}

export function TimeChart({ questions, durationMinutes }: TimeChartProps) {
  const totalSeconds = durationMinutes * 60;
  const idealPerQuestion = questions.length > 0 ? Math.round(totalSeconds / questions.length) : 120;

  const itemsWithTime = questions
    .map((q, i) => ({
      index: i + 1,
      timeSpent: Number(q.score_item?.time_spent_seconds ?? 0),
      outcome: q.score_item?.outcome
    }))
    .filter((item) => item.timeSpent > 0);

  if (itemsWithTime.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center">
        <Clock3 className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
        <p className="mt-2 text-sm text-slate-400">Time per question data is not available for this attempt.</p>
      </div>
    );
  }

  const maxTime = Math.max(...itemsWithTime.map((i) => i.timeSpent), idealPerQuestion * 2);

  const totalWastedTime = itemsWithTime
    .filter((i) => i.outcome === "incorrect" || i.outcome === "unattempted")
    .reduce((sum, i) => sum + i.timeSpent, 0);

  const totalCorrectTime = itemsWithTime
    .filter((i) => i.outcome === "correct")
    .reduce((sum, i) => sum + i.timeSpent, 0);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500">Ideal / Question</p>
          <p className="mt-1 text-xl font-black text-slate-900">{formatTime(idealPerQuestion)}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
          <p className="text-xs font-bold text-emerald-700">Correct answers</p>
          <p className="mt-1 text-xl font-black text-slate-900">{formatTime(totalCorrectTime)}</p>
        </div>
        <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4">
          <p className="text-xs font-bold text-rose-700">Wasted time</p>
          <p className="mt-1 text-xl font-black text-slate-900">{formatTime(totalWastedTime)}</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="overflow-hidden rounded-2xl border border-slate-205 bg-white shadow-card">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Time per Question</p>
        </div>

        <div className="flex items-end gap-0.5 overflow-x-auto p-4" style={{ minHeight: "120px" }}>
          {/* Ideal line marker */}
          <div className="relative flex-1">
            <div className="flex items-end gap-0.5">
              {itemsWithTime.map((item) => {
                const heightPct = Math.min((item.timeSpent / maxTime) * 100, 100);
                const isOver = item.timeSpent > idealPerQuestion * 1.5;
                return (
                  <div
                    key={item.index}
                    className="group relative flex flex-1 flex-col items-center"
                    style={{ minWidth: "8px" }}
                  >
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full mb-1 hidden rounded-lg bg-ink px-2 py-1 text-[10px] font-semibold text-white group-hover:block whitespace-nowrap">
                      Q{item.index}: {formatTime(item.timeSpent)}
                    </div>
                    {/* Bar */}
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        isOver
                          ? "bg-amber-500"
                          : outcomeColor(item.outcome)
                      }`}
                      style={{ height: `${Math.max(heightPct, 4)}px` }}
                    />
                    {/* Q number */}
                    {itemsWithTime.length <= 30 && (
                      <span className="mt-1 text-[9px] text-muted">{item.index}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 border-t border-slate-150 bg-slate-50 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
            <span className="h-2 w-3 rounded-sm bg-emerald-500" /> Correct
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
            <span className="h-2 w-3 rounded-sm bg-rose-500" /> Incorrect
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
            <span className="h-2 w-3 rounded-sm bg-amber-500" /> Over-time (1.5× ideal)
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <span className="h-2 w-3 rounded-sm bg-slate-300" /> Unattempted
          </span>
        </div>
      </div>
    </div>
  );
}
