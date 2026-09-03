import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse, withValidation } from "../../../common/http.js";
import { requireAuth } from "../../auth/guards.js";
import { assertHasAiNotesAccess } from "../../billing/free-tier.js";
import { generateQuizzesAI, generateStudentNotesAI } from "../master/ai.service.js";
import { getForksForSummary } from "./forks.service.js";

const generateNotesSchema = z.object({
  collection_id: z.coerce.number().int().positive(),
  fork_ids: z.array(z.coerce.number().int().positive()).min(1),
  /**
   * What the student actually wants out of these articles — "ten prelims
   * pointers", "focus on the economic angle", "one-page revision sheet".
   * Optional, because the panel can still be used as a plain summarise
   * button, but it is what turns one fixed summary into a useful one.
   */
  instructions: z.string().trim().max(1000).optional()
});

const generateQuizSchema = z.object({
  fork_ids: z.array(z.coerce.number().int().positive()).min(1),
  quiz_type: z.enum(["gk", "maths", "passage"]).default("gk"),
  count: z.coerce.number().int().min(1).max(10).default(3),
  instructions: z.string().trim().max(1000).optional()
});

/**
 * Student-facing AI helpers — separate from /admin/ai/*, which are staff-only
 * content-authoring endpoints and always 403 for a student.
 *
 * Both only ever work from articles the student has already saved into their
 * own collection; neither generates free-standing content from a bare topic.
 * Gated behind Current Affairs Pro (see assertHasAiNotesAccess) since each
 * call has real per-call AI cost.
 */
export async function registerCurrentAffairsAiNotesRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/v1/current-affairs/me/ai/generate-notes", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      await assertHasAiNotesAccess(user.id);
      const body = parse(generateNotesSchema, request.body);
      const sources = await getForksForSummary(body.fork_ids, user.id);
      if (sources.length === 0) {
        return reply.badRequest("None of the selected articles could be found in your collection.");
      }
      const note = await generateStudentNotesAI({ sources, instructions: body.instructions });
      return reply.status(201).send(note);
    });
  });

  /**
   * Self-test questions from the student's own saved articles.
   *
   * This exists because the Current Affairs Pro app had a "generate quiz"
   * button wired to the ADMIN endpoint, which 403s for every student — and it
   * swallowed that error and returned a hardcoded mock paper instead, complete
   * with invented statistics. Students were revising from fabricated questions.
   * A real student endpoint is what that button needed all along.
   */
  server.post("/api/v1/current-affairs/me/ai/generate-quiz", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      await assertHasAiNotesAccess(user.id);
      const body = parse(generateQuizSchema, request.body);
      const sources = await getForksForSummary(body.fork_ids, user.id);
      if (sources.length === 0) {
        return reply.badRequest("None of the selected articles could be found in your collection.");
      }

      // The generator takes a prompt rather than sources, so the student's own
      // articles ARE the prompt — and the instruction below is what stops it
      // wandering off into general knowledge the articles never mentioned.
      const prompt = sources
        .map((source, index) => `Article ${index + 1}: ${source.title}\n\n${source.body}`)
        .join("\n\n---\n\n");

      return generateQuizzesAI({
        quizType: body.quiz_type,
        prompt,
        aiProvider: "openai",
        aiModel: "gpt-4o-mini",
        count: body.count,
        instructions: [
          "Set every question ONLY from the supplied articles. Never use outside knowledge, and never invent a figure, date or finding that is not in the text.",
          body.instructions?.trim()
        ]
          .filter(Boolean)
          .join(" ")
      });
    });
  });
}
