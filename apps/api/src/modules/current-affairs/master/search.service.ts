import { addCondition } from "../../../common/sql.js";
import { query } from "../../../db.js";
import type { SearchCurrentAffairsQuery } from "../schemas.js";

export async function searchCurrentAffairs(options: SearchCurrentAffairsQuery): Promise<unknown> {
  const params: unknown[] = [options.q];
  const articleConditions = ["ma.status = 'published'"];
  const sectionConditions = ["ma.status = 'published'", "sec.is_active = true"];
  let categoryCte = "";

  if (options.content_family) {
    addCondition(articleConditions, params, "ma.content_family = ?", options.content_family);
    sectionConditions.push(`ma.content_family = $${params.length}`);
  }
  if (options.content_kind) {
    addCondition(articleConditions, params, "ma.content_kind = ?", options.content_kind);
    sectionConditions.push(`ma.content_kind = $${params.length}`);
  }
  if (options.category_node_id) {
    params.push(options.category_node_id);
    const categoryParam = params.length;
    if (options.include_descendants) {
      categoryCte = `
        with recursive category_tree as (
          select id
          from current_affairs.category_nodes
          where id = $${categoryParam}
          union all
          select child.id
          from current_affairs.category_nodes child
          join category_tree parent on parent.id = child.parent_id
        )
      `;
      articleConditions.push("ma.category_node_id in (select id from category_tree)");
      sectionConditions.push("ma.category_node_id in (select id from category_tree)");
    } else {
      articleConditions.push(`ma.category_node_id = $${categoryParam}`);
      sectionConditions.push(`ma.category_node_id = $${categoryParam}`);
    }
  }
  if (options.from_date) {
    addCondition(articleConditions, params, "ma.publication_date >= ?", options.from_date);
    sectionConditions.push(`ma.publication_date >= $${params.length}`);
  }
  if (options.to_date) {
    addCondition(articleConditions, params, "ma.publication_date <= ?", options.to_date);
    sectionConditions.push(`ma.publication_date <= $${params.length}`);
  }
  if (options.tag) {
    params.push(options.tag);
    articleConditions.push(`ma.institute_tags ? $${params.length}`);
    sectionConditions.push(`ma.institute_tags ? $${params.length}`);
  }
  if (options.source_name) {
    params.push(`%${options.source_name}%`);
    articleConditions.push(`ma.source_name ilike $${params.length}`);
    sectionConditions.push(`ma.source_name ilike $${params.length}`);
  }

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  const articles = await query(
    `
      ${categoryCte}
      select
        'article' as result_type,
        ma.id,
        ma.title,
        ma.slug,
        ma.content_family,
        ma.content_kind,
        ma.publication_date,
        ts_rank(
          to_tsvector('english', coalesce(ma.title, '') || ' ' || coalesce(ma.body, '') || ' ' || coalesce(ma.source_name, '')),
          plainto_tsquery('english', $1)
        ) as rank
      from current_affairs.master_articles ma
      where ${articleConditions.join(" and ")}
        and to_tsvector('english', coalesce(ma.title, '') || ' ' || coalesce(ma.body, '') || ' ' || coalesce(ma.source_name, ''))
            @@ plainto_tsquery('english', $1)
      order by rank desc, ma.publication_date desc nulls last
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );

  const sections = options.include_sections
    ? await query(
      `
        ${categoryCte}
        select
          'section' as result_type,
          sec.id,
          sec.heading as title,
          sec.slug,
          ma.content_family,
          ma.content_kind,
          ma.publication_date,
          ma.id as article_id,
          ma.title as article_title,
          ma.slug as article_slug,
          ts_rank(
            to_tsvector('english', coalesce(sec.heading, '') || ' ' || coalesce(sec.body, '') || ' ' || coalesce(sec.seo_title, '') || ' ' || coalesce(sec.seo_description, '')),
            plainto_tsquery('english', $1)
          ) as rank
        from current_affairs.master_article_sections sec
        join current_affairs.master_articles ma on ma.id = sec.article_id
        where ${sectionConditions.join(" and ")}
          and to_tsvector('english', coalesce(sec.heading, '') || ' ' || coalesce(sec.body, '') || ' ' || coalesce(sec.seo_title, '') || ' ' || coalesce(sec.seo_description, ''))
              @@ plainto_tsquery('english', $1)
        order by rank desc, ma.publication_date desc nulls last
        limit $${limitPosition} offset $${offsetPosition}
      `,
      params
    )
    : [];

  return { articles, sections };
}
