import { one, query } from "../../db.js";
import type { LeaderboardQuery } from "./schemas.js";

export async function getLeaderboard(options: LeaderboardQuery): Promise<unknown> {
  const entries = await query(
    `
      select
        tr.id as result_id,
        ta.user_id,
        u.username,
        tr.score,
        tr.max_score,
        tr.accuracy,
        tr.correct_count,
        tr.incorrect_count,
        tr.unattempted_count,
        tr.created_at,
        dense_rank() over (order by tr.score desc, tr.created_at asc) as rank
      from assessment.test_results tr
      join assessment.test_attempts ta on ta.id = tr.attempt_id
      join app.users u on u.id = ta.user_id
      where ta.test_template_id = $1
      order by tr.score desc, tr.created_at asc
      limit $2 offset $3
    `,
    [options.test_template_id, options.limit, options.offset]
  );

  let referenceRank: unknown = null;
  if (options.result_id) {
    referenceRank = await one(
      `
        select ranked.*
        from (
          select
            tr.id as result_id,
            dense_rank() over (order by tr.score desc, tr.created_at asc) as rank
          from assessment.test_results tr
          join assessment.test_attempts ta on ta.id = tr.attempt_id
          where ta.test_template_id = $1
        ) ranked
        where ranked.result_id = $2
      `,
      [options.test_template_id, options.result_id]
    );
  }

  const summary = await one(
    `
      select
        count(*)::integer as total_attempts,
        max(tr.score) as highest_score,
        min(tr.score) as lowest_score,
        avg(tr.score)::numeric(10,2) as average_score
      from assessment.test_results tr
      join assessment.test_attempts ta on ta.id = tr.attempt_id
      where ta.test_template_id = $1
    `,
    [options.test_template_id]
  );

  return {
    ...summary,
    reference_rank: referenceRank,
    entries
  };
}

