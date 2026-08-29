-- Where a learner stopped watching a lecture.
--
-- The course workspace offers "Resume", which needs a position to resume from;
-- without this the button could only ever restart the video. Date: 2026-08-29

alter table study_plan.item_progress
  add column if not exists last_position_seconds integer not null default 0
    check (last_position_seconds >= 0);
