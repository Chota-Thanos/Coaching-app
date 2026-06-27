-- Migration: Restructure AI instruction unique constraints to support content_type specific category overrides
-- Date: 2026-06-24

-- 1. Drop the old unique constraint on subject_node_id
alter table current_affairs.ai_instructions 
  drop constraint if exists ai_instructions_subject_node_id_key;

-- 2. Update any existing null content_type values to a default ('daily_current_affairs') to prevent constraint issues
update current_affairs.ai_instructions 
  set content_type = 'daily_current_affairs' 
  where content_type is null;

-- 3. Delete any duplicates that now exist (keeping only the most recently updated one)
delete from current_affairs.ai_instructions a
where id not in (
  select max(id)
  from current_affairs.ai_instructions
  group by scope, coalesce(content_type, ''), coalesce(subject_node_id, 0)
);

-- 4. Create unique index for category-specific instructions under a specific content type
drop index if exists current_affairs.ux_ai_instructions_subject_content_type;
create unique index ux_ai_instructions_subject_content_type
  on current_affairs.ai_instructions (subject_node_id, content_type)
  where subject_node_id is not null;

-- 5. Create unique index for general content type templates (where subject is null)
drop index if exists current_affairs.ux_ai_instructions_scope_content_type;
create unique index ux_ai_instructions_scope_content_type
  on current_affairs.ai_instructions (scope, content_type)
  where subject_node_id is null;
