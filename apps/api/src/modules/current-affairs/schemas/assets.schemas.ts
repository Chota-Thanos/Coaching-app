import { z } from "zod";
import { listQuerySchema } from "../../../common/http.js";

export const articleAssetTypeSchema = z.enum(["image", "thumbnail", "pdf", "source_file", "audio", "other"]);

export const listArticleAssetsQuerySchema = listQuerySchema.extend({
  asset_type: articleAssetTypeSchema.optional()
});

export const createArticleAssetSchema = z.object({
  asset_type: articleAssetTypeSchema.default("image"),
  file_name: z.string().trim().min(1),
  file_url: z.string().url(),
  mime_type: z.string().trim().optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  alt_text: z.string().trim().optional(),
  caption: z.string().trim().optional(),
  metadata: z.record(z.unknown()).optional(),
  display_order: z.number().int().optional()
});

export const updateArticleAssetSchema = z.object({
  asset_type: articleAssetTypeSchema.optional(),
  file_name: z.string().trim().min(1).optional(),
  file_url: z.string().url().optional(),
  mime_type: z.string().trim().nullable().optional(),
  size_bytes: z.number().int().nonnegative().nullable().optional(),
  alt_text: z.string().trim().nullable().optional(),
  caption: z.string().trim().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  display_order: z.number().int().optional()
});

export type ListArticleAssetsQuery = z.output<typeof listArticleAssetsQuerySchema>;
export type CreateArticleAssetInput = z.output<typeof createArticleAssetSchema>;
export type UpdateArticleAssetInput = z.output<typeof updateArticleAssetSchema>;
