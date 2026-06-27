import { one, query, transaction } from "../../../db.js";
import type {
  ReadingDashboardQuery,
  UpdateReadingProgressInput
} from "../schemas.js";

export async function updateReadingProgress(
  forkId: number,
  input: UpdateReadingProgressInput,
  userId: number
): Promise<unknown | null> {
  const hasLastAnchor = Object.prototype.hasOwnProperty.call(input, "last_anchor_json");
  const hasLastSection = Object.prototype.hasOwnProperty.call(input, "last_section_id");
  const isComplete = input.mark_complete === true || input.progress_percent >= 100;
  const shouldUpdateSchedule = isComplete || input.scheduled_revision_at !== undefined;
  const scheduledRevisionAt =
    isComplete && input.scheduled_revision_at === undefined
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      : input.scheduled_revision_at ?? null;
  const eventType =
    isComplete ? "completed" : input.scheduled_revision_at !== undefined ? "revision_scheduled" : "progress_update";

  return transaction(async (client) => {
    const progress = await one(
      `
        insert into current_affairs.student_article_reading_progress
          (
            user_id,
            fork_id,
            progress_percent,
            furthest_progress_percent,
            last_anchor_json,
            last_section_id,
            reading_seconds,
            first_read_at,
            last_read_at,
            completed_at
          )
        select
          $2,
          saf.id,
          $3,
          $3,
          $4,
          $5,
          $6,
          now(),
          now(),
          case when $7::boolean then now() else null end
        from current_affairs.student_article_forks saf
        where saf.id = $1
          and saf.user_id = $2
        on conflict (fork_id)
        do update set
          progress_percent = excluded.progress_percent,
          furthest_progress_percent = greatest(
            current_affairs.student_article_reading_progress.furthest_progress_percent,
            excluded.progress_percent
          ),
          last_anchor_json = case
            when $8::boolean then excluded.last_anchor_json
            else current_affairs.student_article_reading_progress.last_anchor_json
          end,
          last_section_id = case
            when $9::boolean then excluded.last_section_id
            else current_affairs.student_article_reading_progress.last_section_id
          end,
          reading_seconds = current_affairs.student_article_reading_progress.reading_seconds + excluded.reading_seconds,
          first_read_at = coalesce(current_affairs.student_article_reading_progress.first_read_at, excluded.first_read_at),
          last_read_at = now(),
          completed_at = case
            when $7::boolean then coalesce(current_affairs.student_article_reading_progress.completed_at, now())
            else current_affairs.student_article_reading_progress.completed_at
          end,
          updated_at = now()
        returning *
      `,
      [
        forkId,
        userId,
        input.progress_percent,
        JSON.stringify(hasLastAnchor ? input.last_anchor_json ?? {} : {}),
        hasLastSection ? input.last_section_id ?? null : null,
        input.reading_seconds_delta,
        isComplete,
        hasLastAnchor,
        hasLastSection
      ],
      client
    );

    if (!progress) return null;

    if (shouldUpdateSchedule) {
      await query(
        `
          update current_affairs.student_article_forks
          set
            read_status = case when $3::boolean then 'read' else read_status end,
            scheduled_revision_at = case when $4::boolean then $5::timestamptz else scheduled_revision_at end,
            updated_at = now()
          where id = $1
            and user_id = $2
        `,
        [forkId, userId, isComplete, shouldUpdateSchedule, scheduledRevisionAt],
        client
      );
    }

    await query(
      `
        insert into current_affairs.student_article_reading_events
          (user_id, fork_id, event_type, progress_percent, reading_seconds_delta, anchor_json, metadata)
        values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        userId,
        forkId,
        eventType,
        input.progress_percent,
        input.reading_seconds_delta,
        JSON.stringify(hasLastAnchor ? input.last_anchor_json ?? {} : {}),
        JSON.stringify({
          scheduled_revision_at: scheduledRevisionAt instanceof Date ? scheduledRevisionAt.toISOString() : scheduledRevisionAt
        })
      ],
      client
    );

    return progress;
  });
}

export async function getReadingDashboard(
  userId: number,
  options: ReadingDashboardQuery
): Promise<unknown> {
  const stats = await one(
    `
      select
        count(distinct saf.id)::integer as saved_articles,
        (count(distinct saf.id) filter (
          where saf.read_status = 'read'
             or sarp.completed_at is not null
        ))::integer as completed_articles,
        (count(distinct saf.id) filter (
          where saf.read_status = 'needs_revision'
             or (saf.scheduled_revision_at is not null and saf.scheduled_revision_at <= now())
        ))::integer as due_revisions,
        coalesce((
          select sum(sare.reading_seconds_delta)::integer
          from current_affairs.student_article_reading_events sare
          where sare.user_id = $1
            and sare.event_at >= now() - interval '7 days'
        ), 0) as reading_seconds_7d
      from current_affairs.student_article_forks saf
      left join current_affairs.student_article_reading_progress sarp on sarp.fork_id = saf.id
      where saf.user_id = $1
    `,
    [userId]
  );

  const continueReading = await query(
    `
      select
        saf.*,
        row_to_json(ma.*) as master_article,
        row_to_json(sarp.*) as reading_progress
      from current_affairs.student_article_reading_progress sarp
      join current_affairs.student_article_forks saf on saf.id = sarp.fork_id
      join current_affairs.master_articles ma on ma.id = saf.master_article_id
      where sarp.user_id = $1
        and sarp.completed_at is null
        and sarp.progress_percent > 0
        and sarp.progress_percent < 100
      order by sarp.last_read_at desc nulls last
      limit $2
    `,
    [userId, options.limit]
  );

  const dueRevisions = await query(
    `
      select
        saf.*,
        row_to_json(ma.*) as master_article,
        case when sarp.id is null then null else row_to_json(sarp.*) end as reading_progress
      from current_affairs.student_article_forks saf
      join current_affairs.master_articles ma on ma.id = saf.master_article_id
      left join current_affairs.student_article_reading_progress sarp on sarp.fork_id = saf.id
      where saf.user_id = $1
        and (
          saf.read_status = 'needs_revision'
          or (saf.scheduled_revision_at is not null and saf.scheduled_revision_at <= now())
        )
      order by saf.scheduled_revision_at asc nulls first, saf.updated_at desc
      limit $2
    `,
    [userId, options.limit]
  );

  const latestUnread = await query(
    `
      select
        saf.*,
        row_to_json(ma.*) as master_article,
        case when sarp.id is null then null else row_to_json(sarp.*) end as reading_progress
      from current_affairs.student_article_forks saf
      join current_affairs.master_articles ma on ma.id = saf.master_article_id
      left join current_affairs.student_article_reading_progress sarp on sarp.fork_id = saf.id
      where saf.user_id = $1
        and saf.read_status = 'unread'
        and coalesce(sarp.progress_percent, 0) = 0
      order by saf.created_at desc
      limit $2
    `,
    [userId, options.limit]
  );

  const recommendedArticles = await query(
    `
      select ma.*, row_to_json(cn.*) as category
      from current_affairs.master_articles ma
      left join current_affairs.category_nodes cn on cn.id = ma.category_node_id
      where ma.status = 'published'
        and not exists (
          select 1
          from current_affairs.student_article_forks saf
          where saf.master_article_id = ma.id
            and saf.user_id = $1
        )
      order by ma.publication_date desc nulls last, ma.created_at desc
      limit $2
    `,
    [userId, options.limit]
  );

  return {
    stats,
    continue_reading: continueReading,
    due_revisions: dueRevisions,
    latest_unread: latestUnread,
    recommended_articles: recommendedArticles
  };
}
