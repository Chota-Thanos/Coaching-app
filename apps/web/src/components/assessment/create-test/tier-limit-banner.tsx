"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { QUESTION_CAP } from "./tier-caps";

export function TierLimitBanner({
  isMains,
  isGuest,
  hasPremium,
  freeTestUsage
}: {
  isMains: boolean;
  isGuest: boolean;
  hasPremium: boolean;
  /** Only relevant for logged-in, non-premium users. */
  freeTestUsage?: { used: number; limit: number } | null;
}) {
  if (isGuest) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm font-semibold text-amber-800 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>You&apos;re not signed in — this test is capped at 10 questions total.</span>
        </p>
        <Link href="/login" className="shrink-0 text-xs font-black uppercase tracking-wider text-amber-700 underline hover:text-amber-900">
          Sign in for the full limit
        </Link>
      </div>
    );
  }

  if (hasPremium) {
    const cap = isMains ? QUESTION_CAP.premium.mains : QUESTION_CAP.premium.objective;
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm font-semibold text-emerald-800">
        <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        <span>
          Premium: up to {cap} {isMains ? "Mains" : "GK/CSAT"} questions per test · Unlimited tests.
        </span>
      </div>
    );
  }

  const cap = isMains ? QUESTION_CAP.free.mains : QUESTION_CAP.free.objective;
  const usageText = freeTestUsage
    ? `${freeTestUsage.used} of ${freeTestUsage.limit} free tests used`
    : null;
  const atLimit = freeTestUsage ? freeTestUsage.used >= freeTestUsage.limit : false;

  return (
    <div className={`flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between ${
      atLimit ? "border-rose-100 bg-rose-50/60 text-rose-800" : "border-indigo-100 bg-indigo-50/50 text-indigo-800"
    }`}>
      <p className="flex items-center gap-2">
        <Sparkles className={`h-4 w-4 shrink-0 ${atLimit ? "text-rose-600" : "text-indigo-600"}`} aria-hidden="true" />
        <span>
          Free tier: up to {cap} {isMains ? "Mains" : "GK/CSAT"} questions per test
          {usageText ? ` · ${usageText}` : ""}
          {atLimit ? " — you've used all your free tests." : "."}
        </span>
      </p>
      <Link href="/pricing" className="shrink-0 text-xs font-black uppercase tracking-wider text-indigo-700 underline hover:text-indigo-900">
        Upgrade
      </Link>
    </div>
  );
}
