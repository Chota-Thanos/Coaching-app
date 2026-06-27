type TrendPoint = {
  result_date: string;
  avg_score: number | string;
  avg_accuracy: number | string;
  attempts: number;
};

function formatDateShort(value: string): string {
  try {
    const d = new Date(value);
    return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(d);
  } catch {
    return value;
  }
}

function pct(value: number | string): number {
  const n = Number(value ?? 0);
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

export function TrendGraph({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl bg-slate-50 border border-dashed border-slate-200">
        <p className="text-sm text-slate-400">Complete more tests to see your trend.</p>
      </div>
    );
  }

  const maxPct = 100;
  const points = trend.slice(-10); // Show last 10

  return (
    <div className="space-y-3">
      {/* Bars */}
      <div className="flex h-32 items-end gap-1.5">
        {points.map((point, i) => {
          const accPct = pct(point.avg_accuracy);
          const isLast = i === points.length - 1;
          const barColor =
            accPct >= 70 ? "bg-emerald-500" : accPct >= 40 ? "bg-amber-500" : "bg-rose-500";

          return (
            <div key={point.result_date} className="group relative flex flex-1 flex-col items-center justify-end">
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full mb-2 hidden rounded-lg bg-ink px-2.5 py-1.5 text-center group-hover:block">
                <p className="text-xs font-black text-white">{accPct}%</p>
                <p className="text-[10px] text-white/70">{point.attempts} attempt{point.attempts !== 1 ? "s" : ""}</p>
              </div>

              {/* Bar */}
              <div
                className={`w-full rounded-t-lg transition-all ${barColor} ${isLast ? "opacity-100 ring-2 ring-offset-1 ring-indigo-600/30" : "opacity-70 group-hover:opacity-100"}`}
                style={{ height: `${Math.max((accPct / maxPct) * 100, 6)}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Date labels */}
      <div className="flex gap-1.5">
        {points.map((point) => (
          <div key={point.result_date} className="flex-1 text-center">
            <p className="text-[9px] font-semibold text-muted leading-tight">
              {formatDateShort(point.result_date)}
            </p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
          <span className="h-2 w-4 rounded bg-emerald-500" /> ≥ 70%
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
          <span className="h-2 w-4 rounded bg-amber-500" /> 40–70%
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
          <span className="h-2 w-4 rounded bg-rose-500" /> &lt; 40%
        </span>
      </div>
    </div>
  );
}
