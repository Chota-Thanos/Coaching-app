"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { X, ArrowRight, ArrowLeft, Target } from "lucide-react";
import { browserBaseUrl } from "../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TourStep {
  selector: string;
  badge: string;
  title: string;
  body: string;
  actionTrigger?: "click" | "change" | "input";
  actionText?: string;
}

interface GuidedTourEngineProps {
  /** Stable tour key matching the DB — e.g. "custom_test_tour" */
  tourKey: string;
  /** Optional token for authenticated users (enables DB completion sync) */
  token?: string | null;
  /** Hard-coded fallback steps used when the API returns nothing */
  fallbackSteps?: TourStep[];
  /** Called when the user closes or finishes the tour */
  onClose?: () => void;
}

// ─── Completion Helpers ───────────────────────────────────────────────────────

const localKey = (key: string) => `waytoias_tour_done_${key}`;

function isCompletedLocally(key: string, version: number): boolean {
  try {
    const raw = localStorage.getItem(localKey(key));
    if (!raw) return false;
    const { v } = JSON.parse(raw) as { v: number };
    return v >= version;
  } catch {
    return false;
  }
}

function markCompletedLocally(key: string, version: number) {
  try {
    localStorage.setItem(localKey(key), JSON.stringify({ v: version }));
  } catch { /* ignore */ }
}

