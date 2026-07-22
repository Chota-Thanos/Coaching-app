import type { FastifyInstance } from "fastify";
import { parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor } from "../auth/guards.js";
import {
  assessmentExtractSourceSchema,
  parseAssessmentAgentSchema,
  commitAssessmentAgentSchema
} from "./posting-agent.schemas.js";
import { extractFromDocument, extractFromUrl } from "../current-affairs/master/extraction.service.js";
import { parseAssessmentAgent } from "./posting-agent.service.js";
import { commitAssessmentAgent } from "./posting-agent-commit.service.js";

export async function registerAssessmentPostingAgentRoutes(server: FastifyInstance): Promise<void> {
  // Extract raw text from a Word/PDF/image upload or a URL (shared extractor).
  server.post("/api/v1/assessment/admin/agent/extract", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(assessmentExtractSourceSchema, request.body);
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

  // Parse: extract → parseQuizAI → classify into the full taxonomy tree.
  server.post("/api/v1/assessment/admin/agent/parse", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(parseAssessmentAgentSchema, request.body);
      return parseAssessmentAgent(body);
    });
  });

  // Commit: post the reviewed questions (auto-publish or save as drafts for review).
  server.post("/api/v1/assessment/admin/agent/commit", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(commitAssessmentAgentSchema, request.body);
      const result = await commitAssessmentAgent(body, user.id);
      return reply.status(201).send(result);
    });
  });
}
