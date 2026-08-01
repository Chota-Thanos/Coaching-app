'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  X,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  MousePointerClick,
} from 'lucide-react';
import { buildAssessmentDemoScript } from './demo-script';
import { DemoStage } from './demo-stage';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Scripted walkthrough of the assessment flow.
 *
 * Replaces the old spotlight tour, which highlighted one control per page on
 * the real UI and therefore showed empty containers to anyone whose account had
 * no questions, tests or bookmarks. This plays the whole journey — browse → add
 * → name → attempt → review → revise — on a mock stage with fixed content, so
 * it always demonstrates something and works signed out.
 *
 * On desktop the stage is framed as a phone, because the flow is designed
 * mobile-first and reads best at that width; below `sm` it fills the screen.
 */
export function AssessmentDemo({ tryItHref = '/assessment/gk' }: { tryItHref?: string }) {
  const steps = useMemo(() => buildAssessmentDemoScript(), []);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [rect, setRect] = useState<Rect | null>(null);
  /** 0→1 within the current step; drives both the track and the auto-advance. */
  const [elapsed, setElapsed] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  /** Mirrors `elapsed` so the ticker can resume mid-step without re-running on every frame. */
  const elapsedRef = useRef(0);
  // `index` is only ever set from goTo/the ticker, both bounded by the script.
  const step = steps[Math.min(index, steps.length - 1)]!;
  const isLast = index === steps.length - 1;

  const goTo = useCallback((next: number) => {
    setIndex(next);
    elapsedRef.current = 0;
    setElapsed(0);
    setRect(null);
  }, []);

  // Locate the focused control. Runs after layout and again on resize, since
  // the pointer is positioned in the stage's own coordinate space.
  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!step.focus) {
      setRect(null);
      return;
    }
    const target = stage.querySelector<HTMLElement>(
      `[data-demo-focus="${CSS.escape(step.focus)}"]`,
    );
    if (!target) {
      setRect(null);
      return;
    }
    const stageBox = stage.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    setRect({
      top: box.top - stageBox.top,
      left: box.left - stageBox.left,
      width: box.width,
      height: box.height,
    });
  }, [step.focus]);

  useLayoutEffect(() => {
    measure();
    // A second pass once fonts/images settle, so the ring is not half a line off.
    const t = window.setTimeout(measure, 120);
    return () => window.clearTimeout(t);
  }, [measure, index]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // One interval per step, driving both the progress track and the advance so
  // the two can never drift apart. Resumes from wherever a pause left off.
  useEffect(() => {
    if (!playing) return;
    const tick = 100;
    let acc = elapsedRef.current * step.duration;
    const id = window.setInterval(() => {
      acc += tick;
      const fraction = Math.min(acc / step.duration, 1);
      elapsedRef.current = fraction;
      setElapsed(fraction);
      if (fraction < 1) return;
      window.clearInterval(id);
      if (index >= steps.length - 1) {
        setPlaying(false); // hold on the outro rather than looping unasked
        return;
      }
      goTo(index + 1);
    }, tick);
    return () => window.clearInterval(id);
  }, [playing, index, step.duration, steps.length, goTo]);

  const togglePlay = () => {
    if (!playing && isLast && elapsed >= 1) {
      goTo(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && index < steps.length - 1) goTo(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) goTo(index - 1);
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
          <Link
            href={tryItHref}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink transition hover:bg-paper"
            aria-label="Close demo"
          >
            <X className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted">
              How it works
            </p>
            <p className="truncate text-sm font-extrabold text-ink">Build &amp; attempt a test</p>
          </div>
          <span className="shrink-0 rounded-full bg-civic/10 px-3 py-1 text-[11px] font-extrabold text-civic">
            {index + 1} / {steps.length}
          </span>
        </div>

        {/* Stage */}
        <div className="relative flex flex-1 items-stretch justify-center bg-paper p-0 sm:p-6">
          <div
            ref={stageRef}
            className="relative w-full overflow-hidden bg-paper sm:max-w-[390px] sm:rounded-[2rem] sm:border-8 sm:border-midnight sm:shadow-soft"
            style={{ minHeight: 620 }}
          >
            <DemoStage state={step.state} />

            {rect && (
              <>
                <div
                  className="pointer-events-none absolute z-20 rounded-xl border-2 border-civic transition-all duration-[420ms] ease-out"
                  style={{
                    top: rect.top - 5,
                    left: rect.left - 5,
                    width: rect.width + 10,
                    height: rect.height + 10,
                    boxShadow: '0 0 0 4px rgb(79 70 229 / 0.18), 0 0 22px rgb(79 70 229 / 0.35)',
                  }}
                />
                <div
                  className="pointer-events-none absolute z-20 flex h-8 w-8 animate-bounce items-center justify-center rounded-full bg-civic text-white shadow-lg transition-all duration-[420ms] ease-out"
                  style={{
                    top: rect.top + rect.height - 8,
                    left: rect.left + rect.width / 2 - 16,
                  }}
                >
                  <MousePointerClick className="h-4 w-4" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Narration + controls */}
        <div className="sticky bottom-0 border-t border-line bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="flex gap-[2px] px-1 pt-1.5">
            {steps.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => goTo(i)}
                className="h-3 flex-1 py-1"
                aria-label={`Go to step ${i + 1}: ${s.title}`}
              >
                <span className="block h-1 w-full overflow-hidden rounded-full bg-line">
                  <span
                    className="block h-full rounded-full bg-civic"
                    style={{
                      width: i < index ? '100%' : i === index ? `${elapsed * 100}%` : '0%',
                      transition: i === index ? 'width 100ms linear' : undefined,
                    }}
                  />
                </span>
              </button>
            ))}
          </div>

          <div className="px-4 pb-4 pt-2.5">
            <p className="text-sm font-extrabold text-ink">{step.title}</p>
            <p className="mt-1 min-h-[3.2rem] text-[12.5px] leading-relaxed text-muted">
              {step.caption}
            </p>

            <div className="mt-2 flex items-center gap-2">
              <ControlButton icon={<RotateCcw className="h-4 w-4" />} label="Restart" onClick={() => goTo(0)} />
              <ControlButton
                icon={<SkipBack className="h-4 w-4" />}
                label="Previous step"
                onClick={index === 0 ? undefined : () => goTo(index - 1)}
              />
              <ControlButton
                icon={playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                label={playing ? 'Pause' : 'Play'}
                onClick={togglePlay}
                filled
              />
              <ControlButton
                icon={<SkipForward className="h-4 w-4" />}
                label="Next step"
                onClick={isLast ? undefined : () => goTo(index + 1)}
              />
              <Link
                href={tryItHref}
                className={`ml-auto flex h-10 items-center rounded-xl border px-4 text-[12.5px] font-extrabold transition ${
                  isLast
                    ? 'border-civic bg-civic text-white hover:bg-indigo-700'
                    : 'border-line text-ink hover:bg-paper'
                }`}
              >
                Try it yourself
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  icon,
  label,
  onClick,
  filled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  filled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={label}
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:opacity-35 ${
        filled
          ? 'border-civic bg-civic text-white hover:bg-indigo-700'
          : 'border-line text-ink hover:bg-paper'
      }`}
    >
      {icon}
    </button>
  );
}
