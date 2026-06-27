-- Study plan LMS module: paid plans, week/day timeline, separate plan test storage.
-- Date: 2026-06-09

create schema if not exists study_plan;

create table if not exists study_plan.plans (
  id bigint generated always as identity primary key,
  title text not null,
  slug text not null unique,
  subtitle text,
  description text,
  exam_id bigint not null references assessment.exams(id) on delete restrict,
  subject_node_id bigint references assessment.assessment_taxonomy_nodes(id) on delete set null,
  duration_weeks integer not null check (duration_weeks > 0),
  level_label text,
  language text not null default 'English',
  cover_image_url text,
  preview_video_url text,
  price_amount_minor integer not null default 0 check (price_amount_minor >= 0),
  currency text not null default 'INR',
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'published', 'archived')),
  created_by_user_id bigint references app.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_plans_exam_status
  on study_plan.plans(exam_id, status, price_amount_minor);

drop trigger if exists trg_study_plans_updated_at on study_plan.plans;
create trigger trg_study_plans_updated_at
before update on study_plan.plans
for each row
execute function assessment.set_updated_at();

create table if not exists study_plan.test_templates (
  id bigint generated always as identity primary key,
  title text not null,
  slug text not null unique,
  description text,
  exam_id bigint not null references assessment.exams(id) on delete restrict,
  exam_level_id bigint not null references assessment.exam_levels(id) on delete restrict,
  test_type text not null
    check (test_type in ('prelims_test', 'csat_test', 'mains_test')),
  duration_minutes integer not null check (duration_minutes > 0),
  total_marks numeric(10,2) not null default 0,
  negative_marks_per_question numeric(10,2) not null default 0,
  instructions text,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'published', 'archived')),
  created_by_user_id bigint references app.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_plan_tests_exam_type_status
  on study_plan.test_templates(exam_id, exam_level_id, test_type, status);

drop trigger if exists trg_study_plan_tests_updated_at on study_plan.test_templates;
create trigger trg_study_plan_tests_updated_at
before update on study_plan.test_templates
for each row
execute function assessment.set_updated_at();

