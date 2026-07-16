import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor, requireAuth, getOptionalAuth, getGuestToken } from "../auth/guards.js";
import {
  addTestQuestionItemSchema,
  attemptIdParamSchema,
  claimAttemptSchema,
  createTestSectionSchema,
  createTestTemplateSchema,
  leaderboardQuerySchema,
  listQuerySchema,
  listTestTemplatesQuerySchema,
  startAttemptSchema,
  submitAttemptSchema,
  testTemplateIdParamSchema,
  updateTestQuestionItemSchema,
  updateTestSectionSchema,
  updateTestTemplateSchema,
  upsertAttemptResponseSchema,
  listAttemptsQuerySchema,
  bulkUpdateTestTemplatesTaxonomySchema,
  startDynamicAttemptSchema,
  startCompiledAttemptSchema
} from "./schemas.js";
import {
  getAttempt,
  startAttempt,
  upsertAttemptResponse,
  startDynamicAttempt,
  startCompiledAttempt,
  startSingleMainsQuestionAttempt,
  claimGuestAttempt,
  type AttemptIdentity
} from "./attempts.service.js";
import { z } from "zod";
import {
  addTestQuestionItem,
  createTestSection,
  createTestTemplate,
  deleteTestQuestionItem,
  deleteTestTemplate,
  getTestTemplate,
  listTestTemplates,
  updateTestQuestionItem,
  updateTestSection,
  updateTestTemplate,
  createTestTemplateDraft,
  bulkUpdateTestTemplatesTaxonomy,
  createUserCustomTest,
  addQuestionsToUserTest
} from "./test-templates.service.js";
import { saveQuestionsDraft } from "./questions.service.js";
import { parseQuizAI, generateQuizzesAI, draftMainsQuestionAI } from "../current-affairs/master/ai.service.js";
import { extractTextFromImage, extractTextFromImages } from "./ocr.service.js";
import { getUserEntitlements } from "../billing/service.js";
import { getFreeTestUsage } from "./free-test-allowance.js";
import { one, query, transaction } from "../../db.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import mammoth from "mammoth";
 
import { getLeaderboard } from "./leaderboard.service.js";
import {
  getAttemptPaper,
  getResultReview,
  getTestPaper,
  listMyAttempts
} from "./paper.service.js";
import { getResultDetail } from "./results.service.js";
import { submitAttempt } from "./scoring.service.js";
import type { FastifyRequest } from "fastify";

async function resolveAttemptIdentity(request: FastifyRequest): Promise<AttemptIdentity> {
  const user = await getOptionalAuth(request);
  const guestToken = user ? null : getGuestToken(request);
  return { user, guestToken };
}

