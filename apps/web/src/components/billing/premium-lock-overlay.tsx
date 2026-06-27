"use client";

import Link from "next/link";
import { LockKeyhole, Sparkles } from "lucide-react";

interface PremiumLockOverlayProps {
  title: string;
  description: string;
  planName?: string;
  ctaText?: string;
}

export function PremiumLockOverlay({
  title,
  description,
  planName = "Premium",
  ctaText = "View Pricing Plans"
}: PremiumLockOverlayProps) {
  return (
    <div className="flex flex-col items-center justify-center border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/50 rounded-2xl p-8 sm:p-12 text-center shadow-md my-6 max-w-2xl mx-auto relative overflow-hidden">
      {/* Decorative gradient sphere */}
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-500/5 blur-2xl" />
      <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-violet-500/5 blur-2xl" />

      <div className="relative z-10">
        <div className="mx-auto h-16 w-16 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 flex items-center justify-center mb-6 shadow-inner animate-pulse">
          <LockKeyhole className="h-7 w-7" />
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 uppercase tracking-wider mb-4">
          <Sparkles className="h-3.5 w-3.5 fill-indigo-600" />
          {planName} Feature
        </span>

        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h3>
        
        <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
          {description}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 text-sm font-black text-white shadow-md shadow-indigo-150 hover:bg-indigo-700 transition"
          >
            {ctaText}
          </Link>
        </div>
      </div>
    </div>
  );
}
