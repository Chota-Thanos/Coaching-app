import { addCondition } from "../../../common/sql.js";
import { one, query } from "../../../db.js";
import type { CategoryPageQuery } from "../schemas.js";

export async function getCategoryPage(categoryId: number, options: CategoryPageQuery): Promise<unknown | null> {
  const category = await one(
    `
      select *
      from current_affairs.category_nodes
      where id = $1
    `,
    [categoryId]
  );
  if (!category) return null;

  const params: unknown[] = [categoryId];
  const conditions = [
    "ma.status = 'published'",
    options.include_descendants
      ? "ma.category_node_id in (select id from category_tree)"
      : "ma.category_node_id = $1"
  ];

  if (options.content_kind) addCondition(conditions, params, "ma.content_kind = ?", options.content_kind);
  if (options.from_date) addCondition(conditions, params, "ma.publication_date >= ?", options.from_date);
  if (options.to_date) addCondition(conditions, params, "ma.publication_date <= ?", options.to_date);

  const countParams = [...params];

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  const cte = options.include_descendants
    ? `
      with recursive category_tree as (
        select id
        from current_affairs.category_nodes
        where id = $1
        union all
        select child.id
        from current_affairs.category_nodes child
        join category_tree parent on parent.id = child.parent_id
      )
    `
    : "";

  const articles = await query(
    `
      ${cte}
      select ma.*
      from current_affairs.master_articles ma
      where ${conditions.join(" and ")}
      order by
        case ma.content_kind
          when 'daily_current_affairs' then 1
          when 'prelims_pyq' then 2
          when 'daily_editorial_summary' then 3
          when 'mains_topic_note' then 4
          when 'mains_pyq' then 5
          else 9
        end,
        ma.publication_date desc nulls last,
        ma.created_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );

  const counts = await query(
    `
      ${cte}
      select ma.content_kind, count(*)::integer as count
      from current_affairs.master_articles ma
      where ${conditions.join(" and ")}
      group by ma.content_kind
      order by ma.content_kind
    `,
    countParams
  );

  return { category, counts, articles };
}
