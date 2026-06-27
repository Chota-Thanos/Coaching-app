import { addUpdate, requireUpdates } from "../../../common/sql.js";
import { one } from "../../../db.js";
import type {
  AddArticleSectionSourceInput,
  CreateArticleSectionInput,
  UpdateArticleSectionInput
} from "../schemas.js";

export async function createArticleSection(
  articleId: number,
  input: CreateArticleSectionInput,
  userId: number
): Promise<unknown> {
  return one(
    `
      insert into current_affairs.master_article_sections
        (article_id, heading, slug, body, body_json, seo_title, seo_description, display_order, is_active, created_by_user_id)
      values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 0), coalesce($9, true), $10)
      returning *
    `,
    [
      articleId,
      input.heading,
      input.slug,
      input.body,
      JSON.stringify(input.body_json ?? {}),
      input.seo_title ?? null,
      input.seo_description ?? null,
      input.display_order ?? null,
      input.is_active ?? null,
      userId
    ]
  );
}

export async function updateArticleSection(
  id: number,
  input: UpdateArticleSectionInput
): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "heading", input.heading);
  addUpdate(updates, params, "slug", input.slug);
  addUpdate(updates, params, "body", input.body);
  addUpdate(updates, params, "body_json", input.body_json === undefined ? undefined : JSON.stringify(input.body_json));
  addUpdate(updates, params, "seo_title", input.seo_title);
  addUpdate(updates, params, "seo_description", input.seo_description);
  addUpdate(updates, params, "display_order", input.display_order);
  addUpdate(updates, params, "is_active", input.is_active);
  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update current_affairs.master_article_sections
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function deleteArticleSection(id: number): Promise<unknown | null> {
  return one(
    `
      delete from current_affairs.master_article_sections
      where id = $1
      returning *
    `,
    [id]
  );
}

export async function addArticleSectionSource(
  sectionId: number,
  input: AddArticleSectionSourceInput
): Promise<unknown> {
  return one(
    `
      insert into current_affairs.master_article_section_sources
        (section_id, source_article_id, relation_type, note, display_order)
      values ($1, $2, $3, $4, coalesce($5, 0))
      returning *
    `,
    [
      sectionId,
      input.source_article_id,
      input.relation_type,
      input.note ?? null,
      input.display_order ?? null
    ]
  );
}

export async function deleteArticleSectionSource(id: number): Promise<unknown | null> {
  return one(
    `
      delete from current_affairs.master_article_section_sources
      where id = $1
      returning *
    `,
    [id]
  );
}
