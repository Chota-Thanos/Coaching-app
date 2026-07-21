import crypto from "node:crypto";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { config } from "../../config.js";
import { reconcileBillingSubscriptionFromWebhook } from "./service.js";
import { recordPayment, recordPaymentEvent } from "./payments.service.js";
import { reconcileMentorshipPaymentFromWebhook } from "../mentorship/service.js";
import { reconcileStudyPlanEnrollmentFromWebhook } from "../study-plans/service.js";

type RazorpayEntity = {
  id?: string;
  order_id?: string;
  notes?: Record<string, string> | null;
  amount?: number;
  currency?: string;
  method?: string;
};

type RazorpayEvent = {
  event?: string;
  payload?: {
    order?: { entity?: RazorpayEntity };
    payment?: { entity?: RazorpayEntity };
  };
};

/**
 * Registers the Razorpay webhook endpoint in its own encapsulated context so we
 * can capture the RAW request body (Razorpay signs the exact bytes; the default
 * JSON parser would discard them and break HMAC verification).
 *
 * URL:    POST /api/v1/billing/razorpay/webhook
 * Events: order.paid (recommended — carries order notes), payment.captured.
 * Secret: RAZORPAY_WEBHOOK_SECRET (the webhook's own secret, set in the Razorpay
 *         dashboard when creating the webhook — distinct from the API key secret).
 */
export async function registerRazorpayWebhookRoute(server: FastifyInstance): Promise<void> {
  await server.register(async (instance) => {
    // Encapsulated to this child context only: drop the inherited JSON parser
    // (which would consume the body and break HMAC) and keep the raw bytes.
    instance.removeAllContentTypeParsers();
    instance.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_req, body, done) => {
        done(null, body);
      }
    );

    instance.post("/api/v1/billing/razorpay/webhook", async (request, reply) => {
      const secret = config.RAZORPAY_WEBHOOK_SECRET;
      const raw = request.body as Buffer;
      const signature = request.headers["x-razorpay-signature"];

      if (!secret) {
        request.log.error(
          "Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured; ignoring."
        );
        return reply.status(200).send({ received: true, ignored: "no_secret" });
      }
      if (!raw || !Buffer.isBuffer(raw) || typeof signature !== "string") {
        return reply.status(400).send({ error: "Missing body or signature." });
      }

      const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
      const sigBuf = Buffer.from(signature, "utf8");
      const expBuf = Buffer.from(expected, "utf8");
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return reply.status(400).send({ error: "Invalid webhook signature." });
      }

      let event: RazorpayEvent;
      try {
        event = JSON.parse(raw.toString("utf8")) as RazorpayEvent;
      } catch {
        return reply.status(400).send({ error: "Invalid JSON payload." });
      }

      try {
        await processRazorpayEvent(event, request.log);
      } catch (err) {
        // Acknowledge with 200 anyway: the synchronous verify flow is the primary
        // path, and returning 5xx would make Razorpay retry a non-transient bug.
        request.log.error({ err }, "Razorpay webhook processing failed");
      }
      return reply.status(200).send({ received: true });
    });
  });
}

async function processRazorpayEvent(event: RazorpayEvent, log: FastifyBaseLogger): Promise<void> {
  const type = event?.event;
  const paymentEntityEarly = event?.payload?.payment?.entity;

  // Persist the raw event first. The unique (provider, provider_event_id)
  // constraint doubles as idempotency: a redelivered event is skipped here
  // rather than re-granting access downstream.
  const eventId = `${type ?? "unknown"}:${paymentEntityEarly?.id ?? event?.payload?.order?.entity?.id ?? Date.now()}`;
  const { isNew } = await recordPaymentEvent({
    provider: "razorpay",
    eventId,
    eventType: type ?? "unknown",
    payload: event
  });
  if (!isNew) {
    log.info({ eventId }, "Razorpay webhook: duplicate event, already processed");
    return;
  }

  // Only successful-capture events grant access. Ignore payment.failed, refunds, etc.
  if (type !== "order.paid" && type !== "payment.captured") return;

  const orderEntity = event?.payload?.order?.entity;
  const paymentEntity = paymentEntityEarly;

  const paymentId = paymentEntity?.id ?? null;
  const orderId = orderEntity?.id ?? paymentEntity?.order_id ?? null;
  if (!paymentId) {
    log.warn("Razorpay webhook: no payment id in event, skipping");
    return;
  }

  // Order notes carry our routing info. They're present on order.paid; for
  // payment.captured (payment entity only) we fetch the order to recover them.
  let notes: Record<string, string> = (orderEntity?.notes ?? paymentEntity?.notes ?? {}) as Record<
    string,
    string
  >;
  if (Object.keys(notes).length === 0 && orderId) {
    notes = await fetchOrderNotes(orderId);
  }

  // Common payment facts for the ledger, taken from the payment entity.
  const ledgerBase = {
    provider: "razorpay",
    providerOrderId: orderId,
    providerPaymentId: paymentId,
    amountMinor: Number(paymentEntity?.amount ?? orderEntity?.amount ?? 0),
    currency: paymentEntity?.currency ?? orderEntity?.currency ?? "INR",
    method: paymentEntity?.method ?? null,
    status: "paid" as const,
    source: "webhook" as const
  };

  if (notes.mentorship_request_id) {
    const res = await reconcileMentorshipPaymentFromWebhook({
      requestId: Number(notes.mentorship_request_id),
      orderId,
      paymentId
    });
    await recordPayment({
      ...ledgerBase,
      userId: Number(notes.user_id),
      productType: "mentorship",
      productId: Number(notes.mentorship_request_id),
      productLabel: "Mentorship session",
      meta: { reconcile: res }
    });
    log.info({ res, orderId }, "Razorpay webhook: mentorship reconciled");
  } else if (notes.study_plan_id && notes.user_id) {
    const res = await reconcileStudyPlanEnrollmentFromWebhook({
      userId: Number(notes.user_id),
      studyPlanId: Number(notes.study_plan_id),
      orderId,
      paymentId
    });
    await recordPayment({
      ...ledgerBase,
      userId: Number(notes.user_id),
      productType: "study_plan",
      productId: Number(notes.study_plan_id),
      meta: { reconcile: res }
    });
    log.info({ res, orderId }, "Razorpay webhook: study-plan reconciled");
  } else if (notes.plan_price_id && notes.user_id) {
    const res = await reconcileBillingSubscriptionFromWebhook({
      userId: Number(notes.user_id),
      planPriceId: Number(notes.plan_price_id),
      orderId,
      paymentId
    });
    await recordPayment({
      ...ledgerBase,
      userId: Number(notes.user_id),
      productType: "subscription",
      productId: notes.plan_id ? Number(notes.plan_id) : null,
      meta: { reconcile: res, plan_price_id: Number(notes.plan_price_id) }
    });
    log.info({ res, orderId }, "Razorpay webhook: subscription reconciled");
  } else {
    log.warn({ notes, orderId }, "Razorpay webhook: unrecognized order notes, nothing to reconcile");
  }
}

/** Fetch an order's notes from the Razorpay API (used when the event payload
 * doesn't include them, e.g. payment.captured). Returns {} if unavailable. */
async function fetchOrderNotes(orderId: string): Promise<Record<string, string>> {
  const keyId = config.RAZORPAY_KEY_ID;
  const keySecret = config.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return {};
  try {
    const cred = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const resp = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: { Authorization: `Basic ${cred}` }
    });
    if (!resp.ok) return {};
    const order = (await resp.json()) as { notes?: Record<string, string> | null };
    return order?.notes ?? {};
  } catch {
    return {};
  }
}
