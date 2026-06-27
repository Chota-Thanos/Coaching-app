-- Notes Space: editable fork copies and duplicate-safe repository membership

alter table current_affairs.student_article_forks
  add column if not exists forked_title text,
  add column if not exists forked_body text,
  add column if not exists forked_body_json jsonb not null default '{}'::jsonb;

update current_affairs.student_article_forks saf
set
  forked_title = coalesce(saf.forked_title, ma.title),
  forked_body = coalesce(saf.forked_body, ma.body),
  forked_body_json = case
    when saf.forked_body_json = '{}'::jsonb then ma.body_json
    else saf.forked_body_json
  end
from current_affairs.master_articles ma
where ma.id = saf.master_article_id
  and (saf.forked_title is null or saf.forked_body is null);

with ranked_forks as (
  select
    id,
    row_number() over (
      partition by collection_id, fork_id
      order by id
    ) as row_no
  from current_affairs.student_collection_items
  where fork_id is not null
),
ranked_student_articles as (
  select
    id,
    row_number() over (
      partition by collection_id, student_article_id
      order by id
    ) as row_no
  from current_affairs.student_collection_items
  where student_article_id is not null
)
delete from current_affairs.student_collection_items sci
using (
  select id from ranked_forks where row_no > 1
  union all
  select id from ranked_student_articles where row_no > 1
) duplicates
where sci.id = duplicates.id;

create unique index if not exists ux_student_collection_items_collection_fork
  on current_affairs.student_collection_items(collection_id, fork_id)
  where fork_id is not null;

create unique index if not exists ux_student_collection_items_collection_student_article
  on current_affairs.student_collection_items(collection_id, student_article_id)
  where student_article_id is not null;
