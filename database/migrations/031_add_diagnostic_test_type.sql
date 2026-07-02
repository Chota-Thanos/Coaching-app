-- Alter test_type constraint on assessment.test_templates to support diagnostic_test
alter table assessment.test_templates drop constraint if exists test_templates_test_type_check;

alter table assessment.test_templates add constraint test_templates_test_type_check
  check (test_type in ('quick_test', 'sectional_test', 'full_length_test', 'pyq_test', 'mains_test', 'diagnostic_test'));
