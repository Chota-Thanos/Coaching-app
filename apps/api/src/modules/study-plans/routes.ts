import type { FastifyInstance } from "fastify";
import { parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor, requireAuth } from "../auth/guards.js";
import { draftMainsQuestionAI, parseQuizAI } from "../current-affairs/master/ai.service.js";
import {
  addPlanItem,
  addStudyPlanQuestion,
  addStudyPlanQuestions,
  createStudyPlan,
  createStudyPlanTest,
  deletePlanItem,
  deleteStudyPlanQuestion,
  enrollStudyPlan,
  getStudyPlan,
  getStudyPlanAttemptPaper,
  getStudyPlanResultReview,
  getStudyPlanTest,
  getStudyPlanTestPaper,
  listStudyPlans,
  listStudyPlanTests,
  startStudyPlanAttempt,
  submitStudyPlanAttempt,
  updatePlanItem,
  updatePlanItemProgress,
  updateStudyPlan,
  updateStudyPlanQuestion,
  updateStudyPlanTest,
  upsertStudyPlanResponse
} from "./service.js";
import {
  attemptIdParamSchema,
  createPlanItemSchema,
  createStudyPlanQuestionSchema,
  createStudyPlanSchema,
  createStudyPlanTestSchema,
  enrollStudyPlanSchema,
  idParamSchema,
  listStudyPlansQuerySchema,
  listStudyPlanTestsQuerySchema,
  parseStudyPlanQuestionsSchema,
  saveStudyPlanQuestionsDraftSchema,
  startStudyPlanAttemptSchema,
  submitStudyPlanAttemptSchema,
  testTemplateIdParamSchema,
  updatePlanItemSchema,
  updateProgressSchema,
  updateStudyPlanQuestionSchema,
  updateStudyPlanSchema,
  updateStudyPlanTestSchema,
  upsertStudyPlanResponseSchema
} from "./schemas.js";

async function optionalAuth(request: Parameters<typeof requireAuth>[0]) {
  try {
    return await requireAuth(request);
  } catch {
    return undefined;
  }
}

