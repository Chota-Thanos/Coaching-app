import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { requireAdminOrEditor } from "../../auth/guards.js";
import {
  createArticleRelation,
  deleteArticleRelation,
  listArticleRelations,
  updateArticleRelation
} from "./relations.service.js";
import {
  createArticleRelationSchema,
  updateArticleRelationSchema
} from "../schemas.js";

export async function registerCurrentAffairsRelationRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/current-affairs/articles/:id/relations", async (request, reply) => {
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      return listArticleRelations(params.id);
    });
  });

  server.post("/api/v1/current-affairs/articles/:id/relations", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(createArticleRelationSchema, request.body);
      const record = await createArticleRelation(params.id, body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/current-affairs/article-relations/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateArticleRelationSchema, request.body);
      const record = await updateArticleRelation(params.id, body);
      if (!record) return reply.notFound("Article relation not found.");
      return record;
    });
  });

  server.delete("/api/v1/current-affairs/article-relations/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteArticleRelation(params.id);
      if (!record) return reply.notFound("Article relation not found.");
      return record;
    });
  });
}
