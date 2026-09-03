-- Chat and raise-hand for study-plan live classes.
-- Date: 2026-09-03
--
-- The class itself is carried by Agora (migration 045). Everything a class
-- needs *around* the video — a question typed in chat, a hand up waiting to be
-- called on — has no home in that stack: the installed Web RTC SDK has no
-- data-message API, and this API has no WebSocket layer. Both are therefore
-- persisted here and read back over ordinary authenticated HTTP, which the
-- Flutter app can adopt later without any new transport.
--
-- Persisting chat rather than passing it through in memory also means a
-- student who joins twenty minutes late still sees what was asked and
-- answered before they arrived.

create table if not exists study_plan.live_class_messages (
  id bigint generated always as identity primary key,
  live_class_id bigint not null references study_plan.live_classes(id) on delete cascade,
  user_id bigint not null references app.users(id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

-- Every read is "this class, everything after the last id I saw", so the
-- index matches that access shape exactly.
create index if not exists idx_live_class_messages_class_id
  on study_plan.live_class_messages(live_class_id, id);

-- A raised hand is state, not an event: one row per person per class, removed
-- when they lower it or the host calls on them. A primary key on the pair is
-- what makes "raise" idempotent — clicking twice cannot queue two hands.
create table if not exists study_plan.live_class_hands (
  live_class_id bigint not null references study_plan.live_classes(id) on delete cascade,
  user_id bigint not null references app.users(id) on delete cascade,
  raised_at timestamptz not null default now(),
  primary key (live_class_id, user_id)
);

create index if not exists idx_live_class_hands_class
  on study_plan.live_class_hands(live_class_id, raised_at);

comment on table study_plan.live_class_messages is
  'Chat for one live class, read by polling with an "after this id" cursor. Kept after the class ends so the transcript survives.';

comment on table study_plan.live_class_hands is
  'Currently raised hands. A row exists only while the hand is up; lowering it deletes the row.';
