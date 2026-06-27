-- Migration 022: Add mentor types, specifications, exams and agendas
-- Date: 2026-06-10

-- 1. Add specifications, exams, specialization_type, and mentor_type to app.mentor_profiles
alter table app.mentor_profiles add column if not exists specifications text[] not null default '{}';
alter table app.mentor_profiles add column if not exists exams text[] not null default '{}';

alter table app.mentor_profiles add column if not exists specialization_type text not null default 'all_areas' 
  check (specialization_type in ('all_areas', 'specific_field'));

alter table app.mentor_profiles add column if not exists mentor_type text not null default 'evaluation_mentorship' 
  check (mentor_type in ('evaluation_mentorship', 'only_mentorship'));

-- 2. Add specifications to app.professional_onboarding_requests
alter table app.professional_onboarding_requests add column if not exists specifications text[] not null default '{}';

-- 3. Create app.mentorship_agendas table
create table if not exists app.mentorship_agendas (
  id bigint generated always as identity primary key,
  request_id bigint references app.mentorship_requests(id) on delete cascade not null,
  title text not null,
  description text,
  status text not null default 'proposed' check (status in ('proposed', 'agreed', 'solved_proposed', 'solved')),
  created_by bigint references app.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indices for mentorship agendas
create index if not exists idx_mentorship_agendas_request on app.mentorship_agendas(request_id);
create index if not exists idx_mentorship_agendas_status on app.mentorship_agendas(status);
