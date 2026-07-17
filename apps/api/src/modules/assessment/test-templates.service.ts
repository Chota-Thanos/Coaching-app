import type { PoolClient } from "pg";
import { one, query, transaction } from "../../db.js";
import type {
  AddTestQuestionItemInput,
  CreateTestSectionInput,
  CreateTestTemplateInput,
  ListTestTemplatesQuery,
  UpdateTestQuestionItemInput,
  UpdateTestSectionInput,
  UpdateTestTemplateInput
} from "./schemas.js";
import { addCondition, addUpdate, requireUpdates } from "../../common/sql.js";
import { getUserEntitlements } from "../billing/service.js";
import { getQuestionCap } from "./question-caps.js";
import { buildStratifiedSelectionQuery } from "./attempts.service.js";

export type CategorySelectionSpec = {
  subject_node_id?: number | null;
  topic_node_id?: number | null;
  subtopic_node_id?: number | null;
  question_count: number;
  question_family?: string;
  question_nature_id?: number | null;
  is_user_private?: boolean | null;
};

// Resolves category specs (any taxonomy level, e.g. a whole subject) into a
// balanced/stratified list of published question versions — the same rollup
// logic startCompiledAttempt uses for live attempts, reused here so saving a
// category into a reusable test template (new or existing) works from any
// level too, not just leaf categories with questions tagged exactly there.
async function resolveCategoriesToQuestions(
  client: PoolClient,
  userId: number | null,
  examId: number,
  categories: CategorySelectionSpec[],
  excludeQuestionIds: number[] = []
): Promise<Array<{ question_id: number; version_id: number; marks: number; question_family: string }>> {
  const selectedVersions: Array<{ question_id: number; version_id: number; marks: number; question_family: string }> = [];
  const selectedQuestionIds: number[] = [...excludeQuestionIds];

  for (const cat of categories) {
    const isMains = cat.question_family === "mains_subjective";
    const targetNodeId = cat.subtopic_node_id || cat.topic_node_id || cat.subject_node_id;
    if (!targetNodeId || cat.question_count <= 0) continue;

    const params: unknown[] = [examId, targetNodeId];
    let fromAndWhere = "";
    let selectColumns = "";
    let outputColumns = "";
    let strataExpr = "";
    let recursiveCte: string;

    if (isMains) {
      recursiveCte = `
        category_nodes as (
          select id from assessment.mains_taxonomy_nodes where id = $2
          union all
          select child.id from assessment.mains_taxonomy_nodes child
          join category_nodes parent on parent.id = child.parent_id
        )
      `;
      selectColumns = "q.id, qv.id as version_id, coalesce(mqd.marks, 10.0) as marks";
      outputColumns = "id, version_id, marks";
      strataExpr = "coalesce(mqtl.subtopic_node_id, mqtl.topic_node_id, mqtl.theme_node_id, mqtl.subject_area_node_id, mqtl.paper_node_id)";
      fromAndWhere = `
        from assessment.questions q
        join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
        join assessment.mains_question_taxonomy_links mqtl on mqtl.question_id = q.id
        left join assessment.mains_question_details mqd on mqd.question_id = q.id
        where q.status = 'published'
          and q.question_family = 'mains_subjective'
          and mqtl.exam_id = $1
          and (
            mqtl.paper_node_id in (select id from category_nodes)
            or mqtl.subject_area_node_id in (select id from category_nodes)
            or mqtl.theme_node_id in (select id from category_nodes)
            or mqtl.topic_node_id in (select id from category_nodes)
            or mqtl.subtopic_node_id in (select id from category_nodes)
          )
      `;
    } else {
      recursiveCte = `
        category_nodes as (
          select id from assessment.assessment_taxonomy_nodes where id = $2
          union all
          select child.id from assessment.assessment_taxonomy_nodes child
          join category_nodes parent on parent.id = child.parent_id
        )
      `;
      selectColumns = "distinct q.id, qv.id as version_id";
      outputColumns = "id, version_id";
      strataExpr = "coalesce(qtl.subtopic_node_id, qtl.topic_node_id, qtl.source_node_id, qtl.subject_node_id)";
      fromAndWhere = `
        from assessment.questions q
        join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
        join assessment.question_taxonomy_links qtl on qtl.question_id = q.id
        where q.status = 'published'
          and q.question_family = 'objective'
          and qtl.exam_id = $1
          and (
            qtl.subject_node_id in (select id from category_nodes)
            or qtl.source_node_id in (select id from category_nodes)
            or qtl.topic_node_id in (select id from category_nodes)
            or qtl.subtopic_node_id in (select id from category_nodes)
          )
      `;
    }

    if (cat.is_user_private) {
      params.push(userId);
      fromAndWhere += ` and q.created_by_user_id = $${params.length}`;
    } else {
      fromAndWhere += ` and (q.created_by_user_id is null or exists (select 1 from app.users u where u.id = q.created_by_user_id and u.role in ('admin', 'moderator', 'content_editor')))`;
    }
    if (cat.question_nature_id) {
      params.push(cat.question_nature_id);
      fromAndWhere += ` and ${isMains ? "mqtl" : "qtl"}.question_nature_id = $${params.length}`;
    }
    if (selectedQuestionIds.length > 0) {
      params.push(selectedQuestionIds);
      fromAndWhere += ` and q.id != all($${params.length})`;
    }

    params.push(cat.question_count);
    const queryText = buildStratifiedSelectionQuery({
      recursiveCte,
      selectColumns,
      outputColumns,
      strataExpr,
      fromAndWhere,
      limitParamPlaceholder: `$${params.length}`
    });

    const res = await client.query<{ id: number; version_id: number; marks?: number }>(queryText, params);
    for (const row of res.rows) {
      const qid = Number(row.id);
      selectedQuestionIds.push(qid);
      selectedVersions.push({
        question_id: qid,
        version_id: Number(row.version_id),
        marks: isMains ? Number(row.marks ?? 10.0) : 1.0,
        question_family: cat.question_family ?? "objective"
      });
    }
  }

  return selectedVersions;
}

