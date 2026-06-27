-- Migration: Add SEO columns to master_articles and student_articles
-- And tables for AI style guides and subject instruction overrides.
-- Date: 2026-06-03

-- 1. Add SEO columns to master_articles
alter table current_affairs.master_articles
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists canonical_url text,
  add column if not exists keywords jsonb not null default '[]'::jsonb;

-- 2. Add SEO columns to student_articles
alter table current_affairs.student_articles
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists canonical_url text,
  add column if not exists keywords jsonb not null default '[]'::jsonb;

-- 3. Create AI Style Guides table
create table if not exists current_affairs.ai_style_guides (
  id bigint generated always as identity primary key,
  style_guide text not null,
  source_text text,
  created_by bigint references app.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_current_affairs_ai_style_guides_updated_at on current_affairs.ai_style_guides;
create trigger trg_current_affairs_ai_style_guides_updated_at
before update on current_affairs.ai_style_guides
for each row
execute function current_affairs.set_updated_at();

-- 4. Create AI Subject instructions table
create table if not exists current_affairs.ai_instructions (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('general', 'article', 'premium', 'subject')),
  title text not null,
  content_type text,
  subject_node_id bigint references current_affairs.category_nodes(id) on delete cascade,
  prompt text not null,
  is_active boolean not null default true,
  output_schema jsonb not null default '{}'::jsonb,
  example_output jsonb not null default '{}'::jsonb,
  created_by bigint references app.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_node_id)
);

drop trigger if exists trg_current_affairs_ai_instructions_updated_at on current_affairs.ai_instructions;
create trigger trg_current_affairs_ai_instructions_updated_at
before update on current_affairs.ai_instructions
for each row
execute function current_affairs.set_updated_at();
