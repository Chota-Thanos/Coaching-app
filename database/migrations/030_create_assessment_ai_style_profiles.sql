-- Migration: Create assessment.ai_style_profiles table for reusable style profiles
-- Date: 2026-06-25

create table if not exists assessment.ai_style_profiles (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  tag_level1 text,
  tag_level2 text,
  content_type text not null,
  style_profile jsonb not null,
  example_questions jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by bigint references app.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_assessment_ai_style_profiles_updated_at on assessment.ai_style_profiles;
create trigger trg_assessment_ai_style_profiles_updated_at
before update on assessment.ai_style_profiles
for each row
execute function current_affairs.set_updated_at();
