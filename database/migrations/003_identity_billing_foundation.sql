-- Identity, RBAC, audit logs, and subscription entitlements
-- Date: 2026-05-31

create schema if not exists app;
create schema if not exists billing;

create table if not exists app.users (
  id bigint generated always as identity primary key,
  email text not null unique,
  username text not null unique,
  password_hash text not null,
  role text not null default 'student'
    check (role in ('student', 'admin', 'moderator', 'content_editor', 'evaluator')),
  is_active boolean not null default true,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_users_role on app.users(role);
create index if not exists idx_app_users_active on app.users(is_active);

create table if not exists app.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id bigint references app.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor_created
  on app.audit_logs(actor_user_id, created_at desc);

create index if not exists idx_audit_logs_entity
  on app.audit_logs(entity_type, entity_id);

insert into app.users (id, email, username, password_hash, role, is_active)
overriding system value
values (1, 'system@local.invalid', 'system_admin', 'disabled', 'admin', false)
on conflict (id) do nothing;

select setval(
  pg_get_serial_sequence('app.users', 'id'),
  greatest((select coalesce(max(id), 1) from app.users), 1),
  true
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'assessment'
      and table_name = 'test_attempts'
      and constraint_name = 'fk_test_attempts_user'
  ) then
    alter table assessment.test_attempts
      add constraint fk_test_attempts_user
      foreign key (user_id)
      references app.users(id)
      on delete cascade;
  end if;
end
$$;

create table if not exists billing.plans (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists billing.plan_prices (
  id bigint generated always as identity primary key,
  plan_id bigint not null references billing.plans(id) on delete cascade,
  currency text not null default 'INR',
  amount_minor integer not null check (amount_minor >= 0),
  billing_interval text not null default 'month'
    check (billing_interval in ('one_time', 'month', 'quarter', 'year')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists billing.subscriptions (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  plan_id bigint not null references billing.plans(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'pending', 'inactive', 'cancelled', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  provider text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_status
  on billing.subscriptions(user_id, status, ends_at);

create table if not exists billing.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists billing.entitlements (
  id bigint generated always as identity primary key,
  plan_id bigint not null references billing.plans(id) on delete cascade,
  entitlement_key text not null,
  limit_value integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (plan_id, entitlement_key)
);

insert into billing.plans (code, name, description)
values ('assessment_premium', 'Assessment Premium', 'Premium access to paid assessment test series and analytics.')
on conflict (code) do nothing;

insert into billing.entitlements (plan_id, entitlement_key)
select id, 'assessment.premium_tests'
from billing.plans
where code = 'assessment_premium'
on conflict (plan_id, entitlement_key) do nothing;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'assessment'
      and table_name = 'test_templates'
      and constraint_name = 'fk_test_templates_subscription_plan'
  ) then
    alter table assessment.test_templates
      add constraint fk_test_templates_subscription_plan
      foreign key (subscription_plan_id)
      references billing.plans(id)
      on delete restrict;
  end if;
end
$$;
