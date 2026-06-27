import type { FastifyInstance } from "fastify";
import { parse, withValidation } from "../../../common/http.js";
import {
  frontendArticleFiltersQuerySchema,
  frontendArticleListQuerySchema,
  slugParamSchema
} from "../schemas.js";
import {
  getFrontendArticleFilters,
  getPublishedArticleBySlug,
  listFrontendArticles
} from "./frontend-read.service.js";

export async function registerCurrentAffairsFrontendReadRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/current-affairs/frontend/articles", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(frontendArticleListQuerySchema, request.query);
      return listFrontendArticles(query);
    });
  });

  server.get("/api/v1/current-affairs/frontend/filters", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(frontendArticleFiltersQuerySchema, request.query);
      return getFrontendArticleFilters(query);
    });
  });

  server.get("/api/v1/current-affairs/articles/slug/:slug", async (request, reply) => {
    return withValidation(reply, async () => {
      const params = parse(slugParamSchema, request.params);
      const record = await getPublishedArticleBySlug(params.slug);
      if (!record) return reply.notFound("Article not found.");
      return record;
    });
  });
}
