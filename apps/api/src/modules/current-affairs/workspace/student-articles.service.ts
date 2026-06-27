import { addCondition, addUpdate, requireUpdates } from "../../../common/sql.js";
import { one, query } from "../../../db.js";
import type {
  CreateStudentArticleInput,
  ListStudentArticlesQuery,
  UpdateStudentArticleInput
} from "../schemas.js";

export async function listStudentArticles(userId: number, options: ListStudentArticlesQuery): Promise<unknown[]> {
  const params: unknown[] = [userId];
  const conditions = ["user_id = $1"];

  if (options.status) addCondition(conditions, params, "status = ?", options.status);
  if (options.category_node_id) addCondition(conditions, params, "category_node_id = ?", options.category_node_id);

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select *
      from current_affairs.student_articles
      where ${conditions.join(" and ")}
      order by updated_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function createStudentArticle(input: CreateStudentArticleInput, userId: number): Promise<unknown> {
  return one(
    `
      insert into current_affairs.student_articles
        (user_id, title, slug, body, body_json, category_node_id, source_url, personal_tags, status)
      values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, 'draft'))
      returning *
    `,
    [
      userId,
      input.title,
      input.slug,
      input.body,
      JSON.stringify(input.body_json ?? {}),
      input.category_node_id ?? null,
      input.source_url ?? null,
      JSON.stringify(input.personal_tags ?? []),
      input.status ?? null
    ]
  );
}

export async function getStudentArticle(id: number, userId: number): Promise<unknown | null> {
  return one(
    `
      select *
      from current_affairs.student_articles
      where id = $1
        and user_id = $2
    `,
    [id, userId]
  );
}

export async function updateStudentArticle(
  id: number,
  input: UpdateStudentArticleInput,
  userId: number
): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "title", input.title);
  addUpdate(updates, params, "slug", input.slug);
  addUpdate(updates, params, "body", input.body);
  addUpdate(updates, params, "body_json", input.body_json === undefined ? undefined : JSON.stringify(input.body_json));
  addUpdate(updates, params, "category_node_id", input.category_node_id);
  addUpdate(updates, params, "source_url", input.source_url);
  addUpdate(updates, params, "personal_tags", input.personal_tags === undefined ? undefined : JSON.stringify(input.personal_tags));
  addUpdate(updates, params, "status", input.status);
  requireUpdates(updates);

  params.push(id, userId);
  return one(
    `
      update current_affairs.student_articles
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length - 1}
        and user_id = $${params.length}
      returning *
    `,
    params
  );
}

export async function deleteStudentArticle(id: number, userId: number): Promise<unknown | null> {
  return one(
    `
      delete from current_affairs.student_articles
      where id = $1
        and user_id = $2
      returning *
    `,
    [id, userId]
  );
}
