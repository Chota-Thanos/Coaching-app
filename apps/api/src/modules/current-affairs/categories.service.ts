import { addCondition, addUpdate, requireUpdates } from "../../common/sql.js";
import { one, query, transaction } from "../../db.js";
import type { PoolClient } from "pg";
import type {
  BulkCreateCategoryInput,
  BulkReassignCategoryInput,
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput
} from "./schemas.js";

type CategorySubtreeRow = {
  id: string;
  depth: number;
};

async function getCategorySubtree(client: PoolClient, id: number): Promise<CategorySubtreeRow[]> {
  const result = await client.query<CategorySubtreeRow>(
    `
      with recursive subtree(id, depth, path) as (
        select id, 0, array[id]
        from current_affairs.category_nodes
        where id = $1

        union all

        select child.id, subtree.depth + 1, subtree.path || child.id
        from current_affairs.category_nodes child
        join subtree on child.parent_id = subtree.id
        where not child.id = any(subtree.path)
      )
      select id::text as id, depth
      from subtree
      order by depth desc, id desc
    `,
    [id]
  );
  return result.rows;
}

export async function listCategories(options: ListCategoriesQuery): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.content_family) addCondition(conditions, params, "content_family = ?", options.content_family);
  if (options.parent_id) addCondition(conditions, params, "parent_id = ?", options.parent_id);
  if (options.root_only) conditions.push("parent_id is null");
  if (options.node_type) addCondition(conditions, params, "node_type = ?", options.node_type);

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select *
      from current_affairs.category_nodes
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      order by content_family asc, display_order asc, name asc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function createCategory(input: CreateCategoryInput): Promise<unknown> {
  return one(
    `
      insert into current_affairs.category_nodes
        (content_family, parent_id, node_type, name, slug, description, display_order, is_active)
      values ($1, $2, $3, $4, $5, $6, coalesce($7, 0), coalesce($8, true))
      returning *
    `,
    [
      input.content_family,
      input.parent_id ?? null,
      input.node_type,
      input.name,
      input.slug,
      input.description ?? null,
      input.display_order ?? null,
      input.is_active ?? null
    ]
  );
}

export async function bulkCreateCategories(input: BulkCreateCategoryInput): Promise<unknown[]> {
  return transaction(async (client) => {
    const records: unknown[] = [];

    for (const category of input.categories) {
      const result = await client.query(
        `
          insert into current_affairs.category_nodes
            (content_family, parent_id, node_type, name, slug, description, display_order, is_active)
          values ($1, $2, $3, $4, $5, $6, coalesce($7, 0), coalesce($8, true))
          returning *
        `,
        [
          category.content_family,
          category.parent_id ?? null,
          category.node_type,
          category.name,
          category.slug,
          category.description ?? null,
          category.display_order ?? null,
          category.is_active ?? null
        ]
      );
      records.push(result.rows[0]);
    }

    return records;
  });
}

export async function updateCategory(id: number, input: UpdateCategoryInput): Promise<unknown | null> {
  return transaction(async (client) => {
    const existing = await client.query<{ id: string; content_family: string }>(
      `
        select id::text, content_family
        from current_affairs.category_nodes
        where id = $1
        for update
      `,
      [id]
    );
    if (!existing.rows[0]) return null;

    if (input.parent_id !== undefined && input.parent_id !== null) {
      if (input.parent_id === id) {
        throw new Error("category_parent_cannot_be_self");
      }

      const parent = await client.query<{ id: string; content_family: string }>(
        `
          select id::text, content_family
          from current_affairs.category_nodes
          where id = $1
          for update
        `,
        [input.parent_id]
      );
      if (!parent.rows[0]) throw new Error("category_parent_not_found");
      if (parent.rows[0].content_family !== existing.rows[0].content_family) {
        throw new Error("category_parent_family_mismatch");
      }

      const subtree = await getCategorySubtree(client, id);
      if (subtree.some((row) => Number(row.id) === input.parent_id)) {
        throw new Error("category_parent_cannot_be_descendant");
      }
    }

    const params: unknown[] = [];
    const updates: string[] = [];

    addUpdate(updates, params, "parent_id", input.parent_id);
    addUpdate(updates, params, "node_type", input.node_type);
    addUpdate(updates, params, "name", input.name);
    addUpdate(updates, params, "slug", input.slug);
    addUpdate(updates, params, "description", input.description);
    addUpdate(updates, params, "display_order", input.display_order);
    addUpdate(updates, params, "is_active", input.is_active);
    requireUpdates(updates);

    params.push(id);
    const result = await client.query(
      `
        update current_affairs.category_nodes
        set ${updates.join(", ")}, updated_at = now()
        where id = $${params.length}
        returning *
      `,
      params
    );

    return result.rows[0] ?? null;
  });
}