export async function registerStudyPlanRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/study-plans", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(listStudyPlansQuerySchema, request.query);
      return listStudyPlans(query);
    });
  });

  server.post("/api/v1/study-plans", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createStudyPlanSchema, request.body);
      const record = await createStudyPlan(body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/study-plans/:id", async (request, reply) => {
    const user = await optionalAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getStudyPlan(params.id, user);
      if (!record) return reply.notFound("Study plan not found.");
      return record;
    });
  });

  server.patch("/api/v1/study-plans/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateStudyPlanSchema, request.body);
      const record = await updateStudyPlan(params.id, body);
      if (!record) return reply.notFound("Study plan not found.");
      return record;
    });
  });

  server.post("/api/v1/study-plans/:id/enroll", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(enrollStudyPlanSchema, request.body ?? {});
      // Only allow free enrollment on free plans
      const plan = (await getStudyPlan(params.id, user)) as any;
      if (!plan) return reply.notFound("Study plan not found.");
      if (Number(plan.price_amount_minor) > 0) {
        return reply.status(402).send({ error: "This plan requires payment. Use the purchase flow." });
      }
      const record = await enrollStudyPlan(params.id, { ...body, payment_status: "free" }, user.id);
      return reply.status(201).send(record);
    });
  });

  // Create a Razorpay order for a paid study plan
  server.post("/api/v1/study-plans/:id/purchase-order", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const plan = (await getStudyPlan(params.id, user)) as any;
      if (!plan) return reply.notFound("Study plan not found.");
      if (plan.has_access) {
        return reply.status(409).send({ error: "You already have access to this plan." });
      }

      const { config } = await import("../../config.js");
      const crypto = await import("node:crypto");
      const keyId = config.RAZORPAY_KEY_ID;
      const keySecret = config.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret) {
        // Simulated mode
        return reply.status(201).send({
          order_id: `sim_order_${Date.now()}_u${user.id}_sp${params.id}`,
          amount: Number(plan.price_amount_minor),
          currency: plan.currency ?? "INR",
          key_id: "rzp_test_SIMULATED",
          plan_title: plan.title,
          simulated: true
        });
      }

      const orderPayload = {
        amount: Number(plan.price_amount_minor),
        currency: plan.currency ?? "INR",
        receipt: `sp_${params.id}_u${user.id}_${Date.now()}`,
        notes: { user_id: String(user.id), study_plan_id: String(params.id) }
      };

      const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const resp = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${credentials}` },
        body: JSON.stringify(orderPayload)
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`Razorpay order creation failed: ${errBody}`);
      }

      const rzpOrder = (await resp.json()) as { id: string; currency: string; amount: number };
      return reply.status(201).send({
        order_id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        key_id: keyId,
        plan_title: plan.title,
        simulated: false
      });
    });
  });

  // Verify payment and unlock the study plan
  server.post("/api/v1/study-plans/:id/verify-purchase", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.body as {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      };

      const plan = (await getStudyPlan(params.id, user)) as any;
      if (!plan) return reply.notFound("Study plan not found.");
      if (plan.has_access) {
        return reply.status(409).send({ error: "You already have access to this plan." });
      }

      const isSimulated = razorpay_order_id.startsWith("sim_order_");
      const { config } = await import("../../config.js");
      const keySecret = config.RAZORPAY_KEY_SECRET;

      // Verify signature for real payments
      if (!isSimulated && keySecret) {
        const crypto = await import("node:crypto");
        const expected = crypto.default.createHmac("sha256", keySecret)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest("hex");
        if (expected !== razorpay_signature) {
          return reply.status(400).send({ error: "Payment signature verification failed." });
        }
      }

      const record = await enrollStudyPlan(
        params.id,
        {
          provider: isSimulated ? "simulated" : "razorpay",
          payment_status: "paid",
          payment_amount: Number(plan.price_amount_minor),
          payment_currency: plan.currency ?? "INR",
          razorpay_order_id,
          razorpay_payment_id
        },
        user.id
      );
      return reply.status(201).send(record);
    });
  });


  server.post("/api/v1/study-plans/:id/items", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(createPlanItemSchema, request.body);
      const record = await addPlanItem(params.id, body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/study-plan-items/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updatePlanItemSchema, request.body);
      const record = await updatePlanItem(params.id, body);
      if (!record) return reply.notFound("Study plan item not found.");
      return record;
    });
  });

  server.delete("/api/v1/study-plan-items/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deletePlanItem(params.id);
      if (!record) return reply.notFound("Study plan item not found.");
      return record;
    });
  });

  server.patch("/api/v1/study-plan-items/:id/progress", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateProgressSchema, request.body);
      return updatePlanItemProgress(params.id, body, user.id);
    });
  });

  server.get("/api/v1/study-plan-tests", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(listStudyPlanTestsQuerySchema, request.query);
      return listStudyPlanTests(query);
    });
  });

  server.post("/api/v1/study-plan-tests", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createStudyPlanTestSchema, request.body);
      const record = await createStudyPlanTest(body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/study-plan-tests/:testTemplateId", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const record = await getStudyPlanTest(params.testTemplateId);
      if (!record) return reply.notFound("Study plan test not found.");
      return record;
    });
  });

  server.patch("/api/v1/study-plan-tests/:testTemplateId", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const body = parse(updateStudyPlanTestSchema, request.body);
      const record = await updateStudyPlanTest(params.testTemplateId, body);
      if (!record) return reply.notFound("Study plan test not found.");
      return record;
    });
  });

  server.get("/api/v1/study-plan-tests/:testTemplateId/paper", async (request, reply) => {
    const user = await optionalAuth(request);
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const planItemId = typeof request.query === "object" && request.query
        ? Number((request.query as Record<string, unknown>).plan_item_id)
        : undefined;
      const record = await getStudyPlanTestPaper(
        params.testTemplateId,
        user,
        Number.isFinite(planItemId ?? NaN) && (planItemId ?? 0) > 0 ? planItemId : undefined
      );
      if (!record) return reply.notFound("Study plan test not found.");
      return record;
    });
  });

  server.post("/api/v1/study-plan-tests/:testTemplateId/questions", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const body = parse(createStudyPlanQuestionSchema, request.body);
      const record = await addStudyPlanQuestion(params.testTemplateId, body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/study-plan-questions/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateStudyPlanQuestionSchema, request.body);
      const record = await updateStudyPlanQuestion(params.id, body);
      if (!record) return reply.notFound("Study plan question not found.");
      return record;
    });
  });

  server.delete("/api/v1/study-plan-questions/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteStudyPlanQuestion(params.id);
      if (!record) return reply.notFound("Study plan question not found.");
      return record;
    });
  });

  server.post("/api/v1/study-plan-tests/:testTemplateId/attempts/start", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(testTemplateIdParamSchema, request.params);
      const body = parse(startStudyPlanAttemptSchema, request.body ?? {});
      const record = await startStudyPlanAttempt(params.testTemplateId, body, user);
      if (!record) return reply.notFound("Study plan test not found.");
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/study-plan-attempts/:attemptId/paper", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(attemptIdParamSchema, request.params);
      const record = await getStudyPlanAttemptPaper(params.attemptId, user);
      if (!record) return reply.notFound("Attempt not found.");
      return record;
    });
  });

  server.put("/api/v1/study-plan-attempts/:attemptId/responses", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(attemptIdParamSchema, request.params);
      const body = parse(upsertStudyPlanResponseSchema, request.body);
      return upsertStudyPlanResponse(params.attemptId, body, user);
    });
  });

  server.post("/api/v1/study-plan-attempts/:attemptId/submit", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(attemptIdParamSchema, request.params);
      const body = parse(submitStudyPlanAttemptSchema, request.body ?? {});
      return submitStudyPlanAttempt(params.attemptId, body, user);
    });
  });

  server.get("/api/v1/study-plan-results/:id/review", async (request, reply) => {
    const user = await requireAuth(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getStudyPlanResultReview(params.id, user);
      if (!record) return reply.notFound("Study plan result not found.");
      return record;
    });
  });

  server.post("/api/v1/study-plans/admin/ai/parse", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(parseStudyPlanQuestionsSchema, request.body);
      if (body.content_type === "mains") {
        const parsed = await draftMainsQuestionAI({
          topic: body.raw_text,
          instructions: body.instructions
        });
        return {
          questions: (parsed.questions ?? []).map((question: any, index: number) => ({
            display_order: index + 1,
            question_family: "mains_subjective",
            question_statement: question.question_statement,
            question_prompt: question.directive ?? "Write your answer.",
            options: [],
            model_answer: question.model_answer,
            explanation: Array.isArray(question.key_points) ? question.key_points.join("\n") : undefined,
            marks: question.marks ?? 10,
            negative_marks: 0,
            source_payload: question
          }))
        };
      }

      const isPassageMode = body.content_type === "csat_passage";
      const isMathMode = body.content_type === "csat_math";
      const contentType = body.content_type === "gk" ? "gk" : "aptitude";
      const modeInstructions = [
        isPassageMode
          ? "Treat this as a passage-linked CSAT/comprehension set. Extract one shared passage_title and passage_text, then keep each question tied to that passage."
          : "",
        isMathMode
          ? "Treat this as CSAT maths/reasoning. Preserve every formula, symbol, variable, and equation using LaTeX with single dollar delimiters."
          : "",
        body.instructions ?? ""
      ].filter(Boolean).join("\n\n");

      return parseQuizAI({
        rawText: body.raw_text,
        aiProvider: "openai",
        aiModel: "gpt-4o-mini",
        instructions: modeInstructions || undefined,
        content_type: contentType
      });
    });
  });

  server.post("/api/v1/study-plans/admin/ai/save-draft", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(saveStudyPlanQuestionsDraftSchema, request.body);
      const records = await addStudyPlanQuestions(body.test_template_id, body.questions);
      return reply.status(201).send({ success: true, count: records.length, questions: records });
    });
  });
}
