import type { FastifyInstance } from "fastify";
import { idParamSchema, listQuerySchema, parse, withValidation } from "../../../common/http.js";
import { requireAuth } from "../../auth/guards.js";
import { forkArticleSchema, updateForkSchema } from "../schemas.js";
import { deleteFork, forkArticle, getFork, listForks, updateFork } from "./forks.service.js";

export async function registerCurrentAffairsForkRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/v1/current-affairs/articles/:id/fork", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(forkArticleSchema, request.body ?? {});
      const record = await forkArticle(params.id, body, user.id);
      if (!record) return reply.notFound("Published article not found.");
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/current-affairs/me/forks", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const query = parse(listQuerySchema, request.query);
      return listForks(user.id, query);
    });
  });

  server.get("/api/v1/current-affairs/me/forks/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getFork(params.id, user.id);
      if (!record) return reply.notFound("Fork not found.");
      return record;
    });
  });

  server.patch("/api/v1/current-affairs/me/forks/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateForkSchema, request.body);
      const record = await updateFork(params.id, body, user.id);
      if (!record) return reply.notFound("Fork not found.");
      return record;
    });
  });

  server.delete("/api/v1/current-affairs/me/forks/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteFork(params.id, user.id);
      if (!record) return reply.notFound("Fork not found.");
      return record;
    });
  });
}
