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

export async function listFrontendArticles(options: FrontendArticleListQuery & { include_concepts?: boolean }): Promise<unknown> {
  const params: unknown[] = [options.content_kind];
  const conditions = ["ma.status = 'published'", "ma.content_kind = $1"];

  if (options.article_role) {
    params.push(options.article_role);
    conditions.push(`ma.article_role = $${params.length}`);
  } else if (!options.include_concepts) {
    // By default, exclude concepts from main current events lists
    conditions.push(`ma.article_role = 'event'`);
  }

  if (options.category) {
    params.push(options.category);
    conditions.push(categoryPredicate(options.category, params.length));
  }

  // A concept's own publication_date is the day it was first written, which is
  // the wrong date to file it under once it starts accumulating developments: a
  // 2019 primer that picked up three updates last month is invisible in last
  // month's list — exactly where a student revising that month would look for
  // it. So for concepts a month matches on the concept's own date OR on any
  // linked published event falling inside it, which gives one concept legitimate
  // presence in several months. Events are unaffected: they keep the plain
  // column comparison, and concepts still never enter the daily-news list.
  const fanOutToDevelopments = options.article_role === "concept";

  /** Developments on this concept, as `exists`/`max` fragments sharing one bound date param. */
  const developmentsIn = (paramPosition: number, span: string) => `
    from current_affairs.master_article_relations rel
    join current_affairs.master_articles src on src.id = rel.source_article_id
    where rel.target_article_id = ma.id
      and src.status = 'published'
      and coalesce(src.publication_date, src.created_at::date) >= $${paramPosition}::date
      and coalesce(src.publication_date, src.created_at::date) < ($${paramPosition}::date + interval '${span}')
  `;

  /** All developments on this concept, regardless of date. */
  const allDevelopments = `
    from current_affairs.master_article_relations rel
    join current_affairs.master_articles src on src.id = rel.source_article_id
    where rel.target_article_id = ma.id
      and src.status = 'published'
  `;

  // The date the list displays and sorts by. The month filter used to compare
  // the bare column instead, which made every article with a null
  // publication_date — still shown in the list, dated by created_at —
  // unreachable from any month or year filter.
  const articleDate = `coalesce(ma.publication_date, ma.created_at::date)`;

  type DateWindow = { position: number; span: string; ownDate: string };

  /** Adds the window condition; returns it when concepts fanned out, so the sort can reuse it. */
  const applyDateWindow = (start: string, span: string): DateWindow | null => {
    params.push(start);
    const position = params.length;
    const ownDate = `(${articleDate} >= $${position}::date and ${articleDate} < ($${position}::date + interval '${span}'))`;

    if (!fanOutToDevelopments) {
      conditions.push(ownDate);
      return null;
    }

    conditions.push(`(${ownDate} or exists (select 1 ${developmentsIn(position, span)}))`);
    return { position, span, ownDate };
  };

  let activeWindow: DateWindow | null = null;
  if (options.month) activeWindow = applyDateWindow(`${options.month}-01`, "1 month");
  if (options.year) activeWindow = applyDateWindow(`${options.year}-01-01`, "1 year") ?? activeWindow;

  // The date the row is actually being listed under. Inside a month view that
  // has to be the date that put it in *this* month — a concept surfacing in
  // June because of a June development must read as June, not as the day the
  // primer was written. So candidates outside the window are dropped, and
  // `greatest` picks the latest of what remains (it ignores nulls, so a concept
  // with no developments falls back to its own date).
  const lastActivitySql = !fanOutToDevelopments
    ? articleDate
    : activeWindow
      ? `greatest(
          case when ${activeWindow.ownDate} then ${articleDate} end,
          (select max(coalesce(src.publication_date, src.created_at::date)) ${developmentsIn(
            activeWindow.position,
            activeWindow.span
          )})
        )`
      : `greatest(
          ${articleDate},
          (select max(coalesce(src.publication_date, src.created_at::date)) ${allDevelopments})
        )`;

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
          coalesce(ma.publication_date, ma.created_at::date) as publication_date,
          ${lastActivitySql} as last_activity_date,
          row_to_json(cn.*) as category,
          (
            with recursive category_tree as (
              select id, name, slug, parent_id, node_type, 1 as depth
              from current_affairs.category_nodes
              where id = ma.category_node_id

              union all

              select p.id, p.name, p.slug, p.parent_id, p.node_type, ct.depth + 1
              from current_affairs.category_nodes p
              join category_tree ct on ct.parent_id = p.id
            )
            select string_agg(name, ' > ' order by depth desc)
            from category_tree
          ) as category_path,
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
        order by ${lastActivitySql} desc nulls last, ma.created_at desc
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
    // Every other field here is snake_case, matching the rest of this API —
    // this one was camelCase (pageCount), while the frontend's
    // ArticleListResponse type and the <Pagination> component have always
    // read total_pages. Confirmed live: the hub pages' article count and
    // page-size selector both work off `total` correctly, but pagination
    // controls never rendered because total_pages never actually reached the
    // frontend under that name. Renaming it is the fix.
    total_pages: Math.ceil(total / limit)
  };
}

export async function getPublishedArticleBySlug(slug: string): Promise<unknown | null> {
  return one(
    `
      select
        ma.*,
        coalesce(ma.publication_date, ma.created_at::date) as publication_date,
        row_to_json(cn.*) as category,
        (
          with recursive category_tree as (
            select id, name, slug, parent_id, node_type, 1 as depth
            from current_affairs.category_nodes
            where id = ma.category_node_id

            union all

            select p.id, p.name, p.slug, p.parent_id, p.node_type, ct.depth + 1
            from current_affairs.category_nodes p
            join category_tree ct on ct.parent_id = p.id
          )
          select string_agg(name, ' > ' order by depth desc)
          from category_tree
        ) as category_path,
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
              'source_article', jsonb_build_object(
                'id', source.id,
                'title', source.title,
                'slug', source.slug,
                'content_kind', source.content_kind,
                'article_role', source.article_role,
                'publication_date', coalesce(source.publication_date, source.created_at::date),
                'created_at', source.created_at,
                'body', source.body,
                'category', to_jsonb(scn.*),
                'category_path', (
                  with recursive s_cat_tree as (
                    select id, name, slug, parent_id, node_type, 1 as depth
                    from current_affairs.category_nodes
                    where id = source.category_node_id

                    union all

                    select p.id, p.name, p.slug, p.parent_id, p.node_type, sct.depth + 1
                    from current_affairs.category_nodes p
                    join s_cat_tree sct on sct.parent_id = p.id
                  )
                  select string_agg(name, ' > ' order by depth desc)
                  from s_cat_tree
                )
              )
            )
            -- Newest development first: on a concept page this list *is* the
            -- news timeline, so it reads chronologically rather than in
            -- whatever order the links happened to be created.
            order by coalesce(source.publication_date, source.created_at::date) desc, rel.id desc
          )
          from current_affairs.master_article_relations rel
          join current_affairs.master_articles source on source.id = rel.source_article_id
          left join current_affairs.category_nodes scn on scn.id = source.category_node_id
          where rel.target_article_id = ma.id
            and source.status = 'published'
        ), '[]'::jsonb) as incoming_relations,
        (
          select count(*)::integer
          from current_affairs.master_article_relations rel
          join current_affairs.master_articles source on source.id = rel.source_article_id
          where rel.target_article_id = ma.id
            and source.status = 'published'
        ) as appearance_count
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
