-- Current affairs refinement: content families, relations, sections, category pages/search support
-- Date: 2026-05-31

do $$
declare
  con record;
begin
  for con in
    select conname
    from pg_constraint
    where conrelid = 'current_affairs.master_articles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%content_kind%'
  loop
    execute format('alter table current_affairs.master_articles drop constraint %I', con.conname);
  end loop;
end
$$;

alter table current_affairs.master_articles
  add constraint master_articles_content_kind_check
  check (
    content_kind in (
      'daily_current_affairs',
      'prelims_pyq',
      'daily_editorial_summary',
      'mains_topic_note',
      'mains_pyq',
      'mains_summary',
      'mains_article',
      'study_note'
    )
  );

alter table current_affairs.master_articles
  add column if not exists content_family text;

update current_affairs.master_articles
set content_family = case
  when content_kind in ('daily_current_affairs', 'prelims_pyq') then 'prelims'
  else 'mains'
end
where content_family is null;

alter table current_affairs.master_articles
  alter column content_family set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'current_affairs.master_articles'::regclass
      and conname = 'master_articles_content_family_check'
  ) then
    alter table current_affairs.master_articles
      add constraint master_articles_content_family_check
      check (content_family in ('prelims', 'mains'));
  end if;
end
$$;

create index if not exists idx_current_affairs_master_articles_family_kind
  on current_affairs.master_articles(content_family, content_kind, status, publication_date desc);

create or replace function current_affairs.ensure_master_article_family()
returns trigger
language plpgsql
as $$
declare
  category_family text;
begin
  if new.content_kind in ('daily_current_affairs', 'prelims_pyq') and new.content_family <> 'prelims' then
    raise exception 'content_kind % must use prelims content_family', new.content_kind;
  end if;

  if new.content_kind in ('daily_editorial_summary', 'mains_topic_note', 'mains_pyq', 'mains_summary', 'mains_article', 'study_note')
     and new.content_family <> 'mains' then
    raise exception 'content_kind % must use mains content_family', new.content_kind;
  end if;

  if new.category_node_id is not null then
    select cn.content_family into category_family
    from current_affairs.category_nodes cn
    where cn.id = new.category_node_id;

    if category_family is null then
      raise exception 'category_node_id % does not exist', new.category_node_id;
    end if;

    if category_family <> new.content_family then
      raise exception 'article content_family % does not match category content_family %', new.content_family, category_family;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_master_articles_family on current_affairs.master_articles;
create trigger trg_master_articles_family
before insert or update of content_family, content_kind, category_node_id
on current_affairs.master_articles
for each row
execute function current_affairs.ensure_master_article_family();

create table if not exists current_affairs.master_article_relations (
  id bigint generated always as identity primary key,
  source_article_id bigint not null references current_affairs.master_articles(id) on delete cascade,
  target_article_id bigint not null references current_affairs.master_articles(id) on delete cascade,
  relation_type text not null default 'related_reference'
    check (
      relation_type in (
        'related_reference',
        'base_current_affairs',
        'imported_source',
        'follow_up',
        'prerequisite',
        'mains_fodder',
        'pyq_context'
      )
    ),
  label text,
  note text,
  display_order integer not null default 0,
  created_by_user_id bigint references app.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_article_id, target_article_id, relation_type),
  check (source_article_id <> target_article_id)
);

create index if not exists idx_master_article_relations_source
  on current_affairs.master_article_relations(source_article_id, relation_type, display_order);

create index if not exists idx_master_article_relations_target
  on current_affairs.master_article_relations(target_article_id, relation_type);

create table if not exists current_affairs.master_article_sections (
  id bigint generated always as identity primary key,
  article_id bigint not null references current_affairs.master_articles(id) on delete cascade,
  heading text not null,
  slug text not null,
  body text not null default '',
  body_json jsonb not null default '{}'::jsonb,
  seo_title text,
  seo_description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by_user_id bigint references app.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, slug)
);

create index if not exists idx_master_article_sections_article
  on current_affairs.master_article_sections(article_id, display_order);

create index if not exists idx_master_article_sections_search
  on current_affairs.master_article_sections
  using gin(to_tsvector('english', coalesce(heading, '') || ' ' || coalesce(body, '') || ' ' || coalesce(seo_title, '') || ' ' || coalesce(seo_description, '')));

drop trigger if exists trg_master_article_sections_updated_at on current_affairs.master_article_sections;
create trigger trg_master_article_sections_updated_at
before update on current_affairs.master_article_sections
for each row
execute function current_affairs.set_updated_at();

create table if not exists current_affairs.master_article_section_sources (
  id bigint generated always as identity primary key,
  section_id bigint not null references current_affairs.master_article_sections(id) on delete cascade,
  source_article_id bigint not null references current_affairs.master_articles(id) on delete cascade,
  relation_type text not null default 'imported_source'
    check (relation_type in ('imported_source', 'base_current_affairs', 'reference', 'case_study', 'example')),
  note text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (section_id, source_article_id, relation_type)
);

create index if not exists idx_master_article_section_sources_section
  on current_affairs.master_article_section_sources(section_id, display_order);

create index if not exists idx_current_affairs_master_articles_search
  on current_affairs.master_articles
  using gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '') || ' ' || coalesce(source_name, '')));

