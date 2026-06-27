import { z } from "zod";

export const listMediaAssetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  usage_scope: z.string().trim().min(1).max(120).optional(),
  mime_family: z.enum(["image", "document"]).optional()
});

export type ListMediaAssetsQuery = z.infer<typeof listMediaAssetsQuerySchema>;