export async function listTestTemplates(
  options: ListTestTemplatesQuery & { user_id?: number; user_role?: string }
): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = ["tt.source <> 'study_plan'"];

  if (options.exam_id) addCondition(conditions, params, "tt.exam_id = ?", options.exam_id);
  if (options.exam_level_id) addCondition(conditions, params, "tt.exam_level_id = ?", options.exam_level_id);
  if (options.status) addCondition(conditions, params, "tt.status = ?", options.status);
  if (options.access_type) addCondition(conditions, params, "tt.access_type = ?", options.access_type);
  if (options.test_type) addCondition(conditions, params, "tt.test_type = ?", options.test_type);

  if (options.user_id && !["admin", "moderator", "content_editor"].includes(options.user_role ?? "")) {
    addCondition(conditions, params, "(tt.access_type <> 'private' or tt.created_by_user_id = ?)", options.user_id);
  } else if (!options.user_id) {
    conditions.push("tt.access_type <> 'private'");
  }

  if (options.content_type === "mains") {
    conditions.push("tt.test_type = 'mains_test'");
  } else if (options.content_type === "gk") {
    conditions.push(`
      (
        tt.test_type <> 'mains_test'
        and (
          not exists (
            select 1 
            from assessment.test_question_items tqi
            join assessment.question_versions qv on qv.id = tqi.question_version_id
            join assessment.question_taxonomy_links qtl on qtl.question_id = qv.question_id
            join assessment.assessment_taxonomy_nodes atn on atn.id = qtl.subject_node_id
            where tqi.test_template_id = tt.id and atn.content_type = 'aptitude'
          )
        )
      )
    `);
  } else if (options.content_type === "aptitude") {
    conditions.push(`
      exists (
        select 1 
        from assessment.test_question_items tqi
        join assessment.question_versions qv on qv.id = tqi.question_version_id
        join assessment.question_taxonomy_links qtl on qtl.question_id = qv.question_id
        join assessment.assessment_taxonomy_nodes atn on atn.id = qtl.subject_node_id
        where tqi.test_template_id = tt.id and atn.content_type = 'aptitude'
      )
    `);
  }

  let userIdParamIndex: number | null = null;
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
        tt.*,
        coalesce(count(tqi.id), 0)::integer as question_count
        ${userIdParamIndex ? `,
          (
            select ta.id 
            from assessment.test_attempts ta 
            where ta.test_template_id = tt.id and ta.user_id = $${userIdParamIndex}
            order by ta.started_at desc limit 1
          ) as latest_attempt_id,
          (
            select ta.status 
            from assessment.test_attempts ta 
            where ta.test_template_id = tt.id and ta.user_id = $${userIdParamIndex}
            order by ta.started_at desc limit 1
          ) as latest_attempt_status,
          (
            select tr.id 
            from assessment.test_attempts ta 
            left join assessment.test_results tr on tr.attempt_id = ta.id
            where ta.test_template_id = tt.id and ta.user_id = $${userIdParamIndex}
            order by ta.started_at desc limit 1
          ) as latest_result_id
        ` : ""}
      from assessment.test_templates tt
      left join assessment.test_question_items tqi on tqi.test_template_id = tt.id
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      group by tt.id
      order by tt.created_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function createTestTemplate(input: CreateTestTemplateInput): Promise<unknown> {
  return one(
    `
      insert into assessment.test_templates
        (
          title,
          slug,
          description,
          exam_id,
          exam_level_id,
          test_type,
          duration_minutes,
          total_marks,
          negative_marking_config,
          cutoff_config,
          access_type,
          subscription_plan_id,
          status,
          created_by_user_id,
          published_at
        )
      values
        ($1, $2, $3, $4, $5, coalesce($6, 'sectional_test'), $7, coalesce($8, 0.0), $9, $10, coalesce($11, 'free'), $12, coalesce($13, 'draft'), $14, $15)
      returning *
    `,
    [
      input.title,
      input.slug,
      input.description ?? null,
      input.exam_id,
      input.exam_level_id,
      input.test_type ?? null,
      input.duration_minutes,
      input.total_marks ?? null,
      JSON.stringify(input.negative_marking_config ?? {}),
      JSON.stringify(input.cutoff_config ?? {}),
      input.access_type ?? null,
      input.subscription_plan_id ?? null,
      input.status ?? null,
      input.created_by_user_id ?? null,
      input.published_at ?? null
    ]
  );
}

