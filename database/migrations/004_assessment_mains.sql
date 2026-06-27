-- Assessment module: mains taxonomy, question details, and answer attempts
-- Date: 2026-05-31

insert into assessment.question_formats
  (question_family, name, slug, description, display_order)
values
  ('mains_subjective', 'Mains answer writing', 'mains_answer_writing', 'Subjective mains answer writing question.', 10)
on conflict (question_family, slug) do update
set
  name = excluded.name,
  description = excluded.description,
  display_order = excluded.display_order,
  is_active = true;

create table if not exists assessment.mains_taxonomy_nodes (
  id bigint generated always as identity primary key,
  exam_id bigint not null references assessment.exams(id) on delete cascade,
  parent_id bigint references assessment.mains_taxonomy_nodes(id) on delete restrict,
  node_type text not null check (node_type in ('paper', 'subject_area', 'theme', 'topic', 'subtopic')),
  name text not null,
  slug text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_mains_taxonomy_nodes_path
  on assessment.mains_taxonomy_nodes(exam_id, coalesce(parent_id, 0), node_type, slug);

create index if not exists idx_mains_taxonomy_nodes_exam_parent
  on assessment.mains_taxonomy_nodes(exam_id, parent_id, display_order);

create table if not exists assessment.mains_question_details (
  id bigint generated always as identity primary key,
  question_id bigint not null unique references assessment.questions(id) on delete cascade,
  word_limit integer check (word_limit is null or word_limit > 0),
  marks numeric(10,2) not null default 0,
  directive text,
  model_answer text,
  answer_framework jsonb not null default '{}'::jsonb,
  key_points jsonb not null default '[]'::jsonb,
  evaluation_rubric jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function assessment.ensure_mains_question_detail_family()
returns trigger
language plpgsql
as $$
declare
  linked_family text;
begin
  select q.question_family into linked_family
  from assessment.questions q
  where q.id = new.question_id;

  if linked_family <> 'mains_subjective' then
    raise exception 'mains_question_details requires a mains_subjective question. question_id=% has family=%', new.question_id, linked_family;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mains_details_family on assessment.mains_question_details;
create trigger trg_mains_details_family
before insert or update of question_id
on assessment.mains_question_details
for each row
execute function assessment.ensure_mains_question_detail_family();

create table if not exists assessment.mains_question_taxonomy_links (
  id bigint generated always as identity primary key,
  question_id bigint not null references assessment.questions(id) on delete cascade,
  exam_id bigint not null references assessment.exams(id) on delete cascade,
  exam_level_id bigint not null references assessment.exam_levels(id) on delete restrict,
  paper_node_id bigint references assessment.mains_taxonomy_nodes(id) on delete restrict,
  subject_area_node_id bigint references assessment.mains_taxonomy_nodes(id) on delete restrict,
  theme_node_id bigint references assessment.mains_taxonomy_nodes(id) on delete restrict,
  topic_node_id bigint references assessment.mains_taxonomy_nodes(id) on delete restrict,
  subtopic_node_id bigint references assessment.mains_taxonomy_nodes(id) on delete restrict,
  question_nature_id bigint references assessment.question_natures(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_mains_question_taxonomy_question
  on assessment.mains_question_taxonomy_links(question_id);

create index if not exists idx_mains_question_taxonomy_topic
  on assessment.mains_question_taxonomy_links(topic_node_id, subtopic_node_id);

create or replace function assessment.ensure_mains_question_taxonomy_family()
returns trigger
language plpgsql
as $$
declare
  linked_family text;
begin
  select q.question_family into linked_family
  from assessment.questions q
  where q.id = new.question_id;

  if linked_family <> 'mains_subjective' then
    raise exception 'mains_question_taxonomy_links requires a mains_subjective question. question_id=% has family=%', new.question_id, linked_family;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mains_taxonomy_family on assessment.mains_question_taxonomy_links;
create trigger trg_mains_taxonomy_family
before insert or update of question_id
on assessment.mains_question_taxonomy_links
for each row
execute function assessment.ensure_mains_question_taxonomy_family();

create table if not exists assessment.mains_answer_attempts (
  id bigint generated always as identity primary key,
  attempt_id bigint references assessment.test_attempts(id) on delete cascade,
  user_id bigint not null references app.users(id) on delete cascade,
  question_version_id bigint not null references assessment.question_versions(id) on delete restrict,
  student_answer_text text,
  answer_file_url text,
  submitted_at timestamptz not null default now(),
  evaluation_status text not null default 'pending'
    check (evaluation_status in ('pending', 'ai_evaluating', 'evaluated', 'needs_manual_review')),
  evaluated_by_user_id bigint references app.users(id) on delete set null,
  ai_evaluation_job_id bigint,
  score numeric(10,2),
  max_score numeric(10,2),
  feedback text,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (student_answer_text is not null or answer_file_url is not null)
);

create index if not exists idx_mains_answer_attempts_user
  on assessment.mains_answer_attempts(user_id, submitted_at desc);

create index if not exists idx_mains_answer_attempts_status
  on assessment.mains_answer_attempts(evaluation_status);
