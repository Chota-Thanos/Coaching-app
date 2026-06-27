import { z } from "zod";
import { listQuerySchema } from "../../common/http.js";

const idSchema = z.coerce.number().int().positive();

export const createPlanSchema = z.object({
  code: z.string().trim().min(1).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  is_active: z.boolean().optional()
});

export const updatePlanSchema = z.object({
  code: z.string().trim().min(1).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/).optional(),
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  is_active: z.boolean().optional()
});

export const createPlanPriceSchema = z.object({
  currency: z.string().trim().length(3).default("INR"),
  amount_minor: z.number().int().nonnegative(),
  billing_interval: z.enum(["one_time", "month", "quarter", "year"]).default("month"),
  is_active: z.boolean().optional()
});

export const updatePlanPriceSchema = z.object({
  currency: z.string().trim().length(3).optional(),
  amount_minor: z.number().int().nonnegative().optional(),
  billing_interval: z.enum(["one_time", "month", "quarter", "year"]).optional(),
  is_active: z.boolean().optional()
});

export const createEntitlementSchema = z.object({
  entitlement_key: z.string().trim().min(1),
  limit_value: z.number().int().nonnegative().nullable().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const updateEntitlementSchema = z.object({
  entitlement_key: z.string().trim().min(1).optional(),
  limit_value: z.number().int().nonnegative().nullable().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const createSubscriptionSchema = z.object({
  user_id: idSchema,
  plan_id: idSchema,
  status: z.enum(["active", "pending", "inactive", "cancelled", "expired"]).default("active"),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  provider: z.string().trim().optional(),
  provider_subscription_id: z.string().trim().optional()
});

export const updateSubscriptionSchema = z.object({
  plan_id: idSchema.optional(),
  status: z.enum(["active", "pending", "inactive", "cancelled", "expired"]).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  provider: z.string().trim().nullable().optional(),
  provider_subscription_id: z.string().trim().nullable().optional()
});

export const listSubscriptionsQuerySchema = listQuerySchema.extend({
  user_id: idSchema.optional(),
  plan_id: idSchema.optional(),
  status: z.enum(["active", "pending", "inactive", "cancelled", "expired"]).optional()
});

// User-facing: create a Razorpay order for a plan price
export const createOrderSchema = z.object({
  plan_price_id: idSchema
});

// User-facing: verify a Razorpay payment and activate subscription
export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
  plan_price_id: idSchema
});

// Admin: list all subscriptions with extended user info
export const adminListSubscriptionsQuerySchema = listSubscriptionsQuerySchema.extend({
  search: z.string().trim().optional()
});

export type CreatePlanInput = z.output<typeof createPlanSchema>;
export type UpdatePlanInput = z.output<typeof updatePlanSchema>;
export type CreatePlanPriceInput = z.output<typeof createPlanPriceSchema>;
export type UpdatePlanPriceInput = z.output<typeof updatePlanPriceSchema>;
export type CreateEntitlementInput = z.output<typeof createEntitlementSchema>;
export type UpdateEntitlementInput = z.output<typeof updateEntitlementSchema>;
export type CreateSubscriptionInput = z.output<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.output<typeof updateSubscriptionSchema>;
export type ListSubscriptionsQuery = z.output<typeof listSubscriptionsQuerySchema>;
export type CreateOrderInput = z.output<typeof createOrderSchema>;
export type VerifyPaymentInput = z.output<typeof verifyPaymentSchema>;
export type AdminListSubscriptionsQuery = z.output<typeof adminListSubscriptionsQuerySchema>;
