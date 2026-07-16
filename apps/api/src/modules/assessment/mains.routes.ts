import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor, requireAuth, requireEvaluator } from "../auth/guards.js";
import { draftMainsQuestionAI, performOcrGemini } from "../current-affairs/master/ai.service.js";
import { getUserEntitlements } from "../billing/service.js";
import { query } from "../../db.js";
import {
  createMainsQuestionSchema,
  createMainsTaxonomyNodeSchema,
  evaluateMainsAnswerSchema,
  addMainsQuestionVersionSchema,
  listMainsEvaluationQueueQuerySchema,
  listMainsQuestionsQuerySchema,
  listMainsTaxonomyQuerySchema,
  submitMainsAnswerSchema,
  updateMainsQuestionSchema,
  updateMainsTaxonomyNodeSchema,
  mainsOCRRequestSchema
} from "./mains.schemas.js";
import {
  addMainsQuestionVersion,
  createMainsQuestion,
  createMainsTaxonomyNode,
  evaluateMainsAnswer,
  listMainsEvaluationQueue,
  getMainsQuestion,
  listMainsQuestions,
  listMainsTaxonomyNodes,
  submitMainsAnswer,
  updateMainsQuestion,
  updateMainsTaxonomyNode,
  deleteMainsQuestion,
  deleteMainsTaxonomyNode,
  evaluateMainsAnswerWithAI
} from "./mains.service.js";

