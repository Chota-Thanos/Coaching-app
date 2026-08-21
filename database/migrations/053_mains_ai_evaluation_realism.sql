-- Realism upgrade for the Mains AI evaluator: store a structured, rubric-based
-- score breakdown and any AI-flagged factual concerns alongside the existing
-- score/feedback/strengths/weaknesses, and record the word count the AI
-- actually graded against (useful for auditing/debugging bad evaluations).
alter table assessment.mains_answer_attempts
  add column if not exists rubric_breakdown jsonb not null default '[]'::jsonb,
  add column if not exists factual_concerns jsonb not null default '[]'::jsonb,
  add column if not exists word_count integer;

comment on column assessment.mains_answer_attempts.rubric_breakdown is
  'Per-criterion marks awarded by the AI evaluator (or human), e.g. [{"criterion","max_marks","awarded_marks","comment"}], summing to score.';
comment on column assessment.mains_answer_attempts.factual_concerns is
  'Specific facts/claims in the student answer the AI evaluator flagged as possibly incorrect or unverifiable, each with a stated confidence level.';
comment on column assessment.mains_answer_attempts.word_count is
  'Word count of student_answer_text at evaluation time.';
