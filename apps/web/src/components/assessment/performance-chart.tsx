"use client";

/**
 * The single trend chart the performance page uses for both halves of the
 * dashboard: objective accuracy (0-100) and Mains marks (0-max_score). The
 * old page drew two near-identical bar charts — one per content type — that
 * showed a value's height but nothing about its direction. This draws the
 * series as a line over a soft area fill with the latest point called out,
 * so "am I improving?" is answerable at a glance, and marks the same two
 * thresholds the rest of the page colours by.
 */

export type ChartPoint = {
  /** ISO date (or anything Date can parse) — used for the axis labels only. */
  date: string;
  value: number;
  /** Attempts on that date, surfaced in the hover tooltip. */
  attempts?: number;
};

const VIEW_W = 640;
const VIEW_H = 180;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 14;
const BASE_Y = 166;

function formatDateShort(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function PerformanceChart({
  points,
  max,
  goodAt,
  warnAt,
  formatValue,
  emptyMessage = "Complete more tests to see your trend."
}: {
  points: ChartPoint[];
  /** Top of the y axis — 100 for accuracy, the paper's max score for Mains. */
  max: number;
  /** Value at or above which performance reads as strong. */
  goodAt: number;
  /** Value at or above which performance reads as average. */
  warnAt: number;
  formatValue: (value: number) => string;
  emptyMessage?: string;
}) {
  const series = points.slice(-10);

  if (series.length === 0) {
    return (
      <div className="flex h-[150px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
        <p className="text-xs font-semibold text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  const safeMax = max > 0 ? max : 1;
  const toY = (value: number) => BASE_Y - (Math.max(0, Math.min(safeMax, value)) / safeMax) * (BASE_Y - PAD_T);
  // A lone point has no span to divide, so it sits at the left edge rather
  // than dividing by zero.
  const step = series.length > 1 ? (VIEW_W - PAD_L - PAD_R) / (series.length - 1) : 0;
  const toX = (index: number) => PAD_L + index * step;

  const coords = series.map((point, index) => ({ ...point, x: toX(index), y: toY(point.value) }));
  const first = coords[0];
  const last = coords[coords.length - 1];
  // Unreachable — `series` is non-empty past the guard above — but it keeps
  // the coordinate maths below free of non-null assertions.
  if (!first || !last) return null;

  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `M${line.replaceAll(" ", " L")} L${last.x.toFixed(1)},${BASE_Y} L${first.x.toFixed(1)},${BASE_Y} Z`;

  const gradientId = `perf-chart-fill-${max}-${series.length}`;

  return (
    <div className="group/chart relative">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Trend across the last ${series.length} result${series.length === 1 ? "" : "s"}, ending at ${formatValue(last.value)}.`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* The same two bands every accuracy pill on this page uses. */}
        <line x1={PAD_L} y1={toY(goodAt)} x2={VIEW_W - PAD_R} y2={toY(goodAt)} stroke="#a7f3d0" strokeWidth="1" strokeDasharray="3 4" />
        <line x1={PAD_L} y1={toY(warnAt)} x2={VIEW_W - PAD_R} y2={toY(warnAt)} stroke="#fcd34d" strokeWidth="1" strokeDasharray="3 4" />
        <text x="8" y={toY(goodAt) + 3.5} fontSize="9" className="fill-slate-400 font-mono">
          {formatValue(goodAt)}
        </text>
        <text x="8" y={toY(warnAt) + 3.5} fontSize="9" className="fill-slate-400 font-mono">
          {formatValue(warnAt)}
        </text>

        <path d={area} fill={`url(#${gradientId})`} />
        <polyline points={line} fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

        {coords.slice(0, -1).map((c) => (
          <circle key={c.date} cx={c.x} cy={c.y} r="2.6" fill="rgb(var(--c-surface))" stroke="#4f46e5" strokeWidth="1.6" />
        ))}
        <circle cx={last.x} cy={last.y} r="9" fill="#4f46e5" opacity="0.16" />
        <circle cx={last.x} cy={last.y} r="5" fill="#4f46e5" />
        <text
          x={Math.min(last.x, VIEW_W - PAD_R - 14)}
          y={Math.max(last.y - 14, 12)}
          fontSize="12"
          fontWeight="700"
          textAnchor="middle"
          fill="#4f46e5"
        >
          {formatValue(last.value)}
        </text>

        {/* Only the endpoints and midpoint are labelled — ten dates at this
            width would collide. */}
        {Array.from(new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]))
          .map((index) => ({ index, point: series[index] }))
          .filter((entry): entry is { index: number; point: ChartPoint } => Boolean(entry.point))
          .map(({ index, point }) => (
            <text
              key={`${point.date}-${index}`}
              x={toX(index)}
              y={VIEW_H - 2}
              fontSize="9"
              textAnchor={index === series.length - 1 ? "end" : index === 0 ? "start" : "middle"}
              className="fill-slate-400 font-mono"
            >
              {formatDateShort(point.date)}
            </text>
          ))}
      </svg>
    </div>
  );
}