export async function updateTestTemplate(id: number, input: UpdateTestTemplateInput): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "title", input.title);
  addUpdate(updates, params, "slug", input.slug);
  addUpdate(updates, params, "description", input.description);
  addUpdate(updates, params, "exam_id", input.exam_id);
  addUpdate(updates, params, "exam_level_id", input.exam_level_id);
  addUpdate(updates, params, "test_type", input.test_type);
  addUpdate(updates, params, "duration_minutes", input.duration_minutes);
  addUpdate(updates, params, "total_marks", input.total_marks);
  addUpdate(updates, params, "negative_marking_config", input.negative_marking_config === undefined ? undefined : JSON.stringify(input.negative_marking_config));
  addUpdate(updates, params, "cutoff_config", input.cutoff_config === undefined ? undefined : JSON.stringify(input.cutoff_config));
  addUpdate(updates, params, "access_type", input.access_type);
  addUpdate(updates, params, "subscription_plan_id", input.subscription_plan_id);
  addUpdate(updates, params, "status", input.status);
  addUpdate(updates, params, "published_at", input.published_at);

  if (input.status === "published" && input.published_at === undefined) {
    addUpdate(updates, params, "published_at", new Date());
  }

  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update assessment.test_templates
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function getTestTemplate(id: number, userId?: number): Promise<unknown | null> {
  const params: unknown[] = [id];
  if (userId) params.push(userId);

  const mainRecord = await one(
    `
      select
        tt.*,
        coalesce(count(tqi.id), 0)::integer as question_count
        ${userId ? `,
          (
            select ta.id 
            from assessment.test_attempts ta 
            where ta.test_template_id = tt.id and ta.user_id = $2
            order by ta.started_at desc limit 1
          ) as latest_attempt_id,
          (
            select ta.status 
            from assessment.test_attempts ta 
            where ta.test_template_id = tt.id and ta.user_id = $2
            order by ta.started_at desc limit 1
          ) as latest_attempt_status,
          (
            select tr.id 
            from assessment.test_attempts ta 
            left join assessment.test_results tr on tr.attempt_id = ta.id
            where ta.test_template_id = tt.id and ta.user_id = $2
            order by ta.started_at desc limit 1
          ) as latest_result_id
        ` : ""}
      from assessment.test_templates tt
      left join assessment.test_question_items tqi on tqi.test_template_id = tt.id
      where tt.id = $1 and tt.source <> 'study_plan'
      group by tt.id
    `,
    params
  );

  if (!mainRecord) return null;

  // Load the sections
  const sections = await query(
    `
      select * from assessment.test_sections
      where test_template_id = $1
      order by display_order asc
    `,
    [id]
  );

  // Load the questions with details
  const questions = await query(
    `
      select 
        tqi.*,
        qv.question_id,
        qv.question_statement,
        qv.supplementary_statement,
        qv.question_prompt,
        qv.options,
        qv.correct_answer,
        qv.explanation
      from assessment.test_question_items tqi
      join assessment.question_versions qv on qv.id = tqi.question_version_id
      where tqi.test_template_id = $1
      order by tqi.display_order asc
    `,
    [id]
  );

  // Load the category breakdown
  const categoryBreakdown = await query(
    `
      select
        coalesce(atn_sub.id, 0) as subject_node_id,
        coalesce(atn_sub.name, 'Uncategorized') as subject_name,
        coalesce(atn_top.id, 0) as topic_node_id,
        coalesce(atn_top.name, '') as topic_name,
        count(distinct qv.question_id)::integer as question_count
      from assessment.test_question_items tqi
      join assessment.question_versions qv on qv.id = tqi.question_version_id
      left join assessment.question_taxonomy_links qtl on qtl.question_id = qv.question_id
      left join assessment.assessment_taxonomy_nodes atn_sub on atn_sub.id = qtl.subject_node_id
      left join assessment.assessment_taxonomy_nodes atn_top on atn_top.id = qtl.topic_node_id
      where tqi.test_template_id = $1
      group by atn_sub.id, atn_sub.name, atn_top.id, atn_top.name
    `,
    [id]
  );

  return {
    ...mainRecord,
    sections,
    questions,
    category_breakdown: categoryBreakdown
  };
}

