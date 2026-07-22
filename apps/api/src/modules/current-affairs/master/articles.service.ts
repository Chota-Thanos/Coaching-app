import { addCondition, addUpdate, requireUpdates } from "../../../common/sql.js";
import { one, query } from "../../../db.js";
import type {
  CreateMasterArticleInput,
  ListMasterArticlesQuery,
  UpdateMasterArticleInput
} from "../schemas.js";
import { deriveContentFamily } from "./content-family.js";

/**
 * Reconciles the article_category_links join table for an article so it reflects
 * a single primary category plus any additional category trees. Full-replace:
 * existing links are removed and the desired set reinserted. Safe to call with
 * the same pooled connection used elsewhere in this module.
 */
async function syncArticleCategoryLinks(
  articleId: number,
  primaryCategoryNodeId: number | null,
  additionalNodeIds: number[] | null | undefined
): Promise<void> {
  const ordered: number[] = [];
  const seen = new Set<number>();
  if (primaryCategoryNodeId != null) {
    ordered.push(primaryCategoryNodeId);
    seen.add(primaryCategoryNodeId);
  }
  for (const id of additionalNodeIds ?? []) {
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  await query(`delete from current_affairs.article_category_links where article_id = $1`, [articleId]);
  if (ordered.length === 0) return;

  // The primary link is either the article's category_node_id or, when that is
  // absent, the first supplied id.
  const primaryId = primaryCategoryNodeId ?? ordered[0];
  for (const nodeId of ordered) {
    await query(
      `
        insert into current_affairs.article_category_links (article_id, category_node_id, is_primary)
        values ($1, $2, $3)
        on conflict (article_id, category_node_id) do update set is_primary = excluded.is_primary
      `,
      [articleId, nodeId, nodeId === primaryId]
    );
  }
}

function categoryFilterSql(alias: string, includeDescendants: boolean, paramPosition: number): string {
  if (includeDescendants) {
    return `${alias}.category_node_id in (select id from category_tree)`;
  }
  return `${alias}.category_node_id = $${paramPosition}`;
}

export async function listMasterArticles(
  options: ListMasterArticlesQuery,
  includeUnpublished: boolean
): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];
  let categoryCte = "";

  if (options.content_family) addCondition(conditions, params, "ma.content_family = ?", options.content_family);
  if (options.content_kind) addCondition(conditions, params, "ma.content_kind = ?", options.content_kind);
  if (options.article_role) addCondition(conditions, params, "ma.article_role = ?", options.article_role);
  if (options.category_node_id) {
    params.push(options.category_node_id);
    if (options.include_descendants) {
      categoryCte = `
        with recursive category_tree as (
          select id
          from current_affairs.category_nodes
          where id = $${params.length}
          union all
          select child.id
          from current_affairs.category_nodes child
          join category_tree parent on parent.id = child.parent_id
        )
      `;
    }
    conditions.push(categoryFilterSql("ma", options.include_descendants, params.length));
  }
  if (options.from_date) addCondition(conditions, params, "ma.publication_date >= ?", options.from_date);
  if (options.to_date) addCondition(conditions, params, "ma.publication_date <= ?", options.to_date);
  if (options.search) {
    params.push(`%${options.search}%`);
    conditions.push(`(ma.title ilike $${params.length} or ma.body ilike $${params.length})`);
  }
  if (options.tag) {
    params.push(options.tag);
    conditions.push(`ma.institute_tags ? $${params.length}`);
  }
  if (options.source_name) {
    params.push(`%${options.source_name}%`);
    conditions.push(`ma.source_name ilike $${params.length}`);
  }
  if (options.has_assets !== undefined) {
    conditions.push(`${options.has_assets ? "" : "not "}exists (
      select 1
      from current_affairs.master_article_assets maa
      where maa.article_id = ma.id
    )`);
  }

  if (options.status) {
    addCondition(conditions, params, "ma.status = ?", options.status);
  } else if (!includeUnpublished) {
    conditions.push("ma.status = 'published'");
  }

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      ${categoryCte}
      select ma.*, row_to_json(cn.*) as category
      from current_affairs.master_articles ma
      left join current_affairs.category_nodes cn on cn.id = ma.category_node_id
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      order by ma.publication_date desc nulls last, ma.created_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function createMasterArticle(input: CreateMasterArticleInput, userId: number): Promise<unknown> {
  const contentFamily = deriveContentFamily(input.content_kind, input.content_family);
  // Resolve the primary category: an explicit category_node_id wins, otherwise
  // fall back to the first of the multi-category list.
  const primaryCategoryNodeId = input.category_node_id ?? input.category_node_ids?.[0] ?? null;
  const record = await one<{ id: number }>(
    `
      insert into current_affairs.master_articles
        (
          content_family,
          content_kind,
          article_role,
          title,
          slug,
          body,
          body_json,
          category_node_id,
          source_name,
          source_url,
          publication_date,
          institute_tags,
          status,
          created_by_user_id,
          approved_by_user_id,
          approved_at,
          is_ai_generated,
          seo_title,
          seo_description,
          canonical_url,
          keywords
        )
      values ($1, $2, coalesce($3, 'event'), $4, $5, $6, $7, $8, $9, $10, $11, $12, coalesce($13, 'draft'), $14, $15, $16, coalesce($17, false), $18, $19, $20, coalesce($21, '[]'::jsonb))
      returning *
    `,
    [
      contentFamily,
      input.content_kind,
      input.article_role ?? null,
      input.title,
      input.slug,
      input.body,
      JSON.stringify(input.body_json ?? {}),
      primaryCategoryNodeId,
      input.source_name ?? null,
      input.source_url ?? null,
      input.publication_date ?? null,
      JSON.stringify(input.institute_tags ?? []),
      input.status ?? null,
      userId,
      input.status === "approved" || input.status === "published" ? userId : null,
      input.status === "approved" || input.status === "published" ? new Date() : null,
      input.is_ai_generated ?? null,
      input.seo_title ?? null,
      input.seo_description ?? null,
      input.canonical_url ?? null,
      input.keywords ? JSON.stringify(input.keywords) : null
    ]
  );

  if (!record) throw new Error("Failed to create current affairs article.");
  await syncArticleCategoryLinks(record.id, primaryCategoryNodeId, input.category_node_ids);
  return getMasterArticle(record.id, true);
}

