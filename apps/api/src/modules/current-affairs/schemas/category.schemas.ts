import { z } from "zod";
import { listQuerySchema } from "../../../common/http.js";
import { categoryNodeTypeSchema, contentFamilySchema, idSchema, slugSchema } from "./base.js";

export const listCategoriesQuerySchema = listQuerySchema.extend({
  content_family: contentFamilySchema.optional(),
  parent_id: idSchema.optional(),
  root_only: z.coerce.boolean().optional(),
  node_type: categoryNodeTypeSchema.optional()
});

export const createCategorySchema = z.object({
  content_family: contentFamilySchema,
  parent_id: idSchema.nullable().optional(),
  node_type: categoryNodeTypeSchema,
  name: z.string().trim().min(1),
  slug: slugSchema,
  description: z.string().trim().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const bulkCreateCategorySchema = z.object({
  categories: z.array(createCategorySchema).min(1).max(200)
});

export const updateCategorySchema = z.object({
  parent_id: idSchema.nullable().optional(),
  node_type: categoryNodeTypeSchema.optional(),
  name: z.string().trim().min(1).optional(),
  slug: slugSchema.optional(),
  description: z.string().trim().nullable().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const bulkReassignCategorySchema = z.object({
  category_ids: z.array(idSchema).min(1).max(200),
  parent_id: idSchema.nullable(),
  node_type: categoryNodeTypeSchema.optional()
});

export type ListCategoriesQuery = z.output<typeof listCategoriesQuerySchema>;
export type CreateCategoryInput = z.output<typeof createCategorySchema>;
export type BulkCreateCategoryInput = z.output<typeof bulkCreateCategorySchema>;
export type UpdateCategoryInput = z.output<typeof updateCategorySchema>;
export type BulkReassignCategoryInput = z.output<typeof bulkReassignCategorySchema>;
