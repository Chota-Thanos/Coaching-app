-- Migration to add is_user_question column to assessment.questions
ALTER TABLE assessment.questions ADD COLUMN IF NOT EXISTS is_user_question boolean DEFAULT false;
