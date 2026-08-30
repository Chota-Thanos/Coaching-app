"use client";

import { BookMarked, CheckCircle2, Repeat2, Timer } from "lucide-react";
import type { ReadingDashboard } from "../../../lib/api";
import { readingSecondsLabel } from "../../../lib/workspace";

type WorkspaceStatGridProps = {
  dashboard: ReadingDashboard;
};

/* These are a status line, not the point of the page. At full card size they
   pushed the folders — the thing a learner came to open — below the fold. */
const statClasses = "flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2";

export function WorkspaceStatGrid({ dashboard }: WorkspaceStatGridProps) {
  const stats = [
    { label: "Saved", value: dashboard.stats.saved_articles, icon: BookMarked },
    { label: "Completed", value: dashboard.stats.completed_articles, icon: CheckCircle2 },
    { label: "Due revision", value: dashboard.stats.due_revisions, icon: Repeat2 },
    { label: "7 day reading", value: readingSecondsLabel(dashboard.stats.reading_seconds_7d), icon: Timer }
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Notes Space summary">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <article className={statClasses} key={stat.label}>
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-civic" />
            <span className="min-w-0">
              <span className="block text-base font-black leading-none text-ink">{stat.value}</span>
              <span className="mt-0.5 block truncate text-[11px] font-semibold text-ink/60">{stat.label}</span>
            </span>
          </article>
        );
      })}
    </section>
  );
}
