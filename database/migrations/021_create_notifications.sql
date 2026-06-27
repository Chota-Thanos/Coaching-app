-- Migration 021: Create Notifications Table
-- Date: 2026-06-10

create table if not exists app.notifications (
  id bigint generated always as identity primary key,
  user_id bigint references app.users(id) on delete cascade not null,
  type text not null,
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread on app.notifications(user_id, is_read);
create index if not exists idx_notifications_created on app.notifications(created_at desc);
