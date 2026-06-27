import type { PoolClient } from "pg";
import { one, transaction } from "../../db.js";
import type { UserRole } from "../auth/schemas.js";
import { userHasActivePlan } from "../billing/service.js";
import type { StartAttemptInput, UpsertAttemptResponseInput, StartDynamicAttemptInput, StartCompiledAttemptInput } from "./schemas.js";

function noMatchingQuestions(message: string): never {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 404;
  throw error;
}

async function resolveStoredExamLevelId(
  client: PoolClient,
  examId: number,
  requestedExamLevelId?: number
): Promise<number> {
  if (requestedExamLevelId) return requestedExamLevelId;

  const result = await client.query<{ id: number }>(
    `
      select id
      from assessment.exam_levels
      where exam_id = $1
        and is_active = true
      order by display_order asc, id asc
      limit 1
    `,
    [examId]
  );

  const fallbackId = result.rows[0]?.id;
  if (!fallbackId) {
    const error = new Error("No default exam setup exists for this exam profile.") as Error & { statusCode?: number };
    error.statusCode = 409;
    throw error;
  }

  return Number(fallbackId);
}

export async function startAttempt(
  testTemplateId: number,
  input: StartAttemptInput,
  user: { id: number; role: UserRole }
): Promise<unknown | null> {
  void input;

  const test = await one<{
    id: string;
    status: string;
    access_type: string;
    subscription_plan_id: string | null;
    created_by_user_id: string | null;
  }>(
    `
      select id, status, access_type, subscription_plan_id, created_by_user_id
      from assessment.test_templates
      where id = $1
    `,
    [testTemplateId]
  );

  if (!test) return null;

  const isPrivileged = ["admin", "moderator", "content_editor"].includes(user.role);
  if (test.status !== "published" && !isPrivileged) {
    const error = new Error("This test is not published.") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  if (!isPrivileged && test.access_type === "subscription") {
    const hasAccess = await userHasActivePlan(user.id, test.subscription_plan_id);
    if (!hasAccess) {
      const error = new Error("Active subscription required for this test.") as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }
  }

  if (!isPrivileged && ["paid", "private"].includes(test.access_type)) {
    if (test.access_type === "private" && Number(test.created_by_user_id) === user.id) {
      // Allow creator
    } else {
      const error = new Error("You do not have access to this test.") as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }
  }

  return one(
    `
      insert into assessment.test_attempts
        (user_id, test_template_id, expires_at)
      select $1, tt.id, now() + make_interval(mins => tt.duration_minutes)
      from assessment.test_templates tt
      where tt.id = $2
      returning *
    `,
    [user.id, testTemplateId]
  );
}

export async function getAttempt(id: number, user?: { id: number; role: UserRole }): Promise<unknown | null> {
  const userFilter = user && !["admin", "moderator"].includes(user.role) ? "and ta.user_id = $2" : "";
  const params: unknown[] = userFilter ? [id, user?.id] : [id];
  return one(
    `
      select
        ta.*,
        coalesce(
          jsonb_agg(distinct jsonb_build_object(
            'id', ar.id,
            'question_version_id', ar.question_version_id,
            'selected_answer', ar.selected_answer,
            'answer_text', ar.answer_text,
            'status', ar.status,
            'is_marked_for_review', ar.is_marked_for_review,
            'time_spent_seconds', ar.time_spent_seconds,
            'answered_at', ar.answered_at,
            'updated_at', ar.updated_at
          )) filter (where ar.id is not null),
          '[]'::jsonb
        ) as responses,
        row_to_json(tr.*) as result
      from assessment.test_attempts ta
      left join assessment.attempt_responses ar on ar.attempt_id = ta.id
      left join assessment.test_results tr on tr.attempt_id = ta.id
      where ta.id = $1
        ${userFilter}
      group by ta.id, tr.id
    `,
    params
  );
}

export async function upsertAttemptResponse(
  attemptId: number,
  input: UpsertAttemptResponseInput,
  user: { id: number; role: UserRole }
): Promise<unknown> {
  if (!["admin", "moderator"].includes(user.role)) {
    const attempt = await one<{ id: string; status: string }>(
      `
        select id, status
        from assessment.test_attempts
        where id = $1
          and user_id = $2
      `,
      [attemptId, user.id]
    );
    if (!attempt) {
      const error = new Error("Attempt not found.") as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }
    if (attempt.status !== "in_progress") {
      const error = new Error("Cannot update responses after submission.") as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }
  }

  const status =
    input.status ??
    (input.selected_answer !== undefined || input.answer_text ? "answered" : "not_visited");

  return one(
    `
      insert into assessment.attempt_responses
        (
          attempt_id,
          question_version_id,
          selected_answer,
          answer_text,
          status,
          is_marked_for_review,
          time_spent_seconds,
          answered_at
        )
      values ($1, $2, $3, $4, $5, coalesce($6, false), coalesce($7, 0), case when $5 in ('answered', 'marked_for_review') then now() else null end)
      on conflict (attempt_id, question_version_id)
      do update set
        selected_answer = excluded.selected_answer,
        answer_text = excluded.answer_text,
        status = excluded.status,
        is_marked_for_review = excluded.is_marked_for_review,
        time_spent_seconds = excluded.time_spent_seconds,
        answered_at = excluded.answered_at,
        updated_at = now()
      returning *
    `,
    [
      attemptId,
      input.question_version_id,
      input.selected_answer === undefined ? null : JSON.stringify(input.selected_answer),
      input.answer_text ?? null,
      status,
      input.is_marked_for_review ?? null,
      input.time_spent_seconds ?? null
    ]
  );
}

export async function startDynamicAttempt(
  userId: number,
  input: StartDynamicAttemptInput
): Promise<unknown> {
  return transaction(async (client) => {
    const isMains = input.question_family === "mains_subjective";
    const storedExamLevelId = await resolveStoredExamLevelId(client, input.exam_id, input.exam_level_id);

    // 1. Fetch questions matching criteria
    const params: unknown[] = [input.exam_id, input.subject_node_id];
    let queryText = "";

    if (isMains) {
      const targetNodeId = input.subtopic_node_id || input.topic_node_id || input.subject_node_id;
      params[1] = targetNodeId;
      queryText = `
        with recursive category_nodes as (
          select id from assessment.mains_taxonomy_nodes where id = $2
          union all
          select child.id from assessment.mains_taxonomy_nodes child
          join category_nodes parent on parent.id = child.parent_id
        )
        select q.id, qv.id as version_id, coalesce(mqd.marks, 10.0) as marks
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
      if (input.exam_level_id) {
        params.push(input.exam_level_id);
        queryText += ` and mqtl.exam_level_id = $${params.length}`;
      }
      if (input.question_nature_id) {
        params.push(input.question_nature_id);
        queryText += ` and mqtl.question_nature_id = $${params.length}`;
      }
      if (!input.include_attempted) {
        params.push(userId);
        queryText += `
          and q.id not in (
            select distinct maqv.question_id
            from assessment.mains_answers ma
            join assessment.question_versions maqv on maqv.id = ma.question_version_id
            where ma.user_id = $${params.length}
          )
        `;
      }
    } else {
      queryText = `
        select q.id, qv.id as version_id
        from assessment.questions q
        join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
        join assessment.question_taxonomy_links qtl on qtl.question_id = q.id
        where q.status = 'published'
          and q.question_family = 'objective'
          and qtl.exam_id = $1
          and qtl.subject_node_id = $2
      `;
      if (input.exam_level_id) {
        params.push(input.exam_level_id);
        queryText += ` and qtl.exam_level_id = $${params.length}`;
      }
      if (input.topic_node_id) {
        params.push(input.topic_node_id);
        queryText += ` and qtl.topic_node_id = $${params.length}`;
      }
      if (input.subtopic_node_id) {
        params.push(input.subtopic_node_id);
        queryText += ` and qtl.subtopic_node_id = $${params.length}`;
      }
      if (input.question_nature_id) {
        params.push(input.question_nature_id);
        queryText += ` and qtl.question_nature_id = $${params.length}`;
      }
      if (!input.include_attempted) {
        params.push(userId);
        queryText += `
          and q.id not in (
            select distinct arqv.question_id
            from assessment.attempt_responses ar
            join assessment.test_attempts arta on arta.id = ar.attempt_id
            join assessment.question_versions arqv on arqv.id = ar.question_version_id
            where arta.user_id = $${params.length}
          )
        `;
      }
    }

    params.push(input.question_count);
    queryText += `
      order by random()
      limit $${params.length}
    `;

    const questionsRes = await client.query<{ id: number; version_id: number; marks?: number }>(queryText, params);
    
    if (questionsRes.rows.length === 0) {
      noMatchingQuestions("No published questions found for the selected syllabus criteria. Try a different node or generate questions first.");
    }

    // Resolve passages and package passage-linked questions
    const selectedQuestionIds = questionsRes.rows.map(r => Number(r.id));
    const passageLinksRes = selectedQuestionIds.length > 0 ? await client.query<{ question_id: string; passage_id: string }>(
      `
        select question_id, passage_id
        from assessment.passage_questions
        where question_id = any($1)
      `,
      [selectedQuestionIds]
    ) : { rows: [] };

    const passageIdMap = new Map<number, number>();
    const passageIds = new Set<number>();
    passageLinksRes.rows.forEach(row => {
      const qId = Number(row.question_id);
      const pId = Number(row.passage_id);
      passageIdMap.set(qId, pId);
      passageIds.add(pId);
    });

    const allPassageQuestionsRes = passageIds.size > 0 ? await client.query<{
      passage_id: string;
      question_id: string;
      version_id: string;
      display_order: number;
    }>(
      `
        select
          pq.passage_id,
          pq.question_id,
          qv.id as version_id,
          pq.display_order
        from assessment.passage_questions pq
        join assessment.question_versions qv on qv.question_id = pq.question_id and qv.is_current = true
        where pq.passage_id = any($1)
        order by pq.passage_id, pq.display_order, pq.id
      `,
      [Array.from(passageIds)]
    ) : { rows: [] };

    const passageQuestionsMap = new Map<number, Array<{ question_id: number; version_id: number }>>();
    allPassageQuestionsRes.rows.forEach(row => {
      const pId = Number(row.passage_id);
      if (!passageQuestionsMap.has(pId)) {
        passageQuestionsMap.set(pId, []);
      }
      passageQuestionsMap.get(pId)!.push({
        question_id: Number(row.question_id),
        version_id: Number(row.version_id)
      });
    });

    const finalQuestions: Array<{ id: number; version_id: number; marks?: number }> = [];
    const addedPassages = new Set<number>();
    const addedQuestionIds = new Set<number>();

    for (const row of questionsRes.rows) {
      const qId = Number(row.id);
      const pId = passageIdMap.get(qId);

      if (pId !== undefined) {
        if (!addedPassages.has(pId)) {
          const passageQs = passageQuestionsMap.get(pId) || [];
          passageQs.forEach(pq => {
            if (!addedQuestionIds.has(pq.question_id)) {
              finalQuestions.push({
                id: pq.question_id,
                version_id: pq.version_id
              });
              addedQuestionIds.add(pq.question_id);
            }
          });
          addedPassages.add(pId);
        }
      } else {
        if (!addedQuestionIds.has(qId)) {
          finalQuestions.push({
            id: qId,
            version_id: Number(row.version_id),
            marks: row.marks
          });
          addedQuestionIds.add(qId);
        }
      }
    }

    // 2. Create a temporary template
    const slug = `dynamic-${userId}-${Date.now()}`;
    const duration = input.test_type === "quick_test" ? 15 : input.test_type === "sectional_test" ? 45 : 120;
    const testType = isMains ? "mains_test" : input.test_type;
    const marksPerQuestion = isMains ? 10.0 : 2.0;
    const totalMarks = finalQuestions.reduce((acc, row) => acc + Number(row.marks ?? marksPerQuestion), 0);
    const title = isMains ? `Dynamic Mains Practice (${duration} Mins)` : `Dynamic Quiz (${duration} Mins)`;

    const templateRes = await client.query<{ id: number }>(
      `
        insert into assessment.test_templates
          (title, slug, description, exam_id, exam_level_id, test_type, duration_minutes, total_marks, access_type, status, created_by_user_id)
        values ($1, $2, 'Dynamically generated practice session.', $3, $4, $5, $6, $7, 'free', 'published', $8)
        returning id
      `,
      [title, slug, input.exam_id, storedExamLevelId, testType, duration, totalMarks, userId]
    );

    const templateId = templateRes.rows[0]?.id;
    if (!templateId) throw new Error("Failed to create temporary template.");

    // 3. Create section
    const sectionRes = await client.query<{ id: number }>(
      `insert into assessment.test_sections (test_template_id, title, display_order) values ($1, 'Section 1', 1) returning id`,
      [templateId]
    );
    const sectionId = sectionRes.rows[0]?.id;

    // 4. Link questions
    for (let i = 0; i < finalQuestions.length; i++) {
      const q = finalQuestions[i];
      if (q) {
        const marks = isMains ? Number(q.marks ?? 10.0) : 2.0;
        const negativeMarks = isMains ? 0.0 : 0.66;
        await client.query(
          `
            insert into assessment.test_question_items
              (test_template_id, test_section_id, question_version_id, marks, negative_marks, display_order)
            values ($1, $2, $3, $4, $5, $6)
          `,
          [templateId, sectionId, q.version_id, marks, negativeMarks, i + 1]
        );
      }
    }

    // 5. Create attempt
    const attemptRes = await client.query(
      `
        insert into assessment.test_attempts
          (user_id, test_template_id, expires_at)
        values ($1, $2, now() + make_interval(mins => $3))
        returning *
      `,
      [userId, templateId, duration]
    );

    return attemptRes.rows[0];
  });
}

export async function startCompiledAttempt(
  userId: number,
  input: StartCompiledAttemptInput
): Promise<unknown> {
  return transaction(async (client) => {
    const selectedVersions: Array<{ question_id: number; version_id: number; marks: number; negative_marks: number; question_family: string }> = [];
    const storedExamLevelId = await resolveStoredExamLevelId(client, input.exam_id, input.exam_level_id);

    // 1. Fetch questions matching each category specs
    for (const cat of input.categories) {
      const isMains = cat.question_family === "mains_subjective";
      const params: unknown[] = [input.exam_id, cat.subject_node_id];
      let queryText = "";

      if (isMains) {
        const targetNodeId = cat.subtopic_node_id || cat.topic_node_id || cat.subject_node_id;
        params[1] = targetNodeId;
        queryText = `
          with recursive category_nodes as (
            select id from assessment.mains_taxonomy_nodes where id = $2
            union all
            select child.id from assessment.mains_taxonomy_nodes child
            join category_nodes parent on parent.id = child.parent_id
          )
          select q.id, qv.id as version_id, coalesce(mqd.marks, 10.0) as marks
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
        if (input.exam_level_id) {
          params.push(input.exam_level_id);
          queryText += ` and mqtl.exam_level_id = $${params.length}`;
        }
        if (cat.question_nature_id) {
          params.push(cat.question_nature_id);
          queryText += ` and mqtl.question_nature_id = $${params.length}`;
        }
        if (!input.include_attempted) {
          params.push(userId);
          queryText += `
            and q.id not in (
              select distinct maqv.question_id
              from assessment.mains_answers ma
              join assessment.question_versions maqv on maqv.id = ma.question_version_id
              where ma.user_id = $${params.length}
            )
          `;
        }
      } else {
        queryText = `
          select q.id, qv.id as version_id
          from assessment.questions q
          join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
          join assessment.question_taxonomy_links qtl on qtl.question_id = qv.question_id
          where q.status = 'published'
            and q.question_family = 'objective'
            and qtl.exam_id = $1
            and qtl.subject_node_id = $2
        `;
        if (input.exam_level_id) {
          params.push(input.exam_level_id);
          queryText += ` and qtl.exam_level_id = $${params.length}`;
        }
        if (cat.topic_node_id) {
          params.push(cat.topic_node_id);
          queryText += ` and qtl.topic_node_id = $${params.length}`;
        }
        if (cat.subtopic_node_id) {
          params.push(cat.subtopic_node_id);
          queryText += ` and qtl.subtopic_node_id = $${params.length}`;
        }
        if (cat.question_nature_id) {
          params.push(cat.question_nature_id);
          queryText += ` and qtl.question_nature_id = $${params.length}`;
        }
        if (!input.include_attempted) {
          params.push(userId);
          queryText += `
            and q.id not in (
              select distinct arqv.question_id
              from assessment.attempt_responses ar
              join assessment.test_attempts arta on arta.id = ar.attempt_id
              join assessment.question_versions arqv on arqv.id = ar.question_version_id
              where arta.user_id = $${params.length}
            )
          `;
        }
      }

      params.push(cat.question_count);
      queryText += `
        order by random()
        limit $${params.length}
      `;

      const res = await client.query<{ id: number; version_id: number; marks?: number }>(queryText, params);
      if (res.rows.length === 0) {
        noMatchingQuestions("No published questions found for one of the selected compiled-test categories. Try a different syllabus node or generate questions first.");
      }
      for (const row of res.rows) {
        selectedVersions.push({
          question_id: Number(row.id),
          version_id: Number(row.version_id),
          marks: isMains ? Number(row.marks ?? 10.0) : 2.0,
          negative_marks: isMains ? 0.0 : 0.66,
          question_family: cat.question_family ?? "objective"
        });
      }
    }

    if (selectedVersions.length === 0) {
      noMatchingQuestions("No published questions found matching your compiled-test criteria. Try a different syllabus node or generate questions first.");
    }

    // Resolve passages and package passage-linked questions
    const selectedQuestionIds = selectedVersions.map(v => v.question_id);
    const passageLinksRes = selectedQuestionIds.length > 0 ? await client.query<{ question_id: string; passage_id: string }>(
      `
        select question_id, passage_id
        from assessment.passage_questions
        where question_id = any($1)
      `,
      [selectedQuestionIds]
    ) : { rows: [] };

    const passageIdMap = new Map<number, number>();
    const passageIds = new Set<number>();
    passageLinksRes.rows.forEach(row => {
      const qId = Number(row.question_id);
      const pId = Number(row.passage_id);
      passageIdMap.set(qId, pId);
      passageIds.add(pId);
    });

    const allPassageQuestionsRes = passageIds.size > 0 ? await client.query<{
      passage_id: string;
      question_id: string;
      version_id: string;
      display_order: number;
    }>(
      `
        select
          pq.passage_id,
          pq.question_id,
          qv.id as version_id,
          pq.display_order
        from assessment.passage_questions pq
        join assessment.question_versions qv on qv.question_id = pq.question_id and qv.is_current = true
        where pq.passage_id = any($1)
        order by pq.passage_id, pq.display_order, pq.id
      `,
      [Array.from(passageIds)]
    ) : { rows: [] };

    const passageQuestionsMap = new Map<number, Array<{ question_id: number; version_id: number }>>();
    allPassageQuestionsRes.rows.forEach(row => {
      const pId = Number(row.passage_id);
      if (!passageQuestionsMap.has(pId)) {
        passageQuestionsMap.set(pId, []);
      }
      passageQuestionsMap.get(pId)!.push({
        question_id: Number(row.question_id),
        version_id: Number(row.version_id)
      });
    });

    const finalVersions: Array<{
      question_id: number;
      version_id: number;
      marks: number;
      negative_marks: number;
      question_family: string;
    }> = [];
    const addedPassages = new Set<number>();
    const addedQuestionIds = new Set<number>();

    for (const v of selectedVersions) {
      const qId = v.question_id;
      const pId = passageIdMap.get(qId);

      if (pId !== undefined) {
        if (!addedPassages.has(pId)) {
          const passageQs = passageQuestionsMap.get(pId) || [];
          passageQs.forEach(pq => {
            if (!addedQuestionIds.has(pq.question_id)) {
              finalVersions.push({
                question_id: pq.question_id,
                version_id: pq.version_id,
                marks: 2.0,
                negative_marks: 0.66,
                question_family: "objective"
              });
              addedQuestionIds.add(pq.question_id);
            }
          });
          addedPassages.add(pId);
        }
      } else {
        if (!addedQuestionIds.has(qId)) {
          finalVersions.push(v);
          addedQuestionIds.add(qId);
        }
      }
    }

    // 2. Determine test characteristics
    const duration = input.test_type === "quick_test" ? 15 : input.test_type === "sectional_test" ? 45 : 120;
    
    // Check if there are any mains questions
    const hasMains = finalVersions.some(v => v.question_family === "mains_subjective");
    const testType = hasMains ? "mains_test" : input.test_type;
    const totalMarks = finalVersions.reduce((acc, v) => acc + v.marks, 0);
    const title = `Compiled Test (${finalVersions.length} Qs)`;
    const slug = `compiled-${userId}-${Date.now()}`;

    // 3. Create test template
    const templateRes = await client.query<{ id: number }>(
      `
        insert into assessment.test_templates
          (title, slug, description, exam_id, exam_level_id, test_type, duration_minutes, total_marks, access_type, status, created_by_user_id)
        values ($1, $2, 'Custom compiled test session.', $3, $4, $5, $6, $7, 'free', 'published', $8)
        returning id
      `,
      [title, slug, input.exam_id, storedExamLevelId, testType, duration, totalMarks, userId]
    );

    const templateId = templateRes.rows[0]?.id;
    if (!templateId) throw new Error("Failed to create temporary template.");

    // 4. Create section
    const sectionRes = await client.query<{ id: number }>(
      `insert into assessment.test_sections (test_template_id, title, display_order) values ($1, 'Section 1', 1) returning id`,
      [templateId]
    );
    const sectionId = sectionRes.rows[0]?.id;

    // 5. Link questions
    for (let i = 0; i < finalVersions.length; i++) {
      const q = finalVersions[i];
      if (q) {
        await client.query(
          `
            insert into assessment.test_question_items
              (test_template_id, test_section_id, question_version_id, marks, negative_marks, display_order)
            values ($1, $2, $3, $4, $5, $6)
          `,
          [templateId, sectionId, q.version_id, q.marks, q.negative_marks, i + 1]
        );
      }
    }

    // 6. Create attempt
    const attemptRes = await client.query(
      `
        insert into assessment.test_attempts
          (user_id, test_template_id, expires_at)
        values ($1, $2, now() + make_interval(mins => $3))
        returning *
      `,
      [userId, templateId, duration]
    );

    return attemptRes.rows[0];
  });
}

