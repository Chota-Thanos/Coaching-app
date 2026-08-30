-- 060: Cancellation, refunds, expiry, reminders and no-shows.
--
-- The module could take a booking but never unwind one. `status` already
-- allowed 'cancelled' and 'expired' and `payment_status` already allowed
-- 'refunded', but nothing in the codebase ever wrote any of those three values,
-- so a student who needed to pull out had no way to say so and a paid session
-- that did not happen could not be put right. This adds the columns that record
-- who unwound what, and when.
--
-- Nothing here changes an existing row's meaning: every column is nullable or
-- defaulted, and `expires_at` is backfilled so requests already waiting on a
-- mentor start ageing from now rather than retroactively timing out.

begin;

-- ── Requests: who cancelled, why, and what happened to the money ────────────
alter table app.mentorship_requests
  -- When an unanswered request gives up waiting. Set on creation from here on;
  -- the sweep below only ever reads it, so a null means "never expires".
  add column if not exists expires_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_user_id bigint references app.users(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists refunded_at timestamptz,
  -- Free text rather than an enum: the reason a refund was issued is read by
  -- people, not branched on by code.
  add column if not exists refund_reason text;

-- Requests still waiting on a mentor get the standard window from today, not
-- from when they were sent -- otherwise turning this on would expire a month of
-- pending requests in one sweep.
update app.mentorship_requests
   set expires_at = now() + interval '7 days'
 where status = 'requested' and expires_at is null;

create index if not exists idx_mentorship_requests_expiry
  on app.mentorship_requests(expires_at)
  where status = 'requested';

-- ── Sessions: cancellation, reminders, no-shows ─────────────────────────────
alter table app.mentorship_sessions
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_user_id bigint references app.users(id) on delete set null,
  add column if not exists cancellation_reason text,
  -- Set once, when the reminder goes out. Doubles as the idempotency guard: the
  -- sweep runs every few minutes and must not send twice.
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists no_show_reported_at timestamptz,
  add column if not exists no_show_reported_by_user_id bigint references app.users(id) on delete set null,
  -- Which side failed to appear, as claimed by the other one. Not adjudicated
  -- here; staff read it off the admin screen and decide.
  add column if not exists no_show_role text check (no_show_role in ('mentor', 'student')),
  add column if not exists no_show_note text;

-- The reminder sweep looks for sessions starting soon that have not been
-- reminded. Partial index so it stays cheap as history accumulates.
create index if not exists idx_mentorship_sessions_reminder
  on app.mentorship_sessions(starts_at)
  where status = 'scheduled' and reminder_sent_at is null;

commit;
