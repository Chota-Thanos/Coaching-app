-- Lets a single master article belong to MULTIPLE category trees at once
-- (e.g. an article filed under both "Economy" and "International Relations").
-- The existing master_articles.category_node_id column is retained as the
-- PRIMARY category link for backward compatibility (reads, feeds, SEO paths);
-- this join table carries the primary link PLUS any additional categories.

create table if not exists current_affairs.article_category_links (
  id bigint generated always as identity primary key,
  article_id bigint not null
    references current_affairs.master_articles(id) on delete cascade,
  category_node_id bigint not null
    references current_affairs.category_nodes(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (article_id, category_node_id)
);

create index if not exists idx_article_category_links_article
  on current_affairs.article_category_links(article_id);

create index if not exists idx_article_category_links_category
  on current_affairs.article_category_links(category_node_id, article_id);

-- At most one primary link per article.
create unique index if not exists idx_article_category_links_one_primary
  on current_affairs.article_category_links(article_id)
  where is_primary = true;

-- Backfill: mirror every article's existing single category_node_id into the
-- join table as its primary link, so both representations agree from day one.
insert into current_affairs.article_category_links (article_id, category_node_id, is_primary)
select ma.id, ma.category_node_id, true
from current_affairs.master_articles ma
where ma.category_node_id is not null
on conflict (article_id, category_node_id) do nothing;
