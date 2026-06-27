-- Assessment module: objective question foundation
-- Date: 2026-05-31
--
-- Purpose:
-- - Use one objective question schema for GK, maths, CSAT, and passage-linked quizzes.
-- - Keep passage as an optional wrapper, not as a separate question system.
-- - Keep question nature admin-managed, not hardcoded in application logic.
-- - Keep only question_prompt; do not create mid_question_statement.
-- - Do not store model_solution for objective quiz versions.

create schema if not exists assessment;

create table if not exists assessment.exams (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assessment.exam_levels (
  id bigint generated always as identity primary key,
  exam_id bigint not null references assessment.exams(id) on delete cascade,
  name text not null,
  slug text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, slug)
);

create table if not exists assessment.assessment_taxonomy_nodes (
  id bigint generated always as identity primary key,
  exam_id bigint not null references assessment.exams(id) on delete cascade,
  parent_id bigint references assessment.assessment_taxonomy_nodes(id) on delete restrict,
  node_type text not null check (node_type in ('subject', 'source_bucket', 'topic', 'subtopic')),
  name text not null,
  slug text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, parent_id, node_type, slug)
);

create index if not exists idx_assessment_taxonomy_nodes_exam_parent
  on assessment.assessment_taxonomy_nodes(exam_id, parent_id, display_order);

create unique index if not exists ux_assessment_taxonomy_nodes_path
  on assessment.assessment_taxonomy_nodes(exam_id, coalesce(parent_id, 0), node_type, slug);

create index if not exists idx_assessment_taxonomy_nodes_type
  on assessment.assessment_taxonomy_nodes(node_type);

create table if not exists assessment.question_natures (
  id bigint generated always as identity primary key,
  exam_id bigint not null references assessment.exams(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, slug)
);

create table if not exists assessment.question_formats (
  id bigint generated always as identity primary key,
  question_family text not null check (question_family in ('objective', 'mains_subjective')),
  name text not null,
  slug text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_family, slug)
);

insert into assessment.question_formats
  (question_family, name, slug, description, display_order)
values
  ('objective', 'Standard quiz', 'standard_quiz', 'Standalone objective quiz format used by GK, maths, and CSAT.', 10),
  ('objective', 'Statement-based quiz', 'statement_based_quiz', 'Objective question with numbered statements or facts.', 20),
  ('objective', 'Assertion-reason', 'assertion_reason', 'Objective assertion-reason format.', 30),
  ('objective', 'Match the following', 'match_the_following', 'Objective matching/list-pair format.', 40),
  ('objective', 'Passage-linked quiz', 'passage_linked_quiz', 'Objective question linked to a shared passage.', 50)
on conflict (question_family, slug) do update
set
  name = excluded.name,
  description = excluded.description,
  display_order = excluded.display_order,
  is_active = true;

create table if not exists assessment.questions (
  id bigint generated always as identity primary key,
  question_family text not null check (question_family in ('objective', 'mains_subjective')),
  question_format_id bigint not null references assessment.question_formats(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'published', 'archived')),
  created_by_user_id bigint,
  approved_by_user_id bigint,
  approved_at timestamptz,
  is_ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_questions_family_status
  on assessment.questions(question_family, status);

create index if not exists idx_questions_format
  on assessment.questions(question_format_id);

create or replace function assessment.ensure_question_format_family()
returns trigger
language plpgsql
as $$
declare
  format_family text;
begin
  select qf.question_family
    into format_family
  from assessment.question_formats qf
  where qf.id = new.question_format_id;

  if format_family is null then
    raise exception 'question_format_id % does not exist', new.question_format_id;
  end if;

  if format_family <> new.question_family then
    raise exception 'question_family % does not match question format family %', new.question_family, format_family;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_questions_ensure_format_family on assessment.questions;
create trigger trg_questions_ensure_format_family
before insert or update of question_family, question_format_id
on assessment.questions
for each row
execute function assessment.ensure_question_format_family();

create table if not exists assessment.question_versions (
  id bigint generated always as identity primary key,
  question_id bigint not null references assessment.questions(id) on delete cascade,
  version_no integer not null,
  question_statement text not null,
  supplementary_statement text,
  statements_facts jsonb not null default '[]'::jsonb,
  question_prompt text,
  options jsonb not null default '[]'::jsonb,
  correct_answer jsonb,
  explanation text,
  content_json jsonb not null default '{}'::jsonb,
  is_current boolean not null default true,
  created_by_user_id bigint,
  created_at timestamptz not null default now(),
  unique (question_id, version_no)
);

