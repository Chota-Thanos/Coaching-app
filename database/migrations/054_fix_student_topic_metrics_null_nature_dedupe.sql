-- Bug: the upsert in scoring.service.ts (upsertStudentTopicMetric) writes with
-- `on conflict (user_id, taxonomy_node_id, question_nature_id)`, but Postgres
-- treats every NULL as distinct from every other NULL for conflict matching.
-- question_nature_id is NULL for most GK/CSAT questions (they carry no
-- "nature" tag), so every test submission on an unclassified node inserted a
-- brand-new row instead of accumulating onto the existing one — one node
-- (e.g. a subject like "Economy") ends up with one row per test ever taken,
-- each showing that single test's numbers instead of the combined total.
--
-- Fix is two parts: merge the duplicate rows already sitting in the table
-- back into one row per (user_id, taxonomy_node_id, question_nature_id) —
-- treating NULL question_nature_id as one group, same as the corrected
-- constraint below will — then widen the unique constraint with
-- NULLS NOT DISTINCT so future upserts actually match and accumulate.

-- 1. Merge duplicates: for every group of rows sharing the same user,
--    taxonomy node, and question_nature_id (NULLs included as one group),
--    fold every row's totals into the lowest-id row, then drop the rest.
with grouped as (
  select
    user_id,
    taxonomy_node_id,
    question_nature_id,
    min(id) as keep_id,
    sum(attempt_count) as attempt_count,
    sum(question_count) as question_count,
    sum(correct_count) as correct_count,
    sum(incorrect_count) as incorrect_count,
    sum(unattempted_count) as unattempted_count,
    sum(total_score) as total_score,
    sum(total_max_score) as total_max_score,
    max(last_attempted_at) as last_attempted_at,
    count(*) as row_count
  from assessment.student_topic_metrics
  group by user_id, taxonomy_node_id, question_nature_id
  having count(*) > 1
)
update assessment.student_topic_metrics stm
set
  attempt_count = grouped.attempt_count,
  question_count = grouped.question_count,
  correct_count = grouped.correct_count,
  incorrect_count = grouped.incorrect_count,
  unattempted_count = grouped.unattempted_count,
  total_score = grouped.total_score,
  total_max_score = grouped.total_max_score,
  avg_accuracy = case
    when grouped.correct_count + grouped.incorrect_count > 0
      then grouped.correct_count::numeric / (grouped.correct_count + grouped.incorrect_count)
    else 0
  end,
  avg_score = case
    when grouped.attempt_count > 0
      then grouped.total_score / grouped.attempt_count
    else 0
  end,
  last_attempted_at = grouped.last_attempted_at,
  updated_at = now()
from grouped
where stm.id = grouped.keep_id;

-- GROUP BY (unlike a unique index) already treats NULLs as equal, so this
-- keeps exactly the one row per group the UPDATE above just merged into.
delete from assessment.student_topic_metrics stm
where stm.id not in (
  select min(id)
  from assessment.student_topic_metrics
  group by user_id, taxonomy_node_id, question_nature_id
);

-- 2. Widen the constraint so ON CONFLICT actually catches the NULL case
--    going forward — this is the real fix, the merge above only cleans up
--    the damage the bug already did.
alter table assessment.student_topic_metrics
  drop constraint student_topic_metrics_user_id_taxonomy_node_id_question_nat_key;

alter table assessment.student_topic_metrics
  add constraint student_topic_metrics_user_id_taxonomy_node_id_question_nat_key
  unique nulls not distinct (user_id, taxonomy_node_id, question_nature_id);
