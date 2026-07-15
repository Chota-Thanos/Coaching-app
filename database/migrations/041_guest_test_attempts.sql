-- Allow test attempts to be started by an unauthenticated guest, identified by an
-- opaque client-generated guest_token instead of a user_id. The attempt is later
-- "claimed" (user_id assigned, guest_token cleared) once the guest registers/logs in.
alter table assessment.test_attempts
  alter column user_id drop not null;

alter table assessment.test_attempts
  add column if not exists guest_token text,
  add column if not exists claimed_at timestamptz;

alter table assessment.test_attempts drop constraint if exists chk_test_attempts_owner;
alter table assessment.test_attempts
  add constraint chk_test_attempts_owner check (user_id is not null or guest_token is not null);

create index if not exists idx_test_attempts_guest_token
  on assessment.test_attempts(guest_token) where guest_token is not null;
