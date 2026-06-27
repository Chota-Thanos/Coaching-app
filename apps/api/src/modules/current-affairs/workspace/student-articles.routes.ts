import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { requireAuth } from "../../auth/guards.js";
import {
  createStudentArticleSchema,
  listStudentArticlesQuerySchema,
  updateStudentArticleSchema
} from "../schemas.js";
import {
  createStudentArticle,
  deleteStudentArticle,
  getStudentArticle,
  listStudentArticles,
  updateStudentArticle
} from "./student-articles.service.js";

export async function registerCurrentAffairsStudentArticleRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/current-affairs/me/articles", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const query = parse(listStudentArticlesQuerySchema, request.query);
      return listStudentArticles(user.id, query);
    });
  });

  server.post("/api/v1/current-affairs/me/articles", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(createStudentArticleSchema, request.body);
      const record = await createStudentArticle(body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/current-affairs/me/articles/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getStudentArticle(params.id, user.id);
      if (!record) return reply.notFound("Student article not found.");
      return record;
    });
  });

  server.patch("/api/v1/current-affairs/me/articles/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateStudentArticleSchema, request.body);
      const record = await updateStudentArticle(params.id, body, user.id);
      if (!record) return reply.notFound("Student article not found.");
      return record;
    });
  });

  server.delete("/api/v1/current-affairs/me/articles/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteStudentArticle(params.id, user.id);
      if (!record) return reply.notFound("Student article not found.");
      return record;
    });
  });
}
