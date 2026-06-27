import type { ContentFamily, ContentKind } from "./current-affairs";

export type MasterArticleStatus = "draft" | "in_review" | "approved" | "published" | "archived";
export type CategoryNodeType = "subject" | "topic" | "subtopic";
export type IngestionItemStatus = "pending_review" | "approved" | "rejected" | "published";
export type IngestionJobStatus = "queued" | "parsed" | "reviewed" | "published" | "failed";
export type IngestionParserKind = "structured_current_affairs" | "plain_text" | "manual_json" | "external_ai";
export type IngestionSourceKind = "manual_text" | "source_url" | "file_url" | "rss_feed" | "ai_prompt";
export type ArticleAssetType = "image" | "thumbnail" | "pdf" | "source_file" | "audio" | "other";

export const ADMIN_CONTENT_KINDS: Array<{ value: ContentKind; label: string; family: ContentFamily }> = [
  { value: "daily_current_affairs", label: "Daily News", family: "prelims" },
  { value: "prelims_pyq", label: "Prelims PYQ", family: "prelims" },
  { value: "daily_editorial_summary", label: "Editorial Summary", family: "mains" },
  { value: "mains_topic_note", label: "Mains Topic Note", family: "mains" },
  { value: "mains_pyq", label: "Mains PYQ", family: "mains" }
];

export const ADMIN_ARTICLE_STATUSES: MasterArticleStatus[] = [
  "draft",
  "in_review",
  "approved",
  "published",
  "archived"
];

export const CATEGORY_NODE_TYPES: CategoryNodeType[] = ["subject", "topic", "subtopic"];
export const INGESTION_ITEM_STATUSES: IngestionItemStatus[] = ["pending_review", "approved", "rejected", "published"];
export const INGESTION_JOB_STATUSES: IngestionJobStatus[] = ["queued", "parsed", "reviewed", "published", "failed"];
export const INGESTION_PARSER_KINDS: IngestionParserKind[] = ["structured_current_affairs", "plain_text", "manual_json", "external_ai"];
export const ARTICLE_ASSET_TYPES: ArticleAssetType[] = ["image", "thumbnail", "pdf", "source_file", "audio", "other"];

export function adminSlug(value: string, fallback = "current-affairs"): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || fallback;
}

export function splitAdminTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function joinAdminTags(tags: string[] | null | undefined): string {
  return Array.isArray(tags) ? tags.join(", ") : "";
}

export function contentFamilyForKind(kind: ContentKind): ContentFamily {
  return ADMIN_CONTENT_KINDS.find((item) => item.value === kind)?.family ?? "prelims";
}

export function statusLabel(value: string): string {
  return value.replace(/_/g, " ");
}
