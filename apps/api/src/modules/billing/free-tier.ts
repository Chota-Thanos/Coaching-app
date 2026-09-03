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
 * Forking, personal articles, highlights, and notes previously had no cap at
 * all — only the "attach to a named repository" step was enforced, so a free
 * user could fork/write/annotate without limit and only hit a wall when
 * filing things into a repo. These close that gap, sized to roughly match
 * what filling all 5 free repos at 10 items each would actually take.
 */
export const FREE_MAX_FORKS = 50;
export const FREE_MAX_STUDENT_ARTICLES = 10;
export const FREE_MAX_HIGHLIGHTS_PER_FORK = 20;
export const FREE_MAX_NOTES_PER_FORK = 10;

/**
 * Questions-per-test caps deliberately live in assessment/question-caps.ts, not
 * here — that table (free 50 / premium 100 objective, 10 / 25 mains) is already
 * enforced on both test creation and attempts. Duplicating it would create a
 * second source of truth that silently drifts.
 */

/** Any of these keys means the user has paid for the notes workspace. */
const NOTES_PREMIUM_KEYS = ["current_affairs.notes_workspace", "current_affairs.editorial_access"];

/**
 * The AI performance coach is its own entitlement rather than riding on an
 * existing one: it reads a student's whole answer history and costs a real AI
 * call per question asked, so it needs to be priceable on its own. Attach this
 * key to whichever plan should include it.
 */
const PERFORMANCE_COACH_KEYS = ["assessment.performance_coach"];

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
    // capExceededError, not a bare Error: the server error handler reports
    // `error.name` as the response's `error` field, and the clients branch on
    // `cap_exceeded` to show the upgrade prompt instead of a raw failure toast.
    throw capExceededError(
      `Free accounts can create up to ${limits.maxCollections} repositories. Upgrade for unlimited.`
    );
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
    throw capExceededError(
      `Free accounts can add up to ${limits.maxItemsPerCollection} articles per repository. Upgrade for unlimited.`
    );
  }
}

function capExceededError(message: string, name = "cap_exceeded"): Error & { statusCode?: number } {
  const err = new Error(message) as Error & { statusCode?: number };
  err.name = name;
  err.statusCode = 402;
  return err;
}

/**
 * Throws a 402-style error when a free user has forked the free-tier max
 * number of articles. Re-saving an article the user already forked is exempt
 * — forkArticle() upserts on (user_id, master_article_id), so that call
 * updates an existing row rather than creating a new one.
 */
export async function assertCanForkArticle(userId: number, masterArticleId: number): Promise<void> {
  if (await hasAnyEntitlement(userId, NOTES_PREMIUM_KEYS)) return;

  const existing = await one<{ id: number }>(
    `select id from current_affairs.student_article_forks where user_id = $1 and master_article_id = $2`,
    [userId, masterArticleId]
  );
  if (existing) return;

  const row = await one<{ count: string }>(
    `select count(*)::text as count from current_affairs.student_article_forks where user_id = $1`,
    [userId]
  );
  if (Number(row?.count ?? 0) >= FREE_MAX_FORKS) {
    throw capExceededError(`Free accounts can save up to ${FREE_MAX_FORKS} articles. Upgrade for unlimited.`);
  }
}

/** Throws a 402-style error when a free user has written the free-tier max number of personal articles. */
export async function assertCanCreateStudentArticle(userId: number): Promise<void> {
  if (await hasAnyEntitlement(userId, NOTES_PREMIUM_KEYS)) return;

  const row = await one<{ count: string }>(
    `select count(*)::text as count from current_affairs.student_articles where user_id = $1`,
    [userId]
  );
  if (Number(row?.count ?? 0) >= FREE_MAX_STUDENT_ARTICLES) {
    throw capExceededError(`Free accounts can write up to ${FREE_MAX_STUDENT_ARTICLES} personal articles. Upgrade for unlimited.`);
  }
}

/** Throws a 402-style error when a free user's fork already has the max number of highlights. */
export async function assertCanAddHighlight(userId: number, forkId: number): Promise<void> {
  if (await hasAnyEntitlement(userId, NOTES_PREMIUM_KEYS)) return;

  const row = await one<{ count: string }>(
    `select count(*)::text as count
     from current_affairs.student_article_highlights sah
     join current_affairs.student_article_forks saf on saf.id = sah.fork_id
     where sah.fork_id = $1 and saf.user_id = $2`,
    [forkId, userId]
  );
  if (Number(row?.count ?? 0) >= FREE_MAX_HIGHLIGHTS_PER_FORK) {
    throw capExceededError(`Free accounts can add up to ${FREE_MAX_HIGHLIGHTS_PER_FORK} highlights per article. Upgrade for unlimited.`);
  }
}

/** Throws a 402-style error when a free user's fork already has the max number of notes. */
export async function assertCanAddNote(userId: number, forkId: number): Promise<void> {
  if (await hasAnyEntitlement(userId, NOTES_PREMIUM_KEYS)) return;

  const row = await one<{ count: string }>(
    `select count(*)::text as count
     from current_affairs.student_article_notes san
     join current_affairs.student_article_forks saf on saf.id = san.fork_id
     where san.fork_id = $1 and saf.user_id = $2`,
    [forkId, userId]
  );
  if (Number(row?.count ?? 0) >= FREE_MAX_NOTES_PER_FORK) {
    throw capExceededError(`Free accounts can add up to ${FREE_MAX_NOTES_PER_FORK} notes per article. Upgrade for unlimited.`);
  }
}

/**
 * Throws a 402-style error when the user doesn't hold Current Affairs Pro
 * (or the bundle). Unlike the rest of the notes workspace — capped for free
 * users, not locked out — AI generation has real per-call cost, so it's
 * gated behind the subscription entirely, the same way assessment.ai_evaluation
 * gates Mains AI evaluation.
 */
/**
 * Throws a 402-style error when the user doesn't hold the performance coach
 * entitlement. Gated outright rather than capped, like AI notes and Mains
 * evaluation, since every question runs several model calls.
 */
export async function assertHasPerformanceCoachAccess(userId: number): Promise<void> {
  if (await hasAnyEntitlement(userId, PERFORMANCE_COACH_KEYS)) return;
  throw capExceededError(
    "The AI performance coach is a premium feature. Upgrade to have it read your attempts and tell you what you keep getting wrong.",
    "premium_required"
  );
}

export async function assertHasAiNotesAccess(userId: number): Promise<void> {
  if (await hasAnyEntitlement(userId, NOTES_PREMIUM_KEYS)) return;
  throw capExceededError(
    "AI Notes Helper requires Current Affairs Pro. Upgrade to generate real AI study notes and quizzes.",
    "premium_required"
  );
}
