import { z } from "zod";
import { listQuerySchema } from "../../../common/http.js";
import {
  contentFamilySchema,
  idSchema,
  masterArticleKindSchema,
  masterArticleStatusSchema,
  slugSchema
} from "./base.js";

export const listMasterArticlesQuerySchema = listQuerySchema.extend({
  content_family: contentFamilySchema.optional(),
  content_kind: masterArticleKindSchema.optional(),
  status: masterArticleStatusSchema.optional(),
  category_node_id: idSchema.optional(),
  include_descendants: z.coerce.boolean().default(false),
  from_date: z.string().date().optional(),
  to_date: z.string().date().optional(),
  search: z.string().trim().min(1).optional(),
  tag: z.string().trim().min(1).optional(),
  source_name: z.string().trim().min(1).optional(),
  has_assets: z.coerce.boolean().optional()
});

export const frontendArticleListQuerySchema = z.object({
  content_kind: masterArticleKindSchema,
  category: z.string().trim().min(1).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(30).default(12)
});

export const frontendArticleFiltersQuerySchema = z.object({
  content_kind: masterArticleKindSchema,
  content_family: contentFamilySchema.optional()
});

export const createMasterArticleSchema = z.object({
  content_family: contentFamilySchema.optional(),
  content_kind: masterArticleKindSchema,
  title: z.string().trim().min(1),
  slug: slugSchema,
  body: z.string().trim().min(1),
  body_json: z.record(z.unknown()).optional(),
  category_node_id: idSchema.optional(),
  source_name: z.string().trim().optional(),
  source_url: z.string().url().optional(),
  publication_date: z.string().date().optional(),
  institute_tags: z.array(z.string().trim().min(1)).optional(),
  status: masterArticleStatusSchema.optional(),
  is_ai_generated: z.boolean().optional(),
  seo_title: z.string().trim().optional(),
  seo_description: z.string().trim().optional(),
  canonical_url: z.string().trim().optional(),
  keywords: z.array(z.string().trim()).optional()
});

export const updateMasterArticleSchema = createMasterArticleSchema.partial().extend({
  category_node_id: idSchema.nullable().optional(),
  source_name: z.string().trim().nullable().optional(),
  source_url: z.string().url().nullable().optional(),
  publication_date: z.string().date().nullable().optional(),
  seo_title: z.string().trim().nullable().optional(),
  seo_description: z.string().trim().nullable().optional(),
  canonical_url: z.string().trim().nullable().optional(),
  keywords: z.array(z.string().trim()).nullable().optional()
});

export const relationTypeSchema = z.enum([
  "related_reference",
  "base_current_affairs",
  "imported_source",
  "follow_up",
  "prerequisite",
  "mains_fodder",
  "pyq_context"
]);

export const createArticleRelationSchema = z.object({
  target_article_id: idSchema,
  relation_type: relationTypeSchema.default("related_reference"),
  label: z.string().trim().optional(),
  note: z.string().trim().optional(),
  display_order: z.number().int().optional()
});

export const updateArticleRelationSchema = z.object({
  relation_type: relationTypeSchema.optional(),
  label: z.string().trim().nullable().optional(),
  note: z.string().trim().nullable().optional(),
  display_order: z.number().int().optional()
});

export const createArticleSectionSchema = z.object({
  heading: z.string().trim().min(1),
  slug: slugSchema,
  body: z.string().default(""),
  body_json: z.record(z.unknown()).optional(),
  seo_title: z.string().trim().optional(),
  seo_description: z.string().trim().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const updateArticleSectionSchema = z.object({
  heading: z.string().trim().min(1).optional(),
  slug: slugSchema.optional(),
  body: z.string().optional(),
  body_json: z.record(z.unknown()).optional(),
  seo_title: z.string().trim().nullable().optional(),
  seo_description: z.string().trim().nullable().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const sectionSourceRelationTypeSchema = z.enum([
  "imported_source",
  "base_current_affairs",
  "reference",
  "case_study",
  "example"
]);

export const addArticleSectionSourceSchema = z.object({
  source_article_id: idSchema,
  relation_type: sectionSourceRelationTypeSchema.default("imported_source"),
  note: z.string().trim().optional(),
  display_order: z.number().int().optional()
});

export const categoryPageQuerySchema = listQuerySchema.extend({
  include_descendants: z.coerce.boolean().default(true),
  content_kind: masterArticleKindSchema.optional(),
  from_date: z.string().date().optional(),
  to_date: z.string().date().optional()
});

export const searchCurrentAffairsQuerySchema = listQuerySchema.extend({
  q: z.string().trim().min(1),
  content_family: contentFamilySchema.optional(),
  content_kind: masterArticleKindSchema.optional(),
  category_node_id: idSchema.optional(),
  include_descendants: z.coerce.boolean().default(false),
  include_sections: z.coerce.boolean().default(true),
  from_date: z.string().date().optional(),
  to_date: z.string().date().optional(),
  tag: z.string().trim().min(1).optional(),
  source_name: z.string().trim().min(1).optional()
});

export type ListMasterArticlesQuery = z.output<typeof listMasterArticlesQuerySchema>;
export type FrontendArticleListQuery = z.output<typeof frontendArticleListQuerySchema>;
export type FrontendArticleFiltersQuery = z.output<typeof frontendArticleFiltersQuerySchema>;
export type CreateMasterArticleInput = z.output<typeof createMasterArticleSchema>;
export type UpdateMasterArticleInput = z.output<typeof updateMasterArticleSchema>;
export type CreateArticleRelationInput = z.output<typeof createArticleRelationSchema>;
export type UpdateArticleRelationInput = z.output<typeof updateArticleRelationSchema>;
export type CreateArticleSectionInput = z.output<typeof createArticleSectionSchema>;
export type UpdateArticleSectionInput = z.output<typeof updateArticleSectionSchema>;
export type AddArticleSectionSourceInput = z.output<typeof addArticleSectionSourceSchema>;
export type CategoryPageQuery = z.output<typeof categoryPageQuerySchema>;
export type SearchCurrentAffairsQuery = z.output<typeof searchCurrentAffairsQuerySchema>;
