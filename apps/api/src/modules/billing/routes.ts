import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAuth, requireRole } from "../auth/guards.js";
import {
  adminListSubscriptionsQuerySchema,
  createEntitlementSchema,
  createOrderSchema,
  createPlanPriceSchema,
  createPlanSchema,
  createSubscriptionSchema,
  listSubscriptionsQuerySchema,
  updateEntitlementSchema,
  updatePlanPriceSchema,
  updatePlanSchema,
  updateSubscriptionSchema,
  verifyPaymentSchema
} from "./schemas.js";
import {
  createEntitlement,
  createPlan,
  createPlanPrice,
  createRazorpayOrder,
  createSubscription,
  getUserEntitlements,
  getUserSubscriptions,
  getSubscriptionStats,
  listPlans,
  listSubscriptions,
  updateEntitlement,
  updatePlan,
  updatePlanPrice,
  updateSubscription,
  verifyRazorpayPayment
} from "./service.js";
import {
  getPaymentById,
  getPaymentStats,
  listPayments,
  listPaymentsForUser,
  markPaymentRefunded,
  type ListPaymentsFilters,
  type PaymentProductType,
  type PaymentStatus
} from "./payments.service.js";
import { getFreeTestUsage } from "../assessment/free-test-allowance.js";

export async function registerBillingRoutes(server: FastifyInstance): Promise<void> {

  // -------------------------------------------------------------------------
  // Unified payment ledger — admin oversight for reconciliation and disputes
  // -------------------------------------------------------------------------
  server.get("/api/v1/admin/payments", async (request, reply) => {
    await requireRole(request, ["admin", "moderator"]);
    return withValidation(reply, async () => {
      const q = (request.query ?? {}) as Record<string, string>;
      const filters: ListPaymentsFilters = {
        user_id: q.user_id ? Number(q.user_id) : undefined,
        product_type: q.product_type ? (q.product_type as PaymentProductType) : undefined,
        status: q.status ? (q.status as PaymentStatus) : undefined,
        provider: q.provider || undefined,
        search: q.search || undefined,
        from: q.from || undefined,
        to: q.to || undefined,
        limit: q.limit ? Math.min(Number(q.limit), 500) : 100,
        offset: q.offset ? Number(q.offset) : 0
      };
      return listPayments(filters);
    });
  });

  server.get("/api/v1/admin/payments/stats", async (request, reply) => {
    await requireRole(request, ["admin", "moderator"]);
    return withValidation(reply, async () => getPaymentStats());
  });

  server.get("/api/v1/admin/payments/:id", async (request, reply) => {
    await requireRole(request, ["admin", "moderator"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getPaymentById(params.id);
      if (!record) return reply.notFound("Payment not found.");
      return record;
    });
  });

  // Record-keeping only: marks the ledger row refunded. Issue the actual refund
  // in the Razorpay dashboard — we deliberately don't move money from here.
  server.patch("/api/v1/admin/payments/:id/refund", async (request, reply) => {
    await requireRole(request, ["admin"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = (request.body ?? {}) as { notes?: string };
      const record = await markPaymentRefunded(params.id, body.notes ?? null);
      if (!record) return reply.notFound("Payment not found.");
      return record;
    });
  });

  // A user's own payment history
  server.get("/api/v1/billing/me/payments", async (request) => {
    const user = await requireAuth(request);
    return listPaymentsForUser(user.id);
  });

  // -------------------------------------------------------------------------
  // Public: List all active plans with prices + entitlements
  // -------------------------------------------------------------------------
  server.get("/api/v1/billing/plans", async () => {
    return listPlans();
  });

  // -------------------------------------------------------------------------
  // User-facing: My Subscriptions
  // -------------------------------------------------------------------------
  server.get("/api/v1/billing/me/subscriptions", async (request) => {
    const actor = await requireAuth(request);
    return getUserSubscriptions(actor.id);
  });

  // -------------------------------------------------------------------------
  // User-facing: My Entitlements (flat key → limit map)
  // -------------------------------------------------------------------------
  server.get("/api/v1/billing/me/entitlements", async (request) => {
    const actor = await requireAuth(request);
    const entitlements = await getUserEntitlements(actor.id);
    const hasPremium = entitlements.some((e) => e.entitlement_key === "assessment.premium_tests");
    if (!hasPremium) {
      const usage = await getFreeTestUsage(actor.id);
      entitlements.push({
        entitlement_key: "assessment.free_tests_remaining",
        limit_value: Math.max(0, usage.limit - usage.used)
      });
    }
    return entitlements;
  });

  // -------------------------------------------------------------------------
  // User-facing: Create Razorpay payment order
  // -------------------------------------------------------------------------
  server.post("/api/v1/billing/orders", async (request, reply) => {
    const actor = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(createOrderSchema, request.body);
      const order = await createRazorpayOrder(body, actor.id);
      return reply.status(201).send(order);
    });
  });

  // -------------------------------------------------------------------------
  // User-facing: Verify payment and activate subscription
  // -------------------------------------------------------------------------
  server.post("/api/v1/billing/verify", async (request, reply) => {
    const actor = await requireAuth(request);
    return withValidation(reply, async () => {
      const body = parse(verifyPaymentSchema, request.body);
      const result = await verifyRazorpayPayment(body, actor.id);
      return reply.status(201).send(result);
    });
  });

  // -------------------------------------------------------------------------
  // Admin: CRUD Plans
  // -------------------------------------------------------------------------
  server.post("/api/v1/billing/plans", async (request, reply) => {
    await requireRole(request, ["admin"]);
    return withValidation(reply, async () => {
      const body = parse(createPlanSchema, request.body);
      const record = await createPlan(body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/billing/plans/:id", async (request, reply) => {
    await requireRole(request, ["admin"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updatePlanSchema, request.body);
      const record = await updatePlan(params.id, body);
      if (!record) return reply.notFound("Plan not found.");
      return record;
    });
  });

  // -------------------------------------------------------------------------
  // Admin: Plan Prices
  // -------------------------------------------------------------------------
  server.post("/api/v1/billing/plans/:id/prices", async (request, reply) => {
    await requireRole(request, ["admin"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(createPlanPriceSchema, request.body);
      const record = await createPlanPrice(params.id, body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/billing/plan-prices/:id", async (request, reply) => {
    await requireRole(request, ["admin"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updatePlanPriceSchema, request.body);
      const record = await updatePlanPrice(params.id, body);
      if (!record) return reply.notFound("Plan price not found.");
      return record;
    });
  });

  // -------------------------------------------------------------------------
  // Admin: Entitlements
  // -------------------------------------------------------------------------
  server.post("/api/v1/billing/plans/:id/entitlements", async (request, reply) => {
    await requireRole(request, ["admin"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(createEntitlementSchema, request.body);
      const record = await createEntitlement(params.id, body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/billing/entitlements/:id", async (request, reply) => {
    await requireRole(request, ["admin"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateEntitlementSchema, request.body);
      const record = await updateEntitlement(params.id, body);
      if (!record) return reply.notFound("Entitlement not found.");
      return record;
    });
  });

  // -------------------------------------------------------------------------
  // Admin: Subscriptions
  // -------------------------------------------------------------------------
  server.get("/api/v1/billing/subscriptions", async (request, reply) => {
    await requireRole(request, ["admin", "moderator"]);
    return withValidation(reply, async () => {
      const query = parse(adminListSubscriptionsQuerySchema, request.query);
      return listSubscriptions(query);
    });
  });

  server.get("/api/v1/billing/subscriptions/stats", async (request) => {
    await requireRole(request, ["admin", "moderator"]);
    return getSubscriptionStats();
  });

  server.post("/api/v1/billing/subscriptions", async (request, reply) => {
    await requireRole(request, ["admin"]);
    return withValidation(reply, async () => {
      const body = parse(createSubscriptionSchema, request.body);
      const record = await createSubscription(body);
      return reply.status(201).send(record);
    });
  });

  server.patch("/api/v1/billing/subscriptions/:id", async (request, reply) => {
    await requireRole(request, ["admin"]);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateSubscriptionSchema, request.body);
      const record = await updateSubscription(params.id, body);
      if (!record) return reply.notFound("Subscription not found.");
      return record;
    });
  });
}
