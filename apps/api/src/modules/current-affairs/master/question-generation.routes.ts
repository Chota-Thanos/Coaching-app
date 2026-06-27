import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { requireAdminOrEditor } from "../../auth/guards.js";
import { generateAssessmentQuestionsSchema } from "../schemas.js";
import {
  generateAssessmentQuestionsFromArticle,
  listQuestionGenerationJobs
} from "./question-generation.service.js";

export async function registerCurrentAffairsQuestionGenerationRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/current-affairs/articles/:id/question-generation-jobs", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      return listQuestionGenerationJobs(params.id);
    });
  });

  server.post("/api/v1/current-affairs/articles/:id/question-generation", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(generateAssessmentQuestionsSchema, request.body);
      const record = await generateAssessmentQuestionsFromArticle(params.id, body, user.id);
      if (!record) return reply.notFound("Article not found.");
      return reply.status(201).send(record);
    });
  });
}
