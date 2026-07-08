-- Migration: Create study_plan.plan_weeks and study_plan.reviews tables
-- Date: 2026-07-08

create table if not exists study_plan.plan_weeks (
  plan_id bigint not null references study_plan.plans(id) on delete cascade,
  week_no integer not null check (week_no > 0),
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, week_no)
);

create trigger trg_study_plan_plan_weeks_updated_at
before update on study_plan.plan_weeks
for each row execute function assessment.set_updated_at();

create table if not exists study_plan.reviews (
  id bigserial primary key,
  plan_id bigint not null references study_plan.plans(id) on delete cascade,
  user_id bigint not null references app.users(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, user_id)
);

create trigger trg_study_plan_reviews_updated_at
before update on study_plan.reviews
for each row execute function assessment.set_updated_at();
