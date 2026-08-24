"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ApiError } from "../auth/auth-context";
import { SUBSCRIPTION_MODULES, type ModuleId } from "../../lib/subscription-plans";

/**
 * Turns a free-tier wall into an upgrade prompt.
 *
 * The API answers every exhausted allowance with 402 and either
 * `cap_exceeded` (you have used up a countable limit) or `premium_required`
 * (this capability is not on the free plan at all). Both used to surface as a
 * bare red error string, which told the reader they had hit a wall but not that
 * there was a way past it.
 *
 * Call `isCapError(err)` to decide whether to render this instead of your
 * normal error line.
 */

export function isCapError(error: unknown): error is ApiError {
  if (!(error instanceof ApiError)) return false;
  return error.status === 402 || error.code === "cap_exceeded" || error.code === "premium_required";
}

export function CapReachedNotice({
  error,
  module,
  compact = false
}: {
  /** The 402 the API returned — its message already names the limit. */
  error: ApiError | string;
  /** Which module lifts this particular wall. */
  module: ModuleId;
  compact?: boolean;
}) {
  const message = typeof error === "string" ? error : error.message;
  const definition = SUBSCRIPTION_MODULES.find((m) => m.id === module);
  const planCode = definition?.planCode ?? "";

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-civic/25 bg-civic/[0.05] px-4 py-3">
        <Sparkles className="h-4 w-4 shrink-0 text-civic" />
        <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-slate-700">{message}</p>
        <Link
          href={`/pricing?plan=${planCode}`}
          className="shrink-0 rounded-lg bg-civic px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:brightness-110"
        >
          Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-civic/25 bg-civic/[0.04] p-6">
      <div className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-civic shadow-card">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold text-ink">You have reached your free limit</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-slate-600">{message}</p>

          {definition && (
            <ul className="mt-4 flex flex-col gap-1.5">
              {definition.features.slice(0, 3).map((feature) => (
                <li key={feature.label} className="text-[13px] text-slate-600">
                  · {feature.label}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={`/pricing?plan=${planCode}`}
              className="inline-flex items-center gap-2 rounded-xl bg-civic px-5 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110"
            >
              {definition ? `Get ${definition.name}` : "See plans"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/pricing" className="text-[13px] font-semibold text-slate-600 hover:text-ink">
              Compare all plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
