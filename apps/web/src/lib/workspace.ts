import type { StudentCollectionItem, StudentFork } from "./api";

export function workspaceSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "repository";
}

// student_articles has a unique(user_id, slug) constraint — always suffix with
// a time-based token so two drafts with the same title never collide.
export function createUniqueWorkspaceSlug(value: string): string {
  return `${workspaceSlug(value)}-${Date.now().toString(36)}`;
}

export function progressPercent(fork: StudentFork): number {
  const value = Number(fork.reading_progress?.progress_percent ?? 0);
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function progressLabel(fork: StudentFork): string {
  if (fork.read_status === "needs_revision") return "Revision due";
  if (fork.read_status === "read" || fork.reading_progress?.completed_at) return "Read";

  const progress = progressPercent(fork);
  return progress > 0 ? `${progress}% read` : "Unread";
}

const SYSTEM_TAGS = new Set([
  "daily_news",
  "daily current affairs",
  "daily_current_affairs",
  "daily news",
  "editorials",
  "editorial",
  "mains_notes",
  "mains notes",
  "mains_article",
  "mains articles",
  "mains_pyq",
  "prelims_pyq",
  "read",
  "unread",
  "needs_revision",
  "revision due"
]);

export function visibleWorkspaceTags(tags: string[] | null | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag) => {
    const normalized = tag.trim().toLowerCase();
    return normalized.length > 0 && !SYSTEM_TAGS.has(normalized);
  });
}

export function readingSecondsLabel(value: number | string | null | undefined): string {
  const seconds = Number(value ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 min";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function collectionItemTitle(item: StudentCollectionItem): string {
  return item.fork?.forked_title ?? item.master_article?.title ?? item.student_article?.title ?? "Untitled item";
}

export function splitWorkspaceTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

export function joinWorkspaceTags(tags: string[] | null | undefined): string {
  return Array.isArray(tags) ? tags.join(", ") : "";
}
