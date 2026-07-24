"use client";

import Link from "next/link";
import { Lock, Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import type React from "react";

type Props = {
  /** Short headline e.g. "Premium Feature" */
  title?: string;
  /** One-liner description of what the user gets after subscribing */
  description?: string;
  /** Bullet points listing what the plan unlocks */
  features?: string[];
  /** Which plan page to link to. Defaults to /pricing */
  pricingHref?: string;
  /** CTA button label */
  ctaLabel?: string;
  /** visual style variant */
  variant?: "banner" | "overlay" | "inline";
  /** content to blur behind the overlay */
  children?: React.ReactNode;
};

export function SubscriptionGateBanner({
  title = "Premium Feature",
  description = "Upgrade your plan to unlock this feature.",
  features = [],
  pricingHref = "/pricing",
  ctaLabel = "View Plans",
  variant = "banner"
}: Props) {
  if (variant === "inline") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
          <Lock className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-indigo-800">{title}</p>
          <p className="text-xs text-indigo-600/80 font-semibold mt-0.5 line-clamp-1">{description}</p>
        </div>
        <Link
          href={pricingHref}
          className="flex-shrink-0 inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white hover:bg-indigo-700 transition"
        >
          <Zap className="h-3 w-3" />
          Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 text-white shadow-xl">
      {/* Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/20 blur-[80px]" />
      </div>

      <div className="relative px-7 py-8 sm:px-10 sm:py-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/20 px-3 py-1 text-xs font-black text-indigo-300">
            <Lock className="h-3 w-3" />
            {title}
          </span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-white leading-snug max-w-lg">
          {description}
        </h3>

        {features.length > 0 && (
          <ul className="mt-5 space-y-2.5">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm font-semibold text-indigo-200">
                <CheckCircle2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={pricingHref}
            className="inline-flex items-center gap-2 rounded-2xl bg-surface px-6 py-3 text-sm font-black text-indigo-700 hover:bg-indigo-50 transition shadow-md"
          >
            <Zap className="h-4 w-4" />
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15 transition"
          >
            Create Free Account
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Wraps content with a blurred overlay paywall */
export function SubscriptionGateOverlay({
  title = "Premium Feature",
  description = "Upgrade your plan to access this content.",
  features = [],
  pricingHref = "/pricing",
  ctaLabel = "View Plans",
  children
}: Props) {
  return (
    <div className="relative">
      {/* Blurred content behind */}
      <div className="pointer-events-none select-none" aria-hidden>
        <div className="blur-[6px] opacity-40 saturate-50">
          {children}
        </div>
      </div>

      {/* Overlay card */}
      <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
        <div className="w-full max-w-sm rounded-3xl border border-indigo-100 bg-surface/95 backdrop-blur-sm shadow-2xl p-7 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 mb-5">
            <Lock className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-black text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500 font-semibold mt-2 leading-relaxed">{description}</p>

          {features.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-left">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          )}

          <Link
            href={pricingHref}
            className="mt-6 flex items-center justify-center gap-2 w-full rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700 transition shadow-md shadow-indigo-200"
          >
            <Zap className="h-4 w-4" />
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
