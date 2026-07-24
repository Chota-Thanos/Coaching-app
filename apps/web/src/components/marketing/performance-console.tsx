"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";

// ─── Chart primitives — all styled for the always-dark "console" band ──────

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function RadarChart({ axes }: { axes: { label: string; value: number }[] }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 40;
  const n = axes.length;
  const angleStep = 360 / n;
  const ring = (fraction: number) =>
    axes.map((_, i) => { const p = polarPoint(cx, cy, maxR * fraction, i * angleStep); return `${p.x},${p.y}`; }).join(" ");
  const dataPolygon = axes
    .map((a, i) => { const p = polarPoint(cx, cy, maxR * (a.value / 100), i * angleStep); return `${p.x},${p.y}`; })
    .join(" ");
  const avg = Math.round(axes.reduce((s, a) => s + a.value, 0) / n);

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-black tabular-nums text-white">{avg}%</span>
        <span className="text-xs text-white/40">weighted average</span>
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[260px] overflow-visible">
        <polygon points={ring(1)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <polygon points={ring(0.66)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <polygon points={ring(0.33)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <polygon points={dataPolygon} fill="rgba(79,70,229,0.28)" stroke="#818cf8" strokeWidth="2" />
        {axes.map((a, i) => {
          const p = polarPoint(cx, cy, maxR * (a.value / 100), i * angleStep);
          return <circle key={a.label} cx={p.x} cy={p.y} r="3.5" fill="#818cf8" />;
        })}
        {axes.map((a, i) => {
          const p = polarPoint(cx, cy, maxR + 22, i * angleStep);
          return (
            <text key={a.label} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="fill-white/40 font-mono text-[9px]">
              {a.label} {a.value}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function TrendChart({ points }: { points: number[] }) {
  const width = 420;
  const height = 150;
  const stepX = width / (points.length - 1);
  const coords = points.map((v, i) => ({ x: i * stepX, y: height - (v / 100) * height }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const last = coords[coords.length - 1] ?? { x: 0, y: 0 };
  const latestValue = points[points.length - 1] ?? 0;
  const delta = latestValue - (points[0] ?? 0);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <span className="font-mono text-2xl font-black tabular-nums text-white">{latestValue}%</span>
        <span className="font-mono text-xs font-bold text-emerald-400">
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}pt since week 1
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        <line x1="0" y1={height * 0.2} x2={width} y2={height * 0.2} stroke="rgba(255,255,255,0.08)" />
        <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="rgba(255,255,255,0.08)" />
        <line x1="0" y1={height * 0.85} x2={width} y2={height * 0.85} stroke="rgba(255,255,255,0.08)" />
        <path d={areaPath} fill="rgba(79,70,229,0.22)" />
        <path d={linePath} fill="none" stroke="#818cf8" strokeWidth="2.5" />
        <circle cx={last.x} cy={last.y} r="5" fill="#818cf8" stroke="#0f172a" strokeWidth="2" />
      </svg>
    </div>
  );
}

function OmrRow({ label, pct }: { label: string; pct: number }) {
  const filled = Math.round(pct / 10);
  const dotClass =
    pct >= 70 ? "bg-emerald-500 border-emerald-500" : pct >= 40 ? "bg-saffron border-saffron" : "bg-rose-500 border-rose-500";
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs font-bold text-white/75">{label}</span>
      <span className="flex gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-full border ${i < filled ? dotClass : "border-white/20"}`} />
        ))}
      </span>
      <span className="ml-auto font-mono text-xs font-black tabular-nums text-white">{pct}%</span>
    </div>
  );
}

function Readout({ tone, quote, flag }: { tone: "warn" | "positive"; quote: string; flag: string }) {
  const box = tone === "warn" ? "border-rose-400/25 bg-rose-500/10" : "border-emerald-400/25 bg-emerald-500/10";
  const flagColor = tone === "warn" ? "text-rose-300" : "text-emerald-300";
  return (
    <div className={`rounded-xl border px-4 py-3 ${box}`}>
      <p className="text-xs italic leading-relaxed text-white/85">&ldquo;{quote}&rdquo;</p>
      <p className={`mt-2 font-mono text-[10px] font-bold uppercase tracking-wider ${flagColor}`}>{flag}</p>
    </div>
  );
}

function ScoreGauge({ value, max = 10 }: { value: number; max?: number }) {
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - value / max);
  return (
    <div className="flex items-center gap-5">
      <svg width="104" height="104" viewBox="0 0 104 104" className="shrink-0">
        <circle cx="52" cy="52" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="9" />
        <circle
          cx="52" cy="52" r={r} fill="none" stroke="#818cf8" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 52 52)"
        />
      </svg>
      <div>
        <p className="font-mono text-3xl font-black tabular-nums text-white">{value.toFixed(1)}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">/ {max} avg score</p>
      </div>
    </div>
  );
}

// ─── Sample data — illustrative preview for logged-out visitors ────────────

const GK_RADAR = [
  { label: "Polity", value: 88 },
  { label: "Geo", value: 91 },
  { label: "Econ", value: 74 },
  { label: "Sci&T", value: 63 },
  { label: "IR", value: 77 },
  { label: "Hist", value: 85 },
];
const GK_TREND = [58, 62, 64, 68, 70, 72, 74, 76];
const GK_TOPICS = [
  { label: "Geography", pct: 91 },
  { label: "Polity", pct: 88 },
  { label: "History", pct: 85 },
  { label: "IR", pct: 77 },
  { label: "Economy", pct: 74 },
  { label: "Sci & Tech", pct: 63 },
];
const CSAT_RADAR = [
  { label: "Comprehen.", value: 79 },
  { label: "Data interp.", value: 84 },
  { label: "Decision", value: 71 },
  { label: "Numeracy", value: 61 },
  { label: "Reasoning", value: 52 },
];

const TABS = [
  { key: "gk", label: "General Studies" },
  { key: "csat", label: "CSAT" },
  { key: "mains", label: "Mains" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function PerformanceConsoleSection() {
  const [tab, setTab] = useState<TabKey>("gk");

  return (
    <section id="performance" className="relative overflow-hidden bg-midnight text-white section-showcase">
      <div className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-civic/10 blur-[120px] pointer-events-none" />
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <div className="h-6 w-6 rounded-lg bg-civic/15 flex items-center justify-center">
            <BarChart3 className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Performance Console</span>
          <span className="text-[10px] font-bold bg-white/10 text-white/60 px-2 py-0.5 rounded-full">Included on every plan</span>
        </div>
        <h2 className="max-w-2xl text-2xl sm:text-3xl font-black tracking-tight leading-tight">
          Analytics precise enough to change how you study.
        </h2>
        <p className="mt-3 max-w-xl text-sm text-white/55">
          Every attempt — GK, CSAT, or Mains — writes to one live record. Topic accuracy renders as an OMR read: filled bubbles for what
          you&rsquo;ve mastered, open circles for what still needs work.
        </p>

        <div role="tablist" aria-label="Performance console subject" className="mt-8 flex gap-1 border-b border-white/10 overflow-x-auto">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`shrink-0 touch-target px-4 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 -mb-px transition-colors ${
                tab === key ? "text-white border-civic" : "text-white/40 border-transparent hover:text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "gk" && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/40">Subject radar — 6 areas</p>
              <RadarChart axes={GK_RADAR} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/40">8-week accuracy trend</p>
              <TrendChart points={GK_TREND} />
            </div>
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="mb-5 text-[10px] font-black uppercase tracking-widest text-white/40">Topic accuracy — full OMR read</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
                {GK_TOPICS.map((t) => (
                  <OmrRow key={t.label} label={t.label} pct={t.pct} />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "csat" && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/40">CSAT sub-area radar</p>
              <RadarChart axes={CSAT_RADAR} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/40">Accuracy vs. attempt speed</p>
              <p className="mb-4 text-xs text-white/50 leading-relaxed">
                Reasoning accuracy drops sharply after the 40-minute mark — a pacing issue, not a knowledge gap.
              </p>
              <svg viewBox="0 0 420 120" className="w-full" preserveAspectRatio="none">
                <line x1="0" y1="30" x2="420" y2="30" stroke="rgba(255,255,255,0.08)" />
                <line x1="0" y1="75" x2="420" y2="75" stroke="rgba(255,255,255,0.08)" />
                <path d="M0,52 L60,44 L120,40 L180,60 L240,88 L300,96 L360,102 L420,104" fill="none" stroke="#fb7185" strokeWidth="2.5" />
                <circle cx="180" cy="60" r="4.5" fill="#fb7185" />
              </svg>
              <div className="mt-4">
                <Readout
                  tone="warn"
                  quote="Consistently loses 3+ marks on Reasoning items after question 60 — recommend timed sectional drills."
                  flag="Auto-flagged pattern"
                />
              </div>
            </div>
          </div>
        )}

        {tab === "mains" && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="mb-5 text-[10px] font-black uppercase tracking-widest text-white/40">Average evaluated score</p>
              <ScoreGauge value={7.2} />
              <p className="mt-5 text-xs text-white/45">Across 14 evaluated answers · GS-II &amp; GS-III</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/40">Recurring evaluator feedback</p>
              <Readout
                tone="warn"
                quote="Answers consistently lack a concluding value-added statement — add a forward-looking line."
                flag="Flagged 6 times"
              />
              <Readout
                tone="positive"
                quote="Diagram usage in GS-III economy answers improved evaluator scores by 0.8 points on average."
                flag="Positive pattern"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
