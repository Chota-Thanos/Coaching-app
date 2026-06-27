import { z } from "zod";
import { listQuerySchema } from "../../../common/http.js";
import { idSchema, slugSchema } from "./base.js";

export const readingDashboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5)
});

export const forkArticleSchema = z.object({
  personal_tags: z.array(z.string().trim().min(1)).optional(),
  collection_id: idSchema.optional(),
  custom_folder: z.string().trim().optional(),
  read_status: z.enum(["unread", "read", "needs_revision"]).optional(),
  scheduled_revision_at: z.string().datetime().optional()
});

export const updateForkSchema = z.object({
  personal_tags: z.array(z.string().trim().min(1)).optional(),
  personal_summary: z.string().trim().nullable().optional(),
  forked_title: z.string().trim().min(1).nullable().optional(),
  forked_body: z.string().trim().min(1).nullable().optional(),
  forked_body_json: z.record(z.unknown()).optional(),
  custom_folder: z.string().trim().nullable().optional(),
  read_status: z.enum(["unread", "read", "needs_revision"]).optional(),
  scheduled_revision_at: z.string().datetime().nullable().optional()
});

export const updateReadingProgressSchema = z.object({
  progress_percent: z.coerce.number().min(0).max(100),
  last_anchor_json: z.record(z.unknown()).optional(),
  last_section_id: idSchema.nullable().optional(),
  reading_seconds_delta: z.coerce.number().int().min(0).max(43_200).default(0),
  mark_complete: z.boolean().optional(),
  scheduled_revision_at: z.string().datetime().nullable().optional()
});

export const createHighlightSchema = z.object({
  anchor_json: z.record(z.unknown()).default({}),
  color: z.string().trim().min(1).default("yellow"),
  note: z.string().trim().optional()
});

export const updateHighlightSchema = z.object({
  anchor_json: z.record(z.unknown()).optional(),
  color: z.string().trim().min(1).optional(),
  note: z.string().trim().nullable().optional()
});

export const createNoteSchema = z.object({
  anchor_json: z.record(z.unknown()).default({}),
  note: z.string().trim().min(1)
});

export const updateNoteSchema = z.object({
  anchor_json: z.record(z.unknown()).optional(),
  note: z.string().trim().min(1).optional()
});

export const listStudentArticlesQuerySchema = listQuerySchema.extend({
  status: z.enum(["draft", "published", "archived"]).optional(),
  category_node_id: idSchema.optional()
});

export const createStudentArticleSchema = z.object({
  title: z.string().trim().min(1),
  slug: slugSchema,
  body: z.string().trim().min(1),
  body_json: z.record(z.unknown()).optional(),
  category_node_id: idSchema.optional(),
  source_url: z.string().url().optional(),
  personal_tags: z.array(z.string().trim().min(1)).optional(),
  status: z.enum(["draft", "published", "archived"]).optional()
});

export const updateStudentArticleSchema = createStudentArticleSchema.partial().extend({
  category_node_id: idSchema.nullable().optional(),
  source_url: z.string().url().nullable().optional()
});

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1),
  slug: slugSchema,
  description: z.string().trim().optional(),
  custom_tags: z.array(z.string().trim().min(1)).optional()
});

export const updateCollectionSchema = z.object({
  name: z.string().trim().min(1).optional(),
  slug: slugSchema.optional(),
  description: z.string().trim().nullable().optional(),
  custom_tags: z.array(z.string().trim().min(1)).optional()
});

export const addCollectionItemSchema = z.object({
  fork_id: idSchema.optional(),
  student_article_id: idSchema.optional(),
  display_order: z.number().int().optional()
}).refine((value) => Boolean(value.fork_id) !== Boolean(value.student_article_id), {
  message: "Provide exactly one of fork_id or student_article_id."
});

export type ReadingDashboardQuery = z.output<typeof readingDashboardQuerySchema>;
export type ForkArticleInput = z.output<typeof forkArticleSchema>;
export type UpdateForkInput = z.output<typeof updateForkSchema>;
export type UpdateReadingProgressInput = z.output<typeof updateReadingProgressSchema>;
export type CreateHighlightInput = z.output<typeof createHighlightSchema>;
export type UpdateHighlightInput = z.output<typeof updateHighlightSchema>;
export type CreateNoteInput = z.output<typeof createNoteSchema>;
export type UpdateNoteInput = z.output<typeof updateNoteSchema>;
export type ListStudentArticlesQuery = z.output<typeof listStudentArticlesQuerySchema>;
export type CreateStudentArticleInput = z.output<typeof createStudentArticleSchema>;
export type UpdateStudentArticleInput = z.output<typeof updateStudentArticleSchema>;
export type CreateCollectionInput = z.output<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.output<typeof updateCollectionSchema>;
export type AddCollectionItemInput = z.output<typeof addCollectionItemSchema>;
