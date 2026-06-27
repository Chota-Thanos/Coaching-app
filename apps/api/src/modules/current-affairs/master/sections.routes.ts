import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { requireAdminOrEditor } from "../../auth/guards.js";
import {
  addArticleSectionSource,
  createArticleSection,
  deleteArticleSection,
  deleteArticleSectionSource,
  updateArticleSection
} from "./sections.service.js";
import {
  addArticleSectionSourceSchema,
  createArticleSectionSchema,
  updateArticleSectionSchema
} from "../schemas.js";

export async function registerCurrentAffairsSectionRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/v1/current-affairs/articles/:id/sections", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(createArticleSectionSchema, request.body);
      const record = await createArticleSection(params.id, body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/current-affairs/article-sections/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateArticleSectionSchema, request.body);
      const record = await updateArticleSection(params.id, body);
      if (!record) return reply.notFound("Article section not found.");
      return record;
    });
  });

  server.delete("/api/v1/current-affairs/article-sections/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteArticleSection(params.id);
      if (!record) return reply.notFound("Article section not found.");
      return record;
    });
  });

  server.post("/api/v1/current-affairs/article-sections/:id/sources", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(addArticleSectionSourceSchema, request.body);
      const record = await addArticleSectionSource(params.id, body);
      return reply.status(201).send(record);
    });
  });

  server.delete("/api/v1/current-affairs/article-section-sources/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteArticleSectionSource(params.id);
      if (!record) return reply.notFound("Article section source not found.");
      return record;
    });
  });
}
