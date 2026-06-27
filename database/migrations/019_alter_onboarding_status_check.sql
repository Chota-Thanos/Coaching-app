-- Migration 019: Alter onboarding requests status check constraint to support 'more_info_required'
-- Date: 2026-06-10

do $$
declare
  constraint_name_var text;
begin
  select tc.constraint_name into constraint_name_var
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
  where tc.table_schema = 'app'
    and tc.table_name = 'professional_onboarding_requests'
    and tc.constraint_type = 'CHECK'
    and ccu.column_name = 'status';

  if constraint_name_var is not null then
    execute 'alter table app.professional_onboarding_requests drop constraint ' || constraint_name_var;
  end if;
end
$$;

alter table app.professional_onboarding_requests add constraint ck_professional_onboarding_requests_status
  check (status in ('draft', 'pending', 'approved', 'rejected', 'more_info_required'));
