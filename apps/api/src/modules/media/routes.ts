import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor } from "../auth/guards.js";
import { listMediaAssetsQuerySchema } from "./schemas.js";
import { deleteMediaAsset, listMediaAssets, saveUploadedMedia } from "./service.js";

function multipartFieldValue(file: MultipartFile, name: string): string | undefined {
  const field = file.fields[name];
  const item = Array.isArray(field) ? field[0] : field;
  if (!item || item.type !== "field") return undefined;
  if (typeof item.value === "string") return item.value;
  if (item.value === null || item.value === undefined) return undefined;
  return String(item.value);
}

export async function registerMediaRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/v1/media/upload", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const file = await request.file();
      if (!file) return reply.badRequest("File is required.");

      const asset = await saveUploadedMedia(file, user.id, {
        usage_scope: multipartFieldValue(file, "usage_scope"),
        alt_text: multipartFieldValue(file, "alt_text"),
        caption: multipartFieldValue(file, "caption")
      });

      return reply.status(201).send(asset);
    });
  });

  server.get("/api/v1/media/assets", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const query = parse(listMediaAssetsQuerySchema, request.query);
      return listMediaAssets(query);
    });
  });

  server.delete("/api/v1/media/assets/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const success = await deleteMediaAsset(params.id);
      if (!success) return reply.notFound("Media asset not found.");
      return { success: true };
    });
  });
}
