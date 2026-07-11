import type { PoolClient } from "pg";
import { addUpdate, requireUpdates } from "../../common/sql.js";
import { one, query, transaction } from "../../db.js";
import type {
  AddQuestionVersionInput,
  CreatePassageInput,
  CreateQuestionInput,
  ListQuestionsQuery,
  QuestionCountsQuery,
  ReplaceQuestionTaxonomyInput,
  UpdatePassageInput,
  UpdateQuestionAdminInput,
  BulkUpdateQuestionsTaxonomyInput
} from "./schemas.js";
import { addCondition } from "../../common/sql.js";

export async function createPassage(input: CreatePassageInput): Promise<unknown> {
  return one(
    `
      insert into assessment.passages
        (title, body, status, created_by_user_id, is_ai_generated)
      values ($1, $2, coalesce($3, 'draft'), $4, coalesce($5, false))
      returning *
    `,
    [
      input.title ?? null,
      input.body,
      input.status ?? null,
      input.created_by_user_id ?? null,
      input.is_ai_generated ?? null
    ]
  );
}

export async function getPassage(id: number): Promise<unknown | null> {
  return one(
    `
      select
        p.*,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'question_id', pq.question_id,
              'display_order', pq.display_order
            )
            order by pq.display_order
          ) filter (where pq.question_id is not null),
          '[]'::jsonb
        ) as questions
      from assessment.passages p
      left join assessment.passage_questions pq on pq.passage_id = p.id
      where p.id = $1
      group by p.id
    `,
    [id]
  );
}

export async function updatePassage(
  id: number,
  input: UpdatePassageInput,
  userId: number
): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "title", input.title);
  addUpdate(updates, params, "body", input.body);
  addUpdate(updates, params, "status", input.status);
  addUpdate(updates, params, "is_ai_generated", input.is_ai_generated);

  if (input.status === "approved" || input.status === "published") {
    addUpdate(updates, params, "approved_by_user_id", userId);
    addUpdate(updates, params, "approved_at", new Date());
  }

  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update assessment.passages
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

async function insertQuestionVersion(
  client: PoolClient,
  questionId: number,
  input: CreateQuestionInput["version"]
): Promise<void> {
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
      values ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
    `,
    [
      questionId,
      input.question_statement,
      input.supplementary_statement ?? null,
      JSON.stringify(input.statements_facts ?? []),
      input.question_prompt ?? null,
      JSON.stringify(input.options ?? []),
      input.correct_answer === undefined ? null : JSON.stringify(input.correct_answer),
      input.explanation ?? null,
      JSON.stringify(input.content_json ?? {}),
      input.created_by_user_id ?? null
    ]
  );
}

async function insertQuestionTaxonomy(
  client: PoolClient,
  questionId: number,
  taxonomy: NonNullable<CreateQuestionInput["taxonomy"]>
): Promise<void> {
  await client.query(
    `
      insert into assessment.question_taxonomy_links
        (
          question_id,
          exam_id,
          exam_level_id,
          subject_node_id,
          source_node_id,
          topic_node_id,
          subtopic_node_id,
          question_nature_id
        )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      questionId,
      taxonomy.exam_id,
      taxonomy.exam_level_id,
      taxonomy.subject_node_id,
      taxonomy.source_node_id ?? null,
      taxonomy.topic_node_id ?? null,
      taxonomy.subtopic_node_id ?? null,
      taxonomy.question_nature_id ?? null
    ]
  );
}

async function insertPassageLink(
  client: PoolClient,
  questionId: number,
  passage: NonNullable<CreateQuestionInput["passage"]>
): Promise<void> {
  await client.query(
    `
      insert into assessment.passage_questions
        (passage_id, question_id, display_order)
      values ($1, $2, coalesce($3, 0))
    `,
    [passage.passage_id, questionId, passage.display_order ?? null]
  );
}

