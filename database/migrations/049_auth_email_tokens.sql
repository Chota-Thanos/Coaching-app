-- 049_auth_email_tokens.sql
--
-- Single-use tokens for email verification and password reset.
--
-- Before this there was no password recovery at all: a user who forgot their
-- password had no way back into a paid account. app.users.email_verified_at
-- also existed but nothing ever set it for password-registered users, because
-- there was no mechanism to send a verification mail.
--
-- Only the SHA-256 hash of each token is stored, so a leaked database dump
-- cannot be replayed to take over accounts.

create table if not exists app.auth_tokens (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  purpose text not null check (purpose in ('email_verification', 'password_reset')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_tokens_user_purpose
  on app.auth_tokens (user_id, purpose, consumed_at);
create index if not exists idx_auth_tokens_expiry
  on app.auth_tokens (expires_at);

comment on table app.auth_tokens is
  'Single-use, hashed tokens for email verification and password reset. Only the SHA-256 hash is stored; the raw token exists only in the email sent to the user.';
