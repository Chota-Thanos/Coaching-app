"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { StudentFork } from "../../../lib/api";
import { articleHref, contentKindLabel } from "../../../lib/current-affairs";
import { progressLabel } from "../../../lib/workspace";

type WorkspaceQueuePanelProps = {
  title: string;
  forks: StudentFork[];
  emptyText: string;
};

export function WorkspaceQueuePanel({ title, forks, emptyText }: WorkspaceQueuePanelProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-black text-ink">{title}</h2>
      <div className="grid gap-3">
        {forks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-surface p-4 text-sm text-ink/65">{emptyText}</p>
        ) : (
          forks.map((fork) => {
            const article = fork.master_article;
            return (
              <Link
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4 hover:border-civic"
                href={article?.slug ? articleHref(article.slug) : "/current-affairs/daily-news"}
                key={fork.id}
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-extrabold text-ink">
                    {article?.title ?? `Article #${fork.master_article_id}`}
                  </span>
                  <span className="mt-1 block text-sm text-ink/65">
                    {article?.content_kind ? contentKindLabel(article.content_kind) : "Current affairs"} - {progressLabel(fork)}
                  </span>
                </span>
                <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-civic" />
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
