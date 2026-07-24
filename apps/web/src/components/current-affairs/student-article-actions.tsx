"use client";

import { BookmarkPlus, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type { ArticleDetail, StudentFork } from "../../lib/api";
import { authenticatedPost, authenticatedPut, useAuth } from "../auth/auth-context";
import { SignInPanel } from "../auth/sign-in-panel";

export function StudentArticleActions({ article }: { article: ArticleDetail }) {
  const { token, forksByArticleId, refreshForks } = useAuth();
  const existingFork = forksByArticleId.get(article.id);
  const [fork, setFork] = useState<StudentFork | null>(existingFork ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <aside className="rounded-lg border border-line bg-surface p-4 shadow-sm">
        <h2 className="text-base font-extrabold text-ink">Student tools</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">Sign in to save this article, track reading progress, and schedule revision.</p>
        <div className="mt-4">
          <SignInPanel />
        </div>
      </aside>
    );
  }

  async function saveArticle(): Promise<void> {
    if (!token) return;
    setPending(true);
    setMessage(null);
    try {
      const record = await authenticatedPost<StudentFork>(`/api/v1/current-affairs/articles/${article.id}/fork`, token, {});
      setFork(record);
      await refreshForks();
      setMessage("Saved to Notes Space.");
    } finally {
      setPending(false);
    }
  }

  async function markRead(): Promise<void> {
    if (!token) return;
    const activeFork = fork ?? existingFork;
    if (!activeFork) {
      await saveArticle();
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      await authenticatedPut(`/api/v1/current-affairs/me/forks/${activeFork.id}/progress`, token, {
        progress_percent: 100,
        reading_seconds_delta: 0,
        mark_complete: true
      });
      await refreshForks();
      setMessage("Marked read. A revision reminder is scheduled.");
    } finally {
      setPending(false);
    }
  }

  return (
    <aside className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <h2 className="text-base font-extrabold text-ink">Student tools</h2>
      <div className="mt-4 grid gap-2">
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-bold text-ink disabled:opacity-60"
          disabled={pending}
          onClick={saveArticle}
          type="button"
        >
          <BookmarkPlus aria-hidden="true" className="h-4 w-4" />
          Save article
        </button>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
          disabled={pending}
          onClick={markRead}
          type="button"
        >
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          Mark read
        </button>
      </div>
      {message && <p className="mt-3 text-sm font-semibold text-civic">{message}</p>}
    </aside>
  );
}
