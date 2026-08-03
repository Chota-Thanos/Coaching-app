"use client";

import Link from "next/link";
import { Link2 } from "lucide-react";
import type { StudentMasterArticle } from "../../../lib/api";
import { articleHref } from "../../../lib/current-affairs";

type SourceArticleConnectionsProps = {
  article: StudentMasterArticle | null | undefined;
};

// Pulled live from the master article each time this renders, not frozen at save time —
// so a student's saved copy still reflects new links the admin adds later.
export function SourceArticleConnections({ article }: SourceArticleConnectionsProps) {
  if (!article) return null;

  const outgoing = article.outgoing_relations ?? [];
  const incoming = article.incoming_relations ?? [];
  const appearanceCount = article.appearance_count ?? incoming.length;

  if (outgoing.length === 0 && incoming.length === 0) return null;

  return (
    <section className="rounded-lg border border-line bg-paper/30 p-3">
      <p className="inline-flex items-center gap-2 text-sm font-black text-ink">
        <Link2 aria-hidden="true" className="h-4 w-4 text-civic" />
        From the source article
      </p>
      <p className="mt-1 text-xs text-ink/50">
        Live from the published article — updates automatically if the source changes.
      </p>

      {outgoing.length > 0 && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <p className="text-xs font-black uppercase tracking-wide text-ink/55">Related reading</p>
          <div className="mt-2 grid gap-2">
            {outgoing.map((relation) => (
              <Link
                className="rounded-md border border-line bg-surface p-2.5 text-sm font-semibold text-ink hover:border-civic"
                href={articleHref(relation.target_article.slug)}
                key={relation.id}
              >
                {relation.label ?? relation.target_article.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {incoming.length > 0 && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <p className="text-xs font-black uppercase tracking-wide text-ink/55">
            Appears in {appearanceCount} article{appearanceCount === 1 ? "" : "s"}
          </p>
          <div className="mt-2 grid gap-2">
            {incoming.map((relation) => (
              <Link
                className="rounded-md border border-line bg-surface p-2.5 text-sm font-semibold text-ink hover:border-civic"
                href={articleHref(relation.source_article.slug)}
                key={relation.id}
              >
                {relation.label ?? relation.source_article.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
