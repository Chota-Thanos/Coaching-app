"use client";

import { useMemo, useState } from "react";
import { Plus, Tags, Trash2, X } from "lucide-react";
import { useAuth, authenticatedPatch } from "../../auth/auth-context";
import type { StudentCollectionDetail, StudentCollectionItem } from "../../../lib/api";

/**
 * One place to see and edit the tags used in this folder.
 *
 * Tagging used to be a full editor repeated on every article row — a heading, a
 * text input, a save and cancel button, and a strip of quick chips, on each of
 * however many articles the folder held. It was most of the height of the list
 * and it put the same controls on screen dozens of times.
 *
 * The tags belong to the folder, not to each row, so they are managed once
 * here: what is in use, how many articles carry each, and the means to add or
 * remove one. Clicking a tag still filters the list below.
 */
export function FolderTagManager({
  repository,
  selectedTag,
  onSelectTag,
  onChanged
}: {
  repository: StudentCollectionDetail;
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  onChanged: () => Promise<void> | void;
}) {
  const { token } = useAuth();
  const [managing, setManaging] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const items = repository.items ?? [];

  /** Every tag known to this folder, with how many articles carry it. A tag
   *  defined on the folder but used nowhere still shows, at zero, so it can be
   *  removed rather than lingering invisibly. */
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tag of repository.custom_tags ?? []) counts.set(tag, 0);
    for (const item of items) {
      const itemTags = item.fork?.personal_tags ?? item.student_article?.personal_tags ?? [];
      for (const tag of itemTags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [repository.custom_tags, items]);

  async function addTag(): Promise<void> {
    const tag = newTag.trim();
    if (!token || !tag) return;
    setBusy(true);
    setMessage(null);
    try {
      const next = Array.from(new Set([...(repository.custom_tags ?? []), tag]));
      await authenticatedPatch(`/api/v1/current-affairs/me/collections/${repository.id}`, token, {
        custom_tags: next
      });
      setNewTag("");
      await onChanged();
    } catch {
      setMessage("Could not add that tag.");
    } finally {
      setBusy(false);
    }
  }

  /** Removing a tag takes it off the folder and off every article in it —
   *  otherwise it would vanish from this list and keep showing on the rows. */
  async function removeTag(tag: string): Promise<void> {
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      const carriers = items.filter((item) => {
        const itemTags = item.fork?.personal_tags ?? item.student_article?.personal_tags ?? [];
        return itemTags.includes(tag);
      });

      for (const item of carriers) {
        const current = item.fork?.personal_tags ?? item.student_article?.personal_tags ?? [];
        const next = current.filter((t) => t !== tag);
        if (item.fork) {
          await authenticatedPatch(`/api/v1/current-affairs/me/forks/${item.fork.id}`, token, {
            personal_tags: next
          });
        } else if (item.student_article) {
          await authenticatedPatch(`/api/v1/current-affairs/me/articles/${item.student_article.id}`, token, {
            personal_tags: next
          });
        }
      }

      await authenticatedPatch(`/api/v1/current-affairs/me/collections/${repository.id}`, token, {
        custom_tags: (repository.custom_tags ?? []).filter((t) => t !== tag)
      });

      if (selectedTag === tag) onSelectTag("all");
      await onChanged();
      setMessage(
        carriers.length > 0
          ? `Removed "${tag}" from ${carriers.length} article${carriers.length === 1 ? "" : "s"}.`
          : `Removed "${tag}".`
      );
    } catch {
      setMessage("Could not remove that tag everywhere. Some articles may still carry it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-black text-ink">
          <Tags aria-hidden="true" className="h-4 w-4 text-civic" />
          Tags in this folder
        </p>
        <button
          className="text-xs font-bold text-civic"
          onClick={() => setManaging((v) => !v)}
          type="button"
        >
          {managing ? "Done" : "Manage"}
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button
          className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-bold ${
            selectedTag === "all"
              ? "border-civic bg-civic text-white"
              : "border-line bg-surface text-ink/70 hover:border-civic"
          }`}
          onClick={() => onSelectTag("all")}
          type="button"
        >
          All
        </button>

        {tags.length === 0 && !managing && (
          <span className="inline-flex h-8 items-center text-xs font-semibold text-ink/50">
            No tags yet — add one to sort this folder.
          </span>
        )}

        {tags.map(([tag, count]) => (
          <span className="inline-flex items-center" key={tag}>
            <button
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold ${
                selectedTag === tag
                  ? "border-civic bg-civic text-white"
                  : "border-civic/30 bg-surface text-civic hover:bg-civic/10"
              } ${managing ? "rounded-r-none" : ""}`}
              onClick={() => onSelectTag(selectedTag === tag ? "all" : tag)}
              type="button"
            >
              {tag}
              <span className={selectedTag === tag ? "text-white/70" : "text-civic/60"}>{count}</span>
            </button>
            {managing && (
              <button
                aria-label={`Remove the tag ${tag}`}
                className="inline-flex h-8 items-center rounded-r-full border border-l-0 border-berry/40 bg-berry/10 px-2 text-berry disabled:opacity-50"
                disabled={busy}
                onClick={() => void removeTag(tag)}
                type="button"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
      </div>

      {managing && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <input
            className="h-9 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm text-ink"
            onChange={(event) => setNewTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void addTag();
            }}
            placeholder="Revise before mock"
            value={newTag}
          />
          <button
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-civic px-3 text-xs font-bold text-white disabled:opacity-60"
            disabled={busy || newTag.trim().length === 0}
            onClick={() => void addTag()}
            type="button"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Add tag
          </button>
          <button
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-xs font-bold text-ink"
            onClick={() => setManaging(false)}
            type="button"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Close
          </button>
        </div>
      )}

      {message && <p className="mt-2 text-xs font-bold text-civic">{message}</p>}
    </section>
  );
}
