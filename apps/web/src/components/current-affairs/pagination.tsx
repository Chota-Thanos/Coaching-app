import type { CurrentAffairsHub } from "../../lib/current-affairs";
import { hubHref } from "../../lib/current-affairs";

type PaginationProps = {
  hub: CurrentAffairsHub;
  page: number;
  totalPages: number;
  category?: string;
  month?: string;
  year?: string;
};

export function Pagination({ hub, page, totalPages, category, month, year }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((candidate) => candidate === 1 || candidate === totalPages || Math.abs(candidate - page) <= 2);

  return (
    <nav aria-label="Article pages" className="flex flex-wrap items-center justify-center gap-2 pt-3">
      {page > 1 && (
        <a className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-bold text-ink" href={hubHref(hub, { category, month, year, page: page - 1 })}>
          Previous
        </a>
      )}
      {pages.map((candidate, index) => {
        const previous = pages[index - 1];
        const showGap = previous && candidate - previous > 1;
        return (
          <span className="flex items-center gap-2" key={candidate}>
            {showGap && <span className="text-sm text-ink/50">...</span>}
            <a
              aria-current={candidate === page ? "page" : undefined}
              className={`grid h-10 min-w-10 place-items-center rounded-md border px-3 text-sm font-bold ${
                candidate === page ? "border-civic bg-civic text-white" : "border-line bg-surface text-ink"
              }`}
              href={hubHref(hub, { category, month, year, page: candidate })}
            >
              {candidate}
            </a>
          </span>
        );
      })}
      {page < totalPages && (
        <a className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-bold text-ink" href={hubHref(hub, { category, month, year, page: page + 1 })}>
          Next
        </a>
      )}
    </nav>
  );
}
