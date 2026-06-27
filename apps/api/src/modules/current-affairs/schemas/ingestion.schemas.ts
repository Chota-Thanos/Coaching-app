import { z } from "zod";
import { listQuerySchema } from "../../../common/http.js";
import { idSchema, masterArticleKindSchema, masterArticleStatusSchema } from "./base.js";
import { createMasterArticleSchema } from "./master.schemas.js";

export const ingestionSourceKindSchema = z.enum(["manual_text", "source_url", "file_url", "rss_feed", "ai_prompt"]);
export const ingestionParserKindSchema = z.enum(["structured_current_affairs", "plain_text", "manual_json", "external_ai"]);
export const ingestionJobStatusSchema = z.enum(["queued", "parsed", "reviewed", "published", "failed"]);
export const ingestionItemStatusSchema = z.enum(["pending_review", "approved", "rejected", "published"]);

export const listIngestionJobsQuerySchema = listQuerySchema.extend({
  status: ingestionJobStatusSchema.optional(),
  parser_kind: ingestionParserKindSchema.optional()
});

export const createIngestionJobSchema = z.object({
  source_kind: ingestionSourceKindSchema.default("manual_text"),
  parser_kind: ingestionParserKindSchema.default("structured_current_affairs"),
  source_name: z.string().trim().optional(),
  source_url: z.string().url().optional(),
  source_filename: z.string().trim().optional(),
  source_file_url: z.string().url().optional(),
  raw_text: z.string().trim().optional(),
  raw_payload: z.record(z.unknown()).optional(),
  default_content_kind: masterArticleKindSchema.default("daily_current_affairs"),
  default_category_node_id: idSchema.optional(),
  default_publication_date: z.string().date().optional(),
  default_status: masterArticleStatusSchema.default("draft"),
  default_tags: z.array(z.string().trim().min(1)).optional(),
  articles: z.array(createMasterArticleSchema).optional()
}).refine((value) => Boolean(value.raw_text || value.articles?.length || value.raw_payload), {
  message: "Provide raw_text, raw_payload, or at least one article."
});

export const updateIngestionItemSchema = z.object({
  normalized_article: createMasterArticleSchema.partial().optional(),
  status: ingestionItemStatusSchema.optional(),
  validation_errors: z.array(z.unknown()).optional()
});

export type ListIngestionJobsQuery = z.output<typeof listIngestionJobsQuerySchema>;
export type CreateIngestionJobInput = z.output<typeof createIngestionJobSchema>;
export type UpdateIngestionItemInput = z.output<typeof updateIngestionItemSchema>;
