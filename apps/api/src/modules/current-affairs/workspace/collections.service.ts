import { addUpdate, requireUpdates } from "../../../common/sql.js";
import { one, query } from "../../../db.js";
import type {
  AddCollectionItemInput,
  CreateCollectionInput,
  UpdateCollectionInput
} from "../schemas.js";
import { masterArticleEnrichmentJsonbPairs } from "../master/article-enrichment-sql.js";

export async function listCollections(userId: number): Promise<unknown[]> {
  return query(
    `
      select
        sc.*,
        count(sci.id)::integer as item_count
      from current_affairs.student_collections sc
      left join current_affairs.student_collection_items sci on sci.collection_id = sc.id
      where sc.user_id = $1
      group by sc.id
      order by sc.created_at desc
    `,
    [userId]
  );
}

export async function getCollection(id: number, userId: number): Promise<unknown | null> {
  return one(
    `
      select
        sc.*,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', sci.id,
              'fork_id', sci.fork_id,
              'student_article_id', sci.student_article_id,
              'display_order', sci.display_order,
              'created_at', sci.created_at,
              'fork', case when saf.id is null then null else to_jsonb(saf) end,
              'master_article', case
                when ma.id is null then null
                else to_jsonb(ma) || jsonb_build_object(
                  'category', case when cn.id is null then null else to_jsonb(cn) end,
                  ${masterArticleEnrichmentJsonbPairs}
                )
              end,
              'student_article', case when sa.id is null then null else to_jsonb(sa) end
            )
            order by sci.display_order, sci.id
          ) filter (where sci.id is not null),
          '[]'::jsonb
        ) as items
      from current_affairs.student_collections sc
      left join current_affairs.student_collection_items sci on sci.collection_id = sc.id
      left join current_affairs.student_article_forks saf on saf.id = sci.fork_id
      left join current_affairs.master_articles ma on ma.id = saf.master_article_id
      left join current_affairs.category_nodes cn on cn.id = ma.category_node_id
      left join current_affairs.student_articles sa on sa.id = sci.student_article_id
      where sc.id = $1
        and sc.user_id = $2
      group by sc.id
    `,
    [id, userId]
  );
}

export async function createCollection(input: CreateCollectionInput, userId: number): Promise<unknown> {
  return one(
    `
      insert into current_affairs.student_collections (user_id, name, slug, description, custom_tags)
      values ($1, $2, $3, $4, $5)
      returning *
    `,
    [userId, input.name, input.slug, input.description ?? null, JSON.stringify(input.custom_tags ?? [])]
  );
}

export async function updateCollection(id: number, input: UpdateCollectionInput, userId: number): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "name", input.name);
  addUpdate(updates, params, "slug", input.slug);
  addUpdate(updates, params, "description", input.description);
  addUpdate(updates, params, "custom_tags", input.custom_tags === undefined ? undefined : JSON.stringify(input.custom_tags));
  requireUpdates(updates);

  params.push(id, userId);
  return one(
    `
      update current_affairs.student_collections
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length - 1}
        and user_id = $${params.length}
      returning *
    `,
    params
  );
}

export async function deleteCollection(id: number, userId: number): Promise<unknown | null> {
  return one(
    `
      delete from current_affairs.student_collections
      where id = $1
        and user_id = $2
      returning *
    `,
    [id, userId]
  );
}

export async function addCollectionItem(
  collectionId: number,
  input: AddCollectionItemInput,
  userId: number
): Promise<unknown | null> {
  return one(
    `
      with inserted as (
        insert into current_affairs.student_collection_items
          (collection_id, fork_id, student_article_id, display_order)
        select sc.id, $3, $4, coalesce($5, 0)
        from current_affairs.student_collections sc
        where sc.id = $1
          and sc.user_id = $2
          and (
            $3::bigint is null
            or exists (
              select 1
              from current_affairs.student_article_forks saf
              where saf.id = $3
                and saf.user_id = $2
            )
          )
          and (
            $4::bigint is null
            or exists (
              select 1
              from current_affairs.student_articles sa
              where sa.id = $4
                and sa.user_id = $2
            )
          )
        on conflict do nothing
        returning *
      ),
      existing as (
        select sci.*
        from current_affairs.student_collection_items sci
        join current_affairs.student_collections sc on sc.id = sci.collection_id
        where sci.collection_id = $1
          and sc.user_id = $2
          and (
            ($3::bigint is not null and sci.fork_id = $3)
            or ($4::bigint is not null and sci.student_article_id = $4)
          )
      )
      select * from inserted
      union all
      select * from existing
      limit 1
    `,
    [collectionId, userId, input.fork_id ?? null, input.student_article_id ?? null, input.display_order ?? null]
  );
}

export async function deleteCollectionItem(id: number, userId: number): Promise<unknown | null> {
  return one(
    `
      delete from current_affairs.student_collection_items sci
      using current_affairs.student_collections sc
      where sci.id = $1
        and sci.collection_id = sc.id
        and sc.user_id = $2
      returning sci.*
    `,
    [id, userId]
  );
}
