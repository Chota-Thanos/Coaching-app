import { addCondition, addUpdate, requireUpdates } from "../../common/sql.js";
import { one, query, transaction } from "../../db.js";
import type { PoolClient } from "pg";
import { generateText, parseJsonRobust } from "../current-affairs/master/ai.service.js";
import { calculateObjectiveScore } from "./score-calculator.js";
import type { ScoreItem } from "./scoring.types.js";
import type {
  AddMainsQuestionVersionInput,
  CreateMainsQuestionInput,
  CreateMainsTaxonomyNodeInput,
  EvaluateMainsAnswerInput,
  ListMainsEvaluationQueueQuery,
  ListMainsQuestionsQuery,
  ListMainsTaxonomyQuery,
  SubmitMainsAnswerInput,
  UpdateMainsQuestionInput,
  UpdateMainsTaxonomyNodeInput
} from "./mains.schemas.js";

type MainsTaxonomySubtreeRow = {
  id: string;
  depth: number;
};

async function getMainsTaxonomySubtree(client: PoolClient, id: number): Promise<MainsTaxonomySubtreeRow[]> {
  const result = await client.query<MainsTaxonomySubtreeRow>(
    `
      with recursive subtree(id, depth, path) as (
        select id, 0, array[id]
        from assessment.mains_taxonomy_nodes
        where id = $1

        union all

        select child.id, subtree.depth + 1, subtree.path || child.id
        from assessment.mains_taxonomy_nodes child
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

async function detachMainsTaxonomyLinks(client: PoolClient, nodeIds: number[]): Promise<void> {
  if (nodeIds.length === 0) return;

  await client.query(
    `
      update assessment.mains_question_taxonomy_links
      set
        paper_node_id = case when paper_node_id = any($1::bigint[]) then null else paper_node_id end,
        subject_area_node_id = case when subject_area_node_id = any($1::bigint[]) then null else subject_area_node_id end,
        theme_node_id = case when theme_node_id = any($1::bigint[]) then null else theme_node_id end,
        topic_node_id = case when topic_node_id = any($1::bigint[]) then null else topic_node_id end,
        subtopic_node_id = case when subtopic_node_id = any($1::bigint[]) then null else subtopic_node_id end
      where
        paper_node_id = any($1::bigint[])
        or subject_area_node_id = any($1::bigint[])
        or theme_node_id = any($1::bigint[])
        or topic_node_id = any($1::bigint[])
        or subtopic_node_id = any($1::bigint[])
    `,
    [nodeIds]
  );
}

export async function listMainsTaxonomyNodes(options: ListMainsTaxonomyQuery): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.exam_id) addCondition(conditions, params, "exam_id = ?", options.exam_id);
  if (options.parent_id) addCondition(conditions, params, "parent_id = ?", options.parent_id);
  if (options.root_only) conditions.push("parent_id is null");
  if (options.node_type) addCondition(conditions, params, "node_type = ?", options.node_type);
  if (options.search) addCondition(conditions, params, "name ilike ?", `%${options.search}%`);

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select *
      from assessment.mains_taxonomy_nodes
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      order by display_order asc, name asc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function createMainsTaxonomyNode(input: CreateMainsTaxonomyNodeInput): Promise<unknown> {
  return one(
    `
      insert into assessment.mains_taxonomy_nodes
        (exam_id, parent_id, node_type, name, slug, description, image_url, display_order, is_active)
      values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 0), coalesce($9, true))
      returning *
    `,
    [
      input.exam_id,
      input.parent_id ?? null,
      input.node_type,
      input.name,
      input.slug,
      input.description ?? null,
      input.image_url ?? null,
      input.display_order ?? null,
      input.is_active ?? null
    ]
  );
}

export async function updateMainsTaxonomyNode(
  id: number,
  input: UpdateMainsTaxonomyNodeInput
): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "parent_id", input.parent_id);
  addUpdate(updates, params, "node_type", input.node_type);
  addUpdate(updates, params, "name", input.name);
  addUpdate(updates, params, "slug", input.slug);
  addUpdate(updates, params, "description", input.description);
  addUpdate(updates, params, "image_url", input.image_url);
  addUpdate(updates, params, "display_order", input.display_order);
  addUpdate(updates, params, "is_active", input.is_active);
  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update assessment.mains_taxonomy_nodes
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function createMainsQuestion(input: CreateMainsQuestionInput, userId: number): Promise<unknown | null> {
  const questionId = await transaction(async (client) => {
    const question = await client.query<{ id: number }>(
      `
        insert into assessment.questions
          (question_family, question_format_id, status, created_by_user_id, is_ai_generated)
        values ('mains_subjective', $1, coalesce($2, 'draft'), $3, coalesce($4, false))
        returning id
      `,
      [input.question_format_id, input.status ?? null, userId, input.is_ai_generated ?? null]
    );

    const newQuestionId = question.rows[0]?.id;
    if (!newQuestionId) throw new Error("Mains question insert failed.");

    await client.query(
      `
        insert into assessment.question_versions
          (
            question_id,
            version_no,
            question_statement,
            supplementary_statement,
            statements_facts,
            question_prompt,
            options,
            correct_answer,
            explanation,
            content_json,
            is_current,
            created_by_user_id
          )
        values ($1, 1, $2, $3, $4, $5, '[]'::jsonb, null, $6, $7, true, $8)
      `,
      [
        newQuestionId,
        input.version.question_statement,
        input.version.supplementary_statement ?? null,
        JSON.stringify(input.version.statements_facts ?? []),
        input.version.question_prompt ?? null,
        input.version.explanation ?? null,
        JSON.stringify(input.version.content_json ?? {}),
        userId
      ]
    );

    await client.query(
      `
        insert into assessment.mains_question_details
          (question_id, word_limit, marks, directive, model_answer, answer_framework, key_points, evaluation_rubric)
        values ($1, $2, coalesce($3, 0), $4, $5, $6, $7, $8)
      `,
      [
        newQuestionId,
        input.details.word_limit ?? null,
        input.details.marks ?? null,
        input.details.directive ?? null,
        input.details.model_answer ?? null,
        JSON.stringify(input.details.answer_framework ?? {}),
        JSON.stringify(input.details.key_points ?? []),
        JSON.stringify(input.details.evaluation_rubric ?? {})
      ]
    );

    if (input.taxonomy) {
      await client.query(
        `
          insert into assessment.mains_question_taxonomy_links
            (
              question_id,
              exam_id,
              exam_level_id,
              paper_node_id,
              subject_area_node_id,
              theme_node_id,
              topic_node_id,
              subtopic_node_id,
              question_nature_id
            )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          newQuestionId,
          input.taxonomy.exam_id,
          input.taxonomy.exam_level_id,
          input.taxonomy.paper_node_id ?? null,
          input.taxonomy.subject_area_node_id ?? null,
          input.taxonomy.theme_node_id ?? null,
          input.taxonomy.topic_node_id ?? null,
          input.taxonomy.subtopic_node_id ?? null,
          input.taxonomy.question_nature_id ?? null
        ]
      );
    }

    return newQuestionId;
  });

  return getMainsQuestion(questionId);
}

