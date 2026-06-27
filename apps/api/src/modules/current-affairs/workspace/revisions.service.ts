import { addCondition } from "../../../common/sql.js";
import { one, query } from "../../../db.js";
import type {
  GenerateRevisionNotificationsInput,
  ListRevisionNotificationsQuery,
  UpdateRevisionNotificationInput
} from "../schemas.js";

export async function generateRevisionNotifications(
  input: GenerateRevisionNotificationsInput
): Promise<unknown[]> {
  const before = input.before ?? new Date().toISOString();
  return query(
    `
      insert into current_affairs.student_revision_notifications
        (user_id, fork_id, scheduled_at, message, metadata)
      select
        saf.user_id,
        saf.id,
        saf.scheduled_revision_at,
        'Current affairs revision is due: ' || ma.title,
        jsonb_build_object(
          'master_article_id', ma.id,
          'article_title', ma.title,
          'article_slug', ma.slug
        )
      from current_affairs.student_article_forks saf
      join current_affairs.master_articles ma on ma.id = saf.master_article_id
      where saf.scheduled_revision_at is not null
        and saf.scheduled_revision_at <= $1::timestamptz
      order by saf.scheduled_revision_at asc
      limit $2
      on conflict (fork_id, notification_type, scheduled_at) do nothing
      returning *
    `,
    [before, input.limit]
  );
}

export async function listRevisionNotifications(
  userId: number,
  options: ListRevisionNotificationsQuery
): Promise<unknown[]> {
  const params: unknown[] = [userId];
  const conditions = ["srn.user_id = $1"];

  if (options.status) addCondition(conditions, params, "srn.status = ?", options.status);
  if (options.due_only) conditions.push("srn.scheduled_at <= now()");

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select
        srn.*,
        row_to_json(saf.*) as fork,
        row_to_json(ma.*) as master_article
      from current_affairs.student_revision_notifications srn
      join current_affairs.student_article_forks saf on saf.id = srn.fork_id
      join current_affairs.master_articles ma on ma.id = saf.master_article_id
      where ${conditions.join(" and ")}
      order by srn.scheduled_at asc, srn.created_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function updateRevisionNotification(
  id: number,
  input: UpdateRevisionNotificationInput,
  userId: number
): Promise<unknown | null> {
  return one(
    `
      update current_affairs.student_revision_notifications
      set
        status = $3,
        sent_at = case when $3 = 'sent' then coalesce(sent_at, now()) else sent_at end,
        read_at = case when $3 = 'read' then coalesce(read_at, now()) else read_at end,
        dismissed_at = case when $3 = 'dismissed' then coalesce(dismissed_at, now()) else dismissed_at end,
        updated_at = now()
      where id = $1
        and user_id = $2
      returning *
    `,
    [id, userId, input.status]
  );
}
