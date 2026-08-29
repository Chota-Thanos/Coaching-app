"use client";

import { Plus } from "lucide-react";
import { CapReachedNotice, isCapError } from "../../billing/cap-reached-notice";
import { useEffect, useMemo, useState } from "react";
import type { StudentCollection } from "../../../lib/api";
import { ApiError, authenticatedPost, useAuth } from "../../auth/auth-context";

type RepositoryAttachControlProps = {
  collections: StudentCollection[];
  forkId?: number;
  studentArticleId?: number;
  attachedCollectionIds?: number[];
  onAdded?: () => Promise<void> | void;
};

export function RepositoryAttachControl({
  collections,
  forkId,
  studentArticleId,
  attachedCollectionIds = [],
  onAdded
}: RepositoryAttachControlProps) {
  const { token } = useAuth();
  const firstCollectionId = useMemo(() => collections[0]?.id ? String(collections[0].id) : "", [collections]);
  const [collectionId, setCollectionId] = useState(firstCollectionId);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [capError, setCapError] = useState<ApiError | null>(null);

  useEffect(() => {
    setCollectionId((current) => current || firstCollectionId);
  }, [firstCollectionId]);

  const selectedCollectionId = collectionId || firstCollectionId;
  const alreadyAttached = attachedCollectionIds.includes(Number(selectedCollectionId));

  if (collections.length === 0) {
    return <p className="text-xs font-semibold text-ink/55">Create a repository to add this item.</p>;
  }

  async function addToRepository(): Promise<void> {
    if (!token || !selectedCollectionId || alreadyAttached) return;

    setPending(true);
    setMessage(null);
    setCapError(null);
    try {
      await authenticatedPost(`/api/v1/current-affairs/me/collections/${selectedCollectionId}/items`, token, {
        fork_id: forkId,
        student_article_id: studentArticleId
      });
      await onAdded?.();
      setMessage("Added to repository.");
    } catch (err) {
      // A free account whose repository is full gets a 402 naming the limit.
      // Reporting that as a generic failure sent people retrying the same
      // click instead of telling them the repository was full.
      if (isCapError(err)) setCapError(err);
      else setMessage("Could not add item.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <select
        aria-label="Repository"
        className="h-10 min-w-0 rounded-md border border-line bg-surface px-3 text-sm text-ink"
        onChange={(event) => setCollectionId(event.target.value)}
        value={selectedCollectionId}
      >
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}{attachedCollectionIds.includes(collection.id) ? " - added" : ""}
          </option>
        ))}
      </select>
      <button
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-civic/30 bg-civic/10 px-3 text-sm font-bold text-civic hover:bg-civic/15 disabled:border-line disabled:bg-paper disabled:text-ink/45"
        disabled={pending || alreadyAttached}
        onClick={addToRepository}
        type="button"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        {alreadyAttached ? "Added" : "Add"}
      </button>
      {capError && <CapReachedNotice error={capError} module="current_affairs" compact />}
      {message && <p className="text-xs font-semibold text-civic sm:col-span-2">{message}</p>}
    </div>
  );
}
