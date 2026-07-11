-- Migration to add index for user-submitted questions optimization
CREATE INDEX IF NOT EXISTS idx_questions_created_by_user
  ON assessment.questions(created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;
