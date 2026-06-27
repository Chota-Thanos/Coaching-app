import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { requireAdminOrEditor } from "../../auth/guards.js";
import {
  createArticleAsset,
  deleteArticleAsset,
  listArticleAssets,
  updateArticleAsset
} from "./assets.service.js";
import {
  createArticleAssetSchema,
  listArticleAssetsQuerySchema,
  updateArticleAssetSchema
} from "../schemas.js";

export async function registerCurrentAffairsAssetRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/current-affairs/articles/:id/assets", async (request, reply) => {
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const query = parse(listArticleAssetsQuerySchema, request.query);
      return listArticleAssets(params.id, query);
    });
  });

  server.post("/api/v1/current-affairs/articles/:id/assets", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(createArticleAssetSchema, request.body);
      const record = await createArticleAsset(params.id, body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/current-affairs/article-assets/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateArticleAssetSchema, request.body);
      const record = await updateArticleAsset(params.id, body);
      if (!record) return reply.notFound("Article asset not found.");
      return record;
    });
  });

  server.delete("/api/v1/current-affairs/article-assets/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteArticleAsset(params.id);
      if (!record) return reply.notFound("Article asset not found.");
      return record;
    });
  });
}
