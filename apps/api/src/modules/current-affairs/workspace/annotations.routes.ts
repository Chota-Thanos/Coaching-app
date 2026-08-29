import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { requireAuth } from "../../auth/guards.js";
import { assertCanAddHighlight, assertCanAddNote } from "../../billing/free-tier.js";
import {
  createHighlightSchema,
  createNoteSchema,
  updateHighlightSchema,
  updateNoteSchema
} from "../schemas.js";
import { annotationFacets, createHighlight, createNote, deleteHighlight, deleteNote, listAnnotations, updateHighlight, updateNote } from "./annotations.service.js";

export async function registerCurrentAffairsAnnotationRoutes(server: FastifyInstance): Promise<void> {
  // Every highlight and margin note across every article. Both tables were
  // reachable only through a single fork's detail response, so a term's worth
  // of highlighting could not be reviewed without reopening each article.
  server.get("/api/v1/current-affairs/me/annotations", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const raw = (request.query ?? {}) as Record<string, string | undefined>;
      const limit = Math.min(Math.max(Number(raw.limit ?? 100) || 100, 1), 300);
      const offset = Math.max(Number(raw.offset ?? 0) || 0, 0);
      return listAnnotations(user.id, {
        collection_id: raw.collection_id ? Number(raw.collection_id) : undefined,
        color: raw.color?.trim() || undefined,
        tag: raw.tag?.trim() || undefined,
        kind: raw.kind?.trim() || undefined,
        with_note: raw.with_note === "true",
        search: raw.search?.trim() || undefined,
        limit,
        offset
      });
    });
  });

  server.get("/api/v1/current-affairs/me/annotation-facets", async (request) => {
    const user = await requireAuth(request);
    return annotationFacets(user.id);
  });

  server.post("/api/v1/current-affairs/me/forks/:id/highlights", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      await assertCanAddHighlight(user.id, params.id);
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
      await assertCanAddNote(user.id, params.id);
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
