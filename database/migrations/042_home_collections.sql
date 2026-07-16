-- Migration: Curated Home collections
-- Lets an admin hand-pick taxonomy nodes from across different subjects/exams
-- into a named, orderable collection (e.g. "Previous Year Questions",
-- "Current Affairs") for display on the student-facing Home screen.
-- Multiple collections can exist side by side.
-- Date: 2026-07-16

create table if not exists app.home_collections (
  id bigint generated always as identity primary key,
  slug text not null unique,          -- stable identifier referenced by clients
  title text not null,                -- shown as the section heading on Home
  subtitle text,                      -- optional short description
  cover_image_url text,               -- optional collection-level cover (falls back to per-item covers)
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Items table: ordered list of taxonomy nodes picked into a collection.
-- node_id is not FK-constrained because it can point into either the
-- objective (assessment.assessment_taxonomy_nodes) or Mains
-- (assessment.mains_taxonomy_nodes) tree — taxonomy_type disambiguates which.
create table if not exists app.home_collection_items (
  id bigint generated always as identity primary key,
  collection_id bigint not null references app.home_collections(id) on delete cascade,
  taxonomy_type text not null check (taxonomy_type in ('objective', 'mains')),
  node_id bigint not null,
  display_order integer not null default 0,
  cover_image_url text,               -- optional per-item cover override
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, taxonomy_type, node_id)
);

create index if not exists idx_home_collection_items_collection_id on app.home_collection_items(collection_id);

drop trigger if exists trg_home_collections_updated_at on app.home_collections;
create trigger trg_home_collections_updated_at
before update on app.home_collections
for each row execute function current_affairs.set_updated_at();

drop trigger if exists trg_home_collection_items_updated_at on app.home_collection_items;
create trigger trg_home_collection_items_updated_at
before update on app.home_collection_items
for each row execute function current_affairs.set_updated_at();
