"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { authenticatedGet, useAuth } from "../../auth/auth-context";
import { PLAN_CODES } from "../../../lib/subscription-plans";

/**
 * What the free plan still allows, said before the learner hits the wall.
 *
 * The API has exposed GET /me/workspace-limits since the caps were added, and
 * nothing in the app ever called it — so a free student discovered the five
 * repository limit only by being refused at the moment of creating the sixth.
 * The cap errors themselves are handled elsewhere; this is the part that made
 * them predictable.
 */

export type WorkspaceLimits = {
  hasPremium: boolean;
  maxCollections: number | null;
  maxItemsPerCollection: number | null;
  collectionsUsed: number;
};

export function useWorkspaceLimits(): { limits: WorkspaceLimits | null; reload: () => void } {
  const { token } = useAuth();
  const [limits, setLimits] = useState<WorkspaceLimits | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!token) {
      setLimits(null);
      return;
    }
    let cancelled = false;
    void authenticatedGet<WorkspaceLimits>("/api/v1/current-affairs/me/workspace-limits", token)
      .then((data) => {
        if (!cancelled) setLimits(data);
      })
      .catch(() => {
        // A limits lookup failing must never block the workspace itself.
      });
    return () => {
      cancelled = true;
    };
  }, [token, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { limits, reload };
}

/**
 * One line of plan reality. Silent for subscribers — there is no limit to
 * report — and silent while the lookup is in flight, so it never flashes.
 */
export function WorkspaceLimitBar({
  limits,
  itemsUsed,
  context = "workspace"
}: {
  limits: WorkspaceLimits | null;
  /** Items in the repository being viewed, when there is one. */
  itemsUsed?: number;
  context?: "workspace" | "repository";
}) {
  if (!limits || limits.hasPremium) return null;

  const maxCollections = limits.maxCollections;
  const maxItems = limits.maxItemsPerCollection;

  const collectionsLeft = maxCollections === null ? null : Math.max(0, maxCollections - limits.collectionsUsed);
  const itemsLeft =
    maxItems === null || itemsUsed === undefined ? null : Math.max(0, maxItems - itemsUsed);

  // Turn amber once a learner is within one of a wall, so the warning arrives
  // while there is still something they can do about it.
  const tight =
    (collectionsLeft !== null && collectionsLeft <= 1) || (itemsLeft !== null && itemsLeft <= 2);

  const parts: string[] = [];
  if (context === "repository" && maxItems !== null && itemsUsed !== undefined) {
    parts.push(`${itemsUsed} of ${maxItems} articles in this repository`);
  }
  if (maxCollections !== null) {
    parts.push(`${limits.collectionsUsed} of ${maxCollections} repositories`);
  }
  if (parts.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 ${
        tight ? "border-amber-300 bg-amber-50" : "border-line bg-paper"
      }`}
    >
      <Sparkles aria-hidden="true" className={`h-4 w-4 shrink-0 ${tight ? "text-amber-600" : "text-civic"}`} />
      <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug text-ink/70">
        {parts.join(" · ")} used on the free plan.
        {tight ? " You are nearly out." : ""}
      </p>
      <Link
        href={`/pricing?plan=${PLAN_CODES.currentAffairs}`}
        className="shrink-0 rounded-lg border border-civic/30 bg-civic/10 px-3 py-1.5 text-[12px] font-bold text-civic transition hover:bg-civic/15"
      >
        Get unlimited
      </Link>
    </div>
  );
}
