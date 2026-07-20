-- Current affairs: concept ("topic") articles for prelims content reuse, plus an update log
-- so a concept article can be revised in place instead of duplicated.
-- Date: 2026-07-20

alter table current_affairs.master_articles
  add column if not exists article_role text not null default 'event';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'current_affairs.master_articles'::regclass
      and conname = 'master_articles_article_role_check'
  ) then
    alter table current_affairs.master_articles
      add constraint master_articles_article_role_check
      check (article_role in ('event', 'concept'));
  end if;
end
$$;

create index if not exists idx_current_affairs_master_articles_role
  on current_affairs.master_articles(article_role, content_family, status, publication_date desc);

create table if not exists current_affairs.master_article_updates (
  id bigint generated always as identity primary key,
  article_id bigint not null references current_affairs.master_articles(id) on delete cascade,
  body text not null,
  created_by_user_id bigint references app.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_master_article_updates_article
  on current_affairs.master_article_updates(article_id, created_at desc);
