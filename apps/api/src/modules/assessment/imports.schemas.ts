import { z } from "zod";
import { listQuerySchema } from "../../common/http.js";

const idSchema = z.coerce.number().int().positive();

export const createImportBatchSchema = z.object({
  source_filename: z.string().trim().optional(),
  source_file_url: z.string().url().optional(),
  parser_kind: z.string().trim().default("manual_json"),
  items: z.array(z.record(z.unknown())).min(1)
});

export const listImportBatchesQuerySchema = listQuerySchema.extend({
  status: z.enum(["draft", "parsed", "reviewed", "published", "failed"]).optional()
});

export const updateImportItemSchema = z.object({
  normalized_payload: z.record(z.unknown()).optional(),
  status: z.enum(["pending_review", "approved", "rejected", "published"]).optional(),
  validation_errors: z.array(z.unknown()).optional()
});

export const publishImportItemSchema = z.object({
  question_id: idSchema.optional()
});

export type CreateImportBatchInput = z.output<typeof createImportBatchSchema>;
export type ListImportBatchesQuery = z.output<typeof listImportBatchesQuerySchema>;
export type UpdateImportItemInput = z.output<typeof updateImportItemSchema>;
export type PublishImportItemInput = z.output<typeof publishImportItemSchema>;
