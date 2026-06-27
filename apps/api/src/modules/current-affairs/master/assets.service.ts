import { addCondition, addUpdate, requireUpdates } from "../../../common/sql.js";
import { one, query } from "../../../db.js";
import type {
  CreateArticleAssetInput,
  ListArticleAssetsQuery,
  UpdateArticleAssetInput
} from "../schemas.js";

export async function listArticleAssets(
  articleId: number,
  options: ListArticleAssetsQuery
): Promise<unknown[]> {
  const params: unknown[] = [articleId];
  const conditions = ["article_id = $1"];

  if (options.asset_type) addCondition(conditions, params, "asset_type = ?", options.asset_type);

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select *
      from current_affairs.master_article_assets
      where ${conditions.join(" and ")}
      order by asset_type, display_order, id
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function createArticleAsset(
  articleId: number,
  input: CreateArticleAssetInput,
  userId: number
): Promise<unknown> {
  return one(
    `
      insert into current_affairs.master_article_assets
        (
          article_id,
          asset_type,
          file_name,
          file_url,
          mime_type,
          size_bytes,
          alt_text,
          caption,
          metadata,
          display_order,
          uploaded_by_user_id
        )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10, 0), $11)
      returning *
    `,
    [
      articleId,
      input.asset_type,
      input.file_name,
      input.file_url,
      input.mime_type ?? null,
      input.size_bytes ?? null,
      input.alt_text ?? null,
      input.caption ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.display_order ?? null,
      userId
    ]
  );
}

export async function updateArticleAsset(
  id: number,
  input: UpdateArticleAssetInput
): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "asset_type", input.asset_type);
  addUpdate(updates, params, "file_name", input.file_name);
  addUpdate(updates, params, "file_url", input.file_url);
  addUpdate(updates, params, "mime_type", input.mime_type);
  addUpdate(updates, params, "size_bytes", input.size_bytes);
  addUpdate(updates, params, "alt_text", input.alt_text);
  addUpdate(updates, params, "caption", input.caption);
  addUpdate(updates, params, "metadata", input.metadata === undefined ? undefined : JSON.stringify(input.metadata));
  addUpdate(updates, params, "display_order", input.display_order);
  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update current_affairs.master_article_assets
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function deleteArticleAsset(id: number): Promise<unknown | null> {
  return one(
    `
      delete from current_affairs.master_article_assets
      where id = $1
      returning *
    `,
    [id]
  );
}
