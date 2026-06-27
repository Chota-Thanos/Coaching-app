import { one } from "../../db.js";
import type { UserRole } from "../auth/schemas.js";

export async function getResultDetail(
  resultId: number,
  user: { id: number; role: UserRole }
): Promise<unknown | null> {
  const userFilter = ["admin", "moderator"].includes(user.role) ? "" : "and ta.user_id = $2";
  const params: unknown[] = userFilter ? [resultId, user.id] : [resultId];

  return one(
    `
      select
        tr.*,
        row_to_json(ta.*) as attempt,
        row_to_json(tt.*) as test_template,
        coalesce(
          jsonb_agg(
            distinct jsonb_build_object(
              'id', rtb.id,
              'taxonomy_node_id', rtb.taxonomy_node_id,
              'taxonomy_name', atn.name,
              'question_nature_id', rtb.question_nature_id,
              'question_nature_name', qn.name,
              'total_questions', rtb.total_questions,
              'correct_count', rtb.correct_count,
              'incorrect_count', rtb.incorrect_count,
              'unattempted_count', rtb.unattempted_count,
              'score', rtb.score,
              'accuracy', rtb.accuracy,
              'avg_time_seconds', rtb.avg_time_seconds
            )
          ) filter (where rtb.id is not null),
          '[]'::jsonb
        ) as topic_breakdowns
      from assessment.test_results tr
      join assessment.test_attempts ta on ta.id = tr.attempt_id
      join assessment.test_templates tt on tt.id = ta.test_template_id
      left join assessment.result_topic_breakdowns rtb on rtb.result_id = tr.id
      left join assessment.assessment_taxonomy_nodes atn on atn.id = rtb.taxonomy_node_id
      left join assessment.question_natures qn on qn.id = rtb.question_nature_id
      where tr.id = $1
        ${userFilter}
      group by tr.id, ta.id, tt.id
    `,
    params
  );
}

