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

const SUGGESTED_TAGS = ["Revise", "Weak topic", "Prelims fact", "Mains example", "Done"];

export function ForkTagQuickEdit({ fork, availableTags, fallbackTags = [], onChanged }: ForkTagQuickEditProps) {
  const { token, refreshForks } = useAuth();
  const [selectedTags, setSelectedTags] = useState<string[]>(visibleWorkspaceTags(fork.personal_tags));

  // The repository's own tag definitions come first, then the tags this
  // learner already uses, then a small starter set. Before this, a repository
  // with no definitions showed a sentence telling the learner to go and
  // define some instead of any buttons at all — so the quick editor was
  // invisible on every repository nobody had configured.
  const cleanAvailableTags = useMemo(() => {
    const ordered = [...availableTags, ...fallbackTags, ...selectedTags, ...SUGGESTED_TAGS];
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
