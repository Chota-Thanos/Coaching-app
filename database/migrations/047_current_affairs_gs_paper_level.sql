-- Adds a "gs_paper" category tier above "subject" for mains current affairs,
-- so mains content can be organized by GS Paper I-IV before subject/topic/subtopic.
-- Prelims categories are untouched (root nodes there stay node_type = 'subject').

alter table current_affairs.category_nodes
  drop constraint if exists category_nodes_node_type_check;

alter table current_affairs.category_nodes
  add constraint category_nodes_node_type_check
  check (node_type in ('gs_paper', 'subject', 'topic', 'subtopic'));

-- Seed the four GS Paper root nodes for mains.
insert into current_affairs.category_nodes (content_family, parent_id, node_type, name, slug, display_order)
values
  ('mains', null, 'gs_paper', 'GS Paper I', 'gs-paper-1', 1),
  ('mains', null, 'gs_paper', 'GS Paper II', 'gs-paper-2', 2),
  ('mains', null, 'gs_paper', 'GS Paper III', 'gs-paper-3', 3),
  ('mains', null, 'gs_paper', 'GS Paper IV', 'gs-paper-4', 4)
on conflict do nothing;

-- Reparent the existing mains subjects under their GS Paper, using the
-- standard UPSC syllabus grouping.
with papers as (
  select id, slug from current_affairs.category_nodes
  where content_family = 'mains' and node_type = 'gs_paper'
)
update current_affairs.category_nodes cn
set parent_id = papers.id
from papers
where cn.content_family = 'mains'
  and cn.node_type = 'subject'
  and cn.parent_id is null
  and (
    (papers.slug = 'gs-paper-1' and cn.slug in ('history', 'geography', 'society'))
    or (papers.slug = 'gs-paper-2' and cn.slug in ('governance', 'social-issues', 'international-relations'))
    or (papers.slug = 'gs-paper-3' and cn.slug in ('indian-economy', 'environment', 'internal-security', 'disaster-management', 'science-and-tech'))
    or (papers.slug = 'gs-paper-4' and cn.slug in ('ethics-integrity-aptitude'))
  );
