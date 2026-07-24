"use client";

import { Check, Tags } from "lucide-react";
import { useMemo, useState } from "react";
import type { StudentFork } from "../../../lib/api";
import { visibleWorkspaceTags } from "../../../lib/workspace";
import { authenticatedPatch, useAuth } from "../../auth/auth-context";

type ForkTagQuickEditProps = {
  fork: StudentFork;
  availableTags: string[];
  onChanged: () => Promise<void> | void;
};

export function ForkTagQuickEdit({ fork, availableTags, onChanged }: ForkTagQuickEditProps) {
  const { token, refreshForks } = useAuth();
  const cleanAvailableTags = useMemo(
    () => Array.from(new Set(availableTags.map((tag) => tag.trim()).filter(Boolean))),
    [availableTags]
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(visibleWorkspaceTags(fork.personal_tags));
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

  if (cleanAvailableTags.length === 0) {
    return (
      <p className="mt-2 text-xs font-semibold text-ink/55">
        Define custom tags for this repository to enable quick tag editing.
      </p>
    );
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