export async function getMainsQuestion(questionId: number): Promise<unknown | null> {
  return one(
    `
      select
        q.*,
        row_to_json(qv.*) as current_version,
        row_to_json(mqd.*) as mains_details,
        coalesce(jsonb_agg(distinct to_jsonb(mqtl.*)) filter (where mqtl.id is not null), '[]'::jsonb) as taxonomy_links
      from assessment.questions q
      join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
      join assessment.mains_question_details mqd on mqd.question_id = q.id
      left join assessment.mains_question_taxonomy_links mqtl on mqtl.question_id = q.id
      where q.id = $1
        and q.question_family = 'mains_subjective'
      group by q.id, qv.id, mqd.id
    `,
    [questionId]
  );
}

export async function updateMainsQuestion(
  questionId: number,
  input: UpdateMainsQuestionInput,
  userId: number
): Promise<unknown | null> {
  let changed = false;

  await transaction(async (client) => {
    const question = await client.query<{ id: string }>(
      `
        select id
        from assessment.questions
        where id = $1
          and question_family = 'mains_subjective'
        for update
      `,
      [questionId]
    );
    if (!question.rows[0]) {
      const error = new Error("Mains question not found.") as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const questionParams: unknown[] = [];
    const questionUpdates: string[] = [];
    addUpdate(questionUpdates, questionParams, "question_format_id", input.question_format_id);
    addUpdate(questionUpdates, questionParams, "status", input.status);
    addUpdate(questionUpdates, questionParams, "is_ai_generated", input.is_ai_generated);
    if (input.status === "approved" || input.status === "published") {
      addUpdate(questionUpdates, questionParams, "approved_by_user_id", userId);
      addUpdate(questionUpdates, questionParams, "approved_at", new Date());
    }
    if (questionUpdates.length > 0) {
      questionParams.push(questionId);
      await client.query(
        `
          update assessment.questions
          set ${questionUpdates.join(", ")}, updated_at = now()
          where id = $${questionParams.length}
        `,
        questionParams
      );
      changed = true;
    }

    if (input.details) {
      const detailParams: unknown[] = [];
      const detailUpdates: string[] = [];
      addUpdate(detailUpdates, detailParams, "word_limit", input.details.word_limit);
      addUpdate(detailUpdates, detailParams, "marks", input.details.marks);
      addUpdate(detailUpdates, detailParams, "directive", input.details.directive);
      addUpdate(detailUpdates, detailParams, "model_answer", input.details.model_answer);
      addUpdate(detailUpdates, detailParams, "answer_framework", input.details.answer_framework === undefined ? undefined : JSON.stringify(input.details.answer_framework));
      addUpdate(detailUpdates, detailParams, "key_points", input.details.key_points === undefined ? undefined : JSON.stringify(input.details.key_points));
      addUpdate(detailUpdates, detailParams, "evaluation_rubric", input.details.evaluation_rubric === undefined ? undefined : JSON.stringify(input.details.evaluation_rubric));

      if (detailUpdates.length > 0) {
        detailParams.push(questionId);
        await client.query(
          `
            update assessment.mains_question_details
            set ${detailUpdates.join(", ")}, updated_at = now()
            where question_id = $${detailParams.length}
          `,
          detailParams
        );
        changed = true;
      }
    }

    if (input.taxonomy) {
      await client.query("delete from assessment.mains_question_taxonomy_links where question_id = $1", [questionId]);
      await client.query(
        `
          insert into assessment.mains_question_taxonomy_links
            (
              question_id,
              exam_id,
              exam_level_id,
              paper_node_id,
              subject_area_node_id,
              theme_node_id,
              topic_node_id,
              subtopic_node_id,
              question_nature_id
            )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          questionId,
          input.taxonomy.exam_id,
          input.taxonomy.exam_level_id,
          input.taxonomy.paper_node_id ?? null,
          input.taxonomy.subject_area_node_id ?? null,
          input.taxonomy.theme_node_id ?? null,
          input.taxonomy.topic_node_id ?? null,
          input.taxonomy.subtopic_node_id ?? null,
          input.taxonomy.question_nature_id ?? null
        ]
      );
      changed = true;
    }

    if (!changed) {
      const error = new Error("At least one field is required.") as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }
  });

  return getMainsQuestion(questionId);
}

export async function addMainsQuestionVersion(
  questionId: number,
  input: AddMainsQuestionVersionInput,
  userId: number
): Promise<unknown | null> {
  await transaction(async (client) => {
    const question = await client.query<{ id: string }>(
      `
        select id
        from assessment.questions
        where id = $1
          and question_family = 'mains_subjective'
        for update
      `,
      [questionId]
    );
    if (!question.rows[0]) {
      const error = new Error("Mains question not found.") as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const version = await client.query<{ next_version: number }>(
      `
        select coalesce(max(version_no), 0) + 1 as next_version
        from assessment.question_versions
        where question_id = $1
      `,
      [questionId]
    );

    await client.query("update assessment.question_versions set is_current = false where question_id = $1", [questionId]);
    await client.query(
      `
        insert into assessment.question_versions
          (
            question_id,
            version_no,
            question_statement,
            supplementary_statement,
            statements_facts,
            question_prompt,
            options,
            correct_answer,
            explanation,
            content_json,
            is_current,
            created_by_user_id
          )
        values ($1, $2, $3, $4, $5, $6, '[]'::jsonb, null, $7, $8, true, $9)
      `,
      [
        questionId,
        version.rows[0]?.next_version ?? 1,
        input.question_statement,
        input.supplementary_statement ?? null,
        JSON.stringify(input.statements_facts ?? []),
        input.question_prompt ?? null,
        input.explanation ?? null,
        JSON.stringify(input.content_json ?? {}),
        userId
      ]
    );
    await client.query("update assessment.questions set updated_at = now() where id = $1", [questionId]);
  });

  return getMainsQuestion(questionId);
}

export async function listMainsQuestions(options: ListMainsQuestionsQuery): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions = ["q.question_family = 'mains_subjective'"];

  if (options.status) addCondition(conditions, params, "q.status = ?", options.status);
  if (options.exam_id) addCondition(conditions, params, "mqtl.exam_id = ?", options.exam_id);
  if (options.exam_level_id) addCondition(conditions, params, "mqtl.exam_level_id = ?", options.exam_level_id);
  if (options.topic_node_id) addCondition(conditions, params, "mqtl.topic_node_id = ?", options.topic_node_id);
  if (options.subtopic_node_id) addCondition(conditions, params, "mqtl.subtopic_node_id = ?", options.subtopic_node_id);

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select
        q.*,
        row_to_json(qv.*) as current_version,
        row_to_json(mqd.*) as mains_details
      from assessment.questions q
      join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
      join assessment.mains_question_details mqd on mqd.question_id = q.id
      left join assessment.mains_question_taxonomy_links mqtl on mqtl.question_id = q.id
      where ${conditions.join(" and ")}
      group by q.id, qv.id, mqd.id
      order by q.created_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function submitMainsAnswer(input: SubmitMainsAnswerInput, userId: number): Promise<unknown> {
  return one(
    `
      insert into assessment.mains_answer_attempts
        (attempt_id, user_id, question_version_id, student_answer_text, answer_file_url)
      values ($1, $2, $3, $4, $5)
      returning *
    `,
    [
      input.attempt_id ?? null,
      userId,
      input.question_version_id,
      input.student_answer_text ?? null,
      input.answer_file_url ?? null
    ]
  );
}

// A mains answer's score lives on assessment.mains_answer_attempts, but the
// results page reads its stats off assessment.test_results, which is only
// ever populated once at submission time (when every mains question is
// necessarily unscored). Nothing previously re-synced test_results after a
// mains evaluation, so a graded subjective answer never showed up in the
// Score/Accuracy/Unattempted cards. Recomputes the row fresh each time
// (rather than incrementing it) so repeated/re-evaluations never double-count.
async function recomputeTestResultForAttempt(attemptId: number): Promise<void> {
  const rows = await query<{
    question_version_id: string;
    marks: string;
    negative_marks: string;
    correct_answer: unknown;
    selected_answer: unknown;
    response_time_seconds: number | null;
    question_family: string;
  }>(
    `
      select
        tqi.question_version_id,
        tqi.marks,
        tqi.negative_marks,
        qv.correct_answer,
        ar.selected_answer,
        ar.time_spent_seconds as response_time_seconds,
        q.question_family
      from assessment.test_attempts ta
      join assessment.test_question_items tqi on tqi.test_template_id = ta.test_template_id
      join assessment.question_versions qv on qv.id = tqi.question_version_id
      join assessment.questions q on q.id = qv.question_id
      left join assessment.attempt_responses ar
        on ar.attempt_id = ta.id and ar.question_version_id = tqi.question_version_id
      where ta.id = $1
      order by tqi.display_order asc, tqi.id asc
    `,
    [attemptId]
  );
  if (rows.length === 0) return;

  const mainsRows = rows.filter((row) => row.question_family === "mains_subjective");
  if (mainsRows.length === 0) return;

  const objectiveItems: ScoreItem[] = rows
    .filter((row) => row.question_family !== "mains_subjective")
    .map((row) => ({
      question_version_id: row.question_version_id,
      marks: row.marks,
      negative_marks: row.negative_marks,
      correct_answer: row.correct_answer,
      selected_answer: row.selected_answer,
      response_status: null,
      response_time_seconds: row.response_time_seconds,
      subject_node_id: null,
      topic_node_id: null,
      subtopic_node_id: null,
      question_nature_id: null
    }));
  const objectiveScore = calculateObjectiveScore(objectiveItems);

  const mainsAnswers = await query<{ question_version_id: string; evaluation_status: string; score: string | null }>(
    "select question_version_id, evaluation_status, score from assessment.mains_answer_attempts where attempt_id = $1",
    [attemptId]
  );
  const mainsAnswerByQuestionVersion = new Map(mainsAnswers.map((answer) => [String(answer.question_version_id), answer]));

  let mainsScore = 0;
  let mainsMaxScore = 0;
  let mainsUnattempted = 0;
  for (const row of mainsRows) {
    mainsMaxScore += Number(row.marks);
    const answer = mainsAnswerByQuestionVersion.get(String(row.question_version_id));
    if (!answer) {
      mainsUnattempted += 1;
      continue;
    }
    if (answer.evaluation_status === "evaluated") {
      mainsScore += Number(answer.score ?? 0);
    }
  }

  const combinedScore = objectiveScore.score + mainsScore;
  const combinedMaxScore = objectiveScore.maxScore + mainsMaxScore;
  const combinedUnattempted = objectiveScore.unattemptedCount + mainsUnattempted;
  // Binary correct/incorrect has no meaning for a partially-scored subjective
  // answer, so once a test has any mains content, "accuracy" is redefined as
  // the score percentage rather than a correct-answer ratio (which would
  // otherwise stay pinned to whatever the objective-only questions contribute,
  // or 0 for a mains-only test even after full marks).
  const accuracy = combinedMaxScore > 0 ? combinedScore / combinedMaxScore : 0;

  await query(
    `
      update assessment.test_results
      set score = $2, max_score = $3, accuracy = $4, unattempted_count = $5
      where attempt_id = $1
    `,
    [attemptId, combinedScore, combinedMaxScore, accuracy, combinedUnattempted]
  );
}

export async function evaluateMainsAnswer(
  answerAttemptId: number,
  input: EvaluateMainsAnswerInput,
  evaluatorUserId: number
): Promise<unknown> {
  const record = await one<{ attempt_id: number }>(
    `
      update assessment.mains_answer_attempts
      set
        evaluation_status = 'evaluated',
        evaluated_by_user_id = $2,
        score = $3,
        max_score = $4,
        feedback = $5,
        strengths = $6,
        weaknesses = $7,
        checked_copy_url = $8,
        evaluated_at = now(),
        updated_at = now()
      where id = $1
      returning *
    `,
    [
      answerAttemptId,
      evaluatorUserId,
      input.score,
      input.max_score,
      input.feedback ?? null,
      JSON.stringify(input.strengths ?? []),
      JSON.stringify(input.weaknesses ?? []),
      input.checked_copy_url ?? null
    ]
  );
  if (record) await recomputeTestResultForAttempt(Number(record.attempt_id));
  return record;
}

export async function listMainsEvaluationQueue(options: ListMainsEvaluationQueueQuery): Promise<unknown[]> {
  const conditions = ["1 = 1"];
  const params: unknown[] = [];

  if (options.status && options.status !== "all") {
    addCondition(conditions, params, "maa.evaluation_status = ?", options.status);
  }

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select
        maa.*,
        u.email as student_email,
        u.username as student_username,
        qv.question_statement,
        qv.question_prompt,
        qv.supplementary_statement,
        mqd.word_limit,
        mqd.marks as question_marks,
        mqd.directive,
        mqd.model_answer,
        mqtl.paper_node_id,
        paper.name as paper_name,
        subject_area.name as subject_area_name,
        theme.name as theme_name,
        topic.name as topic_name,
        subtopic.name as subtopic_name
      from assessment.mains_answer_attempts maa
      join app.users u on u.id = maa.user_id
      join assessment.question_versions qv on qv.id = maa.question_version_id
      join assessment.mains_question_details mqd on mqd.question_id = qv.question_id
      left join assessment.mains_question_taxonomy_links mqtl on mqtl.question_id = qv.question_id
      left join assessment.mains_taxonomy_nodes paper on paper.id = mqtl.paper_node_id
      left join assessment.mains_taxonomy_nodes subject_area on subject_area.id = mqtl.subject_area_node_id
      left join assessment.mains_taxonomy_nodes theme on theme.id = mqtl.theme_node_id
      left join assessment.mains_taxonomy_nodes topic on topic.id = mqtl.topic_node_id
      left join assessment.mains_taxonomy_nodes subtopic on subtopic.id = mqtl.subtopic_node_id
      where ${conditions.join(" and ")}
      order by
        case maa.evaluation_status
          when 'pending' then 0
          when 'needs_manual_review' then 1
          when 'ai_evaluating' then 2
          else 3
        end,
        maa.submitted_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function deleteMainsTaxonomyNode(id: number): Promise<boolean> {
  return transaction(async (client) => {
    const subtree = await getMainsTaxonomySubtree(client, id);
    if (subtree.length === 0) return false;

    await detachMainsTaxonomyLinks(client, subtree.map((row) => Number(row.id)));

    let deletedCount = 0;
    for (const row of subtree) {
      const deleted = await client.query(
        `
          delete from assessment.mains_taxonomy_nodes
          where id = $1
        `,
        [row.id]
      );
      deletedCount += deleted.rowCount ?? 0;
    }

    return deletedCount > 0;
  });
}

export async function deleteMainsQuestion(id: number): Promise<boolean> {
  const deleted = await query(
    `
      delete from assessment.questions
      where id = $1 and question_family = 'mains_subjective'
      returning id
    `,
    [id]
  );
  return deleted.length > 0;
}

// Grading is a higher-stakes judgment task than routine content generation, so
// it gets a lower (more consistent) temperature and, where possible, a
// stronger model than the "gpt-4o-mini"/flash defaults used elsewhere for
// cheap article/quiz generation.
const MAINS_GRADING_MODEL_OPTIONS = {
  temperature: 0.25,
  openAiModel: "gpt-4o",
  modelPriority: ["gemini-3.5-pro", "gemini-3.1-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"]
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function evaluateMainsAnswerWithAI(attemptId: number, userId: number): Promise<unknown> {
  // 1. Fetch the attempt first
  const attempt = await one<{
    id: number;
    user_id: number;
    question_version_id: number;
    student_answer_text: string | null;
    answer_file_url: string | null;
    evaluation_status: string;
  }>(
    `
      select id, user_id, question_version_id, student_answer_text, answer_file_url, evaluation_status
      from assessment.mains_answer_attempts
      where id = $1
    `,
    [attemptId]
  );

  if (!attempt) {
    const error = new Error("Mains answer attempt not found.") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  // 2. Fetch the question statement and version details
  const questionVersion = await one<{
    question_statement: string;
    supplementary_statement: string | null;
    question_prompt: string | null;
    question_id: number;
  }>(
    `
      select question_statement, supplementary_statement, question_prompt, question_id
      from assessment.question_versions
      where id = $1
    `,
    [attempt.question_version_id]
  );

  if (!questionVersion) {
    const error = new Error("Question version not found.") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const questionDetails = await one<{
    word_limit: number | null;
    marks: number;
    directive: string | null;
    model_answer: string | null;
    key_points: string[];
    evaluation_rubric: any;
    answer_framework: any;
  }>(
    `
      select word_limit, marks, directive, model_answer, key_points, evaluation_rubric, answer_framework
      from assessment.mains_question_details
      where question_id = $1
    `,
    [questionVersion.question_id]
  );

  if (!questionDetails) {
    const error = new Error("Mains question details not found.") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  // Grading blind against an empty answer is worse than not grading at all —
  // it used to silently score whatever placeholder text got substituted in.
  // If the student only attached a file/photo link, they (or the OCR step)
  // need to turn that into text before AI evaluation can run against it.
  const trimmedAnswerText = (attempt.student_answer_text || "").trim();
  if (!trimmedAnswerText) {
    const error = new Error(
      attempt.answer_file_url
        ? "No extracted answer text found for this attempt. Run OCR on the uploaded answer copy (or paste the answer as text) before requesting AI evaluation."
        : "This attempt has no submitted answer text to evaluate."
    ) as Error & { statusCode?: number };
    error.statusCode = 422;
    throw error;
  }
  const wordCount = countWords(trimmedAnswerText);

  // Exam-paper context (GS1-4, Essay, Ethics case studies, optional subjects
  // etc. are graded on different conventions — a single generic prompt can't
  // tell them apart without this).
  const taxonomy = await one<{
    paper_name: string | null;
    subject_area_name: string | null;
    theme_name: string | null;
    question_nature_name: string | null;
  }>(
    `
      select
        paper.name as paper_name,
        subject_area.name as subject_area_name,
        theme.name as theme_name,
        qn.name as question_nature_name
      from assessment.mains_question_taxonomy_links mqtl
      left join assessment.mains_taxonomy_nodes paper on paper.id = mqtl.paper_node_id
      left join assessment.mains_taxonomy_nodes subject_area on subject_area.id = mqtl.subject_area_node_id
      left join assessment.mains_taxonomy_nodes theme on theme.id = mqtl.theme_node_id
      left join assessment.question_natures qn on qn.id = mqtl.question_nature_id
      where mqtl.question_id = $1
    `,
    [questionVersion.question_id]
  );
  const paperName = taxonomy?.paper_name || null;
  const paperLower = `${paperName || ""} ${taxonomy?.subject_area_name || ""} ${taxonomy?.question_nature_name || ""}`.toLowerCase();
  let paperConventions = "This is a General Studies Mains answer: expect a crisp intro, thematically organized body (use of subheadings/keywords is valued), and a solution-oriented conclusion.";
  if (paperLower.includes("ethic") || paperLower.includes("gs4") || paperLower.includes("gs-4") || paperLower.includes("case stud")) {
    paperConventions = "This is a GS4 Ethics / case-study answer: judge it on identification of stakeholders and ethical dilemmas/conflicts of interest, application of ethical theories/principles (not just naming them), and a decisive, justified course of action — not on GS1-3 style factual recall.";
  } else if (paperLower.includes("essay")) {
    paperConventions = "This is an Essay-paper answer: judge it on a clear thesis/central idea, multidimensionality (covering social, economic, political, ethical, historical angles as relevant), coherence of flow between paragraphs, and quality of introduction/conclusion — structure matters more than checklist coverage of 'key points'.";
  }

  // 3. Mark status as 'ai_evaluating'
  await query(
    `
      update assessment.mains_answer_attempts
      set evaluation_status = 'ai_evaluating', updated_at = now()
      where id = $1
    `,
    [attemptId]
  );

  // 4. Construct prompt for UPSC evaluation
  let systemPromptBase = "";
  const instructionRow = await one<{ prompt: string }>(
    `
      select prompt
      from current_affairs.ai_instructions
      where scope = 'quiz' and content_type = 'mains_evaluation' and is_active = true
      order by updated_at desc limit 1
    `
  );
  if (instructionRow?.prompt) {
    systemPromptBase = instructionRow.prompt;
  } else {
    systemPromptBase = `You are a strict, experienced UPSC Mains Examiner marking a real answer copy. Evaluate the student's answer exactly as a real UPSC examiner would — not as a generous teacher trying to encourage a student.
Analyze:
1. Intro-Body-Conclusion structure: Does it introduce the topic clearly, cover main points with arguments/subheadings in the body, and end with a balanced, solution-oriented way forward?
2. Question directive: Does it actually address the exact directive (e.g. Discuss, Analyze, Evaluate, Critically Examine) rather than just describing the topic?
3. Quality of points: Does the response capture the key evaluation points and the model-answer framework given below — and back them with specific, correct facts, examples, committees, case laws, articles, or data (not vague generalities)?
4. ${paperConventions}
5. Word Limit & Marks constraint: Judge whether the length/depth is appropriate for the word limit and marks given below.`;
  }

  // Fetch active evaluation style profiles if they exist
  const activeStyleProfile = await one<{ style_profile: any }>(
    `
      select style_profile
      from assessment.ai_style_profiles
      where content_type = 'mains_evaluation' and is_active = true
      order by updated_at desc limit 1
    `
  );
  if (activeStyleProfile && activeStyleProfile.style_profile) {
    const sp = activeStyleProfile.style_profile;
    systemPromptBase = `${systemPromptBase}\n\n[STYLE PROFILE INSTRUCTIONS]\nYou must evaluate strictly following this style profile:
- Summary of evaluation style: ${sp.summary || ""}
- Guidelines: ${sp.style_instructions || ""}
- Strictness / Depth: ${sp.difficulty || ""}
${sp.format_rules ? `- Format rules: ${Array.isArray(sp.format_rules) ? sp.format_rules.join("; ") : sp.format_rules}` : ""}
${sp.dos ? `- Dos: ${Array.isArray(sp.dos) ? sp.dos.join("; ") : sp.dos}` : ""}
${sp.donts ? `- Donts: ${Array.isArray(sp.donts) ? sp.donts.join("; ") : sp.donts}` : ""}
`;
  }

  const hasRubric = questionDetails.evaluation_rubric && Object.keys(questionDetails.evaluation_rubric).length > 0;
  const rubricInstruction = hasRubric
    ? `A MARKING RUBRIC is provided below (set by the question author). You MUST allocate marks using exactly that rubric's criteria and weights — do not invent your own criteria.`
    : `No custom marking rubric was set for this question. Use this default 3-part rubric, splitting the total marks (${questionDetails.marks || 10}) proportionally across it: (a) Structure & Presentation — ~20%, (b) Content Accuracy & Depth vs. key points/model answer — ~50%, (c) Relevance to the directive, examples/data used — ~30%.`;

  const systemPrompt = `${systemPromptBase}

CALIBRATION — this is the most important instruction. Score strictly against real UPSC Mains marking conventions, not against "did the student try hard":
- Under 30%: Off-topic, factually wrong, or far too thin for the marks allotted.
- 30-45%: Attempts the question but is generic, unstructured, or missing most key points. This is where a mediocre/rushed answer belongs.
- 45-60%: Adequate — covers the main points with reasonable structure but lacks depth, specific examples, or data. Most honest, competent student answers land here.
- 60-70%: Good to very good — well-structured, most key points covered with specific examples/data, only minor gaps.
- Above 70%: Reserve for a genuinely excellent, close-to-model answer. This should be rare, not the default outcome — real UPSC toppers rarely cross 65-70% on any individual question.
Do not inflate the score to be encouraging. Give credit for every correct point made, but do not reward length, generic filler, or restating the question as if it were analysis.

${rubricInstruction}

GROUNDING — every strength and weakness you list must reference something concrete the student actually wrote (paraphrase or quote the relevant part). Do NOT write generic feedback that could apply to any answer on this topic ("add more examples", "improve structure") without saying which part of THIS answer that applies to.

FACTUAL CHECK — separately from scoring, review the student's answer for specific factual claims (dates, numbers, names of committees/acts/articles, case law, statistics) that look incorrect or that you are not confident about. List these as factual_concerns. If you yourself are not fully certain what the correct fact is, say so explicitly in the comment rather than asserting a "correction" with false confidence. If nothing looks factually questionable, return an empty array — do not invent concerns to fill the field.

You MUST return ONLY a valid JSON object matching the following TypeScript schema:
{
  "score": number, // out of ${questionDetails.marks || 10}, must exactly equal the sum of "awarded_marks" in rubric_breakdown. Use floating point (e.g. 4.5, 7.0).
  "max_score": number, // should be ${questionDetails.marks || 10}
  "rubric_breakdown": [ // 2-4 rows covering the whole mark allocation; awarded_marks must sum to "score" and max_marks must sum to max_score
    { "criterion": "string", "max_marks": number, "awarded_marks": number, "comment": "string — 1-2 sentences, specific to this answer" }
  ],
  "feedback": "string", // comprehensive evaluation feedback formatted in HTML (using h3, p, strong, ul, li tags) containing:
    // 1. Overall Verdict (brief, honest summary of the answer quality vs. real UPSC standards)
    // 2. Structure Analysis (intro-body-conclusion assessment)
    // 3. Content Quality (key points covered vs missed, with specifics)
    // 4. Presentation Comments (language, examples, diagrams if any)
    // 5. Way Forward — specific, actionable suggestions AND an explicit comment on whether the word count (given below) was appropriate for the marks/word limit, plus one time-management tip if relevant
  "strengths": string[], // 2-4 concrete strengths, each grounded in what the student actually wrote
  "weaknesses": string[], // 2-4 specific, grounded areas of improvement with actionable suggestions
  "factual_concerns": string[] // specific factual claims that look wrong/unverifiable, each as "claim — concern (confidence: low/medium/high)". Empty array if none.
}
Do NOT return any other text, markdown wrapper, or formatting except the raw JSON.`;

  const userPrompt = `
QUESTION:
${questionVersion.question_statement}
${questionVersion.supplementary_statement || ""}
${questionVersion.question_prompt || ""}

EXAM PAPER: ${paperName || "General Studies (unspecified paper)"}${taxonomy?.subject_area_name ? ` — ${taxonomy.subject_area_name}` : ""}${taxonomy?.theme_name ? ` — ${taxonomy.theme_name}` : ""}
DIRECTIVE: ${questionDetails.directive || "Discuss"}
MAX MARKS: ${questionDetails.marks || 10}
WORD LIMIT: ${questionDetails.word_limit || 250} words

MODEL ANSWER / APPROACH:
${questionDetails.model_answer || "N/A"}

${questionDetails.answer_framework && Object.keys(questionDetails.answer_framework).length > 0 ? `SUGGESTED ANSWER FRAMEWORK / STRUCTURE:\n${JSON.stringify(questionDetails.answer_framework)}\n` : ""}
KEY EVALUATION POINTS:
${JSON.stringify(questionDetails.key_points || [])}

${hasRubric ? `MARKING RUBRIC:\n${JSON.stringify(questionDetails.evaluation_rubric)}\n` : ""}
STUDENT'S ACTUAL WORD COUNT: ${wordCount} words (limit: ${questionDetails.word_limit || 250})

STUDENT'S SUBMITTED ANSWER:
${trimmedAnswerText}
`;

  try {
    // 5. Generate draft evaluation
    const rawResult = await generateText(systemPrompt, userPrompt, true, MAINS_GRADING_MODEL_OPTIONS);
    let result = parseJsonRobust(rawResult);

    // 6. Auditor pass — a second, independent read that checks the draft
    // evaluation for arithmetic consistency, grounding, and score inflation
    // before anything is shown to the student. Mirrors the router→draft→
    // auditor pattern used for article/quiz generation elsewhere in this file.
    try {
      const auditorSystemPrompt = `You are a senior UPSC examiner auditing a junior examiner's evaluation of a Mains answer before it is released to the student. You are given the original grading context and the junior examiner's draft JSON evaluation.
Check and correct the draft:
1. Arithmetic: "score" must exactly equal the sum of "awarded_marks" in rubric_breakdown, and "max_marks" must sum to max_score. Fix silently if not.
2. Calibration: this platform's examiners must grade strictly (a generic/thin answer should score under 45%; scores above 70% should be rare and reserved for near-flawless answers). If the draft score looks inflated relative to what was actually written, lower it and adjust rubric_breakdown/comments to match. Do not raise a score just to be encouraging.
3. Grounding: every strength/weakness must reference something specific the student actually wrote. Rewrite any that are generic boilerplate so they cite the actual content, using the original student answer provided below.
4. Factual concerns: keep only genuinely questionable claims, each appropriately hedged by confidence — do not assert corrections with false certainty.
5. The feedback's "Way Forward" section must comment on the actual word count vs. the word limit.
Return ONLY the corrected JSON, in the exact same schema as the draft. Do not add commentary outside the JSON.`;
      const auditorUserPrompt = JSON.stringify({
        original_question: questionVersion.question_statement,
        directive: questionDetails.directive || "Discuss",
        max_marks: questionDetails.marks || 10,
        word_limit: questionDetails.word_limit || 250,
        student_word_count: wordCount,
        model_answer: questionDetails.model_answer || null,
        key_points: questionDetails.key_points || [],
        student_answer: trimmedAnswerText,
        draft_evaluation: result
      });
      const auditorResponse = await generateText(auditorSystemPrompt, auditorUserPrompt, true, {
        ...MAINS_GRADING_MODEL_OPTIONS,
        temperature: 0.2
      });
      result = parseJsonRobust(auditorResponse);
    } catch (auditErr) {
      console.error("[Mains AI Auditor] Audit pass failed, using unaudited draft evaluation:", auditErr);
    }

    // 7. Save results to the database
    const maxScore = result.max_score ?? questionDetails.marks ?? 10.0;
    const rawScore = result.score ?? 5.0;
    const clampedScore = Math.max(0, Math.min(Number(rawScore) || 0, Number(maxScore) || 10));

    const updated = await one<{ attempt_id: number }>(
      `
        update assessment.mains_answer_attempts
        set
          evaluation_status = 'evaluated',
          score = $2,
          max_score = $3,
          feedback = $4,
          strengths = $5,
          weaknesses = $6,
          rubric_breakdown = $7,
          factual_concerns = $8,
          word_count = $9,
          evaluated_at = now(),
          updated_at = now()
        where id = $1
        returning *
      `,
      [
        attemptId,
        clampedScore,
        maxScore,
        result.feedback ?? "<p>Evaluation complete.</p>",
        JSON.stringify(result.strengths ?? []),
        JSON.stringify(result.weaknesses ?? []),
        JSON.stringify(result.rubric_breakdown ?? []),
        JSON.stringify(result.factual_concerns ?? []),
        wordCount
      ]
    );

    if (updated) await recomputeTestResultForAttempt(Number(updated.attempt_id));
    return updated;
  } catch (err: any) {
    console.error("AI Evaluation failed, updating attempt to needs_manual_review:", err);
    // Mark as failed/needs review
    await query(
      `
        update assessment.mains_answer_attempts
        set evaluation_status = 'needs_manual_review', updated_at = now()
        where id = $1
      `,
      [attemptId]
    );
    throw err;
  }
}
