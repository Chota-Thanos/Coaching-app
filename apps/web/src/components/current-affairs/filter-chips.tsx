import type { CurrentAffairsHub } from "../../lib/current-affairs";
import { hubHref, monthLabel } from "../../lib/current-affairs";

type FilterChipsProps = {
  hub: CurrentAffairsHub;
  category?: string;
  month?: string;
  year?: string;
};

export function FilterChips({ hub, category, month, year }: FilterChipsProps) {
  const chips = [
    category ? { label: `Category: ${category}`, href: hubHref(hub, { month, year }) } : null,
    month ? { label: monthLabel(month), href: hubHref(hub, { category, year }) } : null,
    year ? { label: year, href: hubHref(hub, { category, month }) } : null
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <a className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink" href={chip.href} key={chip.label}>
          {chip.label} x
        </a>
      ))}
    </div>
  );
}
