import type { PoolClient } from "pg";
import { addUpdate, requireUpdates } from "../../../common/sql.js";
import { one, query, transaction } from "../../../db.js";
import type { ForkArticleInput, UpdateForkInput } from "../schemas.js";
import { masterArticleEnrichmentJsonbPairs } from "../master/article-enrichment-sql.js";

async function ensureUndefinedCollection(client: PoolClient, userId: number): Promise<number> {
  const existing = await client.query<{ id: number }>(
    `
      select id
      from current_affairs.student_collections
      where user_id = $1
        and slug = 'undefined-repo'
      limit 1
    `,
    [userId]
  );

  const existingId = existing.rows[0]?.id;
  if (existingId) return Number(existingId);

  const created = await client.query<{ id: number }>(
    `
      insert into current_affairs.student_collections
        (user_id, name, slug, description, custom_tags)
      values ($1, 'Undefined Repo', 'undefined-repo', 'Saved without choosing a repository.', '[]'::jsonb)
      on conflict (user_id, slug) do update
      set updated_at = now()
      returning id
    `,
    [userId]
  );

  const id = created.rows[0]?.id;
  if (!id) throw new Error("Could not create Undefined Repo.");
  return Number(id);
}

async function addForkToCollection(
  client: PoolClient,
  collectionId: number,
  forkId: number,
  userId: number
): Promise<void> {
  await client.query(
    `
      insert into current_affairs.student_collection_items
        (collection_id, fork_id, display_order)
      select sc.id, $2, 0
      from current_affairs.student_collections sc
      where sc.id = $1
        and sc.user_id = $3
        and exists (
          select 1
          from current_affairs.student_article_forks saf
          where saf.id = $2
            and saf.user_id = $3
        )
        and not exists (
          select 1
          from current_affairs.student_collection_items sci
          where sci.collection_id = sc.id
            and sci.fork_id = $2
        )
    `,
    [collectionId, forkId, userId]
  );
}

export async function forkArticle(
  masterArticleId: number,
  input: ForkArticleInput,
  userId: number
): Promise<unknown | null> {
  return transaction(async (client) => {
    const fork = await client.query<{ id: number }>(
      `
        insert into current_affairs.student_article_forks
          (
            user_id,
            master_article_id,
            personal_tags,
            custom_folder,
            read_status,
            scheduled_revision_at,
            forked_title,
            forked_body,
            forked_body_json
          )
        select
          $1,
          ma.id,
          coalesce($3::jsonb, '[]'::jsonb),
          $4,
          coalesce($5, 'unread'),
          $6,
          ma.title,
          ma.body,
          ma.body_json
        from current_affairs.master_articles ma
        where ma.id = $2
          and ma.status = 'published'
        on conflict (user_id, master_article_id)
        do update set
          personal_tags = case
            when $3::jsonb is null then current_affairs.student_article_forks.personal_tags
            else excluded.personal_tags
          end,
          custom_folder = coalesce(excluded.custom_folder, current_affairs.student_article_forks.custom_folder),
          read_status = case
            when $5::text is null then current_affairs.student_article_forks.read_status
            else excluded.read_status
          end,
          scheduled_revision_at = coalesce(excluded.scheduled_revision_at, current_affairs.student_article_forks.scheduled_revision_at),
          forked_title = coalesce(current_affairs.student_article_forks.forked_title, excluded.forked_title),
          forked_body = coalesce(current_affairs.student_article_forks.forked_body, excluded.forked_body),
          forked_body_json = case
            when current_affairs.student_article_forks.forked_body_json = '{}'::jsonb then excluded.forked_body_json
            else current_affairs.student_article_forks.forked_body_json
          end,
          updated_at = now()
        returning *
      `,
      [
        userId,
        masterArticleId,
        input.personal_tags === undefined ? null : JSON.stringify(input.personal_tags),
        input.custom_folder ?? null,
        input.read_status ?? null,
        input.scheduled_revision_at ?? null
      ]
    );

    const record = fork.rows[0];
    if (!record) return null;

    const collectionId = input.collection_id ?? await ensureUndefinedCollection(client, userId);
    await addForkToCollection(client, collectionId, Number(record.id), userId);
    return record;
  });
}