export async function createQuestion(input: CreateQuestionInput): Promise<unknown | null> {
  const questionId = await transaction(async (client) => {
    const questionResult = await client.query<{ id: number }>(
      `
        insert into assessment.questions
          (question_family, question_format_id, status, created_by_user_id, is_ai_generated)
        values ($1, $2, coalesce($3, 'draft'), $4, coalesce($5, false))
        returning id
      `,
      [
        input.question_family,
        input.question_format_id,
        input.status ?? null,
        input.created_by_user_id ?? null,
        input.is_ai_generated ?? null
      ]
    );

    const newQuestionId = questionResult.rows[0]?.id;
    if (!newQuestionId) {
      throw new Error("Question insert failed.");
    }

    await insertQuestionVersion(client, newQuestionId, input.version);

    if (input.taxonomy) {
      await insertQuestionTaxonomy(client, newQuestionId, input.taxonomy);
    }

    if (input.passage) {
      await insertPassageLink(client, newQuestionId, input.passage);
    }

    return newQuestionId;
  });

  return getQuestion(questionId);
}

export async function getQuestion(id: number): Promise<unknown | null> {
  return one(
    `
      select
        q.*,
        row_to_json(qf.*) as question_format,
        row_to_json(qv.*) as current_version,
        coalesce(
          jsonb_agg(distinct jsonb_build_object(
            'id', qtl.id,
            'exam_id', qtl.exam_id,
            'exam_level_id', qtl.exam_level_id,
            'subject_node_id', qtl.subject_node_id,
            'source_node_id', qtl.source_node_id,
            'topic_node_id', qtl.topic_node_id,
            'subtopic_node_id', qtl.subtopic_node_id,
            'question_nature_id', qtl.question_nature_id
          )) filter (where qtl.id is not null),
          '[]'::jsonb
        ) as taxonomy_links,
        coalesce(
          jsonb_agg(distinct jsonb_build_object(
            'passage_id', pq.passage_id,
            'display_order', pq.display_order
          )) filter (where pq.passage_id is not null),
          '[]'::jsonb
        ) as passages
      from assessment.questions q
      join assessment.question_formats qf on qf.id = q.question_format_id
      join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
      left join assessment.question_taxonomy_links qtl on qtl.question_id = q.id
      left join assessment.passage_questions pq on pq.question_id = q.id
      where q.id = $1
      group by q.id, qf.id, qv.id
    `,
    [id]
  );
}

export async function updateQuestionAdmin(
  id: number,
  input: UpdateQuestionAdminInput,
  userId: number
): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "question_format_id", input.question_format_id);
  addUpdate(updates, params, "status", input.status);
  addUpdate(updates, params, "is_ai_generated", input.is_ai_generated);

  if (input.status === "approved" || input.status === "published") {
    addUpdate(updates, params, "approved_by_user_id", userId);
    addUpdate(updates, params, "approved_at", new Date());
  }

  requireUpdates(updates);

  params.push(id);
  await one(
    `
      update assessment.questions
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning id
    `,
    params
  );

  return getQuestion(id);
}

