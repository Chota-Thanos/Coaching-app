import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { requireAuth } from "../../auth/guards.js";
import {
  readingDashboardQuerySchema,
  updateReadingProgressSchema
} from "../schemas.js";
import { getReadingDashboard, updateReadingProgress } from "./reading.service.js";

export async function registerCurrentAffairsReadingRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/current-affairs/me/reading-dashboard", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const query = parse(readingDashboardQuerySchema, request.query);
      return getReadingDashboard(user.id, query);
    });
  });

  server.put("/api/v1/current-affairs/me/forks/:id/progress", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateReadingProgressSchema, request.body);
      const record = await updateReadingProgress(params.id, body, user.id);
      if (!record) return reply.notFound("Fork not found.");
      return record;
    });
  });
}
