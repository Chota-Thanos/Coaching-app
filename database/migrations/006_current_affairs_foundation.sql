-- Current affairs module: institute content and student workspace
-- Date: 2026-05-31

create schema if not exists current_affairs;

create or replace function current_affairs.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists current_affairs.category_nodes (
  id bigint generated always as identity primary key,
  content_family text not null check (content_family in ('prelims', 'mains')),
  parent_id bigint references current_affairs.category_nodes(id) on delete restrict,
  node_type text not null check (node_type in ('subject', 'topic', 'subtopic')),
  name text not null,
  slug text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_current_affairs_category_path
  on current_affairs.category_nodes(content_family, coalesce(parent_id, 0), node_type, slug);

create index if not exists idx_current_affairs_category_parent
  on current_affairs.category_nodes(content_family, parent_id, display_order);

drop trigger if exists trg_current_affairs_category_updated_at on current_affairs.category_nodes;
create trigger trg_current_affairs_category_updated_at
before update on current_affairs.category_nodes
for each row
execute function current_affairs.set_updated_at();

create table if not exists current_affairs.master_articles (
  id bigint generated always as identity primary key,
  content_kind text not null check (
    content_kind in (
      'daily_current_affairs',
      'prelims_pyq',
      'mains_summary',
      'mains_article',
      'mains_pyq',
      'study_note'
    )
  ),
  title text not null,
  slug text not null unique,
  body text not null,
  body_json jsonb not null default '{}'::jsonb,
  category_node_id bigint references current_affairs.category_nodes(id) on delete restrict,
  source_name text,
  source_url text,
  publication_date date,
  institute_tags jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'approved', 'published', 'archived')),
  created_by_user_id bigint references app.users(id) on delete set null,
  approved_by_user_id bigint references app.users(id) on delete set null,
  approved_at timestamptz,
  is_ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_current_affairs_master_articles_kind_status
  on current_affairs.master_articles(content_kind, status, publication_date desc);

create index if not exists idx_current_affairs_master_articles_category
  on current_affairs.master_articles(category_node_id, publication_date desc);

create index if not exists idx_current_affairs_master_articles_tags
  on current_affairs.master_articles using gin(institute_tags);

drop trigger if exists trg_current_affairs_master_articles_updated_at on current_affairs.master_articles;
create trigger trg_current_affairs_master_articles_updated_at
before update on current_affairs.master_articles
for each row
execute function current_affairs.set_updated_at();

create table if not exists current_affairs.student_article_forks (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  master_article_id bigint not null references current_affairs.master_articles(id) on delete cascade,
  personal_tags jsonb not null default '[]'::jsonb,
  personal_summary text,
  custom_folder text,
  read_status text not null default 'unread'
    check (read_status in ('unread', 'read', 'needs_revision')),
  scheduled_revision_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, master_article_id)
);

create index if not exists idx_current_affairs_forks_user_status
  on current_affairs.student_article_forks(user_id, read_status, scheduled_revision_at);

drop trigger if exists trg_current_affairs_forks_updated_at on current_affairs.student_article_forks;
create trigger trg_current_affairs_forks_updated_at
before update on current_affairs.student_article_forks
for each row
execute function current_affairs.set_updated_at();

create table if not exists current_affairs.student_article_highlights (
  id bigint generated always as identity primary key,
  fork_id bigint not null references current_affairs.student_article_forks(id) on delete cascade,
  anchor_json jsonb not null default '{}'::jsonb,
  color text not null default 'yellow',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_current_affairs_highlights_fork
  on current_affairs.student_article_highlights(fork_id, created_at);

drop trigger if exists trg_current_affairs_highlights_updated_at on current_affairs.student_article_highlights;
create trigger trg_current_affairs_highlights_updated_at
before update on current_affairs.student_article_highlights
for each row
execute function current_affairs.set_updated_at();

create table if not exists current_affairs.student_article_notes (
  id bigint generated always as identity primary key,
  fork_id bigint not null references current_affairs.student_article_forks(id) on delete cascade,
  anchor_json jsonb not null default '{}'::jsonb,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_current_affairs_notes_fork
  on current_affairs.student_article_notes(fork_id, created_at);

drop trigger if exists trg_current_affairs_notes_updated_at on current_affairs.student_article_notes;
create trigger trg_current_affairs_notes_updated_at
before update on current_affairs.student_article_notes
for each row
execute function current_affairs.set_updated_at();

create table if not exists current_affairs.student_articles (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  title text not null,
  slug text not null,
  body text not null,
  body_json jsonb not null default '{}'::jsonb,
  category_node_id bigint references current_affairs.category_nodes(id) on delete set null,
  source_url text,
  personal_tags jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create index if not exists idx_current_affairs_student_articles_user
  on current_affairs.student_articles(user_id, status, updated_at desc);

drop trigger if exists trg_current_affairs_student_articles_updated_at on current_affairs.student_articles;
create trigger trg_current_affairs_student_articles_updated_at
before update on current_affairs.student_articles
for each row
execute function current_affairs.set_updated_at();

create table if not exists current_affairs.student_collections (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

drop trigger if exists trg_current_affairs_collections_updated_at on current_affairs.student_collections;
create trigger trg_current_affairs_collections_updated_at
before update on current_affairs.student_collections
for each row
execute function current_affairs.set_updated_at();

create table if not exists current_affairs.student_collection_items (
  id bigint generated always as identity primary key,
  collection_id bigint not null references current_affairs.student_collections(id) on delete cascade,
  fork_id bigint references current_affairs.student_article_forks(id) on delete cascade,
  student_article_id bigint references current_affairs.student_articles(id) on delete cascade,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (
    (fork_id is not null and student_article_id is null)
    or (fork_id is null and student_article_id is not null)
  )
);

create index if not exists idx_current_affairs_collection_items_collection
  on current_affairs.student_collection_items(collection_id, display_order);