async function checkCompletedRemote(key: string, token: string): Promise<{ completed: boolean; tour_version: number }> {
  try {
    const res = await fetch(`${browserBaseUrl}/api/v1/onboarding/tours/${key}/completion`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { completed: false, tour_version: 1 };
    return await res.json();
  } catch {
    return { completed: false, tour_version: 1 };
  }
}

async function markCompletedRemote(key: string, token: string) {
  try {
    await fetch(`${browserBaseUrl}/api/v1/onboarding/tours/${key}/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch { /* non-blocking */ }
}

// ─── Main Controller — fetches steps, checks completion, renders engine ───────

export function GuidedTourController({ tourKey, token, fallbackSteps = [], onClose }: GuidedTourEngineProps) {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [tourVersion, setTourVersion] = useState(1);
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // 1. Fetch tour steps from API (no auth needed)
      let apiSteps: TourStep[] = [];
      let version = 1;
      try {
        const res = await fetch(`${browserBaseUrl}/api/v1/onboarding/tours?key=${tourKey}`);
        if (res.ok) {
          const data = await res.json();
          version = data.tour?.version ?? 1;
          apiSteps = (data.steps ?? []).map((s: any) => ({
            selector: s.selector,
            badge: s.badge,
            title: s.title,
            body: s.body,
            actionTrigger: s.action_trigger ?? undefined,
            actionText: s.action_text ?? undefined,
          }));
        }
      } catch { /* silent */ }

      const resolvedSteps = apiSteps.length > 0 ? apiSteps : fallbackSteps;
      if (cancelled) return;
      setTourVersion(version);
      setSteps(resolvedSteps);

      if (resolvedSteps.length === 0) { setChecked(true); return; }

      // 2. Check if already completed
      // a) Authenticated users: check DB first (cross-device)
      if (token) {
        const remote = await checkCompletedRemote(tourKey, token);
        if (cancelled) return;
        if (remote.completed && remote.tour_version >= version) {
          setChecked(true);
          return;
        }
      } else {
        // b) Guest users: check localStorage only
        if (isCompletedLocally(tourKey, version)) {
          setChecked(true);
          return;
        }
      }

      // Not completed — show the tour
      setShow(true);
      setChecked(true);
    }
    load();
    return () => { cancelled = true; };
  }, [tourKey, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(async (finished: boolean) => {
    setShow(false);
    if (finished && steps && steps.length > 0) {
      markCompletedLocally(tourKey, tourVersion);
      if (token) await markCompletedRemote(tourKey, token);
    }
    onClose?.();
  }, [tourKey, tourVersion, token, steps, onClose]);

  if (!checked || !show || !steps || steps.length === 0) return null;

  return <GuidedTourEngine steps={steps} onClose={handleClose} />;
}

// ─── Pure Rendering Engine (unchanged API, also exportable for direct use) ────

interface EngineProps {
  steps: TourStep[];
  onClose: (finished: boolean) => void;
}

export function GuidedTourEngine({ steps, onClose }: EngineProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex];
  const [elementRect, setElementRect] = useState<{
    top: number; left: number; width: number; height: number;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [actionDone, setActionDone] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const upd = () => setIsMobile(window.innerWidth < 640);
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  useEffect(() => {
    if (!currentStep) return;
    setActionDone(false);

    const el = document.querySelector(currentStep.selector) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });

      const handleUpdate = () => {
        const rect = el.getBoundingClientRect();
        setElementRect({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        });
      };

      const timer = setTimeout(handleUpdate, 350);
      window.addEventListener("scroll", handleUpdate);
      window.addEventListener("resize", handleUpdate);

      let listener: () => void;
      if (currentStep.actionTrigger) {
        listener = () => {
          setActionDone(true);
          if (currentStep.actionTrigger === "click") {
            setTimeout(() => setStepIndex((p) => Math.min(p + 1, steps.length - 1)), 300);
          }
        };
        el.addEventListener(currentStep.actionTrigger, listener);
      }

      return () => {
        clearTimeout(timer);
        window.removeEventListener("scroll", handleUpdate);
        window.removeEventListener("resize", handleUpdate);
        if (el && currentStep.actionTrigger && listener) {
          el.removeEventListener(currentStep.actionTrigger, listener);
        }
      };
    } else {
      setElementRect(null);
    }
  }, [stepIndex, currentStep, steps.length]);

  if (!currentStep) return null;

  const isLast = stepIndex === steps.length - 1;
  const requiresAction = currentStep.actionTrigger && !actionDone;

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((s) => s + 1);
    } else {
      onClose(true); // finished = true
    }
  };

  const getTooltipStyle = (): React.CSSProperties => {
    if (isMobile) {
      return {
        position: "fixed", bottom: "20px", left: "50%",
        transform: "translateX(-50%)", width: "calc(100% - 32px)",
        maxWidth: "400px", zIndex: 10000,
      };
    }
    if (!elementRect) {
      return {
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)", width: "360px", zIndex: 10000,
      };
    }
    const margin = 16, tooltipWidth = 350, vw = window.innerWidth;
    let top = elementRect.top + elementRect.height + margin;
    let left = elementRect.left + (elementRect.width - tooltipWidth) / 2;
    if (left + tooltipWidth > vw - 20) left = vw - tooltipWidth - 20;
    if (left < 20) left = 20;
    if (top + 220 > window.scrollY + window.innerHeight) top = elementRect.top - 220 - margin;
    return { position: "absolute", top: `${top}px`, left: `${left}px`, width: `${tooltipWidth}px`, zIndex: 10000, transition: "all 0.3s ease-out" };
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Spotlight */}
      {elementRect && (
        <div
          style={{
            position: "absolute",
            top: elementRect.top - 8, left: elementRect.left - 8,
            width: elementRect.width + 16, height: elementRect.height + 16,
            borderRadius: "12px",
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.72)",
            border: requiresAction ? "3px dashed #ef4444" : "3px solid #3b82f6",
            zIndex: 9999, pointerEvents: "none", transition: "all 0.3s ease-out",
          }}
          className={requiresAction ? "animate-pulse" : ""}
        />
      )}
      {!elementRect && <div className="fixed inset-0 bg-slate-900/75 z-40" onClick={() => onClose(false)} />}

      {/* Tooltip Card */}
      <div ref={tooltipRef} style={getTooltipStyle()} className="bg-surface rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between text-white shrink-0 bg-indigo-600">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest">{currentStep.badge}</span>
          </div>
          <button onClick={() => onClose(false)} className="h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center" aria-label="Close tour">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-2">
          <h3 className="text-sm font-black text-slate-800 leading-snug">{currentStep.title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{currentStep.body}</p>
          {requiresAction && (
            <div className="mt-2 rounded-lg bg-red-50 border border-red-100 p-2 text-[10px] font-bold text-red-700 animate-pulse">
              ⚠️ ACTION REQUIRED: {currentStep.actionText || "Perform the action on the highlighted element above to proceed."}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <button key={i} onClick={() => setStepIndex(i)} aria-label={`Go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === stepIndex ? "w-4 bg-indigo-600" : "w-1.5 bg-indigo-200"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {stepIndex > 0 && (
              <button onClick={() => setStepIndex((s) => s - 1)}
                className="h-8 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-500 hover:bg-surface flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            )}
            <button disabled={!!requiresAction} onClick={handleNext}
              className="h-8 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 text-xs font-bold flex items-center gap-1">
              {isLast ? "Finish" : "Next"}
              {!isLast && <ArrowRight className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