export async function getMasterArticle(id: number, includeUnpublished: boolean): Promise<unknown | null> {
  return one(
    `
      select
        ma.*,
        row_to_json(cn.*) as category,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'link_id', acl.id,
              'is_primary', acl.is_primary,
              'category', to_jsonb(node.*)
            )
            order by acl.is_primary desc, node.name
          )
          from current_affairs.article_category_links acl
          join current_affairs.category_nodes node on node.id = acl.category_node_id
          where acl.article_id = ma.id
        ), '[]'::jsonb) as categories,
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
            ${includeUnpublished ? "" : "and target.status = 'published'"}
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
            ${includeUnpublished ? "" : "and source.status = 'published'"}
        ), '[]'::jsonb) as incoming_relations,
        (
          select count(*)::integer
          from current_affairs.master_article_relations rel
          where rel.target_article_id = ma.id
        ) as appearance_count,
        coalesce((
          select jsonb_agg(to_jsonb(upd.*) order by upd.created_at desc)
          from current_affairs.master_article_updates upd
          where upd.article_id = ma.id
        ), '[]'::jsonb) as updates
      from current_affairs.master_articles ma
      left join current_affairs.category_nodes cn on cn.id = ma.category_node_id
      where ma.id = $1
        ${includeUnpublished ? "" : "and ma.status = 'published'"}
    `,
    [id]
  );
}

