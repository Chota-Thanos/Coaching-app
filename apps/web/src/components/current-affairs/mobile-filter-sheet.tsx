"use client";

import { Filter, X } from "lucide-react";
import { useState } from "react";
import type { ArticleFiltersResponse } from "../../lib/api";
import type { CurrentAffairsHub } from "../../lib/current-affairs";
import { FilterPanel } from "./filter-panel";

type MobileFilterSheetProps = {
  hub: CurrentAffairsHub;
  filters: ArticleFiltersResponse;
  selectedCategory?: string;
  selectedMonth?: string;
  selectedYear?: string;
};

export function MobileFilterSheet(props: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const hasActiveFilter = Boolean(props.selectedCategory || props.selectedMonth || props.selectedYear);

  return (
    <>
      {/* Floating Action Button (FAB) for Mobile Filters */}
      <button
        className="fixed bottom-20 right-4 z-30 inline-flex h-12 items-center gap-2.5 rounded-full bg-[#4a3fe0] dark:bg-[#5b5bf5] px-5 text-xs font-extrabold uppercase tracking-wider text-white shadow-2xl hover:scale-105 active:scale-95 transition-all border-2 border-white/20 lg:hidden"
        onClick={() => setOpen(true)}
        type="button"
        aria-label="Filter articles"
      >
        <Filter aria-hidden="true" className="h-4 w-4" />
        <span>Filters</span>
        {hasActiveFilter && (
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse border border-white" />
        )}
      </button>

      {/* Filter Sheet Modal Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close filters"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setOpen(false)}
            type="button"
          />
          <section className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface dark:bg-slate-900 p-5 shadow-2xl border-t border-line/60 dark:border-slate-800 animate-in slide-in-from-bottom duration-200">
            <div className="mb-4 flex items-center justify-between border-b border-line/60 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#4a3fe0] dark:text-[#5b5bf5]" />
                <h2 className="text-base font-extrabold text-ink dark:text-white">Filter Articles</h2>
              </div>
              <button
                aria-label="Close filters"
                className="grid h-8 w-8 place-items-center rounded-xl border border-line dark:border-slate-700 bg-paper dark:bg-slate-800 text-ink dark:text-slate-200"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <FilterPanel {...props} />
          </section>
        </div>
      )}
    </>
  );
}
