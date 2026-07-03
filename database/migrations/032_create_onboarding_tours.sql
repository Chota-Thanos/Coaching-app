-- Migration: Admin-managed onboarding tours system
-- Creates tours, steps, and user completion tracking tables
-- Date: 2026-07-04

-- Tours table: one row per named tour (e.g. custom_test_tour, notes_workspace_tour)
create table if not exists app.onboarding_tours (
  id bigint generated always as identity primary key,
  key text not null unique,          -- stable identifier referenced in frontend
  name text not null,                -- human-readable label in admin panel
  version integer not null default 1, -- bump to re-show tour to users who already completed it
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Steps table: ordered list of spotlight steps for each tour
create table if not exists app.onboarding_tour_steps (
  id bigint generated always as identity primary key,
  tour_id bigint not null references app.onboarding_tours(id) on delete cascade,
  display_order integer not null default 0,
  selector text not null,            -- CSS selector targeting the element to highlight
  badge text not null default '',    -- small header label (e.g. "Step 1 of 5")
  title text not null,               -- bold heading
  body text not null,                -- paragraph description
  action_trigger text,               -- null | 'click' | 'change' | 'input'
  action_text text,                  -- instruction shown when action required
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User completion tracking (prevents re-showing completed tours)
create table if not exists app.user_onboarding_completions (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  tour_key text not null,
  tour_version integer not null default 1,  -- version at time of completion
  completed_at timestamptz not null default now(),
  unique(user_id, tour_key)
);

-- Indexes
create index if not exists idx_onboarding_tour_steps_tour_id on app.onboarding_tour_steps(tour_id);
create index if not exists idx_user_onboarding_completions_user_id on app.user_onboarding_completions(user_id);

-- updated_at triggers
drop trigger if exists trg_onboarding_tours_updated_at on app.onboarding_tours;
create trigger trg_onboarding_tours_updated_at
before update on app.onboarding_tours
for each row execute function current_affairs.set_updated_at();

drop trigger if exists trg_onboarding_tour_steps_updated_at on app.onboarding_tour_steps;
create trigger trg_onboarding_tour_steps_updated_at
before update on app.onboarding_tour_steps
for each row execute function current_affairs.set_updated_at();

-- Seed the two default tours so admin UI works immediately
insert into app.onboarding_tours (key, name, version) values
  ('custom_test_tour', 'Custom Test Builder Tour', 1),
  ('notes_workspace_tour', 'Notes Workspace Tour', 1)
on conflict (key) do nothing;
