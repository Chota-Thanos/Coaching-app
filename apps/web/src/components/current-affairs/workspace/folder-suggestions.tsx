"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { useAuth, authenticatedGet, authenticatedPost } from "../../auth/auth-context";
import type { ReadingDashboard, StudentCollectionItem, StudentMasterArticle } from "../../../lib/api";

/**
 * Related articles, suggested inside the folder they would go into.
 *
 * Suggestions used to sit on the workspace home, where they ran before anyone
 * had made a folder — a panel telling a learner with nothing saved to "pick a
 * repository" they had not created. And what it suggested was content-type
 * counts: "Daily News - 2", "Concepts - 2". A count of what happens to exist is
 * not a suggestion; it tells the reader nothing about whether any of it is
 * worth their evening.
 *
 * Here there is something to reason from. The folder already contains articles,
 * those articles have categories, and an article in the same category as things
 * the learner has deliberately kept is a defensible thing to offer — named, so
 * they can judge it, and added in one click to the folder they are already
 * looking at.
 */
export function FolderSuggestions({
  collectionId,
  items,
  onChanged
}: {
  collectionId: number;
  items: StudentCollectionItem[];
  onChanged: () => Promise<void> | void;
}) {
  const { token, refreshForks } = useAuth();
  const [pool, setPool] = useState<StudentMasterArticle[]>([]);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const dashboard = await authenticatedGet<ReadingDashboard>(
        "/api/v1/current-affairs/me/reading-dashboard?limit=24",
        token
      );
      setPool(dashboard.recommended_articles ?? []);
    } catch {
      // Suggestions are an extra; a folder that cannot load them still works.
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  /** The categories this learner has actually chosen to keep here. */
  const folderCategoryIds = useMemo(() => {
    const ids = new Set<number>();
    for (const item of items) {
      const category = item.master_article?.category ?? item.fork?.master_article?.category;
      if (category?.id) ids.add(Number(category.id));
    }
    return ids;
  }, [items]);

  const alreadyHere = useMemo(() => {
    const ids = new Set<number>();
    for (const item of items) {
      const articleId = item.master_article?.id ?? item.fork?.master_article_id;
      if (articleId) ids.add(Number(articleId));
    }
    return ids;
  }, [items]);

  const suggestions = useMemo(() => {
    if (folderCategoryIds.size === 0) return [];
    return pool
      .filter((article) => article.category?.id && folderCategoryIds.has(Number(article.category.id)))
      .filter((article) => !alreadyHere.has(Number(article.id)))
      .slice(0, 5);
  }, [pool, folderCategoryIds, alreadyHere]);

  async function addToFolder(article: StudentMasterArticle): Promise<void> {
    if (!token) return;
    setAddingId(article.id);
    setMessage(null);
    try {
      // Saving the article is what creates the fork the folder can hold.
      const fork = await authenticatedPost<{ id: number }>(
        `/api/v1/current-affairs/articles/${article.id}/fork`,
        token,
        {}
      );
      await authenticatedPost(`/api/v1/current-affairs/me/collections/${collectionId}/items`, token, {
        fork_id: fork.id
      });
      await refreshForks();
      await onChanged();
      setMessage(`Added "${article.title}".`);
    } catch {
      setMessage("Could not add that article. It may already be in this folder.");
    } finally {
      setAddingId(null);
    }
  }

  // An empty folder has nothing to reason from, and guessing would be noise.
  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-line bg-surface p-4">
        <p className="flex items-center gap-1.5 text-sm font-black text-ink">
          <Sparkles aria-hidden="true" className="h-4 w-4 text-civic" />
          Suggestions appear once there is something here
        </p>
        <p className="mt-1 text-sm leading-6 text-ink/65">
          Add a few articles from Daily News or the editorial summaries. Related ones in the same
          categories will then be offered here.
        </p>
      </section>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <section className="rounded-lg border border-civic/25 bg-civic/[0.04] p-4">
      <p className="flex items-center gap-1.5 text-sm font-black text-ink">
        <Sparkles aria-hidden="true" className="h-4 w-4 text-civic" />
        Related to what is in this folder
      </p>
      <p className="mt-0.5 text-xs font-semibold text-ink/55">
        Same categories as the articles you have kept here.
      </p>

      <ul className="mt-3 space-y-1.5">
        {suggestions.map((article) => (
          <li
            className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2"
            key={article.id}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-ink">{article.title}</span>
              {article.category?.name && (
                <span className="block text-[11px] font-semibold text-ink/50">{article.category.name}</span>
              )}
            </span>
            <button
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-civic px-2.5 text-xs font-bold text-white disabled:opacity-60"
              disabled={addingId !== null}
              onClick={() => void addToFolder(article)}
              type="button"
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              {addingId === article.id ? "Adding..." : "Add"}
            </button>
          </li>
        ))}
      </ul>

      {message && <p className="mt-2 text-xs font-bold text-civic">{message}</p>}
    </section>
  );
}
