import { one, query } from "../../../db.js";
import type {
  FrontendArticleFiltersQuery,
  FrontendArticleListQuery
} from "../schemas.js";
import { deriveContentFamily } from "./content-family.js";

function categoryPredicate(category: string, paramPosition: number): string {
  if (/^\d+$/.test(category)) {
    return `
      ma.category_node_id in (
        with recursive selected_categories(id) as (
          select id
          from current_affairs.category_nodes
          where id = $${paramPosition}

          union all

          select child.id
          from current_affairs.category_nodes child
          join selected_categories parent on parent.id = child.parent_id
        )
        select id from selected_categories
      )
    `;
  }

  return `
    ma.category_node_id in (
      with recursive selected_categories(id) as (
        select id
        from current_affairs.category_nodes
        where slug = $${paramPosition}

        union all

        select child.id
        from current_affairs.category_nodes child
        join selected_categories parent on parent.id = child.parent_id
      )
      select id from selected_categories
    )
  `;
}

export async function listFrontendArticles(options: FrontendArticleListQuery): Promise<unknown> {
  const params: unknown[] = [options.content_kind];
  const conditions = ["ma.status = 'published'", "ma.content_kind = $1"];

  if (options.article_role) {
    params.push(options.article_role);
    conditions.push(`ma.article_role = $${params.length}`);
  }

  if (options.category) {
    params.push(options.category);
    conditions.push(categoryPredicate(options.category, params.length));
  }

  if (options.month) {
    params.push(`${options.month}-01`);
    conditions.push(`ma.publication_date >= $${params.length}::date`);
    conditions.push(`ma.publication_date < ($${params.length}::date + interval '1 month')`);
  }

  if (options.year) {
    params.push(`${options.year}-01-01`);
    conditions.push(`ma.publication_date >= $${params.length}::date`);
    conditions.push(`ma.publication_date < ($${params.length}::date + interval '1 year')`);
  }

  const whereSql = conditions.join(" and ");
  const countParams = [...params];
  const page = options.page;
  const limit = options.limit;
  const offset = (page - 1) * limit;

  params.push(limit, offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  const [countRow, items] = await Promise.all([
    one<{ total: string }>(
      `
        select count(*)::text as total
        from current_affairs.master_articles ma
        left join current_affairs.category_nodes cn on cn.id = ma.category_node_id
        where ${whereSql}
      `,
      countParams
    ),
    query(
      `
        select
          ma.*,
          row_to_json(cn.*) as category,
          (
            select row_to_json(asset.*)
            from current_affairs.master_article_assets asset
            where asset.article_id = ma.id
            order by
              case asset.asset_type
                when 'thumbnail' then 1
                when 'image' then 2
                else 9
              end,
              asset.display_order,
              asset.id
            limit 1
          ) as primary_asset
        from current_affairs.master_articles ma
        left join current_affairs.category_nodes cn on cn.id = ma.category_node_id
        where ${whereSql}
        order by ma.publication_date desc nulls last, ma.created_at desc
        limit $${limitPosition} offset $${offsetPosition}
      `,
      params
    )
  ]);

  const total = Number(countRow?.total ?? 0);
  return {
    items,
    page,
    limit,
    total,
    total_pages: Math.max(1, Math.ceil(total / limit))
  };
}

export async function getPublishedArticleBySlug(slug: string): Promise<unknown | null> {
  return one(
    `
      select
        ma.*,
        row_to_json(cn.*) as category,
        coalesce((
          select jsonb_agg(to_jsonb(asset.*) order by asset.asset_type, asset.display_order, asset.id)
          from current_affairs.master_article_assets asset
          where asset.article_id = ma.id
        ), '[]'::jsonb) as assets,
        coalesce((
          select jsonb_agg(to_jsonb(sec.*) order by sec.display_order, sec.id)
          from current_affairs.master_article_sections sec
          where sec.article_id = ma.id
            and sec.is_active = true
        ), '[]'::jsonb) as sections,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', rel.id,
              'relation_type', rel.relation_type,
              'label', rel.label,
              'note', rel.note,
              'display_order', rel.display_order,
              'target_article', to_jsonb(target.*)
            )
            order by rel.display_order, rel.id
          )
          from current_affairs.master_article_relations rel
          join current_affairs.master_articles target on target.id = rel.target_article_id
          where rel.source_article_id = ma.id
            and target.status = 'published'
        ), '[]'::jsonb) as outgoing_relations,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', rel.id,
              'relation_type', rel.relation_type,
              'label', rel.label,
              'note', rel.note,
              'display_order', rel.display_order,
              'source_article', to_jsonb(source.*)
            )
            order by rel.display_order, rel.id
          )
          from current_affairs.master_article_relations rel
          join current_affairs.master_articles source on source.id = rel.source_article_id
          where rel.target_article_id = ma.id
            and source.status = 'published'
        ), '[]'::jsonb) as incoming_relations,
        (
          select count(*)::integer
          from current_affairs.master_article_relations rel
          join current_affairs.master_articles source on source.id = rel.source_article_id
          where rel.target_article_id = ma.id
            and source.status = 'published'
        ) as appearance_count,
        coalesce((
          select jsonb_agg(to_jsonb(upd.*) order by upd.created_at desc)
          from current_affairs.master_article_updates upd
          where upd.article_id = ma.id
        ), '[]'::jsonb) as updates
      from current_affairs.master_articles ma
      left join current_affairs.category_nodes cn on cn.id = ma.category_node_id
      where ma.slug = $1
        and ma.status = 'published'
    `,
    [slug]
  );
}

export async function getFrontendArticleFilters(options: FrontendArticleFiltersQuery): Promise<unknown> {
  const contentFamily = options.content_family ?? deriveContentFamily(options.content_kind);

  const [categories, months, years] = await Promise.all([
    query(
      `
        select
          cn.*,
          (
            select count(*)::integer
            from current_affairs.master_articles ma
            where ma.status = 'published'
              and ma.content_kind = $1
              and ma.category_node_id in (
                with recursive selected_categories(id) as (
                  select cn.id

                  union all

                  select child.id
                  from current_affairs.category_nodes child
                  join selected_categories parent on parent.id = child.parent_id
                )
                select id from selected_categories
              )
          ) as article_count
        from current_affairs.category_nodes cn
        where cn.content_family = $2
          and cn.is_active = true
        order by cn.display_order, cn.name
      `,
      [options.content_kind, contentFamily]
    ),
    query(
      `
        select distinct to_char(date_trunc('month', ma.publication_date), 'YYYY-MM') as month
        from current_affairs.master_articles ma
        where ma.status = 'published'
          and ma.content_kind = $1
          and ma.publication_date is not null
        order by month desc
      `,
      [options.content_kind]
    ),
    query(
      `
        select distinct to_char(ma.publication_date, 'YYYY') as year
        from current_affairs.master_articles ma
        where ma.status = 'published'
          and ma.content_kind = $1
          and ma.publication_date is not null
        order by year desc
      `,
      [options.content_kind]
    )
  ]);

  return { categories, months, years };
}
