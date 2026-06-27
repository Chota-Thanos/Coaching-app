"use client";

import { BookmarkCheck, Clock3 } from "lucide-react";
import { useAuth } from "../auth/auth-context";

export function StudentStatusBadge({ articleId }: { articleId: number }) {
  const { token, forksByArticleId } = useAuth();
  if (!token) return null;

  const fork = forksByArticleId.get(articleId);
  if (!fork) {
    return <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink/55">Not saved</span>;
  }

  const completed = fork.read_status === "read" || Boolean(fork.reading_progress?.completed_at);
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${completed ? "bg-civic/10 text-civic" : "bg-saffron/10 text-saffron"}`}>
      {completed ? <BookmarkCheck aria-hidden="true" className="h-3.5 w-3.5" /> : <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />}
      {completed ? "Read" : fork.read_status === "needs_revision" ? "Revise" : "Saved"}
    </span>
  );
}