export async function bulkReassignCategories(input: BulkReassignCategoryInput): Promise<unknown[] | null> {
  return transaction(async (client) => {
    const categoryIds = Array.from(new Set(input.category_ids));
    const selected = await client.query<{ id: string; content_family: string }>(
      `
        select id::text, content_family
        from current_affairs.category_nodes
        where id = any($1::bigint[])
        for update
      `,
      [categoryIds]
    );

    if (selected.rows.length !== categoryIds.length) return null;

    const families = new Set(selected.rows.map((row) => row.content_family));
    if (families.size > 1) {
      throw new Error("bulk_reassign_same_family_required");
    }

    if (input.parent_id !== null) {
      if (categoryIds.includes(input.parent_id)) {
        throw new Error("bulk_reassign_parent_cannot_be_selected");
      }

      const parent = await client.query<{ id: string; content_family: string }>(
        `
          select id::text, content_family
          from current_affairs.category_nodes
          where id = $1
          for update
        `,
        [input.parent_id]
      );
      if (!parent.rows[0]) throw new Error("bulk_reassign_parent_not_found");
      if (parent.rows[0].content_family !== selected.rows[0]?.content_family) {
        throw new Error("bulk_reassign_parent_family_mismatch");
      }

      for (const categoryId of categoryIds) {
        const subtree = await getCategorySubtree(client, categoryId);
        if (subtree.some((row) => Number(row.id) === input.parent_id)) {
          throw new Error("bulk_reassign_parent_cannot_be_descendant");
        }
      }
    }

    const updates = ["parent_id = $2", "updated_at = now()"];
    const params: unknown[] = [categoryIds, input.parent_id];
    if (input.node_type) {
      params.push(input.node_type);
      updates.unshift(`node_type = $${params.length}`);
    }

    const result = await client.query(
      `
        update current_affairs.category_nodes
        set ${updates.join(", ")}
        where id = any($1::bigint[])
        returning *
      `,
      params
    );

    return result.rows;
  });
}

export async function deleteCategory(id: number): Promise<unknown | null> {
  return transaction(async (client) => {
    const root = await client.query(
      `
        select *
        from current_affairs.category_nodes
        where id = $1
        for update
      `,
      [id]
    );
    if (!root.rows[0]) return null;

    const subtree = await getCategorySubtree(client, id);
    const categoryIds = subtree.map((row) => Number(row.id));

    await client.query(
      `
        update current_affairs.master_articles
        set category_node_id = null, updated_at = now()
        where category_node_id = any($1::bigint[])
      `,
      [categoryIds]
    );

    await client.query(
      `
        update current_affairs.student_articles
        set category_node_id = null, updated_at = now()
        where category_node_id = any($1::bigint[])
      `,
      [categoryIds]
    );

    await client.query(
      `
        update current_affairs.ai_instructions
        set subject_node_id = null, updated_at = now()
        where subject_node_id = any($1::bigint[])
      `,
      [categoryIds]
    );

    for (const row of subtree) {
      await client.query("delete from current_affairs.category_nodes where id = $1", [row.id]);
    }

    return root.rows[0];
  });
}
