-- 059: What the student takes away from a session, and what they say about it.
--
-- Two gaps closed here.
--
-- First, a completed session left nothing behind. `mentorship_sessions.summary`
-- is a single free-text column with no structure and nothing in the interface
-- ever wrote to it, so once the call ended the student had no record of what
-- was covered or what they were told to do next. Action points in particular
-- need their own rows: the student ticks them off over the following weeks, and
-- a paragraph of prose cannot be ticked off.
--
-- Second, nothing anywhere captured whether a session was any good. The mentor
-- list ranks by nothing and shows no rating, so a student choosing between
-- thirty officers is choosing blind. Ratings are one per session, written by
-- the student who attended it, and roll up onto the profile.

begin;

-- ── Mentor's wrap-up ────────────────────────────────────────────────────────
create table if not exists app.mentorship_session_notes (
  id bigint generated always as identity primary key,
  session_id bigint references app.mentorship_sessions(id) on delete cascade not null unique,
  mentor_id bigint references app.users(id) on delete cascade not null,
  -- What was actually discussed, in the mentor's words.
  covered text,
  -- Longer-horizon guidance that is not a discrete task.
  guidance text,
  -- Books, articles, plan items the mentor pointed at. Each entry is
  -- {label, url}; free-form because a mentor may name an offline book.
  resources jsonb not null default '[]'::jsonb,
  -- Kept private until the mentor publishes, so half-written notes are not
  -- visible to the student mid-typing.
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_session_notes_mentor on app.mentorship_session_notes(mentor_id);

-- ── Action points the student works through afterwards ──────────────────────
create table if not exists app.mentorship_action_items (
  id bigint generated always as identity primary key,
  session_id bigint references app.mentorship_sessions(id) on delete cascade not null,
  -- Whoever wrote it: mentors set the tasks, students may add their own.
  created_by_user_id bigint references app.users(id) on delete set null,
  title text not null,
  detail text,
  due_on date,
  -- Only the student marks these done; the mentor sees the result.
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_action_items_session on app.mentorship_action_items(session_id, position);

-- ── Student's rating of the session ─────────────────────────────────────────
create table if not exists app.mentorship_ratings (
  id bigint generated always as identity primary key,
  session_id bigint references app.mentorship_sessions(id) on delete cascade not null unique,
  mentor_id bigint references app.users(id) on delete cascade not null,
  user_id bigint references app.users(id) on delete cascade not null,
  rating smallint not null check (rating between 1 and 5),
  -- Optional; most students rate without writing anything.
  comment text,
  -- A student may ask for their comment not to appear on the public profile
  -- while still counting toward the average.
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mentorship_ratings_mentor on app.mentorship_ratings(mentor_id);

-- ── Denormalised aggregate, so the list page stays one query ────────────────
-- The mentor list renders thirty cards; recomputing an average per card would
-- turn one query into thirty. These two columns are maintained by trigger.
alter table app.mentor_profiles
  add column if not exists rating_average numeric(3, 2),
  add column if not exists rating_count integer not null default 0;

create or replace function app.refresh_mentor_rating() returns trigger
language plpgsql as $$
declare
  target_mentor bigint;
begin
  -- On DELETE the NEW record is unassigned, and reading a field off it raises
  -- rather than returning null -- so branch on the operation instead of
  -- coalescing the two records.
  if tg_op = 'DELETE' then
    target_mentor := old.mentor_id;
  else
    target_mentor := new.mentor_id;
  end if;

  update app.mentor_profiles p
     set rating_average = agg.avg_rating,
         rating_count = agg.total
    from (
      select round(avg(rating)::numeric, 2) as avg_rating, count(*)::integer as total
        from app.mentorship_ratings
       where mentor_id = target_mentor
    ) agg
   where p.user_id = target_mentor;

  return null;
end;
$$;

drop trigger if exists trg_refresh_mentor_rating on app.mentorship_ratings;
create trigger trg_refresh_mentor_rating
  after insert or update or delete on app.mentorship_ratings
  for each row execute function app.refresh_mentor_rating();

-- Backfill for any ratings that somehow predate the trigger (none expected,
-- but this makes re-running the migration on a restored dump correct).
update app.mentor_profiles p
   set rating_average = agg.avg_rating,
       rating_count = agg.total
  from (
    select mentor_id, round(avg(rating)::numeric, 2) as avg_rating, count(*)::integer as total
      from app.mentorship_ratings
     group by mentor_id
  ) agg
 where p.user_id = agg.mentor_id;

commit;
