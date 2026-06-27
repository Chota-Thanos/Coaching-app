import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor, requireAuth } from "../auth/guards.js";
import {
  addTestQuestionItemSchema,
  attemptIdParamSchema,
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
  startSingleMainsQuestionAttempt
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
  createUserCustomTest
} from "./test-templates.service.js";
import { saveQuestionsDraft } from "./questions.service.js";
import { parseQuizAI, generateQuizzesAI, draftMainsQuestionAI } from "../current-affairs/master/ai.service.js";
import { one } from "../../db.js";
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

export async function registerAssessmentTestRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/assessment/test-templates", async (request, reply) => {
    let user = null;
    try {
      user = await requireAuth(request);
    } catch {
      // Allow anonymous
    }
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
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const record = await getTestTemplate(params.testTemplateId);
      if (!record) return reply.notFound("Test template not found.");
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
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const body = parse(startAttemptSchema, request.body ?? {});
      const record = await startAttempt(params.testTemplateId, body, user);
      if (!record) return reply.notFound("Test template not found.");
      return reply.status(201).send(record);
    });
  });

  server.post("/api/v1/assessment/attempts/dynamic", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(startDynamicAttemptSchema, request.body ?? {});
      const record = await startDynamicAttempt(user.id, body);
      return reply.status(201).send(record);
    });
  });

  server.post("/api/v1/assessment/attempts/compiled", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(startCompiledAttemptSchema, request.body ?? {});
      const record = await startCompiledAttempt(user.id, body);
      return reply.status(201).send(record);
    });
  });

  server.post("/api/v1/assessment/attempts/mains-question", async (request, reply) => {
    const user = await requireAuth(request);
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
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(attemptIdParamSchema, request.params);
      const record = await getAttempt(params.attemptId, user);
      if (!record) return reply.notFound("Attempt not found.");
      return record;
    });
  });

  server.get("/api/v1/assessment/attempts/:attemptId/paper", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(attemptIdParamSchema, request.params);
      const record = await getAttemptPaper(params.attemptId, user);
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
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(attemptIdParamSchema, request.params);
      const body = parse(upsertAttemptResponseSchema, request.body);
      return upsertAttemptResponse(params.attemptId, body, user);
    });
  });

  server.post("/api/v1/assessment/attempts/:attemptId/submit", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(attemptIdParamSchema, request.params);
      const body = parse(submitAttemptSchema, request.body);
      return submitAttempt(params.attemptId, body, user);
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

  // User custom test creation
  server.post("/api/v1/assessment/user/custom-tests", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(
        z.object({
          title: z.string().trim().min(1),
          exam_id: z.coerce.number().int().positive(),
          exam_level_id: z.coerce.number().int().positive(),
          question_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
          duration_minutes: z.coerce.number().int().positive().optional(),
          test_type: z.enum(["sectional_test", "mains_test"]).optional()
        }),
        request.body
      );
      
      const record = await createUserCustomTest(user.id, body);
      return reply.status(201).send(record);
    });
  });

  // User AI file parser
  server.post("/api/v1/assessment/user/ai/parse-file", async (request, reply) => {
    const user = await requireAuth(request);
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

  // User AI text parser
  server.post("/api/v1/assessment/user/ai/parse-text", async (request, reply) => {
    const user = await requireAuth(request);
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

  // User AI save parsed questions
  server.post("/api/v1/assessment/user/ai/save-questions", async (request, reply) => {
    const user = await requireAuth(request);
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
      };

      if (!body.questions || !body.exam_id || !body.exam_level_id || !body.subject_node_id) {
        return reply.badRequest("exam_id, exam_level_id, subject_node_id, and questions are required.");
      }

      await saveQuestionsDraft({
        ...body,
        status: "published"
      }, user.id);

      return reply.status(201).send({ success: true });
    });
  });
}
