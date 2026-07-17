-- Classify which flow produced a test_templates row (custom test, study plan mirror,
-- dynamic/compiled practice, etc.) so attempts and metrics can be traced back to their
-- origin, and so Study Plan attempts can be mirrored into the central performance
-- pipeline without being confused with directly-browsable catalog tests.

alter table assessment.test_templates
  add column if not exists source text not null default 'official'
    check (source in ('official', 'custom_test', 'dynamic_practice', 'compiled_practice', 'single_mains_question', 'study_plan'));

create index if not exists idx_test_templates_source
  on assessment.test_templates(source);

alter table assessment.test_attempts
  add column if not exists study_plan_attempt_id bigint unique references study_plan.test_attempts(id) on delete set null;

comment on column assessment.test_templates.source is
  'Which flow created this template: official (admin catalog), custom_test (student-built), dynamic_practice, compiled_practice, single_mains_question, or study_plan (a mirror of a study_plan.test_attempts submission, written for central performance metrics only -- never shown in test catalogs, "My Results", or leaderboards).';

comment on column assessment.test_attempts.study_plan_attempt_id is
  'Set only on source=''study_plan'' mirror attempts -- traces back to the original study_plan.test_attempts row.';
