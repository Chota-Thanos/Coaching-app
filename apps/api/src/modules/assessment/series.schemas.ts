import { z } from "zod";
import { listQuerySchema } from "../../common/http.js";

const idSchema = z.coerce.number().int().positive();

export const createTestSeriesSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().optional(),
  exam_id: idSchema,
  cover_image_url: z.string().url().optional(),
  access_type: z.enum(["free", "subscription", "paid", "private"]).default("free"),
  subscription_plan_id: idSchema.optional(),
  status: z.enum(["draft", "in_review", "published", "archived"]).default("draft"),
  published_at: z.string().datetime().optional()
});

export const updateTestSeriesSchema = z.object({
  title: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().nullable().optional(),
  exam_id: idSchema.optional(),
  cover_image_url: z.string().url().nullable().optional(),
  access_type: z.enum(["free", "subscription", "paid", "private"]).optional(),
  subscription_plan_id: idSchema.nullable().optional(),
  status: z.enum(["draft", "in_review", "published", "archived"]).optional(),
  published_at: z.string().datetime().nullable().optional()
});

export const listTestSeriesQuerySchema = listQuerySchema.extend({
  exam_id: idSchema.optional(),
  status: z.enum(["draft", "in_review", "published", "archived"]).optional(),
  access_type: z.enum(["free", "subscription", "paid", "private"]).optional()
});

export const addTestSeriesItemSchema = z.object({
  test_template_id: idSchema,
  display_order: z.number().int().optional(),
  scheduled_at: z.string().datetime().optional(),
  unlock_at: z.string().datetime().optional()
});

export const updateTestSeriesItemSchema = z.object({
  display_order: z.number().int().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
  unlock_at: z.string().datetime().nullable().optional()
});

export type CreateTestSeriesInput = z.output<typeof createTestSeriesSchema>;
export type UpdateTestSeriesInput = z.output<typeof updateTestSeriesSchema>;
export type ListTestSeriesQuery = z.output<typeof listTestSeriesQuerySchema>;
export type AddTestSeriesItemInput = z.output<typeof addTestSeriesItemSchema>;
export type UpdateTestSeriesItemInput = z.output<typeof updateTestSeriesItemSchema>;
