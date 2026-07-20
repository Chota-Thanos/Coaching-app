import { one, query } from "../../../db.js";
import type { CreateArticleUpdateInput } from "../schemas.js";

export async function listArticleUpdates(articleId: number): Promise<unknown> {
  return query(
    `
      select upd.*
      from current_affairs.master_article_updates upd
      where upd.article_id = $1
      order by upd.created_at desc
    `,
    [articleId]
  );
}

export async function createArticleUpdate(
  articleId: number,
  input: CreateArticleUpdateInput,
  userId: number
): Promise<unknown> {
  return one(
    `
      insert into current_affairs.master_article_updates
        (article_id, body, created_by_user_id)
      values ($1, $2, $3)
      returning *
    `,
    [articleId, input.body, userId]
  );
}

export async function deleteArticleUpdate(id: number): Promise<unknown | null> {
  return one(
    `
      delete from current_affairs.master_article_updates
      where id = $1
      returning *
    `,
    [id]
  );
}
