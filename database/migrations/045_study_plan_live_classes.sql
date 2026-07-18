-- Live classes for Study Plans: one-to-many Agora broadcast sessions, scheduled as
-- a plan_items entry (item_type = 'live_lecture') optionally linked to a real session.
-- Date: 2026-07-18

create table if not exists study_plan.live_classes (
  id bigint generated always as identity primary key,
  plan_id bigint not null references study_plan.plans(id) on delete cascade,
  plan_item_id bigint references study_plan.plan_items(id) on delete set null,
  title text not null,
  description text,
  host_user_id bigint not null references app.users(id) on delete restrict,
  channel_name text not null unique,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  started_at timestamptz,
  ended_at timestamptz,
  created_by_user_id bigint references app.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_plan_live_classes_plan
  on study_plan.live_classes(plan_id, scheduled_start);

create index if not exists idx_study_plan_live_classes_status
  on study_plan.live_classes(status, scheduled_start);

drop trigger if exists trg_study_plan_live_classes_updated_at on study_plan.live_classes;
create trigger trg_study_plan_live_classes_updated_at
before update on study_plan.live_classes
for each row
execute function assessment.set_updated_at();

create table if not exists study_plan.live_class_attendance (
  id bigint generated always as identity primary key,
  live_class_id bigint not null references study_plan.live_classes(id) on delete cascade,
  user_id bigint not null references app.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (live_class_id, user_id, joined_at)
);

create index if not exists idx_study_plan_live_class_attendance_class
  on study_plan.live_class_attendance(live_class_id);

alter table study_plan.plan_items
  add column if not exists live_class_id bigint references study_plan.live_classes(id) on delete set null;

comment on column study_plan.live_classes.channel_name is
  'Agora RTC channel name, unique per session. Tokens are minted per-user/per-role against this channel, never shared or persisted client-side.';

comment on column study_plan.live_classes.host_user_id is
  'The staff/admin account that owns this session and is issued the broadcaster-role token. Any admin/moderator can be assigned as host (not tied to the separate mentors feature).';
