import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor, requireAuth } from "../auth/guards.js";
import {
  addQuestionVersionSchema,
  createPassageSchema,
  createQuestionSchema,
  listQuestionsQuerySchema,
  questionCountsQuerySchema,
  replaceQuestionTaxonomySchema,
  updatePassageSchema,
  updateQuestionAdminSchema,
  bulkUpdateQuestionsTaxonomySchema
} from "./schemas.js";
import {
  addQuestionVersion,
  createPassage,
  createQuestion,
  getPassage,
  getQuestion,
  listQuestionCountsByTaxonomy,
  listQuestions,
  replaceQuestionTaxonomy,
  updatePassage,
  updateQuestionAdmin,
  deleteQuestion,
  bulkUpdateQuestionsTaxonomy
} from "./questions.service.js";

export async function registerAssessmentQuestionRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/v1/assessment/passages", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createPassageSchema, request.body);
      const record = await createPassage(body);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/assessment/passages/:id", async (request, reply) => {
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getPassage(params.id);
      if (!record) return reply.notFound("Passage not found.");
      return record;
    });
  });

  server.patch("/api/v1/assessment/passages/:id", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updatePassageSchema, request.body);
      const record = await updatePassage(params.id, body, user.id);
      if (!record) return reply.notFound("Passage not found.");
      return record;
    });
  });

  server.get("/api/v1/assessment/questions", async (request, reply) => {
    let user = null;
    try {
      user = await requireAuth(request);
    } catch {
      // Allow anonymous
    }
    return withValidation(reply, async () => {
      const query = parse(listQuestionsQuerySchema, request.query);
      const isPrivileged = user ? ["admin", "moderator", "content_editor"].includes(user.role) : false;
      return listQuestions({
        ...query,
        user_id: user?.id,
        is_admin: isPrivileged
      });
    });
  });

  server.get("/api/v1/assessment/question-counts", async (request, reply) => {
    // Optional auth — anonymous gets public counts only; authenticated users also get their own private counts
    let userId: number | undefined;
    try {
      const user = await requireAuth(request);
      userId = user.id;
    } catch {
      // unauthenticated — user_id remains undefined
    }
    return withValidation(reply, async () => {
      const query = parse(questionCountsQuerySchema, request.query);
      return listQuestionCountsByTaxonomy({ ...query, user_id: userId });
    });
  });

  server.post("/api/v1/assessment/questions", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createQuestionSchema, request.body);
      const record = await createQuestion(body);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/assessment/questions/:id", async (request, reply) => {
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getQuestion(params.id);
      if (!record) return reply.notFound("Question not found.");
      return record;
    });
  });

  server.patch("/api/v1/assessment/questions/:id", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateQuestionAdminSchema, request.body);
      const record = await updateQuestionAdmin(params.id, body, user.id);
      if (!record) return reply.notFound("Question not found.");
      return record;
    });
  });

  server.post("/api/v1/assessment/questions/:id/versions", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(addQuestionVersionSchema, request.body);
      const record = await addQuestionVersion(params.id, body, user.id);
      if (!record) return reply.notFound("Question not found.");
      return reply.status(201).send(record);
    });
  });

  server.put("/api/v1/assessment/questions/:id/taxonomy", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(replaceQuestionTaxonomySchema, request.body);
      const record = await replaceQuestionTaxonomy(params.id, body);
      if (!record) return reply.notFound("Question not found.");
      return record;
    });
  });

  server.delete("/api/v1/assessment/questions/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteQuestion(params.id);
      if (!record) return reply.notFound("Question not found.");
      return record;
    });
  });

  server.post("/api/v1/assessment/admin/questions/bulk-taxonomy", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(bulkUpdateQuestionsTaxonomySchema, request.body);
      await bulkUpdateQuestionsTaxonomy(body, user.id);
      return { success: true };
    });
  });
}
