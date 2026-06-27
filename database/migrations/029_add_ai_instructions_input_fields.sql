-- Migration: Add input_schema and example_input to current_affairs.ai_instructions
-- Date: 2026-06-25

alter table current_affairs.ai_instructions
  add column if not exists input_schema jsonb not null default '{}'::jsonb,
  add column if not exists example_input text;
