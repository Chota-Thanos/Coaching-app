-- Create table to store excluded taxonomy nodes per user
create table if not exists assessment.student_excluded_taxonomy_nodes (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  taxonomy_type text not null check (taxonomy_type in ('objective', 'mains')),
  node_id integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, taxonomy_type, node_id)
);

create index if not exists idx_student_excluded_taxonomy_nodes_user_type 
on assessment.student_excluded_taxonomy_nodes(user_id, taxonomy_type);
