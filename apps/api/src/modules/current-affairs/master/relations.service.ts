import { addUpdate, requireUpdates } from "../../../common/sql.js";
import { one, query } from "../../../db.js";
import type {
  CreateArticleRelationInput,
  UpdateArticleRelationInput
} from "../schemas.js";

export async function listArticleRelations(articleId: number): Promise<unknown> {
  const outgoing = await query(
    `
      select rel.*, row_to_json(target.*) as target_article
      from current_affairs.master_article_relations rel
      join current_affairs.master_articles target on target.id = rel.target_article_id
      where rel.source_article_id = $1
      order by rel.display_order, rel.id
    `,
    [articleId]
  );

  const incoming = await query(
    `
      select rel.*, row_to_json(source.*) as source_article
      from current_affairs.master_article_relations rel
      join current_affairs.master_articles source on source.id = rel.source_article_id
      where rel.target_article_id = $1
      order by rel.display_order, rel.id
    `,
    [articleId]
  );

  return { outgoing, incoming };
}

export async function createArticleRelation(
  sourceArticleId: number,
  input: CreateArticleRelationInput,
  userId: number
): Promise<unknown> {
  return one(
    `
      insert into current_affairs.master_article_relations
        (source_article_id, target_article_id, relation_type, label, note, display_order, created_by_user_id)
      values ($1, $2, $3, $4, $5, coalesce($6, 0), $7)
      returning *
    `,
    [
      sourceArticleId,
      input.target_article_id,
      input.relation_type,
      input.label ?? null,
      input.note ?? null,
      input.display_order ?? null,
      userId
    ]
  );
}

export async function updateArticleRelation(
  id: number,
  input: UpdateArticleRelationInput
): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "relation_type", input.relation_type);
  addUpdate(updates, params, "label", input.label);
  addUpdate(updates, params, "note", input.note);
  addUpdate(updates, params, "display_order", input.display_order);
  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update current_affairs.master_article_relations
      set ${updates.join(", ")}
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function deleteArticleRelation(id: number): Promise<unknown | null> {
  return one(
    `
      delete from current_affairs.master_article_relations
      where id = $1
      returning *
    `,
    [id]
  );
}