create unique index if not exists ux_question_versions_current
  on assessment.question_versions(question_id)
  where is_current = true;

create index if not exists idx_question_versions_question
  on assessment.question_versions(question_id, version_no desc);

create table if not exists assessment.passages (
  id bigint generated always as identity primary key,
  title text,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'published', 'archived')),
  created_by_user_id bigint,
  approved_by_user_id bigint,
  approved_at timestamptz,
  is_ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assessment.passage_questions (
  id bigint generated always as identity primary key,
  passage_id bigint not null references assessment.passages(id) on delete cascade,
  question_id bigint not null references assessment.questions(id) on delete cascade,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (passage_id, question_id)
);

create index if not exists idx_passage_questions_passage_order
  on assessment.passage_questions(passage_id, display_order);

create index if not exists idx_passage_questions_question
  on assessment.passage_questions(question_id);

create or replace function assessment.ensure_passage_question_is_objective()
returns trigger
language plpgsql
as $$
declare
  linked_family text;
begin
  select q.question_family
    into linked_family
  from assessment.questions q
  where q.id = new.question_id;

  if linked_family <> 'objective' then
    raise exception 'Only objective questions can be linked to passages. question_id=% has family=%', new.question_id, linked_family;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_passage_questions_ensure_objective on assessment.passage_questions;
create trigger trg_passage_questions_ensure_objective
before insert or update of question_id
on assessment.passage_questions
for each row
execute function assessment.ensure_passage_question_is_objective();

create table if not exists assessment.question_taxonomy_links (
  id bigint generated always as identity primary key,
  question_id bigint not null references assessment.questions(id) on delete cascade,
  exam_id bigint not null references assessment.exams(id) on delete cascade,
  exam_level_id bigint not null references assessment.exam_levels(id) on delete restrict,
  subject_node_id bigint not null references assessment.assessment_taxonomy_nodes(id) on delete restrict,
  source_node_id bigint references assessment.assessment_taxonomy_nodes(id) on delete restrict,
  topic_node_id bigint references assessment.assessment_taxonomy_nodes(id) on delete restrict,
  subtopic_node_id bigint references assessment.assessment_taxonomy_nodes(id) on delete restrict,
  question_nature_id bigint references assessment.question_natures(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_question_taxonomy_links_question
  on assessment.question_taxonomy_links(question_id);

create index if not exists idx_question_taxonomy_links_exam_level
  on assessment.question_taxonomy_links(exam_id, exam_level_id);

create index if not exists idx_question_taxonomy_links_subject
  on assessment.question_taxonomy_links(subject_node_id);

create index if not exists idx_question_taxonomy_links_source
  on assessment.question_taxonomy_links(source_node_id);

create index if not exists idx_question_taxonomy_links_topic
  on assessment.question_taxonomy_links(topic_node_id);

create index if not exists idx_question_taxonomy_links_subtopic
  on assessment.question_taxonomy_links(subtopic_node_id);

create index if not exists idx_question_taxonomy_links_nature
  on assessment.question_taxonomy_links(question_nature_id);

create or replace function assessment.ensure_objective_question_taxonomy_link()
returns trigger
language plpgsql
as $$
declare
  linked_family text;
begin
  select q.question_family
    into linked_family
  from assessment.questions q
  where q.id = new.question_id;

  if linked_family <> 'objective' then
    raise exception 'question_taxonomy_links is only for objective questions. question_id=% has family=%', new.question_id, linked_family;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_question_taxonomy_links_ensure_objective on assessment.question_taxonomy_links;
create trigger trg_question_taxonomy_links_ensure_objective
before insert or update of question_id
on assessment.question_taxonomy_links
for each row
execute function assessment.ensure_objective_question_taxonomy_link();

comment on table assessment.question_formats is
  'Admin-configurable question formats. Standard quiz supports standalone GK, maths, and CSAT questions.';

comment on column assessment.question_versions.question_prompt is
  'Single prompt field for the question. Replaces any mid_question_statement concept.';

comment on column assessment.question_versions.content_json is
  'Flexible renderer payload for rare objective formats. Do not store model solutions here.';

comment on table assessment.passage_questions is
  'Optional passage wrapper. Only passage-linked questions need rows here.';

comment on column assessment.question_taxonomy_links.source_node_id is
  'Source bucket/book/current affairs categorisation node, not a free-text source reference.';
