"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Sparkles,
  Target,
  NotebookPen,
  Newspaper,
  Bookmark,
  FolderOpen,
  FileText,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// TOUR STEPS DATA (targeting DOM IDs)
// ──────────────────────────────────────────────────────────────────────────────

interface TourStep {
  selector: string;
  badge: string;
  title: string;
  body: string;
  actionText?: string;
  actionHint?: string;
}

const TEST_TOUR_STEPS: TourStep[] = [
  {
    selector: "#tour-quick-actions",
    badge: "Step 1 of 5: Actions Hub",
    title: "Quick Action Buttons",
    body: "This is your preparation control room. With a single click, you can resume your last General Studies test, launch a target Revision Test of your tagged questions, take rapid CSAT math drills, or open the Mains Hub to submit a paper.",
  },
  {
    selector: "#tour-gs-tracking",
    badge: "Step 2 of 5: Syllabus Tracking",
    title: "GS Syllabus Progress",
    body: "Keep track of your subject coverage. This section tracks your accuracy scores dynamically across core UPSC General Studies papers (Polity, Economy, Environment, History, Geography) so you always know your status.",
  },
  {
    selector: "#tour-weak-focus",
    badge: "Step 3 of 5: Topic Analysis",
    title: "Weak Area Focus",
    body: "No more guesswork. The system automatically scans your quiz logs to identify your top two weakest syllabus topics. It provides a direct link to practice questions for those specific topics.",
  },
  {
    selector: "#tour-upload-zone",
    badge: "Step 4 of 5: Question Import",
    title: "Drag & Drop Upload Zone",
    body: "Got a test paper in a PDF or a photo format? Simply drag and drop it here. The built-in OCR scans the document, parses out questions, and maps them to custom practice tests.",
  },
  {
    selector: "#tour-radar-chart",
    badge: "Step 5 of 5: Performance Chart",
    title: "Subject Accuracy Radar",
    body: "Your preparation scorecard, visualised. As you complete custom tests and drills, this radar chart updates in real-time. Expand the blue polygon to hit 100% average accuracy!",
  },
];

const NOTES_TOUR_STEPS: TourStep[] = [
  {
    selector: "#tour-daily-feed",
    badge: "Step 1 of 5: Daily News",
    title: "Daily Current Affairs Feed",
    body: "Read unlimited current affairs and syllabus-mapped editorials. Reading current affairs is always free for everyone, with no limits or paywalls. Tap any headline to view details.",
  },
  {
    selector: "#tour-import-btn",
    badge: "Step 2 of 5: Notes Integration",
    title: "Bookmark & Import to Notes",
    body: "Click this bookmark icon next to any news article to instantly import it into a custom repository. This bridges daily news reading with active preparation workspace.",
  },
  {
    selector: "#tour-notes-workspace",
    badge: "Step 3 of 5: Notes Workspace",
    title: "Notes Repositories",
    body: "Manage your subjects here. Organize your saved articles by GS paper or topic (e.g. 'Governance & Polity Notes'). You can save up to 10 articles inside a repository for free.",
  },
  {
    selector: "#tour-revision-lines",
    badge: "Step 4 of 5: Exam recall",
    title: "Quick Revision Lines",
    body: "The fastest way to scan notes before the exam. Inside any repository, write 3-5 concise bullet points summarizing each article. They collect here for quick review.",
  },
  {
    selector: "#tour-study-plans",
    badge: "Step 5 of 5: roadmap",
    title: "Structured Study Plans",
    body: "Looking for a guided path? Browse sprints like the 90-Day Prelims Sprint and Mains GS writing modules down here. They are placed at the bottom so they are visible but don't clutter your view.",
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// TOUR OVERLAY COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

interface OnboardingTourProps {
  type: "test" | "notes";
  onClose: () => void;
}

export function OnboardingTour({ type, onClose }: OnboardingTourProps) {
  const steps = type === "test" ? TEST_TOUR_STEPS : NOTES_TOUR_STEPS;
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex];
  const [elementRect, setElementRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
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

  // Update target element coordinates
  useEffect(() => {
    if (!currentStep) return;
    
    const el = document.querySelector(currentStep.selector);
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

      return () => {
        clearTimeout(timer);
        window.removeEventListener("scroll", handleUpdate);
        window.removeEventListener("resize", handleUpdate);
      };
    } else {
      setElementRect(null);
    }
  }, [stepIndex, currentStep]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && stepIndex < steps.length - 1) setStepIndex((s) => s + 1);
      if (e.key === "ArrowLeft" && stepIndex > 0) setStepIndex((s) => s - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stepIndex, steps.length, onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

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

  // Tooltip position styling
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
            borderRadius: "16px",
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.72)",
            border: "3px solid #3b82f6",
            zIndex: 9999,
            pointerEvents: "none",
            transition: "all 0.3s ease-out",
          }}
          className="animate-pulse"
        />
      )}

      {/* Backdrop fallback */}
      {!elementRect && (
        <div className="fixed inset-0 bg-slate-900/75 z-40" onClick={onClose} />
      )}

      {/* Guided Tooltip popover card */}
      <div
        ref={tooltipRef}
        style={getTooltipStyle()}
        className="bg-surface rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col transition-all duration-300"
      >
        {/* Header */}
        <div className={`px-4 py-3 flex items-center justify-between text-white shrink-0 ${type === "test" ? "bg-blue-600" : "bg-indigo-600"}`}>
          <div className="flex items-center gap-2">
            {type === "test" ? (
              <Target className="h-4 w-4 shrink-0" />
            ) : (
              <NotebookPen className="h-4 w-4 shrink-0" />
            )}
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
        </div>

        {/* Footer controls */}
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStepIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIndex
                    ? `w-4 ${type === "test" ? "bg-blue-600" : "bg-indigo-600"}`
                    : `w-1.5 ${type === "test" ? "bg-blue-200" : "bg-indigo-200"}`
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {stepIndex > 0 && (
              <button
                onClick={handleBack}
                className="h-8 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-500 hover:bg-surface transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </button>
            )}

            <button
              onClick={handleNext}
              className={`h-8 rounded-lg text-white px-3 text-xs font-bold transition-colors flex items-center gap-1 ${
                type === "test" ? "bg-blue-600 hover:bg-blue-700" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {isLast ? "Finish" : "Next"}
              {!isLast && <ArrowRight className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {!isMobile && (
          <div className="bg-slate-50 text-center py-1 border-t border-slate-150">
            <span className="text-[8px] text-slate-400 font-medium">
              Keyboard shortcut: Use ← → keys to navigate · Esc to exit
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TOUR LAUNCHER BANNER
// ──────────────────────────────────────────────────────────────────────────────

interface TourLauncherProps {
  onLaunch: (type: "test" | "notes") => void;
}

export function TourLauncherBanner({ onLaunch }: TourLauncherProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-indigo-50 via-blue-50 to-purple-50 border border-indigo-100 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex items-center gap-3 flex-1">
        <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <p className="text-sm font-black text-slate-800">New: Interactive Product Walkthrough</p>
          <p className="text-xs text-slate-500 mt-0.5">Let us show you exactly how test-making and notes workspace tools operate in real-time.</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
        <button
          onClick={() => onLaunch("test")}
          className="touch-target flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white transition-colors"
          id="launch-test-tour"
        >
          <Target className="h-3.5 w-3.5" />
          Start Test Tour
        </button>
        <button
          onClick={() => onLaunch("notes")}
          className="touch-target flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white transition-colors"
          id="launch-notes-tour"
        >
          <NotebookPen className="h-3.5 w-3.5" />
          Start Notes Tour
        </button>
      </div>
    </div>
  );
}