export async function updateMasterArticle(
  id: number,
  input: UpdateMasterArticleInput,
  userId: number
): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "content_family", input.content_kind ? deriveContentFamily(input.content_kind, input.content_family) : input.content_family);
  addUpdate(updates, params, "content_kind", input.content_kind);
  addUpdate(updates, params, "article_role", input.article_role);
  addUpdate(updates, params, "title", input.title);
  addUpdate(updates, params, "slug", input.slug);
  addUpdate(updates, params, "body", input.body);
  addUpdate(updates, params, "body_json", input.body_json === undefined ? undefined : JSON.stringify(input.body_json));
  // Category handling: the join table is the source of truth for multi-category,
  // while the category_node_id column mirrors the primary link. If only the
  // multi-category list is supplied, the first entry becomes the new primary.
  const categoryTouched = input.category_node_id !== undefined || input.category_node_ids !== undefined;
  if (input.category_node_id !== undefined) {
    addUpdate(updates, params, "category_node_id", input.category_node_id);
  } else if (input.category_node_ids !== undefined) {
    addUpdate(updates, params, "category_node_id", input.category_node_ids?.[0] ?? null);
  }
  addUpdate(updates, params, "source_name", input.source_name);
  addUpdate(updates, params, "source_url", input.source_url);
  addUpdate(updates, params, "publication_date", input.publication_date);
  addUpdate(updates, params, "institute_tags", input.institute_tags === undefined ? undefined : JSON.stringify(input.institute_tags));
  addUpdate(updates, params, "status", input.status);
  addUpdate(updates, params, "is_ai_generated", input.is_ai_generated);
  addUpdate(updates, params, "seo_title", input.seo_title);
  addUpdate(updates, params, "seo_description", input.seo_description);
  addUpdate(updates, params, "canonical_url", input.canonical_url);
  addUpdate(updates, params, "keywords", input.keywords === undefined ? undefined : input.keywords === null ? null : JSON.stringify(input.keywords));

  if (input.status === "approved" || input.status === "published") {
    addUpdate(updates, params, "approved_by_user_id", userId);
    addUpdate(updates, params, "approved_at", new Date());
  }

  requireUpdates(updates);

  params.push(id);
  const updated = await one<{ id: number; category_node_id: number | null }>(
    `
      update current_affairs.master_articles
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
  if (!updated) return null;

  if (categoryTouched) {
    let extras = input.category_node_ids;
    if (extras === undefined) {
      // Only the primary changed — preserve the existing additional trees.
      const existing = await query<{ category_node_id: string }>(
        `select category_node_id from current_affairs.article_category_links where article_id = $1`,
        [id]
      );
      extras = existing.map((row) => Number(row.category_node_id));
    }
    await syncArticleCategoryLinks(updated.id, updated.category_node_id ?? null, extras);
  }

  return getMasterArticle(updated.id, true);
}

export async function archiveMasterArticle(id: number, userId: number): Promise<unknown | null> {
  return one(
    `
      update current_affairs.master_articles
      set
        status = 'archived',
        approved_by_user_id = null,
        approved_at = null,
        updated_at = now()
      where id = $1
      returning *, $2::bigint as archived_by_user_id
    `,
    [id, userId]
  );
}

export async function deleteMasterArticle(id: number): Promise<unknown | null> {
  return one(
    `
      delete from current_affairs.master_articles
      where id = $1
      returning *
    `,
    [id]
  );
}

export async function saveAIGeneratedArticle(
  generated: any,
  contentKind: string,
  categoryNodeId: number | null,
  userId: number
): Promise<any> {
  // 1. Ensure slug uniqueness
  let baseSlug = generated.slug || (generated.title || "ai-article").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (!baseSlug) baseSlug = "ai-article";
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await one("select 1 from current_affairs.master_articles where slug = $1", [slug]);
    if (!existing) break;
    slug = `${baseSlug}-${counter++}`;
  }
  
  // Compile markdown body from sections
  let bodyMarkdown = generated.excerpt || "";
  if (generated.sections && generated.sections.length > 0) {
    bodyMarkdown += "\n\n" + generated.sections.map((s: any) => `## ${s.section_title}\n\n${s.content}`).join("\n\n");
  }
  
  const resolvedCategoryNodeId = categoryNodeId ?? generated.category_node_id ?? null;

  // 2. Insert master article
  const article = await createMasterArticle({
    content_kind: contentKind as any,
    content_family: ['daily_current_affairs', 'prelims_pyq'].includes(contentKind) ? 'prelims' : 'mains',
    title: generated.title || "AI Draft Article",
    slug: slug,
    body: bodyMarkdown,
    category_node_id: resolvedCategoryNodeId ?? undefined,
    source_name: "AI Bulk Queue",
    source_url: generated.source_url || null,
    publication_date: generated.news_date || new Date().toISOString().split("T")[0],
    status: "draft",
    is_ai_generated: true,
    seo_title: generated.title || null,
    seo_description: generated.meta_description || null,
    canonical_url: generated.source_url || null,
    keywords: generated.meta_keywords ? generated.meta_keywords.split(",").map((k: string) => k.trim()) : [],
    institute_tags: ["AI-Draft"]
  }, userId);
  
  const articleId = (article as any).id;
  
  // 3. Insert sections
  if (generated.sections && generated.sections.length > 0) {
    for (const sec of generated.sections) {
      let secSlug = (sec.section_title || "section").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      if (!secSlug) secSlug = "section";
      
      let finalSecSlug = secSlug;
      let secCounter = 1;
      while (true) {
        const existingSec = await one(
          "select 1 from current_affairs.master_article_sections where article_id = $1 and slug = $2",
          [articleId, finalSecSlug]
        );
        if (!existingSec) break;
        finalSecSlug = `${secSlug}-${secCounter++}`;
      }
      
      await one(
        `
          insert into current_affairs.master_article_sections
            (article_id, heading, slug, body, display_order, is_active, created_by_user_id)
          values ($1, $2, $3, $4, $5, true, $6)
          returning *
        `,
        [articleId, sec.section_title, finalSecSlug, sec.content, sec.display_order || 0, userId]
      );
    }
  }
  
  return getMasterArticle(articleId, true);
}