export async function addQuestionVersion(
  questionId: number,
  input: AddQuestionVersionInput,
  userId: number
): Promise<unknown | null> {
  await transaction(async (client) => {
    const question = await client.query<{ id: string }>(
      "select id from assessment.questions where id = $1 for update",
      [questionId]
    );
    if (!question.rows[0]) {
      const error = new Error("Question not found.") as Error & { statusCode?: number };
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

    await client.query(
      "update assessment.question_versions set is_current = false where question_id = $1",
      [questionId]
    );

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
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11)
      `,
      [
        questionId,
        version.rows[0]?.next_version ?? 1,
        input.question_statement,
        input.supplementary_statement ?? null,
        JSON.stringify(input.statements_facts ?? []),
        input.question_prompt ?? null,
        JSON.stringify(input.options ?? []),
        input.correct_answer === undefined ? null : JSON.stringify(input.correct_answer),
        input.explanation ?? null,
        JSON.stringify(input.content_json ?? {}),
        userId
      ]
    );

    await client.query("update assessment.questions set updated_at = now() where id = $1", [questionId]);
  });

  return getQuestion(questionId);
}

export async function replaceQuestionTaxonomy(
  questionId: number,
  input: ReplaceQuestionTaxonomyInput
): Promise<unknown | null> {
  await transaction(async (client) => {
    const question = await client.query<{ id: string }>(
      "select id from assessment.questions where id = $1 for update",
      [questionId]
    );
    if (!question.rows[0]) {
      const error = new Error("Question not found.") as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    await client.query("delete from assessment.question_taxonomy_links where question_id = $1", [questionId]);
    await insertQuestionTaxonomy(client, questionId, input);
    await client.query("update assessment.questions set updated_at = now() where id = $1", [questionId]);
  });

  return getQuestion(questionId);
}

export async function listQuestions(
  options: ListQuestionsQuery & {
    user_id?: number;
    is_admin?: boolean;
    subject_node_ids?: number[];
    topic_node_ids?: number[];
    subtopic_node_ids?: number[];
  }
): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.question_family) addCondition(conditions, params, "q.question_family = ?", options.question_family);
  if (options.status) addCondition(conditions, params, "q.status = ?", options.status);
  if (options.question_format_id) addCondition(conditions, params, "q.question_format_id = ?", options.question_format_id);
  if (options.exam_id) addCondition(conditions, params, "qtl.exam_id = ?", options.exam_id);
  if (options.exam_level_id) addCondition(conditions, params, "qtl.exam_level_id = ?", options.exam_level_id);
  
  if (options.subject_node_ids && options.subject_node_ids.length > 0) {
    addCondition(conditions, params, "qtl.subject_node_id = any(?)", options.subject_node_ids);
  } else if (options.subject_node_id) {
    addCondition(conditions, params, "qtl.subject_node_id = ?", options.subject_node_id);
  }

  if (options.source_node_id) addCondition(conditions, params, "qtl.source_node_id = ?", options.source_node_id);

  if (options.topic_node_ids && options.topic_node_ids.length > 0) {
    addCondition(conditions, params, "qtl.topic_node_id = any(?)", options.topic_node_ids);
  } else if (options.topic_node_id) {
    addCondition(conditions, params, "qtl.topic_node_id = ?", options.topic_node_id);
  }

  if (options.subtopic_node_ids && options.subtopic_node_ids.length > 0) {
    addCondition(conditions, params, "qtl.subtopic_node_id = any(?)", options.subtopic_node_ids);
  } else if (options.subtopic_node_id) {
    addCondition(conditions, params, "qtl.subtopic_node_id = ?", options.subtopic_node_id);
  }

  if (options.question_nature_id) addCondition(conditions, params, "qtl.question_nature_id = ?", options.question_nature_id);
  if (options.content_type) {
    addCondition(conditions, params, "atn.content_type = ?", options.content_type);
  }

  // Question privacy filter: Students/anonymous can see public questions (creator is null or admin/editor) or their own private questions
  if (!options.is_admin) {
    if (options.user_id) {
      addCondition(
        conditions,
        params,
        `(q.created_by_user_id is null or q.created_by_user_id = ? or exists (
          select 1 from app.users u 
          where u.id = q.created_by_user_id 
            and u.role in ('admin', 'moderator', 'content_editor')
        ))`,
        options.user_id
      );
    } else {
      conditions.push(
        `(q.created_by_user_id is null or exists (
          select 1 from app.users u 
          where u.id = q.created_by_user_id 
            and u.role in ('admin', 'moderator', 'content_editor')
        ))`
      );
    }
  }

  let userIdParamIndex = -1;
  if (options.user_id) {
    params.push(options.user_id);
    userIdParamIndex = params.length;
  }

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select
        q.*,
        row_to_json(qf.*) as question_format,
        row_to_json(qv.*) as current_version,
        row_to_json(qn.*) as question_nature,
        qtl.exam_id,
        qtl.exam_level_id,
        qtl.subject_node_id,
        qtl.topic_node_id,
        qtl.subtopic_node_id,
        qtl.question_nature_id,
        pq.passage_id,
        p.title as passage_title,
        p.body as passage_body,
        ${userIdParamIndex !== -1 ? `exists (
          select 1 
          from assessment.attempt_responses ar
          join assessment.test_attempts ta on ta.id = ar.attempt_id
          where ar.question_version_id = qv.id 
            and ta.user_id = $${userIdParamIndex}
        ) as is_used` : "false as is_used"}
      from assessment.questions q
      join assessment.question_formats qf on qf.id = q.question_format_id
      join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
      left join assessment.question_taxonomy_links qtl on qtl.question_id = q.id
      left join assessment.assessment_taxonomy_nodes atn on atn.id = qtl.subject_node_id
      left join assessment.question_natures qn on qn.id = qtl.question_nature_id
      left join assessment.passage_questions pq on pq.question_id = q.id
      left join assessment.passages p on p.id = pq.passage_id
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      group by q.id, qf.id, qv.id, qn.id, qtl.id, pq.passage_id, p.id
      order by q.created_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function listQuestionCountsByTaxonomy(options: QuestionCountsQuery & { user_id?: number }): Promise<unknown[]> {
  const rows: Array<{ node_id: string | number; question_family: string; question_count: string | number }> = [];

  if (!options.question_family || options.question_family === "objective") {
    const params: unknown[] = [options.exam_id];
    let levelFilter = "";
    if (options.exam_level_id) {
      params.push(options.exam_level_id);
      levelFilter = `and qtl.exam_level_id = $${params.length}`;
    }

    const objectiveRows = await query<{ node_id: string; question_family: string; question_count: string }>(
      `
        select
          n.node_id,
          'objective' as question_family,
          count(distinct q.id)::text as question_count
        from assessment.questions q
        join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
        join assessment.question_taxonomy_links qtl on qtl.question_id = q.id
        cross join lateral (
          values (coalesce(qtl.subtopic_node_id, qtl.topic_node_id, qtl.source_node_id, qtl.subject_node_id))
        ) as n(node_id)
        where q.status = 'published'
          and q.question_family = 'objective'
          and qtl.exam_id = $1
          ${levelFilter}
          and n.node_id is not null
          and (q.created_by_user_id is null or exists (
            select 1 from app.users u
            where u.id = q.created_by_user_id
              and u.role in ('admin', 'moderator', 'content_editor')
          ))
        group by n.node_id
      `,
      params
    );
    rows.push(...objectiveRows);
  }

  if (!options.question_family || options.question_family === "mains_subjective") {
    const params: unknown[] = [options.exam_id];
    let levelFilter = "";
    if (options.exam_level_id) {
      params.push(options.exam_level_id);
      levelFilter = `and mqtl.exam_level_id = $${params.length}`;
    }

    const mainsRows = await query<{ node_id: string; question_family: string; question_count: string }>(
      `
        select
          n.node_id,
          'mains_subjective' as question_family,
          count(distinct q.id)::text as question_count
        from assessment.questions q
        join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
        join assessment.mains_question_taxonomy_links mqtl on mqtl.question_id = q.id
        cross join lateral (
          values (coalesce(mqtl.subtopic_node_id, mqtl.topic_node_id, mqtl.theme_node_id, mqtl.subject_area_node_id, mqtl.paper_node_id))
        ) as n(node_id)
        where q.status = 'published'
          and q.question_family = 'mains_subjective'
          and mqtl.exam_id = $1
          ${levelFilter}
          and n.node_id is not null
        group by n.node_id
      `,
      params
    );
    rows.push(...mainsRows);
  }

  // Fetch user's own private question counts per node (for "Your Questions" virtual nodes)
  const userCountMap: Record<number, number> = {};
  if (options.user_id) {
    const params: unknown[] = [options.user_id, options.exam_id];
    let levelFilter = "";
    if (options.exam_level_id) {
      params.push(options.exam_level_id);
      levelFilter = `and qtl.exam_level_id = $${params.length}`;
    }

    const userRows = await query<{ node_id: string; question_count: string }>(
      `
        select
          n.node_id,
          count(distinct q.id)::text as question_count
        from assessment.questions q
        join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
        join assessment.question_taxonomy_links qtl on qtl.question_id = q.id
        cross join lateral (
          values (coalesce(qtl.subtopic_node_id, qtl.topic_node_id, qtl.source_node_id, qtl.subject_node_id))
        ) as n(node_id)
        where q.status = 'published'
          and q.created_by_user_id = $1
          and qtl.exam_id = $2
          ${levelFilter}
          and n.node_id is not null
        group by n.node_id
      `,
      params
    );

    for (const r of userRows) {
      userCountMap[Number(r.node_id)] = Number(r.question_count);
    }
  }

  return rows.map((row) => ({
    node_id: Number(row.node_id),
    question_family: row.question_family,
    question_count: Number(row.question_count),
    user_question_count: userCountMap[Number(row.node_id)] ?? 0
  }));
}

export async function deleteQuestion(id: number): Promise<unknown | null> {
  return transaction(async (client) => {
    // delete from passage questions
    await client.query("delete from assessment.passage_questions where question_id = $1", [id]);
    // delete from test_question_items
    await client.query("delete from assessment.test_question_items where question_version_id in (select id from assessment.question_versions where question_id = $1)", [id]);
    // delete from question taxonomy links
    await client.query("delete from assessment.question_taxonomy_links where question_id = $1", [id]);
    // delete from question versions
    await client.query("delete from assessment.question_versions where question_id = $1", [id]);
    // delete from questions
    const res = await client.query(
      `
        delete from assessment.questions
        where id = $1
        returning *
      `,
      [id]
    );
    return res.rows[0] ?? null;
  });
}

export async function bulkUpdateQuestionsTaxonomy(input: BulkUpdateQuestionsTaxonomyInput, userId?: number): Promise<void> {
  if (input.ids.length === 0) return;

  await transaction(async (client) => {
    const updates: string[] = [];
    const params: unknown[] = [input.ids];

    if (input.exam_id !== undefined) {
      params.push(input.exam_id);
      updates.push(`exam_id = $${params.length}`);
    }
    if (input.exam_level_id !== undefined) {
      params.push(input.exam_level_id);
      updates.push(`exam_level_id = $${params.length}`);
    }
    if (input.subject_node_id !== undefined) {
      params.push(input.subject_node_id);
      updates.push(`subject_node_id = $${params.length}`);
    }
    if (input.source_node_id !== undefined) {
      params.push(input.source_node_id);
      updates.push(`source_node_id = $${params.length}`);
    }
    if (input.topic_node_id !== undefined) {
      params.push(input.topic_node_id);
      updates.push(`topic_node_id = $${params.length}`);
    }
    if (input.subtopic_node_id !== undefined) {
      params.push(input.subtopic_node_id);
      updates.push(`subtopic_node_id = $${params.length}`);
    }
    if (input.question_nature_id !== undefined) {
      params.push(input.question_nature_id);
      updates.push(`question_nature_id = $${params.length}`);
    }

    if (updates.length > 0) {
      await client.query(
        `
          update assessment.question_taxonomy_links
          set ${updates.join(", ")}
          where question_id = any($1)
        `,
        params
      );
    }

    if (input.status !== undefined) {
      const qParams: unknown[] = [input.ids, input.status];
      const qUpdates: string[] = ["status = $2"];
      if ((input.status === "approved" || input.status === "published") && userId !== undefined) {
        qParams.push(userId);
        qUpdates.push(`approved_by_user_id = $${qParams.length}`);
        qParams.push(new Date());
        qUpdates.push(`approved_at = $${qParams.length}`);
      }
      await client.query(
        `
          update assessment.questions
          set ${qUpdates.join(", ")}, updated_at = now()
          where id = any($1)
        `,
        qParams
      );
    }
  });
}

export async function saveQuestionsDraft(
  input: {
    exam_id: number;
    exam_level_id: number;
    subject_node_id: number;
    source_node_id?: number | null;
    topic_node_id?: number | null;
    subtopic_node_id?: number | null;
    passage_title?: string;
    passage_text?: string;
    questions: any[];
    status?: string;
    test_template_id?: number;
    is_user_private?: boolean;
    question_family?: "objective" | "mains_subjective";
  },
  userId: number
): Promise<Array<{ question_id: number; version_id: number }>> {
  const createdItems: Array<{ question_id: number; version_id: number }> = [];
  await transaction(async (client) => {
    // Resolve custom test template parameters if requested
    let sectionId: number | null = null;
    let maxOrder = 0;
    if (input.test_template_id) {
      const templateCheck = await client.query<{ id: number }>(
        `select id from assessment.test_templates where id = $1 and created_by_user_id = $2`,
        [input.test_template_id, userId]
      );
      if (templateCheck.rows.length > 0) {
        const sectionRes = await client.query<{ id: number }>(
          `select id from assessment.test_sections where test_template_id = $1 order by display_order, id limit 1`,
          [input.test_template_id]
        );
        if (sectionRes.rows.length > 0) {
          sectionId = sectionRes.rows[0]?.id ?? null;
        } else {
          const newSectionRes = await client.query<{ id: number }>(
            `insert into assessment.test_sections (test_template_id, title, display_order) values ($1, 'Default Section', 1) returning id`,
            [input.test_template_id]
          );
          sectionId = newSectionRes.rows[0]?.id ?? null;
        }

        const maxOrderRes = await client.query<{ max_order: number }>(
          `select coalesce(max(display_order), 0) as max_order from assessment.test_question_items where test_template_id = $1`,
          [input.test_template_id]
        );
        maxOrder = Number(maxOrderRes.rows[0]?.max_order ?? 0);
      }
    }

    // 1. Create passage if provided
    let passageId: number | null = null;
    if (input.passage_text && input.passage_text.trim() !== "") {
      const passageRes = await client.query<{ id: number }>(
        `
          insert into assessment.passages
            (title, body, status, created_by_user_id, is_ai_generated)
          values ($1, $2, coalesce($4, 'draft'), $3, true)
          returning id
        `,
        [input.passage_title || "Reading Passage", input.passage_text, userId, input.status ?? null]
      );
      passageId = passageRes.rows[0]?.id ?? null;
    }

    // 2. Resolve the format ID for standard_quiz / passage_linked_quiz / mains_answer_writing
    const isMains = input.question_family === "mains_subjective";
    let formatId = 1;
    if (isMains) {
      const formatRow = await client.query<{ id: number }>(
        `select id from assessment.question_formats where slug = 'mains_answer_writing' limit 1`
      );
      formatId = formatRow.rows[0]?.id || 10;
    } else {
      const formatRow = await client.query<{ id: number }>(
        `select id from assessment.question_formats where slug = $1 limit 1`,
        [passageId ? 'passage_linked_quiz' : 'standard_quiz']
      );
      formatId = formatRow.rows[0]?.id || 1;
    }

    // 3. Create questions and versions
    for (let i = 0; i < input.questions.length; i++) {
      const q = input.questions[i];
      
      // Insert question
      const qIsAiGenerated = q.is_ai_generated !== undefined ? !!q.is_ai_generated : true;
      const questionRes = await client.query<{ id: number }>(
        `
          insert into assessment.questions
            (question_family, question_format_id, status, created_by_user_id, is_ai_generated, is_user_question)
          values ($1, $2, coalesce($3, 'draft'), $4, $5, $6)
          returning id
        `,
        [input.question_family || 'objective', formatId, input.status ?? null, userId, qIsAiGenerated, input.is_user_private ? true : null]
      );
      const questionId = questionRes.rows[0]?.id;
      if (!questionId) throw new Error("Failed to create question.");

      // Insert question version
      const optionsJson = isMains ? '[]' : JSON.stringify((q.options || []).map((o: any) => ({ key: o.label, text: o.text })));
      const correctAnswerJson = isMains ? null : JSON.stringify({ key: q.correct_answer });

      const versionRes = await client.query<{ id: number }>(
        `
          insert into assessment.question_versions
            (
              question_id,
              version_no,
              question_statement,
              supplementary_statement,
              question_prompt,
              options,
              correct_answer,
              explanation,
              is_current,
              created_by_user_id
            )
          values ($1, 1, $2, $3, $4, $5, $6, $7, true, $8)
          returning id
        `,
        [
          questionId,
          q.question_statement,
          q.supp_question_statement ?? null,
          q.question_prompt ?? (isMains ? null : "Choose the correct option:"),
          optionsJson,
          correctAnswerJson,
          q.explanation ?? "",
          userId
        ]
      );
      const versionId = versionRes.rows[0]?.id;
      if (!versionId) throw new Error("Failed to create question version.");
      createdItems.push({ question_id: Number(questionId), version_id: Number(versionId) });

      // Link taxonomy (with question-level overrides if available)
      const qExamId = q.exam_id !== undefined && q.exam_id !== null ? Number(q.exam_id) : input.exam_id;
      const qLevelId = q.exam_level_id !== undefined && q.exam_level_id !== null ? Number(q.exam_level_id) : input.exam_level_id;
      const qSubjectId = q.subject_node_id !== undefined && q.subject_node_id !== null ? Number(q.subject_node_id) : input.subject_node_id;
      const qSourceId = q.source_node_id !== undefined && q.source_node_id !== null ? Number(q.source_node_id) : (input.source_node_id ?? null);
      const qTopicId = q.topic_node_id !== undefined && q.topic_node_id !== null ? Number(q.topic_node_id) : (input.topic_node_id ?? null);
      const qSubtopicId = q.subtopic_node_id !== undefined && q.subtopic_node_id !== null ? Number(q.subtopic_node_id) : (input.subtopic_node_id ?? null);
      const natureId = q.question_nature_id ? Number(q.question_nature_id) : null;

      if (isMains) {
        // Insert into mains question details
        await client.query(
          `
            insert into assessment.mains_question_details
              (question_id, word_limit, marks, directive, model_answer, answer_framework, key_points, evaluation_rubric)
            values ($1, $2, coalesce($3, 0), $4, $5, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb)
          `,
          [
            questionId,
            q.word_limit || 250,
            q.marks || 15,
            q.directive || null,
            q.explanation || null
          ]
        );

        // Link mains taxonomy
        await client.query(
          `
            insert into assessment.mains_question_taxonomy_links
              (question_id, exam_id, exam_level_id, paper_node_id, subject_area_node_id, theme_node_id, topic_node_id, subtopic_node_id, question_nature_id)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            questionId,
            qExamId,
            qLevelId,
            qSubjectId, // maps to paper_node_id
            qSourceId,  // maps to subject_area_node_id
            qTopicId,   // maps to theme_node_id
            qSubtopicId, // maps to topic_node_id
            null, // subtopic_node_id
            null  // question_nature_id
          ]
        );
      } else {
        await client.query(
          `
            insert into assessment.question_taxonomy_links
              (question_id, exam_id, exam_level_id, subject_node_id, source_node_id, topic_node_id, subtopic_node_id, question_nature_id)
            values ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            questionId,
            qExamId,
            qLevelId,
            qSubjectId,
            qSourceId,
            qTopicId,
            qSubtopicId,
            natureId
          ]
        );
      }

      // Link passage if present
      if (passageId) {
        await client.query(
          `
            insert into assessment.passage_questions
              (passage_id, question_id, display_order)
            values ($1, $2, $3)
          `,
          [passageId, questionId, i + 1]
        );
      }

      // Link to custom test template if requested
      if (input.test_template_id && sectionId && versionId) {
        maxOrder++;
        const marks = isMains ? (q.marks || 15.0) : 1.0;
        await client.query(
          `
            insert into assessment.test_question_items
              (test_template_id, test_section_id, question_version_id, marks, negative_marks, display_order)
            values ($1, $2, $3, $4, 0.0, $5)
          `,
          [input.test_template_id, sectionId, versionId, marks, maxOrder]
        );
      }
    }

    if (input.test_template_id && sectionId) {
      let totalAddedMarks = 0;
      for (const q of input.questions) {
        totalAddedMarks += isMains ? (q.marks || 15.0) : 1.0;
      }
      await client.query(
        `
          update assessment.test_templates
          set total_marks = total_marks + $1,
              duration_minutes = duration_minutes + $2,
              updated_at = now()
          where id = $3
        `,
        [totalAddedMarks, input.questions.length * 2, input.test_template_id]
      );
    }
  });
  return createdItems;
}
