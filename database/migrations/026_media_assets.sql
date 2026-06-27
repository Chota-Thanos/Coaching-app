-- Shared media upload module
-- Date: 2026-06-15

create schema if not exists media;

create or replace function media.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists media.assets (
  id bigint generated always as identity primary key,
  original_file_name text not null,
  file_name text not null,
  file_url text not null,
  storage_disk text not null default 'local',
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  usage_scope text,
  alt_text text,
  caption text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by_user_id bigint references app.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_media_assets_storage_path
  on media.assets(storage_disk, storage_path);

create index if not exists idx_media_assets_usage_scope
  on media.assets(usage_scope, created_at desc);

create index if not exists idx_media_assets_uploaded_by
  on media.assets(uploaded_by_user_id, created_at desc);

drop trigger if exists trg_media_assets_updated_at on media.assets;
create trigger trg_media_assets_updated_at
before update on media.assets
for each row execute function media.set_updated_at();
