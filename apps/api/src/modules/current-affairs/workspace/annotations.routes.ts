import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { requireAuth } from "../../auth/guards.js";
import {
  createHighlightSchema,
  createNoteSchema,
  updateHighlightSchema,
  updateNoteSchema
} from "../schemas.js";
import {
  createHighlight,
  createNote,
  deleteHighlight,
  deleteNote,
  updateHighlight,
  updateNote
} from "./annotations.service.js";

export async function registerCurrentAffairsAnnotationRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/v1/current-affairs/me/forks/:id/highlights", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(createHighlightSchema, request.body);
      const record = await createHighlight(params.id, body, user.id);
      if (!record) return reply.notFound("Fork not found.");
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/current-affairs/me/highlights/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateHighlightSchema, request.body);
      const record = await updateHighlight(params.id, body, user.id);
      if (!record) return reply.notFound("Highlight not found.");
      return record;
    });
  });

  server.delete("/api/v1/current-affairs/me/highlights/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteHighlight(params.id, user.id);
      if (!record) return reply.notFound("Highlight not found.");
      return record;
    });
  });

  server.post("/api/v1/current-affairs/me/forks/:id/notes", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(createNoteSchema, request.body);
      const record = await createNote(params.id, body, user.id);
      if (!record) return reply.notFound("Fork not found.");
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/current-affairs/me/notes/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateNoteSchema, request.body);
      const record = await updateNote(params.id, body, user.id);
      if (!record) return reply.notFound("Note not found.");
      return record;
    });
  });

  server.delete("/api/v1/current-affairs/me/notes/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteNote(params.id, user.id);
      if (!record) return reply.notFound("Note not found.");
      return record;
    });
  });
}