export async function createTestSection(
  testTemplateId: number,
  input: CreateTestSectionInput
): Promise<unknown> {
  return one(
    `
      insert into assessment.test_sections
        (test_template_id, title, display_order, duration_minutes, instructions)
      values ($1, $2, coalesce($3, 0), $4, $5)
      returning *
    `,
    [
      testTemplateId,
      input.title,
      input.display_order ?? null,
      input.duration_minutes ?? null,
      input.instructions ?? null
    ]
  );
}

export async function updateTestSection(id: number, input: UpdateTestSectionInput): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "title", input.title);
  addUpdate(updates, params, "display_order", input.display_order);
  addUpdate(updates, params, "duration_minutes", input.duration_minutes);
  addUpdate(updates, params, "instructions", input.instructions);
  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update assessment.test_sections
      set ${updates.join(", ")}
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function addTestQuestionItem(
  testTemplateId: number,
  input: AddTestQuestionItemInput
): Promise<unknown> {
  return one(
    `
      insert into assessment.test_question_items
        (test_template_id, test_section_id, question_version_id, marks, negative_marks, display_order)
      values ($1, $2, $3, coalesce($4, 1.0), coalesce($5, 0.0), coalesce($6, 0))
      returning *
    `,
    [
      testTemplateId,
      input.test_section_id ?? null,
      input.question_version_id,
      input.marks ?? null,
      input.negative_marks ?? null,
      input.display_order ?? null
    ]
  );
}

export async function updateTestQuestionItem(id: number, input: UpdateTestQuestionItemInput): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "test_section_id", input.test_section_id);
  addUpdate(updates, params, "marks", input.marks);
  addUpdate(updates, params, "negative_marks", input.negative_marks);
  addUpdate(updates, params, "display_order", input.display_order);
  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update assessment.test_question_items
      set ${updates.join(", ")}
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function deleteTestQuestionItem(id: number): Promise<unknown | null> {
  return one(
    `
      delete from assessment.test_question_items
      where id = $1
      returning *
    `,
    [id]
  );
}

export async function deleteTestTemplate(id: number): Promise<unknown | null> {
  // Clear responses of attempts
  await query(
    `
      delete from assessment.attempt_responses
      where attempt_id in (
        select id from assessment.test_attempts
        where test_template_id = $1
      )
    `,
    [id]
  );

  // Clear results of attempts
  await query(
    `
      delete from assessment.test_results
      where attempt_id in (
        select id from assessment.test_attempts
        where test_template_id = $1
      )
    `,
    [id]
  );

  // Clear attempts
  await query("delete from assessment.test_attempts where test_template_id = $1", [id]);

  // Clear question items
  await query("delete from assessment.test_question_items where test_template_id = $1", [id]);

  // Clear sections
  await query("delete from assessment.test_sections where test_template_id = $1", [id]);

  // Delete the template itself
  return one(
    `
      delete from assessment.test_templates
      where id = $1
      returning *
    `,
    [id]
  );
}

