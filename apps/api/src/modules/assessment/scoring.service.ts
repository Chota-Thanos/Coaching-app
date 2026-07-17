import type { PoolClient } from "pg";
import { one, transaction } from "../../db.js";
import type { UserRole } from "../auth/schemas.js";
import type { SubmitAttemptInput } from "./schemas.js";
import { calculateObjectiveScore } from "./score-calculator.js";
import type { ScoreItem } from "./scoring.types.js";
import type { AttemptIdentity } from "./attempts.service.js";

export async function submitAttempt(
  attemptId: number,
  input: SubmitAttemptInput,
  identity: AttemptIdentity
): Promise<unknown | null> {
  const resultId = await transaction(async (client) => {
    const attemptResult = await client.query<{
      id: string;
      test_template_id: string;
      user_id: string | null;
      guest_token: string | null;
      status: string;
      submit_idempotency_key: string | null;
      cutoff_config: Record<string, unknown>;
    }>(
      `
        select
          ta.id,
          ta.test_template_id,
          ta.user_id,
          ta.guest_token,
          ta.status,
          ta.submit_idempotency_key,
          tt.cutoff_config
        from assessment.test_attempts ta
        join assessment.test_templates tt on tt.id = ta.test_template_id
        where ta.id = $1
        for update
      `,
      [attemptId]
    );

    const attempt = attemptResult.rows[0];
    if (!attempt) {
      throw new Error("Attempt not found.");
    }

    const isPrivileged = !!identity.user && ["admin", "moderator"].includes(identity.user.role);
    if (!isPrivileged) {
      const ownedByUser = !!identity.user && Number(attempt.user_id) === identity.user.id;
      const ownedByGuest = !identity.user && !!attempt.guest_token && attempt.guest_token === identity.guestToken;
      if (!ownedByUser && !ownedByGuest) {
        const error = new Error("Attempt not found.") as Error & { statusCode?: number };
        error.statusCode = 404;
        throw error;
      }
    }

    const existing = await client.query<{ id: string }>(
      "select id from assessment.test_results where attempt_id = $1",
      [attemptId]
    );

    if (existing.rows[0]?.id) {
      return Number(existing.rows[0].id);
    }

    if (attempt.status !== "in_progress") {
      throw new Error(`Attempt cannot be submitted from status ${attempt.status}.`);
    }

    const items = await client.query<ScoreItem>(
      `
        select
          tqi.question_version_id,
          tqi.marks,
          tqi.negative_marks,
          qv.correct_answer,
          ar.selected_answer,
          ar.status as response_status,
          ar.time_spent_seconds as response_time_seconds,
          qtl.subject_node_id,
          qtl.topic_node_id,
          qtl.subtopic_node_id,
          qtl.question_nature_id
        from assessment.test_question_items tqi
        join assessment.question_versions qv on qv.id = tqi.question_version_id
        left join assessment.attempt_responses ar
          on ar.attempt_id = $1
         and ar.question_version_id = tqi.question_version_id
        left join assessment.question_taxonomy_links qtl
          on qtl.question_id = qv.question_id
        where tqi.test_template_id = $2
        order by tqi.display_order asc, tqi.id asc
      `,
      [attemptId, attempt.test_template_id]
    );

    const objectiveScore = calculateObjectiveScore(items.rows);
    const cutoffScore = Number((attempt.cutoff_config as { cutoff_score?: unknown })?.cutoff_score ?? NaN);
    const cutoffStatus = Number.isFinite(cutoffScore)
      ? (objectiveScore.score >= cutoffScore ? "cleared" : "not_cleared")
      : null;

    const insertedResult = await client.query<{ id: string }>(
      `
        insert into assessment.test_results
          (
            attempt_id,
            score,
            max_score,
            accuracy,
            total_questions,
            correct_count,
            incorrect_count,
            unattempted_count,
            negative_marks,
            cutoff_status,
            summary_json
          )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        returning id
      `,
      [
        attemptId,
        objectiveScore.score,
        objectiveScore.maxScore,
        objectiveScore.accuracy,
        objectiveScore.totalQuestions,
        objectiveScore.correctCount,
        objectiveScore.incorrectCount,
        objectiveScore.unattemptedCount,
        objectiveScore.negativeMarks,
        cutoffStatus,
        JSON.stringify({ per_question: objectiveScore.perQuestion })
      ]
    );

    const newResultId = insertedResult.rows[0]?.id;
    if (!newResultId) throw new Error("Result insert failed.");

    for (const breakdown of objectiveScore.breakdowns) {
      await client.query(
        `
          insert into assessment.result_topic_breakdowns
            (
              result_id,
              taxonomy_node_id,
              question_nature_id,
              total_questions,
              correct_count,
              incorrect_count,
              unattempted_count,
              score,
              max_score,
              accuracy,
              avg_time_seconds
            )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          newResultId,
          breakdown.taxonomyNodeId,
          breakdown.questionNatureId,
          breakdown.total,
          breakdown.correct,
          breakdown.incorrect,
          breakdown.unattempted,
          breakdown.score,
          breakdown.maxScore,
          breakdown.correct + breakdown.incorrect > 0
            ? breakdown.correct / (breakdown.correct + breakdown.incorrect)
            : 0,
          breakdown.total > 0 ? breakdown.time / breakdown.total : 0
        ]
      );

      // Guests have no user_id yet — the per-user dashboard aggregate is backfilled
      // once the attempt is claimed into a real account (see claimGuestAttempt).
      if (attempt.user_id) {
        await upsertStudentTopicMetric(client, Number(attempt.user_id), {
          taxonomyNodeId: breakdown.taxonomyNodeId,
          questionNatureId: breakdown.questionNatureId,
          total: breakdown.total,
          correct: breakdown.correct,
          incorrect: breakdown.incorrect,
          unattempted: breakdown.unattempted,
          score: breakdown.score,
          maxScore: breakdown.maxScore
        });
      }
    }

    const rankStats = await client.query<{
      total_attempts: string;
      higher_scores: string;
      same_or_lower_scores: string;
    }>(
      `
        select
          count(*)::text as total_attempts,
          count(*) filter (where tr.score > $2)::text as higher_scores,
          count(*) filter (where tr.score <= $2)::text as same_or_lower_scores
        from assessment.test_results tr
        join assessment.test_attempts ta on ta.id = tr.attempt_id
        where ta.test_template_id = $1
      `,
      [attempt.test_template_id, objectiveScore.score]
    );

    const totalAttempts = Number(rankStats.rows[0]?.total_attempts ?? 1);
    const higherScores = Number(rankStats.rows[0]?.higher_scores ?? 0);
    const sameOrLowerScores = Number(rankStats.rows[0]?.same_or_lower_scores ?? 1);
    const rank = higherScores + 1;
    const percentile = totalAttempts > 0 ? (sameOrLowerScores / totalAttempts) * 100 : null;

    await client.query(
      `
        update assessment.test_results
        set
          rank_snapshot = $2,
          percentile_snapshot = $3
        where id = $1
      `,
      [
        newResultId,
        JSON.stringify({ rank, total_attempts: totalAttempts }),
        percentile
      ]
    );

    await client.query(
      `
        update assessment.test_attempts
        set
          status = 'submitted',
          submitted_at = now(),
          time_spent_seconds = coalesce($2, time_spent_seconds),
          submit_idempotency_key = coalesce($3, submit_idempotency_key)
        where id = $1
      `,
      [
        attemptId,
        input.time_spent_seconds ?? null,
        input.submit_idempotency_key ?? null
      ]
    );

    return Number(newResultId);
  });

  return one(
    `
      select *
      from assessment.test_results
      where id = $1
    `,
    [resultId]
  );
}

export type TopicMetricInput = {
  taxonomyNodeId: string | number | null;
  questionNatureId: string | number | null;
  total: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  score: number;
  maxScore: number;
};

export async function upsertStudentTopicMetric(
  client: PoolClient,
  userId: number,
  breakdown: TopicMetricInput
): Promise<void> {
  if (!breakdown.taxonomyNodeId) return;

  await client.query(
    `
      insert into assessment.student_topic_metrics
        (
          user_id,
          taxonomy_node_id,
          question_nature_id,
          attempt_count,
          question_count,
          correct_count,
          incorrect_count,
          unattempted_count,
          avg_accuracy,
          avg_score,
          total_score,
          total_max_score,
          last_attempted_at
        )
      values ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10, $11, now())
      on conflict (user_id, taxonomy_node_id, question_nature_id)
      do update set
        attempt_count = assessment.student_topic_metrics.attempt_count + 1,
        question_count = assessment.student_topic_metrics.question_count + excluded.question_count,
        correct_count = assessment.student_topic_metrics.correct_count + excluded.correct_count,
        incorrect_count = assessment.student_topic_metrics.incorrect_count + excluded.incorrect_count,
        unattempted_count = assessment.student_topic_metrics.unattempted_count + excluded.unattempted_count,
        avg_accuracy = (
          (assessment.student_topic_metrics.correct_count + excluded.correct_count)::numeric /
          nullif(
            assessment.student_topic_metrics.correct_count + assessment.student_topic_metrics.incorrect_count +
            excluded.correct_count + excluded.incorrect_count,
            0
          )
        ),
        avg_score = (
          (assessment.student_topic_metrics.avg_score * assessment.student_topic_metrics.attempt_count + excluded.avg_score) /
          nullif(assessment.student_topic_metrics.attempt_count + 1, 0)
        ),
        total_score = assessment.student_topic_metrics.total_score + excluded.total_score,
        total_max_score = assessment.student_topic_metrics.total_max_score + excluded.total_max_score,
        last_attempted_at = now(),
        updated_at = now()
    `,
    [
      userId,
      breakdown.taxonomyNodeId,
      breakdown.questionNatureId,
      breakdown.total,
      breakdown.correct,
      breakdown.incorrect,
      breakdown.unattempted,
      breakdown.correct + breakdown.incorrect > 0 ? breakdown.correct / (breakdown.correct + breakdown.incorrect) : 0,
      breakdown.score,
      breakdown.score,
      breakdown.maxScore
    ]
  );
}

/** Replays the topic-metrics upsert for an already-scored result, once a guest attempt
 * has been claimed into a real account (the metrics couldn't be attributed at submit time
 * because there was no user_id yet). */
export async function backfillStudentTopicMetricsForResult(
  client: PoolClient,
  userId: number,
  resultId: number
): Promise<void> {
  const breakdowns = await client.query<{
    taxonomy_node_id: string | number | null;
    question_nature_id: string | number | null;
    total_questions: number;
    correct_count: number;
    incorrect_count: number;
    unattempted_count: number;
    score: string;
    max_score: string;
  }>(
    `
      select taxonomy_node_id, question_nature_id, total_questions, correct_count, incorrect_count, unattempted_count, score, max_score
      from assessment.result_topic_breakdowns
      where result_id = $1
    `,
    [resultId]
  );

  for (const row of breakdowns.rows) {
    await upsertStudentTopicMetric(client, userId, {
      taxonomyNodeId: row.taxonomy_node_id,
      questionNatureId: row.question_nature_id,
      total: row.total_questions,
      correct: row.correct_count,
      incorrect: row.incorrect_count,
      unattempted: row.unattempted_count,
      score: Number(row.score),
      maxScore: Number(row.max_score)
    });
  }
}
