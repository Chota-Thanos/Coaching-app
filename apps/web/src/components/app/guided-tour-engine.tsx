"use client";

import { useEffect, useState, useRef } from "react";
import { X, ArrowRight, ArrowLeft, Target, HelpCircle } from "lucide-react";

export interface TourStep {
  selector: string;
  badge: string;
  title: string;
  body: string;
  actionTrigger?: "click" | "change" | "input";
  actionText?: string;
}

interface GuidedTourEngineProps {
  steps: TourStep[];
  onClose: () => void;
}

export function GuidedTourEngine({ steps, onClose }: GuidedTourEngineProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex];
  const [elementRect, setElementRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [actionDone, setActionDone] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Check viewport
  useEffect(() => {
    const updateSize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Update target element coordinates & attach interaction listener
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

      // Attach dynamic interaction listener if required
      let listener: () => void;
      if (currentStep.actionTrigger) {
        listener = () => {
          setActionDone(true);
          // Auto advance click triggers
          if (currentStep.actionTrigger === "click") {
            setTimeout(() => {
              setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
            }, 300);
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

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((s) => s + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex((s) => s - 1);
    }
  };

  const getTooltipStyle = (): React.CSSProperties => {
    if (isMobile) {
      return {
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: "400px",
        zIndex: 10000,
      };
    }

    if (!elementRect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "360px",
        zIndex: 10000,
      };
    }

    const margin = 16;
    const tooltipWidth = 350;
    const viewportWidth = window.innerWidth;
    
    let top = elementRect.top + elementRect.height + margin;
    let left = elementRect.left + (elementRect.width - tooltipWidth) / 2;

    if (left + tooltipWidth > viewportWidth - 20) {
      left = viewportWidth - tooltipWidth - 20;
    }
    if (left < 20) {
      left = 20;
    }

    const viewportHeight = window.innerHeight;
    if (top + 200 > window.scrollY + viewportHeight) {
      top = elementRect.top - 200 - margin;
    }

    return {
      position: "absolute",
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      zIndex: 10000,
      transition: "all 0.3s ease-out",
    };
  };

  const isLast = stepIndex === steps.length - 1;
  const requiresAction = currentStep.actionTrigger && !actionDone;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Spotlight Overlay */}
      {elementRect && (
        <div
          style={{
            position: "absolute",
            top: elementRect.top - 8,
            left: elementRect.left - 8,
            width: elementRect.width + 16,
            height: elementRect.height + 16,
            borderRadius: "12px",
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.72)",
            border: requiresAction ? "3px dashed #ef4444" : "3px solid #3b82f6",
            zIndex: 9999,
            pointerEvents: "none",
            transition: "all 0.3s ease-out",
          }}
          className={requiresAction ? "animate-pulse" : ""}
        />
      )}

      {/* Backdrop fallback when element is missing */}
      {!elementRect && (
        <div className="fixed inset-0 bg-slate-900/75 z-40" onClick={onClose} />
      )}

      {/* Guided Tooltip Card */}
      <div
        ref={tooltipRef}
        style={getTooltipStyle()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col transition-all duration-300"
      >
        {/* Header */}
        <div className={`px-4 py-3 flex items-center justify-between text-white shrink-0 bg-indigo-600`}>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">
              {currentStep.badge}
            </span>
          </div>
          <button
            onClick={onClose}
            className="h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Close tour"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-2">
          <h3 className="text-sm font-black text-slate-800 leading-snug">
            {currentStep.title}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {currentStep.body}
          </p>
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
              <button
                key={i}
                onClick={() => setStepIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIndex ? "w-4 bg-indigo-600" : "w-1.5 bg-indigo-200"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {stepIndex > 0 && (
              <button
                onClick={handleBack}
                className="h-8 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-500 hover:bg-white transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </button>
            )}

            <button
              disabled={requiresAction}
              onClick={handleNext}
              className="h-8 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 text-xs font-bold transition-colors flex items-center gap-1"
            >
              {isLast ? "Finish" : "Next"}
              {!isLast && <ArrowRight className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
