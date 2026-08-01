-- 051_auth_api_keys.sql
--
-- Machine authentication for automation that runs outside a browser.
--
-- Until now the only way to call an admin endpoint was a short-lived user JWT
-- obtained by logging in with a password, which a local agent cannot hold
-- safely or refresh unattended. An API key is bound to an existing user row, so
-- every downstream guard (requireAdminOrEditor, requireRole, audit columns that
-- record created_by) keeps working unchanged — the key is a way to authenticate
-- as that account, not a parallel permission system.
--
-- Only the SHA-256 hash of the secret is stored. `key_prefix` is the public,
-- non-secret lookup handle so verification is a single indexed row read
-- followed by one constant-time comparison, and so keys can be listed and
-- revoked in a UI without ever showing the secret again.

create table if not exists app.api_keys (
  id bigint generated always as identity primary key,
  user_id bigint not null references app.users(id) on delete cascade,
  -- Human label, e.g. "local posting agent (Abrar laptop)".
  name text not null,
  key_prefix text not null unique,
  key_hash text not null,
  -- Optional narrowing *within* the user's own permissions; null means
  -- "everything this user can already do". Never widens them.
  scopes text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_user on app.api_keys (user_id);
create index if not exists idx_api_keys_active
  on app.api_keys (key_prefix) where revoked_at is null;

comment on table app.api_keys is
  'Long-lived machine credentials bound to an app.users row. Only the SHA-256 hash of the secret is stored; key_prefix is the public lookup handle.';
comment on column app.api_keys.scopes is
  'Optional allow-list narrowing the key within its user''s existing permissions. Null = no extra narrowing. Never grants anything the user lacks.';
