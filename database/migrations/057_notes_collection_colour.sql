-- A repository needs a colour so it is recognisable at a glance in the notes
-- rail, the way a folder is. Nullable: existing repositories keep no colour
-- until an author picks one, and the UI falls back to a stable hash of the id.
-- Date: 2026-08-29

alter table current_affairs.student_collections
  add column if not exists color text;
