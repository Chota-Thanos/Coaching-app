import type { FastifyInstance } from "fastify";
import { parse, withValidation } from "../../../common/http.js";
import { requireAdminOrEditor } from "../../auth/guards.js";
import {
  attachImageBytesSchema,
  insertBodyImageSchema,
  commitPostingAgentSchema,
  extractSourceSchema,
  parsePostingAgentSchema,
  rewordSchema
} from "../schemas.js";
import { extractFromDocument, extractFromUrl } from "./extraction.service.js";
import { parsePostingAgent } from "./posting-agent.service.js";
import { attachImageBytes, commitPostingAgent } from "./posting-agent-commit.service.js";
import { insertBodyImage } from "./body-image.service.js";
import { rewordText } from "./reword.service.js";

export async function registerCurrentAffairsPostingAgentRoutes(server: FastifyInstance): Promise<void> {
  // Phase 1 — extract raw text from a Word/PDF/image upload or a URL.
  server.post("/api/v1/current-affairs/admin/agent/extract", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(extractSourceSchema, request.body);
      if (body.kind === "url") {
        return extractFromUrl(body.url!);
      }
      return extractFromDocument({
        base64_data: body.base64_data!,
        mime_type: body.mime_type!,
        filename: body.filename
      });
    });
  });

  // Phase 2 — run the posting agent: segment, date-resolve, classify, normalise.
  server.post("/api/v1/current-affairs/admin/agent/parse", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(parsePostingAgentSchema, request.body);
      return parsePostingAgent(body);
    });
  });

  // Phase 3 — commit the reviewed candidates (auto-publish or stage for review).
  server.post("/api/v1/current-affairs/admin/agent/commit", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(commitPostingAgentSchema, request.body);
      const result = await commitPostingAgent(body, user.id);
      return reply.status(201).send(result);
    });
  });

  // Attach an actual image file (e.g. an AI-annotated picture) to an
  // already-committed article.
  server.post("/api/v1/current-affairs/admin/agent/attach-image", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(attachImageBytesSchema, request.body);
      const record = await attachImageBytes(body, user.id);
      return reply.status(201).send(record);
    });
  });

  // Place an image *inside* an article's body, between two blocks — the
  // counterpart to attach-image, which only sets the article's hero picture.
  server.post("/api/v1/current-affairs/admin/agent/insert-body-image", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(insertBodyImageSchema, request.body);
      const record = await insertBodyImage(body, user.id);
      return reply.status(201).send(record);
    });
  });

  // Phase 6 — reword a passage on demand for the editor.
  server.post("/api/v1/current-affairs/admin/agent/reword", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(rewordSchema, request.body);
      const rewritten = await rewordText(body);
      return { text: rewritten };
    });
  });
}
