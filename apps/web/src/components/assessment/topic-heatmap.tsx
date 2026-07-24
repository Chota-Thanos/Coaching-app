import { Clock3, TrendingUp, TrendingDown } from "lucide-react";

type TopicRow = {
  id: number;
  taxonomy_name: string | null;
  question_nature_name: string | null;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unattempted_count: number;
  score: number | string;
  accuracy: number | string;
  avg_time_seconds: number | string;
};

function accuracyColor(accuracy: number): string {
  if (accuracy >= 0.7) return "text-emerald-750 bg-emerald-50 border border-emerald-200/50";
  if (accuracy >= 0.4) return "text-amber-750 bg-amber-50 border border-amber-200/50";
  return "text-rose-750 bg-rose-50 border border-rose-200/50";
}

function accuracyBarColor(accuracy: number): string {
  if (accuracy >= 0.7) return "bg-emerald-500";
  if (accuracy >= 0.4) return "bg-amber-500";
  return "bg-rose-500";
}

function formatPct(value: number | string): string {
  const n = Number(value ?? 0);
  const pct = n <= 1 ? n * 100 : n;
  return `${Math.round(pct)}%`;
}

function formatTime(seconds: number | string): string {
  const s = Math.round(Number(seconds ?? 0));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function TopicHeatmap({ topics }: { topics: TopicRow[] }) {
  if (topics.length === 0) {
    return (
      <div className="rounded-2xl bg-paper p-8 text-center">
        <p className="text-sm text-muted">Topic breakdown data is not available for this test.</p>
      </div>
    );
  }

  const sorted = [...topics].sort((a, b) => Number(a.accuracy) - Number(b.accuracy));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-205 bg-surface shadow-card">
      {/* Table header */}
      <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_6rem_4rem] gap-2 bg-slate-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <span>Topic</span>
        <span className="text-center">Qs</span>
        <span className="text-center">✓</span>
        <span>Accuracy</span>
        <span className="text-right">Avg Time</span>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-slate-100">
        {sorted.map((topic) => {
          const acc = Number(topic.accuracy ?? 0);
          const pct = acc <= 1 ? acc : acc / 100;
          const colorClass = accuracyColor(pct);
          const barColor = accuracyBarColor(pct);

          return (
            <li
              key={`${topic.taxonomy_name}-${topic.question_nature_name}`}
              className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_6rem_4rem] items-center gap-2 px-4 py-3 hover:bg-slate-50/50"
            >
              {/* Topic name */}
              <div>
                <p className="truncate text-sm font-semibold text-ink">
                  {topic.taxonomy_name ?? "Unmapped"}
                </p>
                {topic.question_nature_name && (
                  <p className="mt-0.5 truncate text-[11px] text-muted">{topic.question_nature_name}</p>
                )}
              </div>

              {/* Total questions */}
              <p className="text-center text-sm font-bold text-ink">{topic.total_questions}</p>

              {/* Correct */}
              <p className="text-center text-sm font-bold text-emerald-700">{topic.correct_count}</p>

              {/* Accuracy bar */}
              <div className="flex items-center gap-2">
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-all`}
                    style={{ width: formatPct(pct === acc ? acc : pct) }}
                  />
                </div>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${colorClass}`}>
                  {formatPct(topic.accuracy)}
                </span>
              </div>

              {/* Avg time */}
              <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-muted">
                <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                {formatTime(topic.avg_time_seconds)}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Summary legend */}
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-150 bg-slate-50 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
          <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> ≥ 70% — Strong
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
          ⚠ 40–70% — Needs work
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
          <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" /> &lt; 40% — Weak
        </span>
      </div>
    </div>
  );
}
