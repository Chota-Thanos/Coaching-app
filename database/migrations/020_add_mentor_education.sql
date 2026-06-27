-- Migration 020: Add education column to mentor_profiles
-- Date: 2026-06-10

alter table app.mentor_profiles add column if not exists education text;
