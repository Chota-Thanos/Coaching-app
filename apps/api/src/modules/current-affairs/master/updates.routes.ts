import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { requireAdminOrEditor } from "../../auth/guards.js";
import {
  createArticleUpdate,
  deleteArticleUpdate,
  listArticleUpdates
} from "./updates.service.js";
import { createArticleUpdateSchema } from "../schemas.js";

export async function registerCurrentAffairsUpdateRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/current-affairs/articles/:id/updates", async (request, reply) => {
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      return listArticleUpdates(params.id);
    });
  });

  server.post("/api/v1/current-affairs/articles/:id/updates", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(createArticleUpdateSchema, request.body);
      const record = await createArticleUpdate(params.id, body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.delete("/api/v1/current-affairs/article-updates/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteArticleUpdate(params.id);
      if (!record) return reply.notFound("Article update not found.");
      return record;
    });
  });
}