export async function createTestTemplateDraft(
  input: {
    title: string;
    description?: string;
    test_type: string;
    duration_minutes: number;
    total_marks: number;
    exam_id: number;
    exam_level_id: number;
    subject_node_id: number;
    topic_node_id?: number;
    subtopic_node_id?: number;
    passage_title?: string;
    passage_text?: string;
    questions: any[];
  },
  userId: number
): Promise<unknown> {
  const result = await transaction(async (client) => {
    // 1. Create a unique slug for the test template
    let baseSlug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!baseSlug) baseSlug = "ai-quiz";
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await client.query("select 1 from assessment.test_templates where slug = $1", [slug]);
      if ((existing.rowCount ?? 0) === 0) break;
      slug = `${baseSlug}-${counter++}`;
    }

    // 2. Insert test template with status = 'draft'
    const templateResult = await client.query<{ id: number }>(
      `
        insert into assessment.test_templates
          (
            title,
            slug,
            description,
            exam_id,
            exam_level_id,
            test_type,
            duration_minutes,
            total_marks,
            status,
            created_by_user_id
          )
        values
          ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9)
        returning *
      `,
      [
        input.title,
        slug,
        input.description ?? "AI Generated Quiz",
        input.exam_id,
        input.exam_level_id,
        input.test_type,
        input.duration_minutes || 30,
        input.total_marks || (input.questions.length * 2),
        userId
      ]
    );

    const templateId = templateResult.rows[0]?.id;
    if (!templateId) throw new Error("Failed to create test template.");

    // 3. Create test section ("Section 1")
    const sectionResult = await client.query<{ id: number }>(
      `
        insert into assessment.test_sections
          (test_template_id, title, display_order, duration_minutes)
        values ($1, 'Section 1', 1, $2)
        returning id
      `,
      [templateId, input.duration_minutes || null]
    );
    const sectionId = sectionResult.rows[0]?.id;
    if (!sectionId) throw new Error("Failed to create test section.");

    // 4. Create passage if provided
    let passageId: number | null = null;
    if (input.passage_text) {
      const passageRes = await client.query<{ id: number }>(
        `
          insert into assessment.passages
            (title, body, status, created_by_user_id, is_ai_generated)
          values ($1, $2, 'draft', $3, true)
          returning id
        `,
        [input.passage_title || "Reading Passage", input.passage_text, userId]
      );
      passageId = passageRes.rows[0]?.id ?? null;
    }

    // 5. Query the format ID for standard_quiz / passage_linked_quiz
    const formatRow = await client.query<{ id: number }>(
      `select id from assessment.question_formats where slug = $1 limit 1`,
      [passageId ? 'passage_linked_quiz' : 'standard_quiz']
    );
    const formatId = formatRow.rows[0]?.id || 1; // Fallback to 1

    // 6. Create questions and link them
    for (let i = 0; i < input.questions.length; i++) {
      const q = input.questions[i];
      
      // Insert question
      const questionRes = await client.query<{ id: number }>(
        `
          insert into assessment.questions
            (question_family, question_format_id, status, created_by_user_id, is_ai_generated)
          values ('objective', $1, 'draft', $2, true)
          returning id
        `,
        [formatId, userId]
      );
      const questionId = questionRes.rows[0]?.id;
      if (!questionId) throw new Error("Failed to create question.");

      // Insert question version
      const optionsJson = JSON.stringify(q.options.map((o: any) => ({ key: o.label, text: o.text })));
      const correctAnswerJson = JSON.stringify({ key: q.correct_answer });

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
          q.question_prompt ?? "Choose the correct option:",
          optionsJson,
          correctAnswerJson,
          q.explanation ?? "",
          userId
        ]
      );
      const versionId = versionRes.rows[0]?.id;
      if (!versionId) throw new Error("Failed to create question version.");

      // Link taxonomy
      await client.query(
        `
          insert into assessment.question_taxonomy_links
            (question_id, exam_id, exam_level_id, subject_node_id, topic_node_id, subtopic_node_id)
          values ($1, $2, $3, $4, $5, $6)
        `,
        [questionId, input.exam_id, input.exam_level_id, input.subject_node_id, input.topic_node_id ?? null, input.subtopic_node_id ?? null]
      );

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

      // Link to test template section
      await client.query(
        `
          insert into assessment.test_question_items
            (test_template_id, test_section_id, question_version_id, marks, negative_marks, display_order)
          values ($1, $2, $3, 2.0, 0.66, $4)
        `,
        [templateId, sectionId, versionId, i + 1]
      );
    }

    return templateResult.rows[0];
  });

  return result;
}

export async function bulkUpdateTestTemplatesTaxonomy(
  input: {
    ids: number[];
    exam_id?: number;
    exam_level_id?: number;
    subject_node_id?: number;
    topic_node_id?: number | null;
    subtopic_node_id?: number | null;
    status?: "draft" | "in_review" | "published" | "archived";
  }
): Promise<void> {
  if (input.ids.length === 0) return;

  await transaction(async (client) => {
    // 1. Update test templates meta fields: exam_id, exam_level_id, and status
    if (
      input.exam_id !== undefined ||
      input.exam_level_id !== undefined ||
      input.status !== undefined
    ) {
      const updates: string[] = [];
      const params: unknown[] = [];
      if (input.exam_id !== undefined) {
        params.push(input.exam_id);
        updates.push(`exam_id = $${params.length}`);
      }
      if (input.exam_level_id !== undefined) {
        params.push(input.exam_level_id);
        updates.push(`exam_level_id = $${params.length}`);
      }
      if (input.status !== undefined) {
        params.push(input.status);
        updates.push(`status = $${params.length}`);
        if (input.status === "published") {
          params.push(new Date());
          updates.push(`published_at = $${params.length}`);
        }
      }

      params.push(input.ids);
      await client.query(
        `
          update assessment.test_templates
          set ${updates.join(", ")}, updated_at = now()
          where id = any($${params.length})
        `,
        params
      );
    }

    // 2. Update taxonomy links for all questions inside these templates
    if (
      input.exam_id !== undefined ||
      input.exam_level_id !== undefined ||
      input.subject_node_id !== undefined ||
      input.topic_node_id !== undefined ||
      input.subtopic_node_id !== undefined
    ) {
      // Find all objective questions associated with these templates
      const objParams: unknown[] = [input.ids];
      const objUpdates: string[] = [];

      if (input.exam_id !== undefined) {
        objParams.push(input.exam_id);
        objUpdates.push(`exam_id = $${objParams.length}`);
      }
      if (input.exam_level_id !== undefined) {
        objParams.push(input.exam_level_id);
        objUpdates.push(`exam_level_id = $${objParams.length}`);
      }
      if (input.subject_node_id !== undefined) {
        objParams.push(input.subject_node_id);
        objUpdates.push(`subject_node_id = $${objParams.length}`);
      }
      if (input.topic_node_id !== undefined) {
        objParams.push(input.topic_node_id);
        objUpdates.push(`topic_node_id = $${objParams.length}`);
      }
      if (input.subtopic_node_id !== undefined) {
        objParams.push(input.subtopic_node_id);
        objUpdates.push(`subtopic_node_id = $${objParams.length}`);
      }

      if (objUpdates.length > 0) {
        // Update standard objective taxonomy links
        await client.query(
          `
            update assessment.question_taxonomy_links
            set ${objUpdates.join(", ")}
            where question_id in (
              select distinct qv.question_id
              from assessment.test_question_items tqi
              join assessment.question_versions qv on qv.id = tqi.question_version_id
              where tqi.test_template_id = any($1)
            )
          `,
          objParams
        );

        // Also check and update mains question taxonomy links (if any subjective questions are inside these templates)
        const mainsParams: unknown[] = [input.ids];
        const mainsUpdates: string[] = [];

        if (input.exam_id !== undefined) {
          mainsParams.push(input.exam_id);
          mainsUpdates.push(`exam_id = $${mainsParams.length}`);
        }
        if (input.exam_level_id !== undefined) {
          mainsParams.push(input.exam_level_id);
          mainsUpdates.push(`exam_level_id = $${mainsParams.length}`);
        }
        if (input.subject_node_id !== undefined) {
          mainsParams.push(input.subject_node_id);
          mainsUpdates.push(`paper_node_id = $${mainsParams.length}`);
        }
        if (input.topic_node_id !== undefined) {
          mainsParams.push(input.topic_node_id);
          mainsUpdates.push(`subject_area_node_id = $${mainsParams.length}`);
        }
        if (input.subtopic_node_id !== undefined) {
          mainsParams.push(input.subtopic_node_id);
          mainsUpdates.push(`theme_node_id = $${mainsParams.length}`);
        }

        if (mainsUpdates.length > 0) {
          await client.query(
            `
              update assessment.mains_question_taxonomy_links
              set ${mainsUpdates.join(", ")}
              where question_id in (
                select distinct qv.question_id
                from assessment.test_question_items tqi
                join assessment.question_versions qv on qv.id = tqi.question_version_id
                where tqi.test_template_id = any($1)
              )
            `,
            mainsParams
          );
        }
      }
    }
  });
}