export async function registerAssessmentTestRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/assessment/test-templates", async (request, reply) => {
    const user = await getOptionalAuth(request);
    return withValidation(reply, async () => {
      const query = parse(listTestTemplatesQuerySchema, request.query);
      return listTestTemplates({
        ...query,
        user_id: user?.id,
        user_role: user?.role
      });
    });
  });

  server.post("/api/v1/assessment/test-templates", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createTestTemplateSchema, request.body);
      const record = await createTestTemplate(body);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/assessment/test-templates/:testTemplateId", async (request, reply) => {
    const user = await getOptionalAuth(request);
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const record = await getTestTemplate(params.testTemplateId, user?.id);
      if (!record) return reply.notFound("Test template not found.");
      
      const tt = record as any;
      if (tt.access_type === "private") {
        if (!user) {
          return reply.unauthorized("Authentication required for private tests.");
        }
        if (tt.created_by_user_id !== user.id && !["admin", "moderator", "content_editor"].includes(user.role)) {
          return reply.forbidden("You do not have permission to access this private test.");
        }
      }
      return record;
    });
  });

  server.get("/api/v1/assessment/test-templates/:testTemplateId/paper", async (request, reply) => {
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      let includeUnpublished = false;
      try {
        await requireAdminOrEditor(request);
        includeUnpublished = true;
      } catch {
        // Keep includeUnpublished = false for general users
      }
      const record = await getTestPaper(params.testTemplateId, includeUnpublished);
      if (!record) return reply.notFound("Test paper not found.");
      return record;
    });
  });

  server.patch("/api/v1/assessment/test-templates/:testTemplateId", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const body = parse(updateTestTemplateSchema, request.body);
      const record = await updateTestTemplate(params.testTemplateId, body);
      if (!record) return reply.notFound("Test template not found.");
      return record;
    });
  });

  server.delete("/api/v1/assessment/test-templates/:testTemplateId", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const record = await deleteTestTemplate(params.testTemplateId);
      if (!record) return reply.notFound("Test template not found.");
      return record;
    });
  });

  server.post("/api/v1/assessment/test-templates/:testTemplateId/sections", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const body = parse(createTestSectionSchema, request.body);
      const record = await createTestSection(params.testTemplateId, body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/assessment/test-sections/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateTestSectionSchema, request.body);
      const record = await updateTestSection(params.id, body);
      if (!record) return reply.notFound("Test section not found.");
      return record;
    });
  });

  server.post("/api/v1/assessment/test-templates/:testTemplateId/questions", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const body = parse(addTestQuestionItemSchema, request.body);
      const record = await addTestQuestionItem(params.testTemplateId, body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/assessment/test-question-items/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateTestQuestionItemSchema, request.body);
      const record = await updateTestQuestionItem(params.id, body);
      if (!record) return reply.notFound("Test question item not found.");
      return record;
    });
  });

  server.delete("/api/v1/assessment/test-question-items/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteTestQuestionItem(params.id);
      if (!record) return reply.notFound("Test question item not found.");
      return record;
    });
  });

  server.post("/api/v1/assessment/test-templates/:testTemplateId/attempts/start", async (request, reply) => {
    const identity = await resolveAttemptIdentity(request);
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const body = parse(startAttemptSchema, request.body ?? {});
      const record = await startAttempt(params.testTemplateId, body, identity);
      if (!record) return reply.notFound("Test template not found.");
      return reply.status(201).send(record);
    });
  });

  server.post("/api/v1/assessment/attempts/dynamic", async (request, reply) => {
    const user = await requireAuth(request);
    if (!(await requireFreeTestAllowance(user.id, reply))) return;
    return withValidation(reply, async () => {
      const body = parse(startDynamicAttemptSchema, request.body ?? {});
      const record = await startDynamicAttempt(user.id, body);
      return reply.status(201).send(record);
    });
  });

  server.post("/api/v1/assessment/attempts/compiled", async (request, reply) => {
    const user = await requireAuth(request);
    if (!(await requireFreeTestAllowance(user.id, reply))) return;
    return withValidation(reply, async () => {
      const body = parse(startCompiledAttemptSchema, request.body ?? {});
      const record = await startCompiledAttempt(user.id, body);
      return reply.status(201).send(record);
    });
  });

  server.post("/api/v1/assessment/attempts/mains-question", async (request, reply) => {
    const user = await requireAuth(request);
    if (!(await requireFreeTestAllowance(user.id, reply))) return;
    return withValidation(reply, async () => {
      const body = parse(
        z.object({ question_id: z.coerce.number().int().positive() }),
        request.body ?? {}
      );
      const record = await startSingleMainsQuestionAttempt(user.id, body.question_id);
      return reply.status(201).send(record);
    });
  });

  server.post("/api/v1/assessment/attempts/dynamic/generate", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = request.body as {
        exam_id: number;
        exam_level_id: number;
        subject_node_id: number;
        topic_node_id?: number | null;
        subtopic_node_id?: number | null;
        question_nature_id?: number | null;
        count?: number;
      };

      if (!body.exam_id || !body.exam_level_id || !body.subject_node_id) {
        return reply.badRequest("exam_id, exam_level_id, and subject_node_id are required.");
      }

      let subjectName = "General Knowledge";
      if (body.subject_node_id) {
        const node = await one<{ name: string }>(
          "select name from assessment.assessment_taxonomy_nodes where id = $1",
          [body.subject_node_id]
        );
        if (node) subjectName = node.name;
      }
      let topicName = "";
      if (body.topic_node_id) {
        const node = await one<{ name: string }>(
          "select name from assessment.assessment_taxonomy_nodes where id = $1",
          [body.topic_node_id]
        );
        if (node) topicName = node.name;
      }

      const prompt = `Generate a high quality objective multiple choice quiz on the UPSC subject: ${subjectName}${topicName ? ` (specifically on the topic: ${topicName})` : ""}. Please write multiple-choice questions with 4 options and provide correct answers and explanations.`;

      const generated = await generateQuizzesAI({
        quizType: "gk",
        prompt,
        aiProvider: "openai",
        aiModel: "gpt-4o-mini",
        count: body.count || 5
      });

      if (!generated || !generated.questions || generated.questions.length === 0) {
        return reply.badRequest("AI generation returned empty questions. Please try again.");
      }

      const savePayload = {
        exam_id: body.exam_id,
        exam_level_id: body.exam_level_id,
        subject_node_id: body.subject_node_id,
        topic_node_id: body.topic_node_id || null,
        subtopic_node_id: body.subtopic_node_id || null,
        passage_title: generated.passage_title,
        passage_text: generated.passage_text,
        status: "published" as const,
        questions: generated.questions.map((q: any) => ({
          ...q,
          question_nature_id: body.question_nature_id || null
        }))
      };

      await saveQuestionsDraft(savePayload, user.id);
      return reply.status(201).send({ success: true, count: generated.questions.length });
    });
  });

  server.get("/api/v1/assessment/attempts/:attemptId", async (request, reply) => {
    const identity = await resolveAttemptIdentity(request);
    return withValidation(reply, async () => {
      const params = parse(attemptIdParamSchema, request.params);
      const record = await getAttempt(params.attemptId, identity);
      if (!record) return reply.notFound("Attempt not found.");
      return record;
    });
  });

  server.get("/api/v1/assessment/attempts/:attemptId/paper", async (request, reply) => {
    const identity = await resolveAttemptIdentity(request);
    return withValidation(reply, async () => {
      const params = parse(attemptIdParamSchema, request.params);
      const record = await getAttemptPaper(params.attemptId, identity);
      if (!record) return reply.notFound("Attempt paper not found.");
      return record;
    });
  });

  server.get("/api/v1/assessment/me/attempts", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const query = parse(listAttemptsQuerySchema, request.query);
      return listMyAttempts(user.id, query);
    });
  });

  server.put("/api/v1/assessment/attempts/:attemptId/responses", async (request, reply) => {
    const identity = await resolveAttemptIdentity(request);
    return withValidation(reply, async () => {
      const params = parse(attemptIdParamSchema, request.params);
      const body = parse(upsertAttemptResponseSchema, request.body);
      return upsertAttemptResponse(params.attemptId, body, identity);
    });
  });

  server.post("/api/v1/assessment/attempts/:attemptId/submit", async (request, reply) => {
    const identity = await resolveAttemptIdentity(request);
    return withValidation(reply, async () => {
      const params = parse(attemptIdParamSchema, request.params);
      const body = parse(submitAttemptSchema, request.body);
      return submitAttempt(params.attemptId, body, identity);
    });
  });

  server.post("/api/v1/assessment/attempts/:attemptId/claim", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(attemptIdParamSchema, request.params);
      const body = parse(claimAttemptSchema, request.body);
      return claimGuestAttempt(params.attemptId, body.guest_token, user.id);
    });
  });

  server.get("/api/v1/assessment/leaderboard", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(leaderboardQuerySchema, request.query);
      return getLeaderboard(query);
    });
  });

  server.get("/api/v1/assessment/results/:id", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getResultDetail(params.id, user);
      if (!record) return reply.notFound("Result not found.");
      return record;
    });
  });

  server.get("/api/v1/assessment/results/:id/review", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getResultReview(params.id, user);
      if (!record) return reply.notFound("Result review not found.");
      return record;
    });
  });

  server.post("/api/v1/assessment/admin/ai/parse", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = request.body as {
        raw_text: string;
        ai_provider: string;
        ai_model: string;
        instructions?: string;
        content_type?: "gk" | "aptitude";
      };

      if (!body.raw_text) {
        return reply.badRequest("raw_text is required.");
      }

      return parseQuizAI({
        rawText: body.raw_text,
        aiProvider: body.ai_provider || "openai",
        aiModel: body.ai_model || "gpt-4o-mini",
        instructions: body.instructions,
        content_type: body.content_type
      });
    });
  });

  server.post("/api/v1/assessment/admin/ai/parse-questions", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = request.body as {
        raw_text: string;
        content_type?: "gk" | "aptitude";
        exam_id?: number;
        instructions?: string;
      };

      if (!body.raw_text) {
        return reply.badRequest("raw_text is required.");
      }

      return parseQuizAI({
        rawText: body.raw_text,
        aiProvider: "openai",
        aiModel: "gpt-4o-mini",
        instructions: body.instructions,
        content_type: body.content_type
      });
    });
  });

  server.post("/api/v1/assessment/admin/ai/parse-file", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = request.body as {
        base64_data: string;
        filename: string;
        mime_type: string;
        content_type?: "gk" | "aptitude";
        exam_id?: number;
        instructions?: string;
      };

      if (!body.base64_data || !body.mime_type) {
        return reply.badRequest("base64_data and mime_type are required.");
      }

      let extractedText = "";
      try {
        const base64Clean = body.base64_data.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Clean, "base64");

        if (body.mime_type === "application/pdf") {
          const data = await pdf(buffer);
          extractedText = data.text;
        } else if (
          body.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
          body.mime_type === "application/msword"
        ) {
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value;
        } else {
          extractedText = buffer.toString("utf-8");
        }
      } catch (err: any) {
        console.error("File extraction error:", err);
        return reply.badRequest("Failed to extract text from the file: " + (err.message || err));
      }

      if (!extractedText.trim()) {
        return reply.badRequest("No text could be extracted from the uploaded document.");
      }

      return parseQuizAI({
        rawText: extractedText,
        aiProvider: "openai",
        aiModel: "gpt-4o-mini",
        instructions: body.instructions,
        content_type: body.content_type
      });
    });
  });

  server.post("/api/v1/assessment/admin/ai/parse-mains-file", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = request.body as {
        base64_data: string;
        filename: string;
        mime_type: string;
        instructions?: string;
      };

      if (!body.base64_data || !body.mime_type) {
        return reply.badRequest("base64_data and mime_type are required.");
      }

      let extractedText = "";
      try {
        const base64Clean = body.base64_data.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Clean, "base64");

        if (body.mime_type === "application/pdf") {
          const data = await pdf(buffer);
          extractedText = data.text;
        } else if (
          body.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
          body.mime_type === "application/msword"
        ) {
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value;
        } else {
          extractedText = buffer.toString("utf-8");
        }
      } catch (err: any) {
        console.error("File extraction error:", err);
        return reply.badRequest("Failed to extract text from the file: " + (err.message || err));
      }

      if (!extractedText.trim()) {
        return reply.badRequest("No text could be extracted from the uploaded document.");
      }

      return draftMainsQuestionAI({
        topic: extractedText,
        instructions: body.instructions
      });
    });
  });

  server.post("/api/v1/assessment/admin/ai/save-draft", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = request.body as {
        exam_id: number;
        exam_level_id: number;
        subject_node_id: number;
        source_node_id?: number;
        topic_node_id?: number;
        subtopic_node_id?: number;
        passage_title?: string;
        passage_text?: string;
        questions: any[];
        status?: string;
      };

      if (!body.questions || !body.exam_id || !body.exam_level_id || !body.subject_node_id) {
        return reply.badRequest("exam_id, exam_level_id, subject_node_id, and questions are required.");
      }

      await saveQuestionsDraft(body, user.id);
      return reply.status(201).send({ success: true });
    });
  });

  server.post("/api/v1/assessment/admin/test-templates/bulk-taxonomy", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(bulkUpdateTestTemplatesTaxonomySchema, request.body);
      await bulkUpdateTestTemplatesTaxonomy(body);
      return { success: true };
    });
  });

  // User custom test creation — guests may create a small free test too (see
  // createUserCustomTest's guest question-count cap); logged-in users are unlimited.
  server.post("/api/v1/assessment/user/custom-tests", async (request, reply) => {
    const user = await getOptionalAuth(request);
    if (user && !(await requireFreeTestAllowance(user.id, reply))) return;
    return withValidation(reply, async () => {
      const body = parse(
        z.object({
          title: z.string().trim().min(1),
          description: z.string().trim().optional(),
          exam_id: z.coerce.number().int().positive(),
          exam_level_id: z.coerce.number().int().positive(),
          question_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
          duration_minutes: z.coerce.number().int().positive().optional(),
          test_type: z.enum(["sectional_test", "mains_test"]).optional()
        }),
        request.body
      );

      const record = await createUserCustomTest(user?.id ?? null, body);
      return reply.status(201).send(record);
    });
  });

  // User custom test add questions
  server.post("/api/v1/assessment/user/custom-tests/:testTemplateId/add-questions", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const body = parse(
        z.object({
          question_ids: z.array(z.coerce.number().int().positive())
        }),
        request.body
      );

      const record = await addQuestionsToUserTest(user.id, params.testTemplateId, body.question_ids);
      return record;
    });
  });

  // Helper: check user has assessment.premium_tests entitlement
  async function requireAssessmentPremium(userId: number, reply: any): Promise<boolean> {
    const entitlements = await getUserEntitlements(userId);
    const hasPremium = entitlements.some((e) => e.entitlement_key === "assessment.premium_tests");
    if (!hasPremium) {
      reply.status(403).send({ error: "This feature requires an Assessment Premium subscription." });
      return false;
    }
    return true;
  }

  // Helper: check user hasn't exhausted their one-time free self-built test
  // allowance (standardised across GK/CSAT/Mains — see free-test-allowance.ts).
  async function requireFreeTestAllowance(userId: number, reply: any): Promise<boolean> {
    const { used, limit, hasPremium } = await getFreeTestUsage(userId);
    if (!hasPremium && used >= limit) {
      reply.status(403).send({
        error: "free_test_limit_reached",
        message: `You've used all ${limit} free tests. Upgrade to Assessment Premium for unlimited tests.`,
        limit,
        used
      });
      return false;
    }
    return true;
  }

  // User AI file parser (PDF, Word, Images)
  server.post("/api/v1/assessment/user/ai/parse-file", async (request, reply) => {
    const user = await requireAuth(request);
    if (!(await requireAssessmentPremium(user.id, reply))) return;
    return withValidation(reply, async () => {
      const body = request.body as {
        base64_data: string;
        filename: string;
        mime_type: string;
        content_type?: "gk" | "aptitude";
        exam_id?: number;
        instructions?: string;
      };

      if (!body.base64_data || !body.mime_type) {
        return reply.badRequest("base64_data and mime_type are required.");
      }

      let extractedText = "";
      try {
        const base64Clean = body.base64_data.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Clean, "base64");

        if (body.mime_type === "application/pdf") {
          const data = await pdf(buffer);
          extractedText = data.text;
        } else if (
          body.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          body.mime_type === "application/msword"
        ) {
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value;
        } else if (
          ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(body.mime_type)
        ) {
          // OCR via Google Cloud Vision
          extractedText = await extractTextFromImage(buffer);
        } else {
          extractedText = buffer.toString("utf-8");
        }
      } catch (err: any) {
        console.error("File extraction error:", err);
        return reply.badRequest("Failed to extract text from the file: " + (err.message || err));
      }

      if (!extractedText.trim()) {
        return reply.badRequest("No text could be extracted from the uploaded file.");
      }

      const parsed = await parseQuizAI({
        rawText: extractedText,
        aiProvider: "openai",
        aiModel: "gpt-4o-mini",
        instructions: body.instructions,
        content_type: body.content_type
      });

      if (Array.isArray(parsed)) {
        return { success: true, questions: parsed };
      }
      return parsed;
    });
  });

  // User AI multi-image parser (OCR multiple images in order, then AI parse)
  server.post("/api/v1/assessment/user/ai/parse-images", async (request, reply) => {
    const user = await requireAuth(request);
    if (!(await requireAssessmentPremium(user.id, reply))) return;
    return withValidation(reply, async () => {
      const body = request.body as {
        images: Array<{ base64_data: string; mime_type: string }>;
        content_type?: "gk" | "aptitude";
        instructions?: string;
      };

      if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
        return reply.badRequest("images array is required and must not be empty.");
      }
      if (body.images.length > 20) {
        return reply.badRequest("Maximum 20 images allowed per parse session.");
      }

      let extractedText = "";
      try {
        const buffers = body.images.map((img) => {
          const clean = img.base64_data.replace(/^data:[^;]+;base64,/, "");
          return Buffer.from(clean, "base64");
        });
        extractedText = await extractTextFromImages(buffers);
      } catch (err: any) {
        console.error("OCR multi-image error:", err);
        return reply.badRequest("Failed to extract text from images: " + (err.message || err));
      }

      if (!extractedText.trim()) {
        return reply.badRequest("No text could be read from the uploaded images.");
      }

      const parsed = await parseQuizAI({
        rawText: extractedText,
        aiProvider: "openai",
        aiModel: "gpt-4o-mini",
        instructions: body.instructions,
        content_type: body.content_type
      });

      if (Array.isArray(parsed)) {
        return { success: true, questions: parsed };
      }
      return parsed;
    });
  });

  // User AI text parser
  server.post("/api/v1/assessment/user/ai/parse-text", async (request, reply) => {
    const user = await requireAuth(request);
    if (!(await requireAssessmentPremium(user.id, reply))) return;
    return withValidation(reply, async () => {
      const body = request.body as {
        raw_text: string;
        content_type?: "gk" | "aptitude";
        exam_id?: number;
        instructions?: string;
      };

      if (!body.raw_text) {
        return reply.badRequest("raw_text is required.");
      }

      const parsed = await parseQuizAI({
        rawText: body.raw_text,
        aiProvider: "openai",
        aiModel: "gpt-4o-mini",
        instructions: body.instructions,
        content_type: body.content_type
      });

      if (Array.isArray(parsed)) {
        return { success: true, questions: parsed };
      }
      return parsed;
    });
  });

  // User AI save parsed questions (also used for manual entry)
  server.post("/api/v1/assessment/user/ai/save-questions", async (request, reply) => {
    const user = await requireAuth(request);
    if (!(await requireAssessmentPremium(user.id, reply))) return;
    return withValidation(reply, async () => {
      const body = request.body as {
        exam_id: number;
        exam_level_id: number;
        subject_node_id: number;
        source_node_id?: number;
        topic_node_id?: number;
        subtopic_node_id?: number;
        passage_title?: string;
        passage_text?: string;
        questions: any[];
        test_template_id?: number;
        mark_for_revision?: boolean; // If true, bookmarks all saved questions
      };

      if (!body.questions || !body.exam_id || !body.exam_level_id || !body.subject_node_id) {
        return reply.badRequest("exam_id, exam_level_id, subject_node_id, and questions are required.");
      }

      const createdItems = await saveQuestionsDraft({
        ...body,
        status: "published",
        is_user_private: true
      }, user.id);

      // If mark_for_revision is enabled, automatically bookmark each question for the user
      if (body.mark_for_revision && createdItems && createdItems.length > 0) {
        for (const item of createdItems) {
          try {
            await query(
              `
                insert into assessment.student_bookmarks (user_id, question_id, question_version_id, note)
                values ($1, $2, $3, 'Created and marked for revision')
                on conflict (user_id, question_id) do nothing
              `,
              [user.id, item.question_id, item.version_id]
            );
          } catch (e) {
            console.error("Failed to automatically bookmark user-created question:", e);
          }
        }
      }

      return reply.status(201).send({ success: true });
    });
  });

  // User: list own submitted questions for a category
  server.get("/api/v1/assessment/user/my-questions", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const q = request.query as {
        exam_id?: string;
        subject_node_id?: string;
        topic_node_id?: string;
        subtopic_node_id?: string;
        limit?: string;
        offset?: string;
      };

      const params: unknown[] = [user.id];
      const conditions: string[] = ["q.created_by_user_id = $1", "q.status = 'published'"];

      if (q.exam_id) {
        params.push(Number(q.exam_id));
        conditions.push(`qtl.exam_id = $${params.length}`);
      }
      if (q.subject_node_id) {
        params.push(Number(q.subject_node_id));
        conditions.push(`qtl.subject_node_id = $${params.length}`);
      }
      if (q.topic_node_id) {
        params.push(Number(q.topic_node_id));
        conditions.push(`qtl.topic_node_id = $${params.length}`);
      }
      if (q.subtopic_node_id) {
        params.push(Number(q.subtopic_node_id));
        conditions.push(`qtl.subtopic_node_id = $${params.length}`);
      }

      const limit = Math.min(Number(q.limit ?? 50), 100);
      const offset = Number(q.offset ?? 0);
      params.push(limit, offset);

      const rows = await query<any>(
        `
          select
            q.id as question_id,
            q.is_ai_generated,
            q.created_at,
            qv.id as question_version_id,
            qv.question_statement,
            qv.supplementary_statement,
            qv.options,
            qv.correct_answer,
            qv.explanation,
            qtl.subject_node_id,
            qtl.topic_node_id,
            qtl.subtopic_node_id,
            sn.name as subject_name,
            tn.name as topic_name,
            stn.name as subtopic_name,
            exists (
              select 1 from assessment.student_bookmarks sb
              where sb.question_id = q.id and sb.user_id = $1
            ) as is_bookmarked
          from assessment.questions q
          join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
          join assessment.question_taxonomy_links qtl on qtl.question_id = q.id
          left join assessment.assessment_taxonomy_nodes sn on sn.id = qtl.subject_node_id
          left join assessment.assessment_taxonomy_nodes tn on tn.id = qtl.topic_node_id
          left join assessment.assessment_taxonomy_nodes stn on stn.id = qtl.subtopic_node_id
          where ${conditions.join(" and ")}
          order by q.created_at desc
          limit $${params.length - 1} offset $${params.length}
        `,
        params
      );

      return rows.map((r: any) => ({
        ...r,
        options: typeof r.options === "string" ? JSON.parse(r.options) : r.options,
        correct_answer: typeof r.correct_answer === "string" ? JSON.parse(r.correct_answer) : r.correct_answer
      }));
    });
  });

  // User: archive (soft-delete) own submitted question
  server.delete("/api/v1/assessment/user/my-questions/:questionId", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const { questionId } = request.params as { questionId: string };
      const result = await query<{ id: number }>(
        `
          update assessment.questions
          set status = 'archived', updated_at = now()
          where id = $1 and created_by_user_id = $2 and status = 'published'
          returning id
        `,
        [Number(questionId), user.id]
      );
      if (!result.length) {
        return reply.status(404).send({ error: "Question not found or already deleted." });
      }
      return reply.status(200).send({ success: true });
    });
  });

  // Get excluded taxonomy nodes for authenticated user
  server.get("/api/v1/assessment/taxonomy/excluded", async (request, reply) => {
    const user = await requireAuth(request);
    const rows = await query<{ taxonomy_type: string; node_id: number }>(
      "select taxonomy_type, node_id from assessment.student_excluded_taxonomy_nodes where user_id = $1",
      [user.id]
    );
    const objective: number[] = [];
    const mains: number[] = [];
    for (const row of rows) {
      if (row.taxonomy_type === "objective") {
        objective.push(row.node_id);
      } else if (row.taxonomy_type === "mains") {
        mains.push(row.node_id);
      }
    }
    return { objective, mains };
  });

  // Update excluded taxonomy nodes for authenticated user
  server.post("/api/v1/assessment/taxonomy/excluded", async (request, reply) => {
    const user = await requireAuth(request);
    const bodySchema = z.object({
      taxonomy_type: z.enum(["objective", "mains"]),
      excluded_node_ids: z.array(z.number())
    });
    const body = parse(bodySchema, request.body);

    await transaction(async (client) => {
      // 1. Delete all existing exclusions for this user and type
      await client.query(
        "delete from assessment.student_excluded_taxonomy_nodes where user_id = $1 and taxonomy_type = $2",
        [user.id, body.taxonomy_type]
      );
      // 2. Insert new ones
      if (body.excluded_node_ids.length > 0) {
        const values: string[] = [];
        const params: unknown[] = [user.id, body.taxonomy_type];
        
        body.excluded_node_ids.forEach((nodeId, idx) => {
          params.push(nodeId);
          values.push(`($1, $2, $${idx + 3})`);
        });

        const sql = `
          insert into assessment.student_excluded_taxonomy_nodes (user_id, taxonomy_type, node_id)
          values ${values.join(", ")}
        `;
        await client.query(sql, params);
      }
    });

    return { success: true };
  });
}
