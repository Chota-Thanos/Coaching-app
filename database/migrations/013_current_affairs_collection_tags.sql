-- Current affairs Notes Space: repository-level custom tag definitions

alter table current_affairs.student_collections
  add column if not exists custom_tags jsonb not null default '[]'::jsonb;
