-- Current affairs student reading progress and dashboard support
-- Date: 2026-05-31

create table if not exists current_affairs.student_article_reading_progress (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  fork_id bigint not null references current_affairs.student_article_forks(id) on delete cascade,
  progress_percent numeric(5,2) not null default 0
    check (progress_percent >= 0 and progress_percent <= 100),
  furthest_progress_percent numeric(5,2) not null default 0
    check (furthest_progress_percent >= 0 and furthest_progress_percent <= 100),
  last_anchor_json jsonb not null default '{}'::jsonb,
  last_section_id bigint references current_affairs.master_article_sections(id) on delete set null,
  reading_seconds integer not null default 0 check (reading_seconds >= 0),
  first_read_at timestamptz,
  last_read_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fork_id)
);

create index if not exists idx_current_affairs_reading_progress_user_recent
  on current_affairs.student_article_reading_progress(user_id, last_read_at desc nulls last);

create index if not exists idx_current_affairs_reading_progress_user_completed
  on current_affairs.student_article_reading_progress(user_id, completed_at desc nulls last);

create or replace function current_affairs.ensure_reading_progress_integrity()
returns trigger
language plpgsql
as $$
declare
  fork_owner_id bigint;
  fork_master_article_id bigint;
begin
  select saf.user_id, saf.master_article_id
    into fork_owner_id, fork_master_article_id
  from current_affairs.student_article_forks saf
  where saf.id = new.fork_id;

  if fork_owner_id is null then
    raise exception 'fork_id % does not exist', new.fork_id;
  end if;

  if fork_owner_id <> new.user_id then
    raise exception 'reading progress user_id % does not own fork_id %', new.user_id, new.fork_id;
  end if;

  if new.last_section_id is not null and not exists (
    select 1
    from current_affairs.master_article_sections sec
    where sec.id = new.last_section_id
      and sec.article_id = fork_master_article_id
  ) then
    raise exception 'last_section_id % does not belong to fork article %', new.last_section_id, fork_master_article_id;
  end if;

  if new.furthest_progress_percent < new.progress_percent then
    new.furthest_progress_percent = new.progress_percent;
  end if;

  if new.first_read_at is null then
    new.first_read_at = now();
  end if;

  if new.last_read_at is null then
    new.last_read_at = now();
  end if;

  if new.progress_percent >= 100 and new.completed_at is null then
    new.completed_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_current_affairs_reading_progress_integrity
  on current_affairs.student_article_reading_progress;
create trigger trg_current_affairs_reading_progress_integrity
before insert or update of user_id, fork_id, progress_percent, furthest_progress_percent, last_section_id, first_read_at, last_read_at, completed_at
on current_affairs.student_article_reading_progress
for each row
execute function current_affairs.ensure_reading_progress_integrity();

drop trigger if exists trg_current_affairs_reading_progress_updated_at
  on current_affairs.student_article_reading_progress;
create trigger trg_current_affairs_reading_progress_updated_at
before update on current_affairs.student_article_reading_progress
for each row
execute function current_affairs.set_updated_at();

create table if not exists current_affairs.student_article_reading_events (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  fork_id bigint not null references current_affairs.student_article_forks(id) on delete cascade,
  event_type text not null default 'progress_update'
    check (event_type in ('progress_update', 'completed', 'revision_scheduled')),
  progress_percent numeric(5,2)
    check (progress_percent is null or (progress_percent >= 0 and progress_percent <= 100)),
  reading_seconds_delta integer not null default 0 check (reading_seconds_delta >= 0),
  anchor_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  event_at timestamptz not null default now()
);

create index if not exists idx_current_affairs_reading_events_user_time
  on current_affairs.student_article_reading_events(user_id, event_at desc);

create index if not exists idx_current_affairs_reading_events_fork_time
  on current_affairs.student_article_reading_events(fork_id, event_at desc);

create or replace function current_affairs.ensure_reading_event_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from current_affairs.student_article_forks saf
    where saf.id = new.fork_id
      and saf.user_id = new.user_id
  ) then
    raise exception 'reading event user_id % does not own fork_id %', new.user_id, new.fork_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_current_affairs_reading_event_owner
  on current_affairs.student_article_reading_events;
create trigger trg_current_affairs_reading_event_owner
before insert or update of user_id, fork_id
on current_affairs.student_article_reading_events
for each row
execute function current_affairs.ensure_reading_event_owner();
