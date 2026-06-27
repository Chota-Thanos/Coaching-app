-- Current affairs remaining backend support: ingestion, assets, reminders, and assessment handoff
-- Date: 2026-05-31

create table if not exists current_affairs.master_article_assets (
  id bigint generated always as identity primary key,
  article_id bigint not null references current_affairs.master_articles(id) on delete cascade,
  asset_type text not null default 'image'
    check (asset_type in ('image', 'thumbnail', 'pdf', 'source_file', 'audio', 'other')),
  file_name text not null,
  file_url text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  alt_text text,
  caption text,
  metadata jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  uploaded_by_user_id bigint references app.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_current_affairs_article_assets_article
  on current_affairs.master_article_assets(article_id, asset_type, display_order);

drop trigger if exists trg_current_affairs_article_assets_updated_at
  on current_affairs.master_article_assets;
create trigger trg_current_affairs_article_assets_updated_at
before update on current_affairs.master_article_assets
for each row
execute function current_affairs.set_updated_at();

create table if not exists current_affairs.ingestion_jobs (
  id bigint generated always as identity primary key,
  source_kind text not null default 'manual_text'
    check (source_kind in ('manual_text', 'source_url', 'file_url', 'rss_feed', 'ai_prompt')),
  parser_kind text not null default 'structured_current_affairs'
    check (parser_kind in ('structured_current_affairs', 'plain_text', 'manual_json', 'external_ai')),
  source_name text,
  source_url text,
  source_filename text,
  source_file_url text,
  raw_text text,
  raw_payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'parsed', 'reviewed', 'published', 'failed')),
  error_message text,
  created_by_user_id bigint references app.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_current_affairs_ingestion_jobs_status
  on current_affairs.ingestion_jobs(status, created_at desc);

drop trigger if exists trg_current_affairs_ingestion_jobs_updated_at
  on current_affairs.ingestion_jobs;
create trigger trg_current_affairs_ingestion_jobs_updated_at
before update on current_affairs.ingestion_jobs
for each row
execute function current_affairs.set_updated_at();

create table if not exists current_affairs.ingestion_items (
  id bigint generated always as identity primary key,
  job_id bigint not null references current_affairs.ingestion_jobs(id) on delete cascade,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_article jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'published')),
  validation_errors jsonb not null default '[]'::jsonb,
  published_article_id bigint references current_affairs.master_articles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_current_affairs_ingestion_items_job_status
  on current_affairs.ingestion_items(job_id, status);

drop trigger if exists trg_current_affairs_ingestion_items_updated_at
  on current_affairs.ingestion_items;
create trigger trg_current_affairs_ingestion_items_updated_at
before update on current_affairs.ingestion_items
for each row
execute function current_affairs.set_updated_at();

create table if not exists current_affairs.student_revision_notifications (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  fork_id bigint not null references current_affairs.student_article_forks(id) on delete cascade,
  notification_type text not null default 'current_affairs_revision'
    check (notification_type in ('current_affairs_revision')),
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'read', 'dismissed')),
  message text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fork_id, notification_type, scheduled_at)
);

create index if not exists idx_current_affairs_revision_notifications_user_status
  on current_affairs.student_revision_notifications(user_id, status, scheduled_at);

create or replace function current_affairs.ensure_revision_notification_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from current_affairs.student_article_forks saf
    where saf.id = new.fork_id
      and saf.user_id = new.user_id
  ) then
    raise exception 'revision notification user_id % does not own fork_id %', new.user_id, new.fork_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_current_affairs_revision_notification_owner
  on current_affairs.student_revision_notifications;
create trigger trg_current_affairs_revision_notification_owner
before insert or update of user_id, fork_id
on current_affairs.student_revision_notifications
for each row
execute function current_affairs.ensure_revision_notification_owner();

drop trigger if exists trg_current_affairs_revision_notifications_updated_at
  on current_affairs.student_revision_notifications;
create trigger trg_current_affairs_revision_notifications_updated_at
before update on current_affairs.student_revision_notifications
for each row
execute function current_affairs.set_updated_at();

create table if not exists current_affairs.question_generation_jobs (
  id bigint generated always as identity primary key,
  article_id bigint not null references current_affairs.master_articles(id) on delete cascade,
  requested_by_user_id bigint references app.users(id) on delete set null,
  assessment_import_batch_id bigint references assessment.question_import_batches(id) on delete set null,
  status text not null default 'generated'
    check (status in ('queued', 'generated', 'failed')),
  generation_mode text not null default 'draft_from_article'
    check (generation_mode in ('draft_from_article', 'external_ai')),
  question_count integer not null default 0 check (question_count >= 0),
  request_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_current_affairs_question_generation_article
  on current_affairs.question_generation_jobs(article_id, created_at desc);

drop trigger if exists trg_current_affairs_question_generation_jobs_updated_at
  on current_affairs.question_generation_jobs;
create trigger trg_current_affairs_question_generation_jobs_updated_at
before update on current_affairs.question_generation_jobs
for each row
execute function current_affairs.set_updated_at();
