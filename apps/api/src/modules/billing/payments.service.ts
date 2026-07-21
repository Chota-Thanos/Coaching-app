import { one, query } from "../../db.js";

/**
 * The unified payment ledger (billing.payments) plus the raw provider event log
 * (billing.payment_events). Both the synchronous verify endpoints and the
 * Razorpay webhook write here, deduplicated on (provider, provider_payment_id),
 * so whichever path lands second is a no-op rather than a duplicate charge row.
 */

export type PaymentProductType = "subscription" | "study_plan" | "mentorship";
export type PaymentStatus = "created" | "paid" | "failed" | "refunded";
export type PaymentSource = "verify" | "webhook" | "manual" | "simulated";

export type RecordPaymentInput = {
  userId: number;
  productType: PaymentProductType;
  productId?: number | null;
  productLabel?: string | null;
  provider?: string;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  amountMinor?: number;
  currency?: string;
  status?: PaymentStatus;
  method?: string | null;
  source?: PaymentSource;
  notes?: string | null;
  meta?: Record<string, unknown>;
};

/**
 * Upsert a payment into the ledger. Never throws — a ledger failure must not
 * break the actual payment flow, so callers can fire-and-forget.
 */
export async function recordPayment(input: RecordPaymentInput): Promise<unknown | null> {
  try {
    return await one(
      `
        insert into billing.payments (
          user_id, product_type, product_id, product_label, provider,
          provider_order_id, provider_payment_id, amount_minor, currency,
          status, method, source, notes, meta
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        on conflict (provider, provider_payment_id) where provider_payment_id is not null
        do update set
          status = excluded.status,
          amount_minor = case
            when excluded.amount_minor > 0 then excluded.amount_minor
            else billing.payments.amount_minor
          end,
          method = coalesce(excluded.method, billing.payments.method),
          product_id = coalesce(excluded.product_id, billing.payments.product_id),
          product_label = coalesce(excluded.product_label, billing.payments.product_label),
          meta = billing.payments.meta || excluded.meta,
          updated_at = now()
        returning *
      `,
      [
        input.userId,
        input.productType,
        input.productId ?? null,
        input.productLabel ?? null,
        input.provider ?? "razorpay",
        input.providerOrderId ?? null,
        input.providerPaymentId ?? null,
        input.amountMinor ?? 0,
        input.currency ?? "INR",
        input.status ?? "paid",
        input.method ?? null,
        input.source ?? "verify",
        input.notes ?? null,
        JSON.stringify(input.meta ?? {})
      ]
    );
  } catch (err) {
    console.error("[payments] failed to record payment in ledger:", err);
    return null;
  }
}

/**
 * Persist a raw provider event. The unique (provider, provider_event_id)
 * constraint doubles as webhook idempotency: returns false when this event was
 * already recorded, so the caller can skip re-processing it.
 */
export async function recordPaymentEvent(params: {
  provider: string;
  eventId: string;
  eventType: string;
  payload: unknown;
}): Promise<{ isNew: boolean }> {
  try {
    const row = await one<{ id: string }>(
      `
        insert into billing.payment_events (provider, provider_event_id, event_type, payload, processed_at)
        values ($1, $2, $3, $4, now())
        on conflict (provider, provider_event_id) do nothing
        returning id
      `,
      [params.provider, params.eventId, params.eventType, JSON.stringify(params.payload ?? {})]
    );
    return { isNew: Boolean(row) };
  } catch (err) {
    console.error("[payments] failed to record payment event:", err);
    // Fail open: better to re-process an event than to silently drop it.
    return { isNew: true };
  }
}

export type ListPaymentsFilters = {
  user_id?: number;
  product_type?: PaymentProductType;
  status?: PaymentStatus;
  provider?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

/** Admin: unified list of every payment, newest first. */
export async function listPayments(filters: ListPaymentsFilters): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters.user_id) {
    params.push(filters.user_id);
    conditions.push(`p.user_id = $${params.length}`);
  }
  if (filters.product_type) {
    params.push(filters.product_type);
    conditions.push(`p.product_type = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`p.status = $${params.length}`);
  }
  if (filters.provider) {
    params.push(filters.provider);
    conditions.push(`p.provider = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`p.created_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`p.created_at <= $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const i = params.length;
    conditions.push(
      `(u.email ilike $${i} or u.username ilike $${i} or p.provider_payment_id ilike $${i} or p.provider_order_id ilike $${i} or p.product_label ilike $${i})`
    );
  }

  params.push(filters.limit ?? 100);
  const limitPos = params.length;
  params.push(filters.offset ?? 0);
  const offsetPos = params.length;

  return query(
    `
      select p.*,
        json_build_object('id', u.id, 'email', u.email, 'username', u.username, 'role', u.role) as user
      from billing.payments p
      join app.users u on u.id = p.user_id
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      order by p.created_at desc
      limit $${limitPos} offset $${offsetPos}
    `,
    params
  );
}

/** Admin: a single payment with its owner, for dispute lookup. */
export async function getPaymentById(id: number): Promise<unknown | null> {
  return one(
    `
      select p.*,
        json_build_object('id', u.id, 'email', u.email, 'username', u.username, 'role', u.role) as user
      from billing.payments p
      join app.users u on u.id = p.user_id
      where p.id = $1
    `,
    [id]
  );
}

/** Admin: headline revenue/volume figures for the payments dashboard. */
export async function getPaymentStats(): Promise<unknown> {
  return one(
    `
      select
        count(*)::int as total_payments,
        count(*) filter (where status = 'paid')::int as paid_count,
        count(*) filter (where status = 'refunded')::int as refunded_count,
        count(*) filter (where status = 'failed')::int as failed_count,
        coalesce(sum(amount_minor) filter (where status = 'paid'), 0)::bigint as gross_minor,
        coalesce(sum(amount_minor) filter (where status = 'refunded'), 0)::bigint as refunded_minor,
        coalesce(sum(amount_minor) filter (where status = 'paid' and created_at >= now() - interval '30 days'), 0)::bigint as gross_minor_30d,
        count(*) filter (where status = 'paid' and product_type = 'subscription')::int as subscription_count,
        count(*) filter (where status = 'paid' and product_type = 'study_plan')::int as study_plan_count,
        count(*) filter (where status = 'paid' and product_type = 'mentorship')::int as mentorship_count
      from billing.payments
    `
  );
}

/** A user's own payment history, for /dashboard/purchases. */
export async function listPaymentsForUser(userId: number): Promise<unknown[]> {
  return query(
    `
      select id, product_type, product_id, product_label, provider,
             provider_order_id, provider_payment_id, amount_minor, currency,
             status, method, created_at
      from billing.payments
      where user_id = $1
      order by created_at desc
    `,
    [userId]
  );
}

/** Admin: mark a payment refunded (record-keeping; does not call Razorpay). */
export async function markPaymentRefunded(id: number, notes?: string | null): Promise<unknown | null> {
  return one(
    `
      update billing.payments
      set status = 'refunded',
          notes = coalesce($2, notes),
          meta = meta || jsonb_build_object('refunded_at', now()),
          updated_at = now()
      where id = $1
      returning *
    `,
    [id, notes ?? null]
  );
}
