-- Migration 023: Add mentorship settings table and seed default values
-- Date: 2026-06-10

create table if not exists app.mentorship_settings (
  key text primary key,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seed target_exams and approved_specifications if not already present
insert into app.mentorship_settings (key, value)
values 
  ('target_exams', '["UPSC CSE", "UPPSC", "BPSC", "MPSC"]'::jsonb),
  ('approved_specifications', '["Mentor for Prelims Exam", "Mentor for Mains", "Mentor for GS 1", "Complete Mentorship"]'::jsonb)
on conflict (key) do nothing;
