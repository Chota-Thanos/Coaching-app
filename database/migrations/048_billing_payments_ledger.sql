-- 048_billing_payments_ledger.sql
--
-- A single normalized ledger of every payment across all revenue streams.
--
-- Before this, payment facts lived in three disconnected places:
--   * subscriptions -> billing.subscriptions.provider_subscription_id
--   * study plans   -> study_plan.enrollments.razorpay_payment_id
--   * mentorship    -> app.mentorship_requests.meta->'payment' (JSON)
-- which made "show me every payment received", dispute lookup, and
-- reconciliation against Razorpay a manual, error-prone exercise.
--
-- billing.payment_events already existed for raw provider events but was never
-- written to by any code; it is now used by the Razorpay webhook.

create table if not exists billing.payments (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,

  -- What was bought. product_id points at the subscription / study plan /
  -- mentorship request depending on product_type.
  product_type text not null
    check (product_type in ('subscription', 'study_plan', 'mentorship')),
  product_id bigint,
  product_label text,

  provider text not null default 'razorpay',
  provider_order_id text,
  provider_payment_id text,

  amount_minor bigint not null default 0,
  currency text not null default 'INR',

  status text not null default 'paid'
    check (status in ('created', 'paid', 'failed', 'refunded')),
  method text,

  -- Which code path recorded it: the synchronous verify call, the Razorpay
  -- webhook safety net, or an admin acting manually.
  source text not null default 'verify'
    check (source in ('verify', 'webhook', 'manual', 'simulated')),

  notes text,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per real provider payment. This is what lets the synchronous verify
-- path and the webhook both record the same payment without duplicating it
-- (whichever lands second is a no-op via ON CONFLICT).
create unique index if not exists billing_payments_provider_payment_uniq
  on billing.payments (provider, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists idx_billing_payments_user
  on billing.payments (user_id, created_at desc);
create index if not exists idx_billing_payments_product
  on billing.payments (product_type, product_id);
create index if not exists idx_billing_payments_created
  on billing.payments (created_at desc);
create index if not exists idx_billing_payments_status
  on billing.payments (status);
create index if not exists idx_billing_payments_order
  on billing.payments (provider_order_id);

comment on table billing.payments is
  'Unified ledger of every payment across subscriptions, study plans and mentorship. Written by both the synchronous verify endpoints and the Razorpay webhook; deduplicated on (provider, provider_payment_id).';

-- ---------------------------------------------------------------------------
-- One-time backfill from the three pre-existing sources, so the ledger is
-- complete from day one rather than only covering payments made after deploy.
-- Rows are marked meta->>'backfilled' = 'true'. Amounts are best-effort:
-- subscriptions never stored the amount paid, so those land as 0 and must be
-- cross-checked against Razorpay if they ever matter for a dispute.
-- ---------------------------------------------------------------------------

insert into billing.payments (
  user_id, product_type, product_id, product_label, provider,
  provider_payment_id, amount_minor, currency, status, source, created_at, meta
)
select
  s.user_id,
  'subscription',
  s.id,
  p.name,
  coalesce(s.provider, 'razorpay'),
  s.provider_subscription_id,
  0,
  'INR',
  case when s.status in ('cancelled', 'expired') then 'paid' else 'paid' end,
  case when s.provider = 'simulated' then 'simulated' else 'manual' end,
  s.created_at,
  jsonb_build_object('backfilled', true, 'subscription_status', s.status)
from billing.subscriptions s
join billing.plans p on p.id = s.plan_id
on conflict do nothing;

insert into billing.payments (
  user_id, product_type, product_id, product_label, provider,
  provider_order_id, provider_payment_id, amount_minor, currency,
  status, source, created_at, meta
)
select
  e.user_id,
  'study_plan',
  e.plan_id,
  sp.title,
  coalesce(e.provider, 'razorpay'),
  e.razorpay_order_id,
  e.razorpay_payment_id,
  coalesce(e.payment_amount, 0),
  coalesce(e.payment_currency, 'INR'),
  'paid',
  case when e.provider = 'simulated' then 'simulated' else 'manual' end,
  coalesce(e.purchased_at, e.created_at),
  jsonb_build_object('backfilled', true)
from study_plan.enrollments e
join study_plan.plans sp on sp.id = e.plan_id
where e.payment_status = 'paid'
on conflict do nothing;

insert into billing.payments (
  user_id, product_type, product_id, product_label, provider,
  provider_order_id, provider_payment_id, amount_minor, currency,
  status, source, created_at, meta
)
select
  r.user_id,
  'mentorship',
  r.id,
  'Mentorship session',
  coalesce(r.meta -> 'payment' ->> 'provider', 'razorpay'),
  r.meta -> 'payment' ->> 'razorpay_order_id',
  r.meta -> 'payment' ->> 'razorpay_payment_id',
  -- mentorship_requests.payment_amount is stored in rupees, not paise
  (coalesce(r.payment_amount, 0) * 100)::bigint,
  coalesce(r.payment_currency, 'INR'),
  'paid',
  case when r.meta -> 'payment' ->> 'provider' = 'simulated' then 'simulated' else 'manual' end,
  r.updated_at,
  jsonb_build_object('backfilled', true)
from app.mentorship_requests r
where r.payment_status = 'paid'
on conflict do nothing;
