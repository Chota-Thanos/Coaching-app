-- Migration 024: Add meta jsonb column to app.mentorship_agendas
-- Date: 2026-06-10

alter table app.mentorship_agendas add column if not exists meta jsonb not null default '{}'::jsonb;
