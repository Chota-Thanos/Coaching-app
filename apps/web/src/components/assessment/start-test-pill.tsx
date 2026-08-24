"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { useSubscription } from "../../lib/use-subscription";
import { useAuth } from "../auth/auth-context";
import { useStartTest, type StartTestCategory } from "../../lib/use-start-test";
import { CapReachedNotice, isCapError } from "../billing/cap-reached-notice";

/**
 * The one "Start a test" control every screen in this app should use —
 * performance page rows, category/subject/source detail pages, and the home
 * dashboard's practice widget all render the same component so the behaviour
 * (and any future fix to it) never drifts between call sites.
 *
 * Renders a small pill by default; on a cap error it swaps the calling row
 * out for an inline upgrade prompt instead of failing silently.
 */
export function StartTestPill({
  examId,
  categories,
  label = "Start",
  tone = "neutral",
  testType,
  title,
  className = ""
}: {
  examId: number | null;
  categories: StartTestCategory[];
  label?: string;
  /** "weak" tints the pill to flag it's addressing a weak area; "neutral" is the default border pill. */
  tone?: "neutral" | "weak" | "primary";
  testType?: "quick_test" | "sectional_test" | "full_length_test" | "pyq_test" | "diagnostic_test";
  title?: string;
  className?: string;
}) {
  const { start, starting, error, clearError } = useStartTest();
  const [dismissed, setDismissed] = useState(false);

  if (!examId || categories.length === 0) return null;

  if (error && !dismissed && isCapError(error)) {
    return (
      <div className={className}>
        <CapReachedNotice
          error={error}
          module="self_preparation"
          compact
        />
        <button
          type="button"
          onClick={() => {
            clearError();
            setDismissed(true);
          }}
          className="mt-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const toneClass =
    tone === "primary"
      ? "bg-civic text-white hover:brightness-110"
      : tone === "weak"
        ? "bg-rose-600 text-white hover:bg-rose-700"
        : "border border-line text-slate-600 hover:border-civic/40 hover:text-civic";

  return (
    <button
      type="button"
      disabled={starting}
      onClick={() => {
        setDismissed(false);
        void start(examId, categories, { testType, title });
      }}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[11.5px] font-bold transition disabled:opacity-60 ${toneClass} ${className}`}
    >
      {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3 w-3" />}
      {starting ? "Starting…" : label}
    </button>
  );
}

/**
 * Free-plan users see how many self-built tests they have left wherever a
 * Start pill appears, so a click that is about to hit the wall is not a
 * surprise. Returns null for an active subscriber (unlimited) or while the
 * entitlement hasn't loaded yet.
 */
export function useFreeTestsRemainingLabel(): string | null {
  const { token } = useAuth();
  const { hasAnyActive, entitlements, loading } = useSubscription(token);
  if (loading || hasAnyActive) return null;
  const record = entitlements.find((e) => e.entitlement_key === "assessment.free_tests_remaining");
  if (record?.limit_value == null) return null;
  return `${record.limit_value} free test${record.limit_value === 1 ? "" : "s"} left`;
}
