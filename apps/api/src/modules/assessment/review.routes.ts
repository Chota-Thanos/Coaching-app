import type { FastifyInstance } from "fastify";
import { idParamSchema, listQuerySchema, parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor, requireAuth } from "../auth/guards.js";
import {
  createBookmarkSchema,
  createErrorLogSchema,
  createErrorTypeSchema,
  updateErrorTypeSchema
} from "./review.schemas.js";
import {
  createBookmark,
  deleteBookmark,
  createErrorLog,
  createErrorType,
  getDashboardAnalytics,
  getStudentCategoryPerformance,
  getStudentPerformanceTree,
  getStudentTopicMetrics,
  listBookmarks,
  listErrorLogs,
  listErrorTypes,
  updateErrorType
} from "./review.service.js";

export async function registerReviewRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/assessment/error-types", async () => {
    return listErrorTypes();
  });

  server.post("/api/v1/assessment/error-types", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createErrorTypeSchema, request.body);
      const record = await createErrorType(body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/assessment/error-types/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateErrorTypeSchema, request.body);
      const record = await updateErrorType(params.id, body);
      if (!record) return reply.notFound("Error type not found.");
      return record;
    });
  });

  server.get("/api/v1/assessment/me/bookmarks", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const query = parse(listQuerySchema, request.query);
      return listBookmarks(user.id, query);
    });
  });

  server.post("/api/v1/assessment/me/bookmarks", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(createBookmarkSchema, request.body);
      const record = await createBookmark(user.id, body);
      return reply.status(201).send(record);
    });
  });
  server.delete("/api/v1/assessment/me/bookmarks/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      await deleteBookmark(user.id, params.id);
      return reply.status(200).send({ success: true });
    });
  });

  server.get("/api/v1/assessment/me/error-logs", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const query = parse(listQuerySchema, request.query);
      return listErrorLogs(user.id, query);
    });
  });

  server.post("/api/v1/assessment/me/error-logs", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(createErrorLogSchema, request.body);
      const record = await createErrorLog(user.id, body);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/assessment/me/dashboard", async (request) => {
    const user = await requireAuth(request);
    return getDashboardAnalytics(user.id);
  });

  server.get("/api/v1/assessment/me/topic-metrics", async (request) => {
    const user = await requireAuth(request);
    return getStudentTopicMetrics(user.id);
  });

  server.get("/api/v1/assessment/me/performance-tree", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const query = request.query as { content_type?: string };
      const contentType = query?.content_type === "aptitude" ? "aptitude" : "gk";
      return getStudentPerformanceTree(user.id, contentType);
    });
  });

  server.get("/api/v1/assessment/me/categories/:id/performance", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const query = request.query as any;
      const record = await getStudentCategoryPerformance(user.id, params.id, query?.content_type);
      if (!record) return reply.notFound("Category performance not found.");
      return record;
    });
  });
}
