-- Migration 018: Mentorship System Database Schema
-- Date: 2026-06-10

-- 1. Safely drop the old check constraint on app.users.role and add 'mentor'
do $$
declare
  constraint_name_var text;
begin
  select tc.constraint_name into constraint_name_var
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
  where tc.table_schema = 'app'
    and tc.table_name = 'users'
    and tc.constraint_type = 'CHECK'
    and ccu.column_name = 'role';

  if constraint_name_var is not null then
    execute 'alter table app.users drop constraint ' || constraint_name_var;
  end if;
end
$$;

alter table app.users add constraint ck_users_role
  check (role in ('student', 'admin', 'moderator', 'content_editor', 'evaluator', 'mentor'));

-- 2. Create professional onboarding requests table
create table if not exists app.professional_onboarding_requests (
  id bigint generated always as identity primary key,
  user_id bigint references app.users(id) on delete cascade not null,
  email_snapshot text,
  desired_role text not null default 'mentor' check (desired_role = 'mentor'),
  full_name text not null,
  city text,
  years_experience integer,
  phone text,
  about text,
  status text not null default 'pending' check (status in ('draft', 'pending', 'approved', 'rejected')),
  details jsonb not null default '{}'::jsonb,
  reviewer_user_id bigint references app.users(id) on delete set null,
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prof_onboarding_user on app.professional_onboarding_requests(user_id);
create index if not exists idx_prof_onboarding_status on app.professional_onboarding_requests(status, created_at desc);

-- Unique constraint for single pending application per user
create unique index if not exists ux_prof_onboarding_single_pending
  on app.professional_onboarding_requests(user_id)
  where status = 'pending';

-- 3. Create mentor profiles table
create table if not exists app.mentor_profiles (
  id bigint generated always as identity primary key,
  user_id bigint references app.users(id) on delete cascade not null unique,
  display_name text not null,
  headline text,
  bio text,
  years_experience integer,
  city text,
  profile_image_url text,
  contact_url text,
  public_email text,
  is_public boolean not null default true,
  is_active boolean not null default true,
  is_verified boolean not null default true,
  specialization_tags text[] not null default '{}',
  highlights text[] not null default '{}',
  credentials text[] not null default '{}',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mentor_profiles_user on app.mentor_profiles(user_id);
create index if not exists idx_mentor_profiles_active on app.mentor_profiles(is_active, is_public);

-- 4. Create mentorship slots table
create table if not exists app.mentorship_slots (
  id bigint generated always as identity primary key,
  mentor_id bigint references app.users(id) on delete cascade not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode text not null default 'video',
  max_bookings integer not null default 1,
  booked_count integer not null default 0,
  is_active boolean not null default true,
  meeting_link text,
  title text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mentorship_slots_mentor on app.mentorship_slots(mentor_id);
create index if not exists idx_mentorship_slots_time on app.mentorship_slots(starts_at, ends_at);
create index if not exists idx_mentorship_slots_active on app.mentorship_slots(is_active);

-- 5. Create mentorship requests table
create table if not exists app.mentorship_requests (
  id bigint generated always as identity primary key,
  user_id bigint references app.users(id) on delete cascade not null, -- learner
  mentor_id bigint references app.users(id) on delete cascade not null, -- mentor
  mains_answer_attempt_id bigint references assessment.mains_answer_attempts(id) on delete set null, -- optional evaluation link
  preferred_mode text not null default 'video',
  note text,
  status text not null default 'requested' check (status in ('requested', 'accepted', 'rejected', 'completed', 'cancelled', 'expired')),
  scheduled_slot_id bigint references app.mentorship_slots(id) on delete set null,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded', 'failed')),
  payment_amount integer not null default 0,
  payment_currency text not null default 'INR',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mentorship_requests_user on app.mentorship_requests(user_id);
create index if not exists idx_mentorship_requests_mentor on app.mentorship_requests(mentor_id);
create index if not exists idx_mentorship_requests_status on app.mentorship_requests(status);

-- 6. Create mentorship sessions table
create table if not exists app.mentorship_sessions (
  id bigint generated always as identity primary key,
  request_id bigint references app.mentorship_requests(id) on delete cascade not null unique,
  slot_id bigint references app.mentorship_slots(id) on delete set null,
  mentor_id bigint references app.users(id) on delete cascade not null,
  user_id bigint references app.users(id) on delete cascade not null,
  mode text not null default 'video',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  meeting_link text,
  summary text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mentorship_sessions_mentor on app.mentorship_sessions(mentor_id);
create index if not exists idx_mentorship_sessions_user on app.mentorship_sessions(user_id);

-- 7. Create mentorship messages table
create table if not exists app.mentorship_messages (
  id bigint generated always as identity primary key,
  request_id bigint references app.mentorship_requests(id) on delete cascade not null,
  sender_id bigint references app.users(id) on delete cascade not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_mentorship_messages_request on app.mentorship_messages(request_id, created_at asc);
