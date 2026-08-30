"use client";

import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { useState } from "react";
import type { ContentKind } from "../../lib/current-affairs";
import type { StudentFork } from "../../lib/api";
import { authenticatedPost, useAuth } from "../auth/auth-context";
import { InlineSignInPrompt } from "../../components/assessment/sign-in-required-notice";

type ForkArticleButtonProps = {
  articleId: number;
  contentKind: ContentKind;
};

export function ForkArticleButton({ articleId, contentKind }: ForkArticleButtonProps) {
  const { token, forksByArticleId, refreshForks } = useAuth();
  const existingFork = forksByArticleId.get(articleId);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const isSaved = saved || Boolean(existingFork);

  async function saveArticle(): Promise<void> {
    if (!token) {
      // Was a bare sentence with no route; saving genuinely needs an
      // account, so the message carries the way to get one.
      setNeedsSignIn(true);
      return;
    }
    if (isSaved) return;

      setPending(true);
    setMessage(null);
    try {
      await authenticatedPost<StudentFork>(`/api/v1/current-affairs/articles/${articleId}/fork`, token, {});
      setSaved(true);
      await refreshForks();
      setMessage("Saved to Notes Space.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        aria-label={isSaved ? "Article saved to Notes Space" : "Save article to Notes Space"}
        className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold ${
          isSaved
            ? "border-civic/30 bg-civic/10 text-civic"
            : "border-line bg-surface text-ink hover:border-civic"
        } disabled:opacity-60`}
        disabled={pending || isSaved}
        onClick={saveArticle}
        type="button"
      >
        {isSaved ? <BookmarkCheck aria-hidden="true" className="h-4 w-4" /> : <BookmarkPlus aria-hidden="true" className="h-4 w-4" />}
        {isSaved ? "Saved" : pending ? "Saving..." : "Save"}
      </button>
      {needsSignIn && (
        <p className="mt-2 text-xs font-semibold text-civic">
          <InlineSignInPrompt message="Sign in to save this article." />
        </p>
      )}
      {message && <p className="mt-2 text-xs font-semibold text-civic">{message}</p>}
    </div>
  );
}
