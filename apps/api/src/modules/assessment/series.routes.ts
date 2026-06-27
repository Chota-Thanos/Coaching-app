import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor } from "../auth/guards.js";
import {
  addTestSeriesItemSchema,
  createTestSeriesSchema,
  listTestSeriesQuerySchema,
  updateTestSeriesItemSchema,
  updateTestSeriesSchema
} from "./series.schemas.js";
import {
  addTestSeriesItem,
  createTestSeries,
  deleteTestSeriesItem,
  getTestSeries,
  listTestSeries,
  updateTestSeries,
  updateTestSeriesItem
} from "./series.service.js";

export async function registerTestSeriesRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/assessment/test-series", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(listTestSeriesQuerySchema, request.query);
      return listTestSeries(query);
    });
  });

  server.post("/api/v1/assessment/test-series", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createTestSeriesSchema, request.body);
      const record = await createTestSeries(body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/assessment/test-series/:id", async (request, reply) => {
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getTestSeries(params.id);
      if (!record) return reply.notFound("Test series not found.");
      return record;
    });
  });

  server.patch("/api/v1/assessment/test-series/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateTestSeriesSchema, request.body);
      const record = await updateTestSeries(params.id, body);
      if (!record) return reply.notFound("Test series not found.");
      return record;
    });
  });

  server.post("/api/v1/assessment/test-series/:id/items", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(addTestSeriesItemSchema, request.body);
      const record = await addTestSeriesItem(params.id, body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/assessment/test-series-items/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateTestSeriesItemSchema, request.body);
      const record = await updateTestSeriesItem(params.id, body);
      if (!record) return reply.notFound("Test series item not found.");
      return record;
    });
  });

  server.delete("/api/v1/assessment/test-series-items/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteTestSeriesItem(params.id);
      if (!record) return reply.notFound("Test series item not found.");
      return record;
    });
  });
}
