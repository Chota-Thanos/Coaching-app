import { one } from "../../db.js";
import { getUserEntitlements } from "./service.js";

/**
 * Free-tier caps, and the premium values that lift them.
 *
 * These live here rather than in billing.entitlements.limit_value because the
 * seeded entitlement rows use limit_value = null to mean "unlimited for plan
 * holders" — they carry no notion of what a FREE user gets. The free number is
 * a product decision, so it's an explicit constant (same pattern as
 * FREE_TEST_LIMIT in assessment/free-test-allowance.ts).
 *
 * Enforcement is server-side on purpose: the mobile and web clients also show
 * these limits in their UI, but a client-only cap is trivially bypassed by
 * calling the API directly.
 */

export const FREE_MAX_NOTE_COLLECTIONS = 5;
export const FREE_MAX_ITEMS_PER_COLLECTION = 10;

/**
 * Questions-per-test caps deliberately live in assessment/question-caps.ts, not
 * here — that table (free 50 / premium 100 objective, 10 / 25 mains) is already
 * enforced on both test creation and attempts. Duplicating it would create a
 * second source of truth that silently drifts.
 */

/** Any of these keys means the user has paid for the notes workspace. */
const NOTES_PREMIUM_KEYS = ["current_affairs.notes_workspace", "current_affairs.editorial_access"];

async function hasAnyEntitlement(userId: number, keys: string[]): Promise<boolean> {
  const entitlements = await getUserEntitlements(userId);
  return entitlements.some((e) => keys.includes(e.entitlement_key));
}

export type NotesWorkspaceLimits = {
  hasPremium: boolean;
  /** null = unlimited */
  maxCollections: number | null;
  /** null = unlimited */
  maxItemsPerCollection: number | null;
  collectionsUsed: number;
};

/**
 * Notes workspace allowance. The workspace itself is available to everyone —
 * free users are capped on how much they can put in it, not locked out.
 */
export async function getNotesWorkspaceLimits(userId: number): Promise<NotesWorkspaceLimits> {
  const hasPremium = await hasAnyEntitlement(userId, NOTES_PREMIUM_KEYS);

  const row = await one<{ count: string }>(
    `select count(*)::text as count
     from current_affairs.student_collections
     where user_id = $1`,
    [userId]
  );

  return {
    hasPremium,
    maxCollections: hasPremium ? null : FREE_MAX_NOTE_COLLECTIONS,
    maxItemsPerCollection: hasPremium ? null : FREE_MAX_ITEMS_PER_COLLECTION,
    collectionsUsed: Number(row?.count ?? 0)
  };
}

/** Throws a 402-style error when a free user is at their collection cap. */
export async function assertCanCreateCollection(userId: number): Promise<void> {
  const limits = await getNotesWorkspaceLimits(userId);
  if (limits.maxCollections === null) return;
  if (limits.collectionsUsed >= limits.maxCollections) {
    const err = new Error(
      `Free accounts can create up to ${limits.maxCollections} repositories. Upgrade for unlimited.`
    ) as Error & { statusCode?: number };
    err.statusCode = 402;
    throw err;
  }
}

/** Throws a 402-style error when a free user's repository is full. */
export async function assertCanAddCollectionItem(
  userId: number,
  collectionId: number
): Promise<void> {
  const limits = await getNotesWorkspaceLimits(userId);
  if (limits.maxItemsPerCollection === null) return;

  const row = await one<{ count: string }>(
    `select count(*)::text as count
     from current_affairs.student_collection_items sci
     join current_affairs.student_collections sc on sc.id = sci.collection_id
     where sci.collection_id = $1 and sc.user_id = $2`,
    [collectionId, userId]
  );
  const used = Number(row?.count ?? 0);

  if (used >= limits.maxItemsPerCollection) {
    const err = new Error(
      `Free accounts can add up to ${limits.maxItemsPerCollection} articles per repository. Upgrade for unlimited.`
    ) as Error & { statusCode?: number };
    err.statusCode = 402;
    throw err;
  }
}