create table if not exists study_plan.test_questions (
  id bigint generated always as identity primary key,
  test_template_id bigint not null references study_plan.test_templates(id) on delete cascade,
  display_order integer not null default 0,
  question_family text not null default 'objective'
    check (question_family in ('objective', 'mains_subjective')),
  question_statement text not null,
  supplementary_statement text,
  question_prompt text,
  options jsonb not null default '[]'::jsonb,
  correct_answer jsonb,
  explanation text,
  model_answer text,
  marks numeric(10,2) not null default 1,
  negative_marks numeric(10,2) not null default 0,
  subject_node_id bigint references assessment.assessment_taxonomy_nodes(id) on delete set null,
  topic_node_id bigint references assessment.assessment_taxonomy_nodes(id) on delete set null,
  subtopic_node_id bigint references assessment.assessment_taxonomy_nodes(id) on delete set null,
  question_nature_id bigint references assessment.question_natures(id) on delete set null,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_plan_test_questions_test_order
  on study_plan.test_questions(test_template_id, display_order, id);

create index if not exists idx_study_plan_test_questions_subject
  on study_plan.test_questions(subject_node_id, topic_node_id, subtopic_node_id);

drop trigger if exists trg_study_plan_test_questions_updated_at on study_plan.test_questions;
create trigger trg_study_plan_test_questions_updated_at
before update on study_plan.test_questions
for each row
execute function assessment.set_updated_at();

create table if not exists study_plan.plan_items (
  id bigint generated always as identity primary key,
  plan_id bigint not null references study_plan.plans(id) on delete cascade,
  week_no integer not null check (week_no > 0),
  day_no integer not null check (day_no > 0 and day_no <= 7),
  display_order integer not null default 0,
  item_type text not null
    check (item_type in ('reading', 'revision', 'prelims_test', 'csat_test', 'mains_test', 'live_lecture')),
  title text not null,
  description text,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  resource_url text,
  lecture_url text,
  test_template_id bigint references study_plan.test_templates(id) on delete set null,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_plan_items_plan_schedule
  on study_plan.plan_items(plan_id, week_no, day_no, display_order, id);

drop trigger if exists trg_study_plan_items_updated_at on study_plan.plan_items;
create trigger trg_study_plan_items_updated_at
before update on study_plan.plan_items
for each row
execute function assessment.set_updated_at();

create table if not exists study_plan.enrollments (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  plan_id bigint not null references study_plan.plans(id) on delete cascade,
  status text not null default 'active'
    check (status in ('pending_payment', 'active', 'completed', 'cancelled', 'refunded')),
  amount_paid_minor integer not null default 0 check (amount_paid_minor >= 0),
  currency text not null default 'INR',
  provider text,
  provider_payment_id text,
  purchased_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_id)
);

create index if not exists idx_study_plan_enrollments_user_status
  on study_plan.enrollments(user_id, status, started_at desc);

drop trigger if exists trg_study_plan_enrollments_updated_at on study_plan.enrollments;
create trigger trg_study_plan_enrollments_updated_at
before update on study_plan.enrollments
for each row
execute function assessment.set_updated_at();

create table if not exists study_plan.item_progress (
  id bigint generated always as identity primary key,
  enrollment_id bigint not null references study_plan.enrollments(id) on delete cascade,
  plan_item_id bigint not null references study_plan.plan_items(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed')),
  test_attempt_id bigint,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (enrollment_id, plan_item_id)
);

create index if not exists idx_study_plan_item_progress_enrollment
  on study_plan.item_progress(enrollment_id, status);

drop trigger if exists trg_study_plan_item_progress_updated_at on study_plan.item_progress;
create trigger trg_study_plan_item_progress_updated_at
before update on study_plan.item_progress
for each row
execute function assessment.set_updated_at();

create table if not exists study_plan.test_attempts (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  test_template_id bigint not null references study_plan.test_templates(id) on delete restrict,
  plan_item_id bigint references study_plan.plan_items(id) on delete set null,
  enrollment_id bigint references study_plan.enrollments(id) on delete set null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'expired', 'cancelled')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  expires_at timestamptz,
  time_spent_seconds integer not null default 0,
  submit_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_plan_attempts_user_test
  on study_plan.test_attempts(user_id, test_template_id, started_at desc);

drop trigger if exists trg_study_plan_attempts_updated_at on study_plan.test_attempts;
create trigger trg_study_plan_attempts_updated_at
before update on study_plan.test_attempts
for each row
execute function assessment.set_updated_at();

alter table study_plan.item_progress
  drop constraint if exists fk_study_plan_item_progress_attempt;

alter table study_plan.item_progress
  add constraint fk_study_plan_item_progress_attempt
  foreign key (test_attempt_id)
  references study_plan.test_attempts(id)
  on delete set null;

create table if not exists study_plan.attempt_responses (
  id bigint generated always as identity primary key,
  attempt_id bigint not null references study_plan.test_attempts(id) on delete cascade,
  question_id bigint not null references study_plan.test_questions(id) on delete restrict,
  selected_answer jsonb,
  answer_text text,
  status text not null default 'not_visited'
    check (status in ('not_visited', 'answered', 'skipped', 'marked_for_review')),
  is_marked_for_review boolean not null default false,
  time_spent_seconds integer not null default 0,
  answered_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists idx_study_plan_attempt_responses_attempt
  on study_plan.attempt_responses(attempt_id);

drop trigger if exists trg_study_plan_attempt_responses_updated_at on study_plan.attempt_responses;
create trigger trg_study_plan_attempt_responses_updated_at
before update on study_plan.attempt_responses
for each row
execute function assessment.set_updated_at();

create or replace function study_plan.ensure_response_question_belongs_to_attempt_test()
returns trigger as $$
begin
  if not exists (
    select 1
    from study_plan.test_attempts ta
    join study_plan.test_questions tq on tq.test_template_id = ta.test_template_id
    where ta.id = new.attempt_id
      and tq.id = new.question_id
  ) then
    raise exception 'Question does not belong to this study plan test.';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_study_plan_attempt_responses_question_in_test
  on study_plan.attempt_responses;
create trigger trg_study_plan_attempt_responses_question_in_test
before insert or update on study_plan.attempt_responses
for each row
execute function study_plan.ensure_response_question_belongs_to_attempt_test();

create table if not exists study_plan.test_results (
  id bigint generated always as identity primary key,
  attempt_id bigint not null unique references study_plan.test_attempts(id) on delete cascade,
  score numeric(10,2) not null default 0,
  max_score numeric(10,2) not null default 0,
  accuracy numeric(7,4) not null default 0,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  unattempted_count integer not null default 0,
  negative_marks numeric(10,2) not null default 0,
  result_status text not null default 'scored'
    check (result_status in ('scored', 'submitted_unscored')),
  summary_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists study_plan.result_topic_breakdowns (
  id bigint generated always as identity primary key,
  result_id bigint not null references study_plan.test_results(id) on delete cascade,
  taxonomy_node_id bigint references assessment.assessment_taxonomy_nodes(id) on delete set null,
  question_nature_id bigint references assessment.question_natures(id) on delete set null,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  unattempted_count integer not null default 0,
  score numeric(10,2) not null default 0,
  accuracy numeric(7,4) not null default 0,
  avg_time_seconds numeric(10,2) not null default 0
);

create index if not exists idx_study_plan_result_breakdowns_result
  on study_plan.result_topic_breakdowns(result_id);

create table if not exists study_plan.question_import_batches (
  id bigint generated always as identity primary key,
  created_by_user_id bigint references app.users(id) on delete set null,
  source_filename text,
  source_file_url text,
  status text not null default 'draft'
    check (status in ('draft', 'parsed', 'reviewed', 'published', 'failed')),
  parser_kind text not null default 'manual_json',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists study_plan.question_import_items (
  id bigint generated always as identity primary key,
  batch_id bigint not null references study_plan.question_import_batches(id) on delete cascade,
  raw_payload jsonb not null,
  normalized_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'published')),
  validation_errors jsonb not null default '[]'::jsonb,
  published_question_id bigint references study_plan.test_questions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_plan_question_import_items_batch_status
  on study_plan.question_import_items(batch_id, status);
