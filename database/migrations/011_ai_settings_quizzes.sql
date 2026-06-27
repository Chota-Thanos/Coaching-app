-- Migration: Add content_type to style guides and extend scope constraint on instructions
-- Date: 2026-06-03

-- 1. Add content_type to current_affairs.ai_style_guides
alter table current_affairs.ai_style_guides
  add column if not exists content_type text;

-- Add partial unique constraints to make sure we only have at most one global style guide (null content_type)
-- and one style guide per content_type
drop index if exists current_affairs.ux_ai_style_guides_content_type;
create unique index ux_ai_style_guides_content_type 
  on current_affairs.ai_style_guides (content_type) 
  where content_type is not null;

drop index if exists current_affairs.ux_ai_style_guides_global;
create unique index ux_ai_style_guides_global 
  on current_affairs.ai_style_guides ((1)) 
  where content_type is null;

-- 2. Modify constraint on current_affairs.ai_instructions
do $$
declare
  r record;
begin
  for r in (
    select conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'current_affairs'
      and t.relname = 'ai_instructions'
      and c.contype = 'c'
      and c.conname like '%scope%'
  ) loop
    execute 'alter table current_affairs.ai_instructions drop constraint ' || r.conname;
  end loop;
end;
$$;

alter table current_affairs.ai_instructions
  add constraint ai_instructions_scope_check check (scope in ('general', 'article', 'premium', 'subject', 'quiz'));
