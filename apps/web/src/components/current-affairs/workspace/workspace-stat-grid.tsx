"use client";

import { BookMarked, CheckCircle2, Repeat2, Timer } from "lucide-react";
import type { ReadingDashboard } from "../../../lib/api";
import { readingSecondsLabel } from "../../../lib/workspace";

type WorkspaceStatGridProps = {
  dashboard: ReadingDashboard;
};

const statClasses = "rounded-lg border border-line bg-white p-4 shadow-sm";

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
            <Icon aria-hidden="true" className="h-5 w-5 text-civic" />
            <p className="mt-3 text-2xl font-black text-ink">{stat.value}</p>
            <p className="mt-1 text-sm font-semibold text-ink/65">{stat.label}</p>
          </article>
        );
      })}
    </section>
  );
}
