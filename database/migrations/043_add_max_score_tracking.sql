-- Track max possible marks alongside score at the category-breakdown level, so
-- performance can be ranked by marks percentage (score / max_score * 100) instead
-- of raw correct/incorrect accuracy. Marks percentage can go negative once negative
-- marking outweighs correct answers, which plain accuracy (a 0..1 ratio) can't express.

alter table assessment.result_topic_breakdowns
  add column if not exists max_score numeric(10,2) not null default 0;

-- Cumulative (not averaged) sums across every attempt, so score_percent can be
-- computed as total_score / total_max_score at read time — a correctly
-- question-count-weighted ratio, unlike the existing avg_score column (which
-- averages each attempt's score with equal weight regardless of question count).
alter table assessment.student_topic_metrics
  add column if not exists total_score numeric(12,2) not null default 0,
  add column if not exists total_max_score numeric(12,2) not null default 0;
