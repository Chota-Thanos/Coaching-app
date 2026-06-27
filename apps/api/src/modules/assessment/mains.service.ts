import { addCondition, addUpdate, requireUpdates } from "../../common/sql.js";
import { one, query, transaction } from "../../db.js";
import type { PoolClient } from "pg";
import { generateText, parseJsonRobust } from "../current-affairs/master/ai.service.js";
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

export async function evaluateMainsAnswer(
  answerAttemptId: number,
  input: EvaluateMainsAnswerInput,
  evaluatorUserId: number
): Promise<unknown> {
  return one(
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
  }>(
    `
      select word_limit, marks, directive, model_answer, key_points, evaluation_rubric
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
    systemPromptBase = `You are an expert UPSC Mains Examiner. Evaluate the student's answer response based on standard UPSC evaluation guidelines.
Analyze:
1. Intro-Body-Conclusion structure: Introduce the topic clearly, cover main points with arguments/subheadings in body, and end with a balanced way forward.
2. Question directive: Address the exact directive (e.g. Discuss, Analyze, Evaluate, Critically Examine).
3. Quality of points: Check if the response matches or captures key points and the model answer framework.
4. Word Limit & Marks constraint: Evaluate if the length is appropriate for the word limit (${questionDetails.word_limit || 250} words) and score it out of ${questionDetails.marks || 10} marks.`;
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

  const systemPrompt = `${systemPromptBase}

You MUST return ONLY a valid JSON object matching the following TypeScript schema:
{
  "score": number, // out of ${questionDetails.marks || 10}. Assign marks based strictly on the quality of the answer using these criteria:
    // 80-100% → Outstanding: Covers all key points, excellent structure, relevant examples, precise language
    // 60-79%  → Good: Covers most key points, good structure, some examples, minor gaps
    // 40-59%  → Average: Covers key points partially, adequate structure, lacks depth or examples
    // Below 40% → Needs Work: Misses key points, poor structure, very brief or off-topic
    // Give credit for every correct point made. Do NOT penalize for brevity if key points are covered. Use floating point (e.g. 4.5, 7.0).
  "max_score": number, // should be ${questionDetails.marks || 10}
  "feedback": "string", // comprehensive evaluation feedback formatted in HTML (using h3, p, strong, ul, li tags) containing:
    // 1. Overall Verdict (brief summary of the answer quality)
    // 2. Structure Analysis (intro-body-conclusion assessment)
    // 3. Content Quality (key points covered vs missed)
    // 4. Presentation Comments (language, examples, diagrams if any)
    // 5. Way Forward (specific suggestions to improve the answer)
  "strengths": string[], // list of 2-4 concrete strengths found in the answer
  "weaknesses": string[] // list of 2-4 specific areas of improvement with actionable suggestions
}
Do NOT return any other text, markdown wrapper, or formatting except the raw JSON.`;


  const userPrompt = `
QUESTION:
${questionVersion.question_statement}
${questionVersion.supplementary_statement || ""}
${questionVersion.question_prompt || ""}

DIRECTIVE: ${questionDetails.directive || "Discuss"}
MAX MARKS: ${questionDetails.marks || 10}
WORD LIMIT: ${questionDetails.word_limit || 250} words

MODEL ANSWER / APPROACH:
${questionDetails.model_answer || "N/A"}

KEY EVALUATION POINTS:
${JSON.stringify(questionDetails.key_points || [])}

STUDENT'S SUBMITTED ANSWER:
${attempt.student_answer_text || "N/A (check attachments)"}
`;

  try {
    // 5. Generate evaluation response
    const rawResult = await generateText(systemPrompt, userPrompt);
    const result = parseJsonRobust(rawResult);

    // 6. Save results to the database
    const updated = await one(
      `
        update assessment.mains_answer_attempts
        set
          evaluation_status = 'evaluated',
          score = $2,
          max_score = $3,
          feedback = $4,
          strengths = $5,
          weaknesses = $6,
          evaluated_at = now(),
          updated_at = now()
        where id = $1
        returning *
      `,
      [
        attemptId,
        result.score ?? 5.0,
        result.max_score ?? questionDetails.marks ?? 10.0,
        result.feedback ?? "<p>Evaluation complete.</p>",
        JSON.stringify(result.strengths ?? []),
        JSON.stringify(result.weaknesses ?? [])
      ]
    );

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
