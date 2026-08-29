-- Per-mentor session fee and duration.
--
-- Every mentorship request was created with payment_amount hardcoded to 1000
-- (mentorship/service.ts), so a six-year IAS officer and a first-year mentor
-- cost a student exactly the same, and no screen could show a price before
-- checkout because there was nothing to show. Rupees, not paise: the request's
-- own payment_amount is already stored in rupees and converted at order time.
-- Date: 2026-08-30

alter table app.mentor_profiles
  add column if not exists session_fee integer not null default 1000
    check (session_fee >= 0);

alter table app.mentor_profiles
  add column if not exists session_minutes integer not null default 45
    check (session_minutes > 0);
