-- Migration: Add content_type to assessment_taxonomy_nodes
-- Date: 2026-06-04

-- 1. Add content_type column with check constraint and default
alter table assessment.assessment_taxonomy_nodes 
  add column if not exists content_type text not null default 'gk' 
  check (content_type in ('gk', 'aptitude'));

-- 2. Drop the old unique index
drop index if exists assessment.ux_assessment_taxonomy_nodes_path;

-- 3. Create the new unique index including content_type
create unique index if not exists ux_assessment_taxonomy_nodes_path 
  on assessment.assessment_taxonomy_nodes(exam_id, coalesce(parent_id, 0), node_type, slug, content_type);
