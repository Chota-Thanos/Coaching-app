"use client";

import { Check, Tags } from "lucide-react";
import { useMemo, useState } from "react";
import type { StudentFork } from "../../../lib/api";
import { visibleWorkspaceTags } from "../../../lib/workspace";
import { authenticatedPatch, useAuth } from "../../auth/auth-context";

type ForkTagQuickEditProps = {
  fork: StudentFork;
  availableTags: string[];
  /** Tags the learner already uses elsewhere, so the control is still useful
   *  on a repository whose owner never defined any. */
  fallbackTags?: string[];
  onChanged: () => Promise<void> | void;
};

/* "Revise" is the one tag the product itself depends on: the Due for revision
   filter looks for it, so it is always offered even on a folder that defines no
   tags of its own. Everything else comes from the folder, which is what makes
   the tag manager authoritative -- previously a fixed list of five was appended
   to every article, so removing a tag in the manager changed nothing here and
   the deleted tags simply reappeared. */
const ALWAYS_OFFERED = ["Revise"];

export function ForkTagQuickEdit({ fork, availableTags, fallbackTags = [], onChanged }: ForkTagQuickEditProps) {
  const { token, refreshForks } = useAuth();
  const [selectedTags, setSelectedTags] = useState<string[]>(visibleWorkspaceTags(fork.personal_tags));

  // The folder's own tags, plus whatever this article already carries so an
  // existing tag can be switched off, plus Revise. Deliberately no starter set:
  // the tag manager at the top of the folder decides what exists here.
  const cleanAvailableTags = useMemo(() => {
    const ordered = [...availableTags, ...fallbackTags, ...selectedTags, ...ALWAYS_OFFERED];
    return Array.from(new Set(ordered.map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
  }, [availableTags, fallbackTags, selectedTags]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveTags(nextTags: string[]): Promise<void> {
    if (!token) return;
    setSelectedTags(nextTags);
    setSaving(true);
    setMessage(null);
    try {
      await authenticatedPatch(`/api/v1/current-affairs/me/forks/${fork.id}`, token, {
        personal_tags: nextTags
      });
      await refreshForks();
      await onChanged();
      setMessage("Tags updated.");
    } catch {
      setSelectedTags(visibleWorkspaceTags(fork.personal_tags));
      setMessage("Could not update tags.");
    } finally {
      setSaving(false);
    }
  }

  function toggleTag(tag: string): void {
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((item) => item !== tag)
      : [...selectedTags, tag];
    void saveTags(nextTags);
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-ink/55">
          <Tags aria-hidden="true" className="h-3.5 w-3.5 text-civic" />
          Quick
      </span>
      {cleanAvailableTags.map((tag) => {
        const selected = selectedTags.includes(tag);
        return (
          <button
            className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-bold transition ${
              selected
                ? "border-civic bg-civic text-white"
                : "border-civic/30 bg-surface text-civic hover:bg-civic/10"
            }`}
            disabled={saving}
            key={tag}
            onClick={() => toggleTag(tag)}
            type="button"
          >
            {selected && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
            {tag}
          </button>
        );
      })}
      {saving && <span className="text-xs font-bold text-civic">Saving...</span>}
      {message && <span className="text-xs font-semibold text-civic">{message}</span>}
    </div>
  );
}
