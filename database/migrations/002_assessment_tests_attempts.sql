-- Assessment module: test templates, attempts, responses, and results
-- Date: 2026-05-31

create or replace function assessment.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists assessment.test_templates (
  id bigint generated always as identity primary key,
  title text not null,
  slug text not null unique,
  description text,
  exam_id bigint not null references assessment.exams(id) on delete restrict,
  exam_level_id bigint not null references assessment.exam_levels(id) on delete restrict,
  test_type text not null default 'sectional_test'
    check (test_type in ('quick_test', 'sectional_test', 'full_length_test', 'pyq_test', 'mains_test')),
  duration_minutes integer not null check (duration_minutes > 0),
  total_marks numeric(10,2) not null default 0,
  negative_marking_config jsonb not null default '{}'::jsonb,
  cutoff_config jsonb not null default '{}'::jsonb,
  access_type text not null default 'free'
    check (access_type in ('free', 'subscription', 'paid', 'private')),
  subscription_plan_id bigint,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'published', 'archived')),
  created_by_user_id bigint,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_test_templates_exam_level
  on assessment.test_templates(exam_id, exam_level_id);

create index if not exists idx_test_templates_status
  on assessment.test_templates(status, access_type);

drop trigger if exists trg_test_templates_updated_at on assessment.test_templates;
create trigger trg_test_templates_updated_at
before update on assessment.test_templates
for each row
execute function assessment.set_updated_at();

create table if not exists assessment.test_sections (
  id bigint generated always as identity primary key,
  test_template_id bigint not null references assessment.test_templates(id) on delete cascade,
  title text not null,
  display_order integer not null default 0,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  instructions text,
  created_at timestamptz not null default now()
);

create index if not exists idx_test_sections_template_order
  on assessment.test_sections(test_template_id, display_order);

create table if not exists assessment.test_question_items (
  id bigint generated always as identity primary key,
  test_template_id bigint not null references assessment.test_templates(id) on delete cascade,
  test_section_id bigint references assessment.test_sections(id) on delete cascade,
  question_version_id bigint not null references assessment.question_versions(id) on delete restrict,
  marks numeric(10,2) not null default 1,
  negative_marks numeric(10,2) not null default 0,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (test_template_id, question_version_id)
);

create index if not exists idx_test_question_items_template_order
  on assessment.test_question_items(test_template_id, display_order);

create index if not exists idx_test_question_items_question_version
  on assessment.test_question_items(question_version_id);

create or replace function assessment.ensure_test_item_section_matches_template()
returns trigger
language plpgsql
as $$
declare
  section_template_id bigint;
begin
  if new.test_section_id is null then
    return new;
  end if;

  select ts.test_template_id
    into section_template_id
  from assessment.test_sections ts
  where ts.id = new.test_section_id;

  if section_template_id is null then
    raise exception 'test_section_id % does not exist', new.test_section_id;
  end if;

  if section_template_id <> new.test_template_id then
    raise exception 'test_section_id % does not belong to test_template_id %', new.test_section_id, new.test_template_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_test_items_section_template on assessment.test_question_items;
create trigger trg_test_items_section_template
before insert or update of test_template_id, test_section_id
on assessment.test_question_items
for each row
execute function assessment.ensure_test_item_section_matches_template();

create table if not exists assessment.test_attempts (
  id bigint generated always as identity primary key,
  user_id bigint not null,
  test_template_id bigint not null references assessment.test_templates(id) on delete restrict,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'expired', 'cancelled')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  expires_at timestamptz,
  time_spent_seconds integer not null default 0 check (time_spent_seconds >= 0),
  submit_idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_test_attempts_user_template
  on assessment.test_attempts(user_id, test_template_id, started_at desc);

create index if not exists idx_test_attempts_status
  on assessment.test_attempts(status);

drop trigger if exists trg_test_attempts_updated_at on assessment.test_attempts;
create trigger trg_test_attempts_updated_at
before update on assessment.test_attempts
for each row
execute function assessment.set_updated_at();