const GUEST_CUSTOM_TEST_QUESTION_CAP = 10;

// exam_levels rows are plain auto-increment ids, and different seed histories
// (see migration 038_seed_exam_levels.sql, which added a second 'prelims'/
// 'csat'/'mains' set alongside the original 'prelims-gs'/'prelims-csat'/
// 'mains-written' rows from migration 001) can leave different environments
// with different ids — or even different slugs — for "the GK prelims level".
// Resolving by content_type here, trying every known slug convention, means
// clients never have to guess a row id or a slug name that might not exist
// on whichever environment they're actually talking to.
const EXAM_LEVEL_SLUG_CANDIDATES: Record<"gk" | "aptitude" | "mains", string[]> = {
  gk: ["prelims-gs", "prelims"],
  aptitude: ["prelims-csat", "csat"],
  mains: ["mains-written", "mains"]
};

async function resolveExamLevelId(
  client: PoolClient,
  examId: number,
  contentType: "gk" | "aptitude" | "mains"
): Promise<number> {
  const candidates = EXAM_LEVEL_SLUG_CANDIDATES[contentType];
  const result = await client.query<{ id: number }>(
    `
      select id
      from assessment.exam_levels
      where exam_id = $1 and slug = any($2::text[])
      order by array_position($2::text[], slug)
      limit 1
    `,
    [examId, candidates]
  );
  const row = result.rows[0];
  if (!row) {
    const error = new Error(
      `No exam level configured for content type "${contentType}" on exam ${examId}.`
    ) as Error & { statusCode?: number };
    error.name = "exam_level_not_found";
    error.statusCode = 404;
    throw error;
  }
  return Number(row.id);
}

