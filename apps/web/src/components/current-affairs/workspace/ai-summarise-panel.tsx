"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { ApiError, authenticatedPost, useAuth } from "../../auth/auth-context";
import { CapReachedNotice, isCapError } from "../../billing/cap-reached-notice";
import type { StudentArticle, StudentFork } from "../../../lib/api";
import { workspaceSlug } from "../../../lib/workspace";

/**
 * Summarise several saved articles into one note, with AI.
 *
 * The endpoint has existed since the AI notes helper was built, but the only
 * caller was the create-notes wizard's AI-Assisted mode — so a learner whose
 * repository was already full of articles had no way to say "summarise these"
 * without walking back through a five-step setup flow. This puts it where the
 * articles are.
 *
 * It only ever summarises articles the learner has already saved; it never
 * generates free-standing content from a bare topic. Gated behind Current
 * Affairs Pro server-side, so an unentitled learner gets the upgrade prompt
 * rather than a raw failure.
 */
export function AiSummarisePanel({
  collectionId,
  forks,
  onCreated
}: {
  collectionId: number;
  /** The forks currently visible in this repository — what "these" means. */
  forks: StudentFork[];
  onCreated: () => Promise<void> | void;
}) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [capError, setCapError] = useState<ApiError | null>(null);

  const toggle = (forkId: number) =>
    setSelected((current) =>
      current.includes(forkId) ? current.filter((id) => id !== forkId) : [...current, forkId]
    );

  async function summarise(): Promise<void> {
    if (!token || selected.length === 0) return;
    setBusy(true);
    setMessage(null);
    setCapError(null);
    try {
      const note = await authenticatedPost<{ title: string; body: string }>(
        "/api/v1/current-affairs/me/ai/generate-notes",
        token,
        { collection_id: collectionId, fork_ids: selected }
      );
      // The endpoint returns the note; saving it as a personal article and
      // filing it in this repository is what makes it part of the notes.
      const slug = `${workspaceSlug(note.title)}-${Date.now().toString().slice(-4)}`;
      const article = await authenticatedPost<StudentArticle>("/api/v1/current-affairs/me/articles", token, {
        title: note.title,
        slug,
        body: note.body,
        status: "published"
      });
      await authenticatedPost(`/api/v1/current-affairs/me/collections/${collectionId}/items`, token, {
        student_article_id: article.id
      });
      setSelected([]);
      setOpen(false);
      await onCreated();
    } catch (err) {
      if (isCapError(err)) setCapError(err);
      else setMessage("Could not summarise those articles. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (forks.length === 0) return null;

  return (
    <div className="rounded-lg border border-civic/25 bg-civic/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-civic" />
          <div>
            <p className="text-sm font-black text-ink">Summarise with AI</p>
            <p className="mt-0.5 text-xs font-semibold text-ink/55">
              Turn several saved articles in this repository into one revision note.
            </p>
          </div>
        </div>
        <button
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-civic/30 bg-surface px-3 text-xs font-bold text-civic"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? "Cancel" : "Pick articles"}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid gap-3">
          <div className="max-h-56 overflow-y-auto rounded-md border border-line bg-surface">
            {forks.map((fork) => {
              const checked = selected.includes(fork.id);
              return (
                <label
                  className="flex cursor-pointer items-start gap-2.5 border-b border-line/60 p-2.5 last:border-b-0 hover:bg-paper"
                  key={fork.id}
                >
                  <input checked={checked} className="mt-0.5" onChange={() => toggle(fork.id)} type="checkbox" />
                  <span className="min-w-0 flex-1 text-xs font-bold text-ink">
                    {fork.forked_title ?? fork.master_article?.title ?? `Article ${fork.master_article_id}`}
                  </span>
                </label>
              );
            })}
          </div>

          {capError && <CapReachedNotice error={capError} module="current_affairs" compact />}
          {message && <p className="text-xs font-bold text-berry">{message}</p>}

          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
              disabled={busy || selected.length === 0}
              onClick={summarise}
              type="button"
            >
              {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}
              {busy ? "Summarising..." : `Summarise ${selected.length || ""}`.trim()}
            </button>
            <p className="text-xs font-semibold text-ink/55">
              {selected.length === 0
                ? "Pick at least one article."
                : `The note is saved into this repository as your own article.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
