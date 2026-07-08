-- Migration: Seed default subscription plans and add study plan payment tracking
-- Date: 2026-06-21

-- -----------------------------------------------------------------------
-- Add payment tracking columns to study_plan.enrollments (if table exists)
-- -----------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'study_plan' and table_name = 'enrollments'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'study_plan' and table_name = 'enrollments' and column_name = 'payment_status'
    ) then
      alter table study_plan.enrollments
        add column payment_status text not null default 'free'
          check (payment_status in ('free', 'pending', 'paid', 'refunded', 'failed')),
        add column payment_amount integer not null default 0,
        add column payment_currency text not null default 'INR',
        add column razorpay_order_id text,
        add column razorpay_payment_id text;
    end if;
  end if;
end
$$;

-- -----------------------------------------------------------------------
-- Seed billing plans
-- -----------------------------------------------------------------------

-- Assessment Premium Plan
insert into billing.plans (code, name, description, is_active)
values (
  'assessment_premium',
  'Assessment Premium',
  'Full access to all premium test series, detailed analytics, performance radar, and AI-powered answer evaluation.',
  true
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

-- Current Affairs Pro Plan
insert into billing.plans (code, name, description, is_active)
values (
  'current_affairs_pro',
  'Current Affairs Pro',
  'Unlimited daily article reads, editorial deep dives, syllabus-mapped issue briefs, and personal notes workspace.',
  true
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

-- Assessment + CA Bundle Plan
insert into billing.plans (code, name, description, is_active)
values (
  'assessment_ca_bundle',
  'Complete Prep Bundle',
  'Best value — combines Assessment Premium + Current Affairs Pro at a discounted rate. Ideal for serious aspirants.',
  true
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

-- -----------------------------------------------------------------------
-- Seed plan prices (INR, in paise — 1 INR = 100 paise)
-- -----------------------------------------------------------------------

-- Assessment Premium prices
insert into billing.plan_prices (plan_id, currency, amount_minor, billing_interval, is_active)
select p.id, 'INR', 49900, 'month', true
from billing.plans p where p.code = 'assessment_premium'
on conflict do nothing;

insert into billing.plan_prices (plan_id, currency, amount_minor, billing_interval, is_active)
select p.id, 'INR', 119900, 'quarter', true
from billing.plans p where p.code = 'assessment_premium'
on conflict do nothing;

insert into billing.plan_prices (plan_id, currency, amount_minor, billing_interval, is_active)
select p.id, 'INR', 399900, 'year', true
from billing.plans p where p.code = 'assessment_premium'
on conflict do nothing;

-- Current Affairs Pro prices
insert into billing.plan_prices (plan_id, currency, amount_minor, billing_interval, is_active)
select p.id, 'INR', 29900, 'month', true
from billing.plans p where p.code = 'current_affairs_pro'
on conflict do nothing;

insert into billing.plan_prices (plan_id, currency, amount_minor, billing_interval, is_active)
select p.id, 'INR', 74900, 'quarter', true
from billing.plans p where p.code = 'current_affairs_pro'
on conflict do nothing;

insert into billing.plan_prices (plan_id, currency, amount_minor, billing_interval, is_active)
select p.id, 'INR', 249900, 'year', true
from billing.plans p where p.code = 'current_affairs_pro'
on conflict do nothing;

-- Bundle prices
insert into billing.plan_prices (plan_id, currency, amount_minor, billing_interval, is_active)
select p.id, 'INR', 69900, 'month', true
from billing.plans p where p.code = 'assessment_ca_bundle'
on conflict do nothing;

insert into billing.plan_prices (plan_id, currency, amount_minor, billing_interval, is_active)
select p.id, 'INR', 179900, 'quarter', true
from billing.plans p where p.code = 'assessment_ca_bundle'
on conflict do nothing;

insert into billing.plan_prices (plan_id, currency, amount_minor, billing_interval, is_active)
select p.id, 'INR', 599900, 'year', true
from billing.plans p where p.code = 'assessment_ca_bundle'
on conflict do nothing;

-- -----------------------------------------------------------------------
-- Seed entitlements
-- -----------------------------------------------------------------------

-- Assessment Premium entitlements
insert into billing.entitlements (plan_id, entitlement_key, limit_value, metadata)
select p.id, 'assessment.premium_tests', null, '{}'
from billing.plans p where p.code = 'assessment_premium'
on conflict (plan_id, entitlement_key) do nothing;

insert into billing.entitlements (plan_id, entitlement_key, limit_value, metadata)
select p.id, 'assessment.max_questions_per_test', null, '{}'
from billing.plans p where p.code = 'assessment_premium'
on conflict (plan_id, entitlement_key) do nothing;

insert into billing.entitlements (plan_id, entitlement_key, limit_value, metadata)
select p.id, 'assessment.ai_evaluation', null, '{}'
from billing.plans p where p.code = 'assessment_premium'
on conflict (plan_id, entitlement_key) do nothing;

insert into billing.entitlements (plan_id, entitlement_key, limit_value, metadata)
select p.id, 'assessment.performance_analytics', null, '{}'
from billing.plans p where p.code = 'assessment_premium'
on conflict (plan_id, entitlement_key) do nothing;

-- Current Affairs Pro entitlements
insert into billing.entitlements (plan_id, entitlement_key, limit_value, metadata)
select p.id, 'current_affairs.daily_reads', null, '{}'
from billing.plans p where p.code = 'current_affairs_pro'
on conflict (plan_id, entitlement_key) do nothing;

insert into billing.entitlements (plan_id, entitlement_key, limit_value, metadata)
select p.id, 'current_affairs.editorial_access', null, '{}'
from billing.plans p where p.code = 'current_affairs_pro'
on conflict (plan_id, entitlement_key) do nothing;

insert into billing.entitlements (plan_id, entitlement_key, limit_value, metadata)
select p.id, 'current_affairs.notes_workspace', null, '{}'
from billing.plans p where p.code = 'current_affairs_pro'
on conflict (plan_id, entitlement_key) do nothing;

-- Bundle entitlements (inherits all from both plans)
insert into billing.entitlements (plan_id, entitlement_key, limit_value, metadata)
select p.id, e_key, null, '{}'
from billing.plans p
cross join (values
  ('assessment.premium_tests'),
  ('assessment.max_questions_per_test'),
  ('assessment.ai_evaluation'),
  ('assessment.performance_analytics'),
  ('current_affairs.daily_reads'),
  ('current_affairs.editorial_access'),
  ('current_affairs.notes_workspace')
) as keys(e_key)
where p.code = 'assessment_ca_bundle'
on conflict (plan_id, entitlement_key) do nothing;
