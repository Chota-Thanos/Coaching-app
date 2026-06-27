import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { requireAuth } from "../../auth/guards.js";
import {
  addCollectionItemSchema,
  createCollectionSchema,
  updateCollectionSchema
} from "../schemas.js";
import {
  addCollectionItem,
  createCollection,
  deleteCollection,
  deleteCollectionItem,
  getCollection,
  listCollections,
  updateCollection
} from "./collections.service.js";

export async function registerCurrentAffairsCollectionRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/current-affairs/me/collections", async (request) => {
    const user = await requireAuth(request);
    return listCollections(user.id);
  });

  server.get("/api/v1/current-affairs/me/collections/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getCollection(params.id, user.id);
      if (!record) return reply.notFound("Collection not found.");
      return record;
    });
  });

  server.post("/api/v1/current-affairs/me/collections", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(createCollectionSchema, request.body);
      const record = await createCollection(body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/current-affairs/me/collections/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateCollectionSchema, request.body);
      const record = await updateCollection(params.id, body, user.id);
      if (!record) return reply.notFound("Collection not found.");
      return record;
    });
  });

  server.delete("/api/v1/current-affairs/me/collections/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteCollection(params.id, user.id);
      if (!record) return reply.notFound("Collection not found.");
      return record;
    });
  });

  server.post("/api/v1/current-affairs/me/collections/:id/items", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(addCollectionItemSchema, request.body);
      const record = await addCollectionItem(params.id, body, user.id);
      if (!record) return reply.notFound("Collection not found.");
      return reply.status(201).send(record);
    });
  });

  server.delete("/api/v1/current-affairs/me/collection-items/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteCollectionItem(params.id, user.id);
      if (!record) return reply.notFound("Collection item not found.");
      return record;
    });
  });
}
