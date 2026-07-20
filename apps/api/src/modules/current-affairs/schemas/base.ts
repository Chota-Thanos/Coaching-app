import { z } from "zod";

export const idSchema = z.coerce.number().int().positive();
export const slugSchema = z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const slugParamSchema = z.object({
  slug: slugSchema
});

export const contentFamilySchema = z.enum(["prelims", "mains"]);
export const articleRoleSchema = z.enum(["event", "concept"]);
export const categoryNodeTypeSchema = z.enum(["subject", "topic", "subtopic"]);
export const masterArticleStatusSchema = z.enum(["draft", "in_review", "approved", "published", "archived"]);
export const masterArticleKindSchema = z.enum([
  "daily_current_affairs",
  "prelims_pyq",
  "daily_editorial_summary",
  "mains_topic_note",
  "mains_pyq",
  "mains_summary",
  "mains_article",
  "study_note"
]);
