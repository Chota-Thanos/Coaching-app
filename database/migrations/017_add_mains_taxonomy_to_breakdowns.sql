-- Add mains_taxonomy_node_id to study_plan.result_topic_breakdowns
-- Date: 2026-06-09

alter table study_plan.result_topic_breakdowns
  add column if not exists mains_taxonomy_node_id bigint references assessment.mains_taxonomy_nodes(id) on delete set null;
