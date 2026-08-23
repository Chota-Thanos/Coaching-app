import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse, withValidation } from "../../../common/http.js";
import { requireAuth } from "../../auth/guards.js";
import { assertHasAiNotesAccess } from "../../billing/free-tier.js";
import { generateStudentNotesAI } from "../master/ai.service.js";
import { getForksForSummary } from "./forks.service.js";

const generateNotesSchema = z.object({
  collection_id: z.coerce.number().int().positive(),
  fork_ids: z.array(z.coerce.number().int().positive()).min(1)
});

/**
 * Student-facing AI Notes Helper — separate from /admin/ai/generate, which
 * is a staff-only content-authoring endpoint and always 403s for students.
 * This is the real endpoint the notes-creation wizard's AI-Assisted mode
 * calls, gated behind Current Affairs Pro (see assertHasAiNotesAccess)
 * since it has real per-call AI cost. It only ever summarizes articles the
 * student has already forked into their own collection — never generates
 * free-standing content from a bare topic.
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
      const note = await generateStudentNotesAI({ sources });
      return reply.status(201).send(note);
    });
  });
}
