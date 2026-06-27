import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor } from "../auth/guards.js";
import {
  createImportBatchSchema,
  listImportBatchesQuerySchema,
  publishImportItemSchema,
  updateImportItemSchema
} from "./imports.schemas.js";
import {
  createImportBatch,
  getImportBatch,
  listImportBatches,
  publishImportItem,
  updateImportItem
} from "./imports.service.js";

export async function registerQuestionImportRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/assessment/import-batches", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const query = parse(listImportBatchesQuerySchema, request.query);
      return listImportBatches(query);
    });
  });

  server.post("/api/v1/assessment/import-batches", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createImportBatchSchema, request.body);
      const record = await createImportBatch(body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/assessment/import-batches/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getImportBatch(params.id);
      if (!record) return reply.notFound("Import batch not found.");
      return record;
    });
  });

  server.patch("/api/v1/assessment/import-items/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateImportItemSchema, request.body);
      const record = await updateImportItem(params.id, body);
      if (!record) return reply.notFound("Import item not found.");
      return record;
    });
  });

  server.post("/api/v1/assessment/import-items/:id/publish", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(publishImportItemSchema, request.body ?? {});
      const record = await publishImportItem(params.id, body, user.id);
      if (!record) return reply.notFound("Import item not found.");
      return record;
    });
  });
}
