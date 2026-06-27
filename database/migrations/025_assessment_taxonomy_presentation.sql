-- Migration: Add presentation metadata to assessment taxonomy nodes
-- Date: 2026-06-15

alter table assessment.assessment_taxonomy_nodes
  add column if not exists image_url text;

alter table assessment.mains_taxonomy_nodes
  add column if not exists image_url text;