export async function createUserCustomTest(
  userId: number | null,
  input: {
    title: string;
    description?: string;
    exam_id: number;
    exam_level_id?: number;
    content_type?: "gk" | "aptitude" | "mains";
    question_ids?: number[];
    categories?: CategorySelectionSpec[];
    duration_minutes?: number;
    test_type?: string;
  }
): Promise<any> {
  const requestedCount = input.categories?.length
    ? input.categories.reduce((sum, c) => sum + c.question_count, 0)
    : (input.question_ids?.length ?? 0);

  if (!userId && requestedCount > GUEST_CUSTOM_TEST_QUESTION_CAP) {
    const error = new Error(
      `Guest tests are limited to ${GUEST_CUSTOM_TEST_QUESTION_CAP} questions — sign in for unlimited custom tests.`
    ) as Error & { statusCode?: number };
    error.name = "guest_question_cap_exceeded";
    error.statusCode = 403;
    throw error;
  }

  if (userId) {
    const isMains = (input.test_type ?? "sectional_test") === "mains_test";
    const entitlements = await getUserEntitlements(userId);
    const hasPremium = entitlements.some((e) => e.entitlement_key === "assessment.premium_tests");
    const cap = getQuestionCap(hasPremium, isMains);
    if (requestedCount > cap) {
      const error = new Error(
        `${isMains ? "Mains" : "GK/CSAT"} tests are limited to ${cap} questions${hasPremium ? " on Assessment Premium" : " on the free tier"}.${hasPremium ? "" : " Upgrade to Assessment Premium for a higher limit."}`
      ) as Error & { statusCode?: number };
      error.name = "question_cap_exceeded";
      error.statusCode = 403;
      throw error;
    }
  }

  let duration = input.duration_minutes ?? (requestedCount * 2);
  if (duration <= 0) {
    duration = 60;
  }
  const slug = `custom-${userId ?? "guest"}-${Date.now()}`;
  const testType = input.test_type ?? "sectional_test";
  // Guest-created tests can't use 'private' access (there's no owner to check against),
  // so they're 'free' instead — still only reachable via their own slug/id.
  const accessType = userId ? "private" : "free";

  return transaction(async (client) => {
    const examLevelId = input.exam_level_id ?? (await resolveExamLevelId(client, input.exam_id, input.content_type!));

    // 0. Resolve category specs (any taxonomy level) into concrete question ids,
    // using the same rollup logic as live compiled attempts — falls back to
    // explicit question_ids when no categories were given.
    const questionIds = input.categories?.length
      ? (await resolveCategoriesToQuestions(client, userId, input.exam_id, input.categories)).map((v) => v.question_id)
      : (input.question_ids ?? []);

    if (questionIds.length === 0) {
      const error = new Error("No published questions found matching the selected categories.") as Error & { statusCode?: number };
      error.name = "no_matching_questions";
      error.statusCode = 404;
      throw error;
    }

    // 1. Create the test template
    const templateResult = await client.query<{ id: number }>(
      `
        insert into assessment.test_templates
          (title, slug, description, exam_id, exam_level_id, test_type, duration_minutes, total_marks, access_type, status, created_by_user_id, source)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'published', $10, 'custom_test')
        returning id, title, slug, description, exam_id, exam_level_id, test_type, duration_minutes, total_marks, access_type, status, created_by_user_id, source
      `,
      [
        input.title,
        slug,
        input.description ?? null,
        input.exam_id,
        examLevelId,
        testType,
        duration,
        questionIds.length, // initial fallback for total_marks
        accessType,
        userId
      ]
    );
    const templateId = templateResult.rows[0]?.id;
    if (!templateId) throw new Error("Failed to create custom test template.");

    // 2. Create a default section
    const sectionResult = await client.query<{ id: number }>(
      `
        insert into assessment.test_sections
          (test_template_id, title, display_order)
        values ($1, 'Default Section', 1)
        returning id
      `,
      [templateId]
    );
    const sectionId = sectionResult.rows[0]?.id;
    if (!sectionId) throw new Error("Failed to create custom test section.");

    // 3. Get marks for Mains questions if applicable
    const questionMarksMap = new Map<number, number>();
    if (testType === "mains_test") {
      const marksResult = await client.query<{ question_id: number; marks: number }>(
        `
          select question_id, marks
          from assessment.mains_question_details
          where question_id = any($1)
        `,
        [questionIds]
      );
      marksResult.rows.forEach((row) => {
        questionMarksMap.set(row.question_id, Number(row.marks) || 10.0);
      });
    }

    // 4. Get current versions of selected question IDs
    const versionsResult = await client.query<{ id: number; question_id: number }>(
      `
        select id, question_id
        from assessment.question_versions
        where question_id = any($1) and is_current = true
      `,
      [questionIds]
    );

    // 5. Insert question items and calculate actual total marks
    let totalMarks = 0;
    for (let i = 0; i < versionsResult.rows.length; i++) {
      const row = versionsResult.rows[i];
      if (!row) continue;
      const qid = row.question_id;
      const marks = testType === "mains_test" ? (questionMarksMap.get(qid) ?? 10.0) : 1.0;
      totalMarks += marks;

      await client.query(
        `
          insert into assessment.test_question_items
            (test_template_id, test_section_id, question_version_id, marks, negative_marks, display_order)
          values ($1, $2, $3, $4, 0.0, $5)
        `,
        [templateId, sectionId, row.id, marks, i + 1]
      );
    }

    // 6. Update the total marks of the template to match actual marks
    await client.query(
      `
        update assessment.test_templates
        set total_marks = $1
        where id = $2
      `,
      [totalMarks, templateId]
    );

    return {
      id: templateId,
      ...templateResult.rows[0],
      total_marks: totalMarks
    };
  });
}

