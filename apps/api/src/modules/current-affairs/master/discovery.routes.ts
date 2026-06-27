import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { categoryPageQuerySchema, searchCurrentAffairsQuerySchema } from "../schemas.js";
import { getCategoryPage } from "./category-pages.service.js";
import { searchCurrentAffairs } from "./search.service.js";

export async function registerCurrentAffairsDiscoveryRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/current-affairs/search", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(searchCurrentAffairsQuerySchema, request.query);
      return searchCurrentAffairs(query);
    });
  });

  server.get("/api/v1/current-affairs/categories/:id/page", async (request, reply) => {
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const query = parse(categoryPageQuerySchema, request.query);
      const record = await getCategoryPage(params.id, query);
      if (!record) return reply.notFound("Category not found.");
      return record;
    });
  });
}
