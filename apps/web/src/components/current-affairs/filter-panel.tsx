"use client";

import { Filter, X } from "lucide-react";
import type { ArticleFiltersResponse, CategoryNode } from "../../lib/api";
import type { CurrentAffairsHub } from "../../lib/current-affairs";
import { monthLabel } from "../../lib/current-affairs";

type FilterPanelProps = {
  hub: CurrentAffairsHub;
  filters: ArticleFiltersResponse;
  selectedCategory?: string;
  selectedMonth?: string;
  selectedYear?: string;
};

/* ── Tree building ──────────────────────────────────────── */

type CategoryTree = CategoryNode & { children: CategoryTree[] };

function buildTree(flat: CategoryNode[]): CategoryTree[] {
  const byId = new Map<number, CategoryTree>(
    flat.map((node) => ({ ...node, children: [] })).map((node) => [node.id, node])
  );
  const roots: CategoryTree[] = [];
  for (const node of byId.values()) {
    if (node.parent_id === null) {
      roots.push(node);
    } else {
      const parent = byId.get(node.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node); // orphan → treat as root
      }
    }
  }
  return roots;
}

function categoryValue(category: CategoryNode): string {
  return category.slug || String(category.id);
}

/* ── Flat list for <select> with indentation ───────────── */

type FlatOption = {
  value: string;
  label: string;
  depth: number;
};

function flattenTree(nodes: CategoryTree[], depth = 0): FlatOption[] {
  const result: FlatOption[] = [];
  for (const node of nodes) {
    const prefix = depth > 0 ? "  ".repeat(depth) + "↳ " : "";
    result.push({ value: categoryValue(node), label: `${prefix}${node.name}`, depth });
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  }
  return result;
}

export function FilterPanel({
  hub,
  filters,
  selectedCategory,
  selectedMonth,
  selectedYear
}: FilterPanelProps) {
  const hasActiveFilter = Boolean(selectedCategory || selectedMonth || selectedYear);
  const tree = buildTree(filters.categories);
  const flatOptions = flattenTree(tree);

  // Find the display label for the active category chip
  const activeCategory = flatOptions.find((o) => o.value === selectedCategory);

  return (
    <form
      action={`/current-affairs/${hub.path}`}
      className="flex flex-wrap items-center gap-2"
      method="get"
    >
      <input name="page" type="hidden" value="1" />

      {/* Category — hierarchical <select> */}
      <select
        className="h-9 max-w-[200px] rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition hover:border-civic focus:border-civic focus:outline-none focus:ring-2 focus:ring-civic/20"
        defaultValue={selectedCategory ?? ""}
        name="category"
        id="filter-category"
        aria-label="Filter by subject"
      >
        <option value="">All Subjects</option>
        {flatOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Month / Year */}
      {hub.filterMode === "month" ? (
        <select
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition hover:border-civic focus:border-civic focus:outline-none focus:ring-2 focus:ring-civic/20"
          defaultValue={selectedMonth ?? ""}
          name="month"
          id="filter-month"
          aria-label="Filter by month"
        >
          <option value="">All Months</option>
          {filters.months.map(({ month }) => (
            <option key={month} value={month}>
              {monthLabel(month)}
            </option>
          ))}
        </select>
      ) : (
        <select
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition hover:border-civic focus:border-civic focus:outline-none focus:ring-2 focus:ring-civic/20"
          defaultValue={selectedYear ?? ""}
          name="year"
          id="filter-year"
          aria-label="Filter by year"
        >
          <option value="">All Years</option>
          {filters.years.map(({ year }) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      )}

      {/* Apply */}
      <button
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-civic px-4 text-sm font-bold text-white shadow-sm transition hover:bg-civic/90 active:scale-[0.98]"
        type="submit"
      >
        <Filter aria-hidden="true" className="h-3.5 w-3.5" />
        Apply
      </button>

      {/* Clear filters */}
      {hasActiveFilter && (
        <a
          href={`/current-affairs/${hub.path}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-muted shadow-sm transition hover:border-berry/50 hover:text-berry"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          Clear
        </a>
      )}

      {/* Active filter chips */}
      {selectedCategory && activeCategory && (
        <span className="inline-flex items-center gap-1 rounded-full bg-civic/12 px-3 py-1 text-xs font-bold text-civic">
          {activeCategory.label.replace(/^[\s↳]+/, "")}
        </span>
      )}
      {selectedMonth && (
        <span className="inline-flex items-center gap-1 rounded-full bg-civic/12 px-3 py-1 text-xs font-bold text-civic">
          {monthLabel(selectedMonth)}
        </span>
      )}
      {selectedYear && (
        <span className="inline-flex items-center gap-1 rounded-full bg-civic/12 px-3 py-1 text-xs font-bold text-civic">
          Year: {selectedYear}
        </span>
      )}
    </form>
  );
}
