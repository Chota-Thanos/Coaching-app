alter table assessment.mains_answer_attempts
  add column if not exists checked_copy_url text,
  add column if not exists evaluated_at timestamptz;

create index if not exists idx_mains_answer_attempts_status_submitted
  on assessment.mains_answer_attempts(evaluation_status, submitted_at desc);