export async function addQuestionsToUserTest(
  userId: number,
  testId: number,
  questionIds: number[],
  categories?: CategorySelectionSpec[]
): Promise<any> {
  if (!questionIds.length && !categories?.length) return { success: true, count: 0 };

  return transaction(async (client) => {
    // 1. Get the template and check ownership and attempts
    const template = await client.query<{ created_by_user_id: number; access_type: string; test_type: string; exam_id: number }>(
      `
        select created_by_user_id, access_type, test_type, exam_id
        from assessment.test_templates
        where id = $1
      `,
      [testId]
    );

    if (template.rows.length === 0) {
      throw new Error("Test template not found.");
    }

    const row = template.rows[0];
    if (!row) {
      throw new Error("Test template not found.");
    }
    if (row.access_type !== "private" || row.created_by_user_id !== userId) {
      throw new Error("You do not have permission to modify this test.");
    }

    // Check if there are any attempts on this test
    const attempts = await client.query(
      `
        select id from assessment.test_attempts
        where test_template_id = $1 limit 1
      `,
      [testId]
    );

    if (attempts.rows.length > 0) {
      throw new Error("Cannot add questions to a test that has already been attempted.");
    }

    // Resolve category specs (any taxonomy level) into concrete question ids,
    // same rollup logic as createUserCustomTest / live compiled attempts.
    // Excludes questions already in this test so re-adding from a category
    // that overlaps with what's already there doesn't hit a duplicate-item
    // constraint.
    let resolvedQuestionIds = questionIds;
    if (categories?.length) {
      const existingRes = await client.query<{ question_id: number }>(
        `
          select qv.question_id
          from assessment.test_question_items tqi
          join assessment.question_versions qv on qv.id = tqi.question_version_id
          where tqi.test_template_id = $1
        `,
        [testId]
      );
      const existingQuestionIds = existingRes.rows.map((r) => Number(r.question_id));
      const resolved = await resolveCategoriesToQuestions(client, userId, row.exam_id, categories, existingQuestionIds);
      if (resolved.length === 0) {
        const error = new Error("No published questions found matching the selected categories.") as Error & { statusCode?: number };
        error.name = "no_matching_questions";
        error.statusCode = 404;
        throw error;
      }
      resolvedQuestionIds = resolved.map((v) => v.question_id);
    }
    if (resolvedQuestionIds.length === 0) return { success: true, count: 0 };

    // 2. Get default section
    let sectionId: number;
    const sectionResult = await client.query<{ id: number }>(
      `
        select id from assessment.test_sections
        where test_template_id = $1
        order by display_order asc limit 1
      `,
      [testId]
    );

    if (sectionResult.rows.length > 0 && sectionResult.rows[0]) {
      sectionId = sectionResult.rows[0].id;
    } else {
      // Create default section if it doesn't exist
      const newSection = await client.query<{ id: number }>(
        `
          insert into assessment.test_sections (test_template_id, title, display_order)
          values ($1, 'Default Section', 1)
          returning id
        `,
        [testId]
      );
      const newSectionRow = newSection.rows[0];
      if (!newSectionRow) throw new Error("Failed to create default section.");
      sectionId = newSectionRow.id;
    }

    // 3. Get current display_order offset
    const maxOrderResult = await client.query<{ max_order: number }>(
      `
        select coalesce(max(display_order), 0)::integer as max_order
        from assessment.test_question_items
        where test_template_id = $1 and test_section_id = $2
      `,
      [testId, sectionId]
    );
    const maxOrderRow = maxOrderResult.rows[0];
    const orderOffset = maxOrderRow ? maxOrderRow.max_order : 0;

    // 4. Resolve current versions of selected question IDs
    const versionsResult = await client.query<{ id: number; question_id: number }>(
      `
        select id, question_id
        from assessment.question_versions
        where question_id = any($1) and is_current = true
      `,
      [resolvedQuestionIds]
    );

    // 5. Get marks for Mains questions if applicable
    const questionMarksMap = new Map<number, number>();
    if (row.test_type === "mains_test") {
      const marksResult = await client.query<{ question_id: number; marks: number }>(
        `
          select question_id, marks
          from assessment.mains_question_details
          where question_id = any($1)
        `,
        [resolvedQuestionIds]
      );
      marksResult.rows.forEach((r) => {
        questionMarksMap.set(r.question_id, Number(r.marks) || 10.0);
      });
    }

    // 6. Insert new items
    let addedMarks = 0;
    for (let i = 0; i < versionsResult.rows.length; i++) {
      const versionRow = versionsResult.rows[i];
      if (!versionRow) continue;
      const qid = versionRow.question_id;
      const marks = row.test_type === "mains_test" ? (questionMarksMap.get(qid) ?? 10.0) : 1.0;
      addedMarks += marks;

      await client.query(
        `
          insert into assessment.test_question_items
            (test_template_id, test_section_id, question_version_id, marks, negative_marks, display_order)
          values ($1, $2, $3, $4, 0.0, $5)
        `,
        [testId, sectionId, versionRow.id, marks, orderOffset + i + 1]
      );
    }

    // 7. Update total marks
    await client.query(
      `
        update assessment.test_templates
        set total_marks = total_marks + $1,
            duration_minutes = duration_minutes + $2
        where id = $3
      `,
      [addedMarks, versionsResult.rows.length * 2, testId]
    );

    return {
      success: true,
      added_count: versionsResult.rows.length,
      added_marks: addedMarks
    };
  });
}