export async function startSingleMainsQuestionAttempt(
  userId: number,
  questionId: number
): Promise<any> {
  return transaction(async (client) => {
    // 1. Fetch the question version and details
    const questionRes = await client.query<{
      version_id: number;
      question_statement: string;
      marks: number;
      exam_id: number;
      exam_level_id: number | null;
    }>(
      `
        select qv.id as version_id, qv.question_statement, coalesce(mqd.marks, 15.0) as marks,
               mqtl.exam_id, mqtl.exam_level_id
        from assessment.questions q
        join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
        left join assessment.mains_question_taxonomy_links mqtl on mqtl.question_id = q.id
        left join assessment.mains_question_details mqd on mqd.question_id = q.id
        where q.id = $1 and q.question_family = 'mains_subjective'
        limit 1
      `,
      [questionId]
    );

    const question = questionRes.rows[0];
    if (!question) {
      throw new Error("Mains question not found or is not subjective.");
    }

    // 2. Create a temporary template
    const slug = `mains-single-${userId}-${questionId}-${Date.now()}`;
    const duration = 45; // Default duration of 45 mins
    const testType = "mains_test";
    const totalMarks = question.marks;
    const title = question.question_statement.length > 50 
      ? `${question.question_statement.substring(0, 47)}...` 
      : question.question_statement;

    const templateRes = await client.query<{ id: number }>(
      `
        insert into assessment.test_templates
          (title, slug, description, exam_id, exam_level_id, test_type, duration_minutes, total_marks, access_type, status, created_by_user_id)
        values ($1, $2, 'Single question subjective practice canvas.', $3, $4, $5, $6, $7, 'free', 'published', $8)
        returning id
      `,
      [title, slug, question.exam_id || 1, question.exam_level_id, testType, duration, totalMarks, userId]
    );

    const templateId = templateRes.rows[0]?.id;
    if (!templateId) throw new Error("Failed to create temporary template.");

    // 3. Create section
    const sectionRes = await client.query<{ id: number }>(
      `insert into assessment.test_sections (test_template_id, title, display_order) values ($1, 'Section 1', 1) returning id`,
      [templateId]
    );
    const sectionId = sectionRes.rows[0]?.id;

    // 4. Link question
    await client.query(
      `
        insert into assessment.test_question_items
          (test_template_id, test_section_id, question_version_id, marks, negative_marks, display_order)
        values ($1, $2, $3, $4, $5, $6)
      `,
      [templateId, sectionId, question.version_id, question.marks, 0.0, 1]
    );

    // 5. Create attempt
    const attemptRes = await client.query<{ id: number }>(
      `
        insert into assessment.test_attempts
          (user_id, test_template_id, expires_at)
        values ($1, $2, now() + make_interval(mins => $3))
        returning *
      `,
      [userId, templateId, duration]
    );

    return attemptRes.rows[0];
  });
}
