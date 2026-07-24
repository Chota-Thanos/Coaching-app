// Shared visual language for in-page tab strips. Every tab — active AND
// inactive — is its own bordered pill, so the row reads as clickable tabs
// even before anything is hovered. Wraps to a second line on narrow screens
// instead of hiding tabs behind horizontal scroll, so nothing goes undiscovered.
// Consumers render their own <Link>/<button> — these only supply classNames,
// since some tab strips are URL-driven (Link) and others are state-driven (button).

export function tabStripClass(extra?: string) {
  return `flex flex-wrap items-center gap-2 ${extra ?? ""}`.trim();
}

export function tabButtonClass(active: boolean, extra?: string) {
  return `inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-colors ${
    active
      ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
      : "border-slate-300 bg-surface text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700"
  } ${extra ?? ""}`.trim();
}
