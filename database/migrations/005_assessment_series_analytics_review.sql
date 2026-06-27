-- Assessment module: test series, bookmarks, error logs, metrics, imports
-- Date: 2026-05-31

create table if not exists assessment.test_series (
  id bigint generated always as identity primary key,
  title text not null,
  slug text not null unique,
  description text,
  exam_id bigint not null references assessment.exams(id) on delete restrict,
  cover_image_url text,
  access_type text not null default 'free'
    check (access_type in ('free', 'subscription', 'paid', 'private')),
  subscription_plan_id bigint references billing.plans(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'published', 'archived')),
  created_by_user_id bigint references app.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_test_series_exam_status
  on assessment.test_series(exam_id, status, access_type);

create table if not exists assessment.test_series_items (
  id bigint generated always as identity primary key,
  test_series_id bigint not null references assessment.test_series(id) on delete cascade,
  test_template_id bigint not null references assessment.test_templates(id) on delete restrict,
  display_order integer not null default 0,
  scheduled_at timestamptz,
  unlock_at timestamptz,
  created_at timestamptz not null default now(),
  unique (test_series_id, test_template_id)
);

create index if not exists idx_test_series_items_series_order
  on assessment.test_series_items(test_series_id, display_order);

create table if not exists assessment.error_types (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into assessment.error_types (name, slug, display_order)
values
  ('Silly mistake', 'silly-mistake', 10),
  ('Conceptual error', 'conceptual-error', 20),
  ('Factual gap', 'factual-gap', 30),
  ('Lack of time', 'lack-of-time', 40),
  ('Over-attempt', 'over-attempt', 50)
on conflict (slug) do nothing;

create table if not exists assessment.student_error_logs (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  question_version_id bigint not null references assessment.question_versions(id) on delete restrict,
  attempt_id bigint references assessment.test_attempts(id) on delete set null,
  taxonomy_node_id bigint references assessment.assessment_taxonomy_nodes(id) on delete set null,
  error_type_id bigint not null references assessment.error_types(id) on delete restrict,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_error_logs_user
  on assessment.student_error_logs(user_id, created_at desc);

create table if not exists assessment.student_bookmarks (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  question_id bigint not null references assessment.questions(id) on delete cascade,
  question_version_id bigint references assessment.question_versions(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists idx_student_bookmarks_user
  on assessment.student_bookmarks(user_id, created_at desc);

create table if not exists assessment.student_topic_metrics (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  taxonomy_node_id bigint references assessment.assessment_taxonomy_nodes(id) on delete cascade,
  question_nature_id bigint references assessment.question_natures(id) on delete set null,
  attempt_count integer not null default 0,
  question_count integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  unattempted_count integer not null default 0,
  avg_accuracy numeric(7,4) not null default 0,
  avg_score numeric(10,2) not null default 0,
  last_attempted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, taxonomy_node_id, question_nature_id)
);

create index if not exists idx_student_topic_metrics_user
  on assessment.student_topic_metrics(user_id, avg_accuracy asc, question_count desc);

create table if not exists assessment.question_import_batches (
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

create table if not exists assessment.question_import_items (
  id bigint generated always as identity primary key,
  batch_id bigint not null references assessment.question_import_batches(id) on delete cascade,
  raw_payload jsonb not null,
  normalized_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'published')),
  validation_errors jsonb not null default '[]'::jsonb,
  published_question_id bigint references assessment.questions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_question_import_items_batch_status
  on assessment.question_import_items(batch_id, status);
