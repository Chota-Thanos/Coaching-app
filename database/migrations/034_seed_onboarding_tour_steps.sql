-- Migration: Seed onboarding tour steps
-- Date: 2026-07-04

-- Helper to clear previous seeded steps (prevent duplicates)
delete from app.onboarding_tour_steps 
where tour_id in (
  select id from app.onboarding_tours 
  where key in ('custom_test_tour', 'notes_workspace_tour', 'mobile_home_tour')
);

-- 1. Steps for Web Custom Test Builder Tour
with tour as (select id from app.onboarding_tours where key = 'custom_test_tour' limit 1)
insert into app.onboarding_tour_steps (tour_id, display_order, selector, badge, title, body, action_trigger, action_text)
values
  ((select id from tour), 0, '#tour-content-type', 'Step 1 of 6: Content Type', 'Select Content Type', 'Choose the subject domain for your custom mock test: General Studies (GS), CSAT / Aptitude, or Mains subjective. Click the ''CSAT'' or ''GS'' button to select it.', 'click', 'Click on one of the content type buttons below (e.g. GS or CSAT) to proceed.'),
  ((select id from tour), 1, '#tour-subject-expand', 'Step 2 of 6: Browse Subjects', 'Expand a Subject', 'The syllabus categories are loaded dynamically. Click on the first subject row name to expand it and reveal its topics.', 'click', 'Click on the subject name above to expand it.'),
  ((select id from tour), 2, '#tour-add-topic-btn', 'Step 3 of 6: Add Topic', 'Add Topic to Basket', 'Inside the expanded subject, you can view the available question counts. Click the ''Add'' button next to the topic to add it to your custom test basket.', 'click', 'Click the ''Add'' button next to the subtopic above.'),
  ((select id from tour), 3, '#tour-basket-card', 'Step 4 of 6: Adjust Questions Count', 'Manage Question Pool', 'The topic is now in your basket! Here, you can adjust the quantity of questions you want from this category. Click ''Next'' when you''re done reviewing.', null, null),
  ((select id from tour), 4, '#tour-test-name', 'Step 5 of 6: Name Your Test', 'Custom Test Title', 'Provide a name for this custom mock test so you can easily identify it later in your history.', 'input', 'Type a custom test name in the input box above to proceed.'),
  ((select id from tour), 5, '#tour-create-test-btn', 'Step 6 of 6: Start Your Exam', 'Generate & Start Test', 'You''re all set! Click this button to generate the custom test and launch the exam interface. (Note: Guest users will be prompted to log in/register to preserve their progress).', 'click', 'Click the ''Create & Start Custom Test'' button below to launch.');

-- 2. Steps for Mobile Dashboard Tour
with tour as (select id from app.onboarding_tours where key = 'mobile_home_tour' limit 1)
insert into app.onboarding_tour_steps (tour_id, display_order, selector, badge, title, body, action_trigger, action_text)
values
  ((select id from tour), 0, 'banner', 'Step 1 of 5: Member Center', 'Premium Subscription Status', 'Track your active subscription tier, validity dates, and evaluation token counts right at the top of your dashboard.', null, null),
  ((select id from tour), 1, 'radar', 'Step 2 of 5: Analytics Radar', 'Your Subject Performance', 'View your GS Prelims, CSAT math drill, and Mains answer-writing accuracy breakdown dynamically.', null, null),
  ((select id from tour), 2, 'practice', 'Step 3 of 5: Mock Test Builder', 'Custom GK, CSAT & Mains Quizzes', 'Tap any tile to launch targeted Prelims GS tests, math CSAT drills, or subjective Mains writing assignments.', null, null),
  ((select id from tour), 3, 'study_plans', 'Step 4 of 5: Study Plans', 'Structured Preparation roadmaps', 'Sprint toward mock exams with guided 90-Day Prelims pathways and Mains writing modules.', null, null),
  ((select id from tour), 4, 'mentors', 'Step 5 of 5: Mentors Hub', 'Connect with Verified Toppers', 'Browse and book 1-on-1 calls or mains evaluation reviews directly with verified UPSC experts.', null, null);

-- 3. Steps for Web Notes Workspace Tour
with tour as (select id from app.onboarding_tours where key = 'notes_workspace_tour' limit 1)
insert into app.onboarding_tour_steps (tour_id, display_order, selector, badge, title, body, action_trigger, action_text)
values
  ((select id from tour), 0, '#tour-repo-list', 'Step 1 of 3: Notes Repositories', 'Create & Manage Folders', 'Create subjects-specific repositories to group current affairs editorials, dynamic summaries, and mains answer drafts.', null, null),
  ((select id from tour), 1, '#tour-editor', 'Step 2 of 3: Rich Workspace Editor', 'Aspirant Workspace Editor', 'Tag keywords, link GS topics, insert diagram assets, and auto-summarize articles using the AI Assistant panel.', null, null),
  ((select id from tour), 2, '#tour-ai-helper', 'Step 3 of 3: Copilot Helper', 'Interactive AI Copilot', 'Ask questions, get feedback on mock drafts, or parse complex current affairs syllabus updates with live AI guidance.', null, null);