export async function registerMainsAssessmentRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/assessment/mains/taxonomy-nodes", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(listMainsTaxonomyQuerySchema, request.query);
      return listMainsTaxonomyNodes(query);
    });
  });

  server.post("/api/v1/assessment/mains/taxonomy-nodes", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createMainsTaxonomyNodeSchema, request.body);
      const record = await createMainsTaxonomyNode(body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/assessment/mains/taxonomy-nodes/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateMainsTaxonomyNodeSchema, request.body);
      const record = await updateMainsTaxonomyNode(params.id, body);
      if (!record) return reply.notFound("Mains taxonomy node not found.");
      return record;
    });
  });

  server.get("/api/v1/assessment/mains/questions", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(listMainsQuestionsQuerySchema, request.query);
      return listMainsQuestions(query);
    });
  });

  server.post("/api/v1/assessment/mains/questions", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createMainsQuestionSchema, request.body);
      const record = await createMainsQuestion(body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/assessment/mains/questions/:id", async (request, reply) => {
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getMainsQuestion(params.id);
      if (!record) return reply.notFound("Mains question not found.");
      return record;
    });
  });

  server.patch("/api/v1/assessment/mains/questions/:id", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateMainsQuestionSchema, request.body);
      const record = await updateMainsQuestion(params.id, body, user.id);
      if (!record) return reply.notFound("Mains question not found.");
      return record;
    });
  });

  server.post("/api/v1/assessment/mains/questions/:id/versions", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(addMainsQuestionVersionSchema, request.body);
      const record = await addMainsQuestionVersion(params.id, body, user.id);
      if (!record) return reply.notFound("Mains question not found.");
      return reply.status(201).send(record);
    });
  });

  server.post("/api/v1/assessment/mains/answers", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(submitMainsAnswerSchema, request.body);
      const record = await submitMainsAnswer(body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/assessment/mains/my-answers", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const queryParams = request.query as Record<string, unknown> | undefined;
      const questionVersionId = queryParams?.question_version_id ? Number(queryParams.question_version_id) : undefined;

      let sql = `
        select maa.*, 
               qv.question_id,
               qv.question_statement,
               qv.question_prompt,
               mqtl.paper_node_id,
               mtn.name as paper_name,
               tr.id as result_id
        from assessment.mains_answer_attempts maa
        join assessment.question_versions qv on qv.id = maa.question_version_id
        left join assessment.mains_question_taxonomy_links mqtl on mqtl.question_id = qv.question_id
        left join assessment.mains_taxonomy_nodes mtn on mtn.id = mqtl.paper_node_id
        left join assessment.test_results tr on tr.attempt_id = maa.attempt_id
        where maa.user_id = $1
      `;
      const params: unknown[] = [user.id];

      if (questionVersionId) {
        params.push(questionVersionId);
        sql += ` and maa.question_version_id = $2`;
      }

      sql += ` order by maa.submitted_at desc limit 50`;

      const records = await query(sql, params);
      return records;
    });
  });

  server.get("/api/v1/assessment/mains/evaluation-queue", async (request, reply) => {
    await requireEvaluator(request);
    return withValidation(reply, async () => {
      const query = parse(listMainsEvaluationQueueQuerySchema, request.query);
      return listMainsEvaluationQueue(query);
    });
  });

  server.patch("/api/v1/assessment/mains/answers/:id/evaluation", async (request, reply) => {
    const params = parse(idParamSchema, request.params);
    let user;
    try {
      user = await requireEvaluator(request);
    } catch (err) {
      user = await requireAuth(request);
      const attempts = await query<{ user_id: number }>(
        "select user_id from assessment.mains_answer_attempts where id = $1",
        [params.id]
      );
      const attempt = attempts[0];
      if (!attempt || Number(attempt.user_id) !== Number(user.id)) {
        throw err;
      }
    }

    return withValidation(reply, async () => {
      const body = parse(evaluateMainsAnswerSchema, request.body);
      const record = await evaluateMainsAnswer(params.id, body, user.id);
      if (!record) return reply.notFound("Mains answer attempt not found.");
      return record;
    });
  });

  server.delete("/api/v1/assessment/mains/taxonomy-nodes/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const success = await deleteMainsTaxonomyNode(params.id);
      if (!success) return reply.notFound("Mains taxonomy node not found.");
      return { success: true };
    });
  });

  server.delete("/api/v1/assessment/mains/questions/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const success = await deleteMainsQuestion(params.id);
      if (!success) return reply.notFound("Mains question not found.");
      return { success: true };
    });
  });

  server.post("/api/v1/assessment/mains/answers/:id/ai-evaluate", async (request, reply) => {
    const user = await requireAuth(request);
    // AI-based answer review is a paid feature — free users can create and take
    // Mains tests, but reviewing answers with AI requires Premium.
    const entitlements = await getUserEntitlements(user.id);
    const canAiEvaluate = entitlements.some(
      (e) => e.entitlement_key === "assessment.ai_evaluation" || e.entitlement_key === "assessment.premium_tests"
    );
    if (!canAiEvaluate) {
      return reply.status(403).send({
        error: "ai_evaluation_requires_premium",
        message: "AI-based answer evaluation requires an Assessment Premium subscription."
      });
    }
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await evaluateMainsAnswerWithAI(params.id, user.id);
      return record;
    });
  });

  server.get("/api/v1/assessment/mains/attempts/:attemptId/answers", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(
        z.object({ attemptId: z.coerce.number().int().positive() }),
        request.params
      );
      const records = await query(
        `
          select *
          from assessment.mains_answer_attempts
          where attempt_id = $1
            and user_id = $2
          order by submitted_at asc
        `,
        [params.attemptId, user.id]
      );
      return records;
    });
  });

  server.post("/api/v1/assessment/admin/ai/draft-mains-question", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = request.body as {
        topic: string;
        instructions?: string;
        ai_provider?: string;
        ai_model?: string;
        style_profile_id?: number;
      };

      if (!body.topic) {
        return reply.badRequest("topic is required.");
      }

      return draftMainsQuestionAI({
        topic: body.topic,
        instructions: body.instructions,
        aiProvider: body.ai_provider,
        aiModel: body.ai_model,
        styleProfileId: body.style_profile_id
      });
    });
  });

  server.post("/api/v1/assessment/mains/ocr", async (request, reply) => {
    await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(mainsOCRRequestSchema, request.body);
      const extractedText = await performOcrGemini(body.images_base64);
      return { extracted_text: extractedText };
    });
  });
}