create table if not exists assessment.attempt_responses (
  id bigint generated always as identity primary key,
  attempt_id bigint not null references assessment.test_attempts(id) on delete cascade,
  question_version_id bigint not null references assessment.question_versions(id) on delete restrict,
  selected_answer jsonb,
  answer_text text,
  status text not null default 'not_visited'
    check (status in ('not_visited', 'answered', 'skipped', 'marked_for_review')),
  is_marked_for_review boolean not null default false,
  time_spent_seconds integer not null default 0 check (time_spent_seconds >= 0),
  answered_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_version_id)
);

create index if not exists idx_attempt_responses_attempt
  on assessment.attempt_responses(attempt_id);

create index if not exists idx_attempt_responses_question
  on assessment.attempt_responses(question_version_id);

drop trigger if exists trg_attempt_responses_updated_at on assessment.attempt_responses;
create trigger trg_attempt_responses_updated_at
before update on assessment.attempt_responses
for each row
execute function assessment.set_updated_at();

create or replace function assessment.ensure_response_question_belongs_to_attempt_test()
returns trigger
language plpgsql
as $$
declare
  attempt_template_id bigint;
begin
  select ta.test_template_id
    into attempt_template_id
  from assessment.test_attempts ta
  where ta.id = new.attempt_id;

  if attempt_template_id is null then
    raise exception 'attempt_id % does not exist', new.attempt_id;
  end if;

  if not exists (
    select 1
    from assessment.test_question_items tqi
    where tqi.test_template_id = attempt_template_id
      and tqi.question_version_id = new.question_version_id
  ) then
    raise exception 'question_version_id % does not belong to attempt test_template_id %', new.question_version_id, attempt_template_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_attempt_responses_question_in_test on assessment.attempt_responses;
create trigger trg_attempt_responses_question_in_test
before insert or update of attempt_id, question_version_id
on assessment.attempt_responses
for each row
execute function assessment.ensure_response_question_belongs_to_attempt_test();

create table if not exists assessment.attempt_events (
  id bigint generated always as identity primary key,
  attempt_id bigint not null references assessment.test_attempts(id) on delete cascade,
  question_version_id bigint references assessment.question_versions(id) on delete restrict,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_attempt_events_attempt_created
  on assessment.attempt_events(attempt_id, created_at);

create table if not exists assessment.test_results (
  id bigint generated always as identity primary key,
  attempt_id bigint not null unique references assessment.test_attempts(id) on delete cascade,
  score numeric(10,2) not null default 0,
  max_score numeric(10,2) not null default 0,
  accuracy numeric(7,4) not null default 0,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  unattempted_count integer not null default 0,
  negative_marks numeric(10,2) not null default 0,
  rank_snapshot jsonb not null default '{}'::jsonb,
  percentile_snapshot numeric(7,4),
  cutoff_status text,
  summary_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_test_results_score
  on assessment.test_results(score desc, created_at asc);

create table if not exists assessment.result_topic_breakdowns (
  id bigint generated always as identity primary key,
  result_id bigint not null references assessment.test_results(id) on delete cascade,
  taxonomy_node_id bigint references assessment.assessment_taxonomy_nodes(id) on delete restrict,
  question_nature_id bigint references assessment.question_natures(id) on delete restrict,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  unattempted_count integer not null default 0,
  score numeric(10,2) not null default 0,
  accuracy numeric(7,4) not null default 0,
  avg_time_seconds numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_result_topic_breakdowns_result
  on assessment.result_topic_breakdowns(result_id);

comment on table assessment.test_question_items is
  'Locks a test to immutable question_versions. Editable question records must not alter already-created tests.';

comment on table assessment.attempt_responses is
  'Autosaved student responses. Server-side submission scoring reads from this table.';

comment on column assessment.test_attempts.submit_idempotency_key is
  'Client-provided submit key to prevent duplicate final submission.';
