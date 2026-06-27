import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { requireAdminOrEditor } from "../../auth/guards.js";
import {
  createIngestionJob,
  getIngestionJob,
  listIngestionJobs,
  publishIngestionItem,
  updateIngestionItem
} from "./ingestion.service.js";
import {
  createIngestionJobSchema,
  listIngestionJobsQuerySchema,
  updateIngestionItemSchema
} from "../schemas.js";

export async function registerCurrentAffairsIngestionRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/current-affairs/admin/ingestion-jobs", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const query = parse(listIngestionJobsQuerySchema, request.query);
      return listIngestionJobs(query);
    });
  });

  server.post("/api/v1/current-affairs/admin/ingestion-jobs", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createIngestionJobSchema, request.body);
      const record = await createIngestionJob(body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/current-affairs/admin/ingestion-jobs/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getIngestionJob(params.id);
      if (!record) return reply.notFound("Ingestion job not found.");
      return record;
    });
  });

  server.patch("/api/v1/current-affairs/admin/ingestion-items/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateIngestionItemSchema, request.body);
      const record = await updateIngestionItem(params.id, body);
      if (!record) return reply.notFound("Ingestion item not found.");
      return record;
    });
  });

  server.post("/api/v1/current-affairs/admin/ingestion-items/:id/publish", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await publishIngestionItem(params.id, user.id);
      if (!record) return reply.notFound("Ingestion item not found.");
      return record;
    });
  });
}
