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

export async function registerBillingRoutes(server: FastifyInstance): Promise<void> {

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
    return getUserEntitlements(actor.id);
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
