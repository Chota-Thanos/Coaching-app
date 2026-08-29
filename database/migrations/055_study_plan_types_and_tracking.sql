-- Study plans: declared plan types, subscription-aware access, and the
-- scheduling columns the student tracker is built on.
--
-- Until now a plan's nature was only implied by whichever plan_items happened
-- to sit inside it, and an enrollment recorded no dates at all — so nothing
-- could say "this is a course", "your subscription covers this", or "you are
-- two days behind". Date: 2026-08-29

-- ── 1. Plan type ────────────────────────────────────────────────────────────
alter table study_plan.plans
  add column if not exists plan_type text not null default 'self_prep'
    check (plan_type in ('full_course', 'self_prep', 'test_series'));

-- ── 2. Access mode ──────────────────────────────────────────────────────────
-- 'one_time'     — priced, bought on its own (today's only behaviour)
-- 'subscription' — a subscriber holding required_entitlement_key enrols free
-- 'free'         — anyone signed in can enrol
alter table study_plan.plans
  add column if not exists access_mode text not null default 'one_time'
    check (access_mode in ('one_time', 'subscription', 'free'));

-- Which entitlement unlocks it when access_mode = 'subscription'. An
-- entitlement key rather than a plan code, because that is what
-- billing.getUserEntitlements actually returns for a user.
alter table study_plan.plans
  add column if not exists required_entitlement_key text;

-- ── 3. Effort estimate, shown before purchase ───────────────────────────────
alter table study_plan.plans
  add column if not exists weekly_hours numeric(5,1)
    check (weekly_hours is null or weekly_hours > 0);

-- Benchmark the depth signal compares a learner's test average against.
alter table study_plan.plans
  add column if not exists target_accuracy numeric(5,2) not null default 70.0
    check (target_accuracy > 0 and target_accuracy <= 100);

-- ── 4. Scheduling on the enrollment ─────────────────────────────────────────
-- start_date is picked by the learner; study_days says which weekdays they
-- actually study (1 = Monday … 7 = Sunday, matching ISO dow); target_end_date
-- is derived once at enrolment and then held fixed, so "on time" always means
-- "against what we agreed", and a reschedule is an explicit change to it.
alter table study_plan.enrollments
  add column if not exists start_date date;

alter table study_plan.enrollments
  add column if not exists study_days smallint[] not null default '{1,2,3,4,5,6,7}';

alter table study_plan.enrollments
  add column if not exists target_end_date date;

alter table study_plan.enrollments
  add column if not exists rescheduled_count integer not null default 0;

alter table study_plan.enrollments
  add column if not exists last_activity_at timestamptz;

-- Existing enrollments keep working: anchor them to the day they began.
update study_plan.enrollments
   set start_date = started_at::date
 where start_date is null;

-- ── 5. Depth signal needs real time-on-task ─────────────────────────────────
-- Tests already record their own duration; readings and lectures did not, so
-- "marked complete in 90 seconds of a 45-minute reading" was undetectable.
alter table study_plan.item_progress
  add column if not exists time_spent_seconds integer not null default 0
    check (time_spent_seconds >= 0);

alter table study_plan.item_progress
  add column if not exists started_at timestamptz;

-- ── 6. Many resources per item ──────────────────────────────────────────────
create table if not exists study_plan.plan_item_resources (
  id bigint generated always as identity primary key,
  plan_item_id bigint not null references study_plan.plan_items(id) on delete cascade,
  title text not null,
  resource_kind text not null default 'link'
    check (resource_kind in ('link', 'pdf', 'note', 'video', 'book_pages')),
  url text,
  body text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (url is not null or body is not null)
);

create index if not exists idx_study_plan_item_resources_item
  on study_plan.plan_item_resources(plan_item_id, display_order, id);

drop trigger if exists trg_study_plan_item_resources_updated_at on study_plan.plan_item_resources;
create trigger trg_study_plan_item_resources_updated_at
before update on study_plan.plan_item_resources
for each row
execute function assessment.set_updated_at();

-- Carry the single legacy resource_url across so nothing is lost; plan_items
-- keeps the column as a fallback for anything not migrated.
insert into study_plan.plan_item_resources (plan_item_id, title, resource_kind, url, display_order)
select pi.id, coalesce(nullif(pi.title, ''), 'Resource'), 'link', pi.resource_url, 0
from study_plan.plan_items pi
where pi.resource_url is not null
  and pi.resource_url <> ''
  and not exists (
    select 1 from study_plan.plan_item_resources r where r.plan_item_id = pi.id
  );

-- ── 7. Backfill plan_type from what each plan actually contains ─────────────
-- A plan with lectures is a course; a plan with only tests is a test series;
-- everything else is self-preparation.
update study_plan.plans p
   set plan_type = 'full_course'
 where exists (
   select 1 from study_plan.plan_items pi
   where pi.plan_id = p.id and pi.item_type = 'live_lecture'
 )
    or exists (
   select 1 from study_plan.plan_items pi
   where pi.plan_id = p.id and pi.lecture_url is not null and pi.lecture_url <> ''
 );

update study_plan.plans p
   set plan_type = 'test_series'
 where p.plan_type <> 'full_course'
   and exists (
     select 1 from study_plan.plan_items pi
     where pi.plan_id = p.id
       and pi.item_type in ('prelims_test', 'csat_test', 'mains_test')
   )
   and not exists (
     select 1 from study_plan.plan_items pi
     where pi.plan_id = p.id
       and pi.item_type in ('reading', 'revision')
   );

-- Free plans keep behaving as free rather than becoming unsellable one-time
-- purchases at ₹0.
update study_plan.plans
   set access_mode = 'free'
 where coalesce(price_amount_minor, 0) = 0;

create index if not exists idx_study_plans_type_access
  on study_plan.plans(plan_type, access_mode, status);
