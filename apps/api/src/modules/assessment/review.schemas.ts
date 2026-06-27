import { z } from "zod";
import { listQuerySchema } from "../../common/http.js";

const idSchema = z.coerce.number().int().positive();

export const createBookmarkSchema = z.object({
  question_id: idSchema,
  question_version_id: idSchema.optional(),
  note: z.string().trim().optional()
});

export const createErrorLogSchema = z.object({
  question_version_id: idSchema,
  attempt_id: idSchema.optional(),
  taxonomy_node_id: idSchema.optional(),
  error_type_id: idSchema,
  note: z.string().trim().optional()
});

export const createErrorTypeSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const updateErrorTypeSchema = z.object({
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const listStudentItemsQuerySchema = listQuerySchema;

export type CreateBookmarkInput = z.output<typeof createBookmarkSchema>;
export type CreateErrorLogInput = z.output<typeof createErrorLogSchema>;
export type CreateErrorTypeInput = z.output<typeof createErrorTypeSchema>;
export type UpdateErrorTypeInput = z.output<typeof updateErrorTypeSchema>;