export async function listForks(userId: number, options: { limit: number; offset: number }): Promise<unknown[]> {
  return query(
    `
      select
        saf.*,
        coalesce(
          (
            select jsonb_agg(sci.collection_id order by sci.created_at desc)
            from current_affairs.student_collection_items sci
            where sci.fork_id = saf.id
          ),
          '[]'::jsonb
        ) as collection_ids,
        coalesce(
          (
            select jsonb_agg(sc.name order by sci.created_at desc)
            from current_affairs.student_collection_items sci
            join current_affairs.student_collections sc on sc.id = sci.collection_id
            where sci.fork_id = saf.id
          ),
          '[]'::jsonb
        ) as collection_names,
        to_jsonb(ma.*) || jsonb_build_object(${masterArticleEnrichmentJsonbPairs}) as master_article,
        case when sarp.id is null then null else row_to_json(sarp.*) end as reading_progress
      from current_affairs.student_article_forks saf
      join current_affairs.master_articles ma on ma.id = saf.master_article_id
      left join current_affairs.student_article_reading_progress sarp on sarp.fork_id = saf.id
      where saf.user_id = $1
      order by saf.updated_at desc
      limit $2 offset $3
    `,
    [userId, options.limit, options.offset]
  );
}

export async function getFork(id: number, userId: number): Promise<unknown | null> {
  return one(
    `
      select
        saf.*,
        to_jsonb(ma.*) || jsonb_build_object(${masterArticleEnrichmentJsonbPairs}) as master_article,
        case when sarp.id is null then null else row_to_json(sarp.*) end as reading_progress,
        coalesce(jsonb_agg(distinct to_jsonb(sah.*)) filter (where sah.id is not null), '[]'::jsonb) as highlights,
        coalesce(jsonb_agg(distinct to_jsonb(san.*)) filter (where san.id is not null), '[]'::jsonb) as notes
      from current_affairs.student_article_forks saf
      join current_affairs.master_articles ma on ma.id = saf.master_article_id
      left join current_affairs.student_article_reading_progress sarp on sarp.fork_id = saf.id
      left join current_affairs.student_article_highlights sah on sah.fork_id = saf.id
      left join current_affairs.student_article_notes san on san.fork_id = saf.id
      where saf.id = $1
        and saf.user_id = $2
      group by saf.id, ma.id, sarp.id
    `,
    [id, userId]
  );
}

export async function updateFork(id: number, input: UpdateForkInput, userId: number): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "personal_tags", input.personal_tags === undefined ? undefined : JSON.stringify(input.personal_tags));
  addUpdate(updates, params, "personal_summary", input.personal_summary);
  addUpdate(updates, params, "forked_title", input.forked_title);
  addUpdate(updates, params, "forked_body", input.forked_body);
  addUpdate(updates, params, "forked_body_json", input.forked_body_json === undefined ? undefined : JSON.stringify(input.forked_body_json));
  addUpdate(updates, params, "custom_folder", input.custom_folder);
  addUpdate(updates, params, "read_status", input.read_status);
  addUpdate(updates, params, "scheduled_revision_at", input.scheduled_revision_at);
  requireUpdates(updates);

  params.push(id, userId);
  return one(
    `
      update current_affairs.student_article_forks
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length - 1}
        and user_id = $${params.length}
      returning *
    `,
    params
  );
}

export async function deleteFork(id: number, userId: number): Promise<unknown | null> {
  return one(
    `
      delete from current_affairs.student_article_forks
      where id = $1
        and user_id = $2
      returning *
    `,
    [id, userId]
  );
}
