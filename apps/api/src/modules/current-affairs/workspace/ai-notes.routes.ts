import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse, withValidation } from "../../../common/http.js";
import { requireAuth } from "../../auth/guards.js";
import { assertHasAiNotesAccess } from "../../billing/free-tier.js";
import { generateQuizzesAI, generateStudentNotesAI } from "../master/ai.service.js";

const generateNotesSchema = z.object({
  topic: z.string().trim().min(1),
  instructions: z.string().trim().optional()
});

const generateQuizSchema = z.object({
  topic: z.string().trim().min(1),
  quiz_type: z.enum(["gk", "aptitude", "passage"]).optional(),
  count: z.coerce.number().int().min(1).max(5).optional()
});

/**
 * Student-facing AI Notes Helper — separate from /admin/ai/generate and
 * /admin/ai/generate-quiz, which are staff-only content-authoring endpoints
 * and always 403 for students. This is the real endpoint the workspace AI
 * helper UI should call, gated behind Current Affairs Pro (see
 * assertHasAiNotesAccess) since it has real per-call AI cost.
 */
export async function registerCurrentAffairsAiNotesRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/v1/current-affairs/me/ai/generate-notes", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      await assertHasAiNotesAccess(user.id);
      const body = parse(generateNotesSchema, request.body);
      const note = await generateStudentNotesAI({ topic: body.topic, instructions: body.instructions });
      return reply.status(201).send(note);
    });
  });

  server.post("/api/v1/current-affairs/me/ai/generate-quiz", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      await assertHasAiNotesAccess(user.id);
      const body = parse(generateQuizSchema, request.body);

      const quizType = body.quiz_type ?? "gk";
      const contentType = quizType === "aptitude" ? "aptitude" : "gk";
      const prompt = `Generate a high quality objective multiple choice quiz on the UPSC current affairs topic: ${body.topic}. Please write multiple-choice questions with 4 options and provide correct answers and explanations.`;

      const generated = await generateQuizzesAI({
        quizType,
        prompt,
        aiProvider: "openai",
        aiModel: "gpt-4o-mini",
        content_type: contentType,
        count: body.count || 2
      });

      if (!generated || !generated.questions || generated.questions.length === 0) {
        return reply.badRequest("AI generation returned no questions. Please try again.");
      }

      return reply.status(201).send({
        passage_title: generated.passage_title,
        passage_text: generated.passage_text,
        questions: generated.questions
      });
    });
  });
}
