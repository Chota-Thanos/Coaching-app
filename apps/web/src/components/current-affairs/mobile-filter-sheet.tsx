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

  return (
    <>
      <button
        className="fixed bottom-4 left-4 right-4 z-20 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-midnight px-4 text-sm font-bold text-white shadow-soft lg:hidden"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Filter aria-hidden="true" className="h-4 w-4" />
        Filter articles
      </button>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close filters"
            className="absolute inset-0 bg-midnight/40"
            onClick={() => setOpen(false)}
            type="button"
          />
          <section className="absolute inset-x-0 bottom-0 rounded-t-xl bg-paper p-4 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-ink">Filters</h2>
              <button
                aria-label="Close filters"
                className="grid h-10 w-10 place-items-center rounded-md border border-line bg-surface"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <FilterPanel {...props} />
          </section>
        </div>
      )}
    </>
  );
}
