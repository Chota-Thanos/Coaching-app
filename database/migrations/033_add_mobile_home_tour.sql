-- Migration: Add mobile_home_tour seed
-- Date: 2026-07-04

insert into app.onboarding_tours (key, name, version) values
  ('mobile_home_tour', 'Mobile Dashboard Tour', 1)
on conflict (key) do nothing;
