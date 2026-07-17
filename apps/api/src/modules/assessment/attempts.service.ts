import type { PoolClient } from "pg";
import { one, transaction } from "../../db.js";
import type { UserRole } from "../auth/schemas.js";
import { userHasActivePlan, getUserEntitlements } from "../billing/service.js";
import type { StartAttemptInput, UpsertAttemptResponseInput, StartDynamicAttemptInput, StartCompiledAttemptInput } from "./schemas.js";
import { backfillStudentTopicMetricsForResult } from "./scoring.service.js";
import { getQuestionCap } from "./question-caps.js";

async function assertWithinQuestionCap(userId: number, questionCount: number, isMains: boolean): Promise<void> {
  const entitlements = await getUserEntitlements(userId);
  const hasPremium = entitlements.some((e) => e.entitlement_key === "assessment.premium_tests");
  const cap = getQuestionCap(hasPremium, isMains);
  if (questionCount > cap) {
    forbidden(
      `${isMains ? "Mains" : "GK/CSAT"} tests are limited to ${cap} questions${hasPremium ? " on Assessment Premium" : " on the free tier"}.${hasPremium ? "" : " Upgrade to Assessment Premium for a higher limit."}`,
      "question_cap_exceeded"
    );
  }
}

/**
 * Wraps a "select ... from ... where ..." query (built without any trailing
 * order/limit) so the final N rows are drawn as an even spread across each
 * question's most specific taxonomy group, instead of one flat random draw
 * across the whole matched pool — which silently over-represents whichever
 * sub-category happens to have the most published questions. Each group is
 * capped at ceil(N / groupCount), then the combined, still-oversized pool is
 * randomly trimmed down to exactly N (or fewer, if the pool itself is
 * smaller than N), so the final set stays evenly spread rather than biased
 * toward the largest group.
 */
export function buildStratifiedSelectionQuery(options: {
  // Body of an extra CTE (e.g. "category_nodes as (select id from ... union all ...)")
  // that `fromAndWhere` can reference via "in (select id from category_nodes)".
  // Kept as a real CTE (not a joined subquery) so it's checked as membership,
  // not cross-joined — a cross join would duplicate a question's row once
  // per matching category_nodes row when more than one of its taxonomy
  // columns matches, throwing off the stratification counts below.
  recursiveCte?: string;
  selectColumns: string;
  outputColumns: string;
  strataExpr: string;
  fromAndWhere: string;
  limitParamPlaceholder: string;
}): string {
  const { recursiveCte, selectColumns, outputColumns, strataExpr, fromAndWhere, limitParamPlaceholder } = options;
  // Note: count(distinct x) over (...) is not valid Postgres (DISTINCT isn't
  // supported inside window functions), so strata_count is computed as its
  // own single-row CTE and cross joined in — safe since it's always exactly
  // one row.
  return `
    with ${recursiveCte ? `recursive ${recursiveCte},` : ""} matched as (
      select ${selectColumns}, ${strataExpr} as strata_id
      ${fromAndWhere}
    ),
    strata_meta as (
      select count(distinct strata_id) as strata_count from matched
    ),
    ranked as (
      select ${outputColumns}, strata_id,
             row_number() over (partition by strata_id order by random()) as rn
      from matched
    )
    select ${outputColumns}
    from ranked, strata_meta
    where rn <= ceil(${limitParamPlaceholder}::numeric / greatest(strata_meta.strata_count, 1))
    order by random()
    limit ${limitParamPlaceholder}
  `;
}

/** Either a real authenticated user, or an unauthenticated guest identified by an
 * opaque client-generated token. Exactly one of the two is expected to be set. */
export type AttemptIdentity = {
  user: { id: number; role: UserRole } | null;
  guestToken: string | null;
};

function noMatchingQuestions(message: string): never {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 404;
  throw error;
}

function unauthorized(message: string): never {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 401;
  throw error;
}

function forbidden(message: string, code?: string): never {
  const error = new Error(message) as Error & { statusCode?: number };
  if (code) error.name = code;
  error.statusCode = 403;
  throw error;
}

function notFound(message: string): never {
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
  identity: AttemptIdentity
): Promise<unknown | null> {
  void input;

  if (!identity.user && !identity.guestToken) {
    unauthorized("Sign in or start a guest session to take this test.");
  }

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

  const user = identity.user;
  const isPrivileged = !!user && ["admin", "moderator", "content_editor"].includes(user.role);

  if (!user) {
    // Guests may only take published, free tests — no subscription/paid/private access.
    if (test.status !== "published" || test.access_type !== "free") {
      forbidden("Sign in to access this test.");
    }
  } else {
    if (test.status !== "published" && !isPrivileged) {
      forbidden("This test is not published.");
    }

    if (!isPrivileged && test.access_type === "subscription") {
      const hasAccess = await userHasActivePlan(user.id, test.subscription_plan_id);
      if (!hasAccess) {
        forbidden("Active subscription required for this test.");
      }
    }

    if (!isPrivileged && ["paid", "private"].includes(test.access_type)) {
      if (test.access_type === "private" && Number(test.created_by_user_id) === user.id) {
        // Allow creator
      } else {
        forbidden("You do not have access to this test.");
      }
    }
  }

  return one(
    `
      insert into assessment.test_attempts
        (user_id, guest_token, test_template_id, expires_at)
      select $1, $2, tt.id, now() + make_interval(mins => tt.duration_minutes)
      from assessment.test_templates tt
      where tt.id = $3
      returning *
    `,
    [user?.id ?? null, user ? null : identity.guestToken, testTemplateId]
  );
}

export async function getAttempt(id: number, identity?: AttemptIdentity): Promise<unknown | null> {
  const isPrivileged = !!identity?.user && ["admin", "moderator"].includes(identity.user.role);
  let userFilter = "";
  const params: unknown[] = [id];
  if (!isPrivileged) {
    if (identity?.user) {
      userFilter = "and ta.user_id = $2";
      params.push(identity.user.id);
    } else if (identity?.guestToken) {
      userFilter = "and ta.guest_token = $2";
      params.push(identity.guestToken);
    } else {
      userFilter = "and false";
    }
  }
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
  identity: AttemptIdentity
): Promise<unknown> {
  const isPrivileged = !!identity.user && ["admin", "moderator"].includes(identity.user.role);
  if (!isPrivileged) {
    if (!identity.user && !identity.guestToken) {
      unauthorized("Sign in or start a guest session to answer this test.");
    }
    const ownerClause = identity.user ? "user_id = $2" : "guest_token = $2";
    const ownerValue = identity.user ? identity.user.id : identity.guestToken;
    const attempt = await one<{ id: string; status: string }>(
      `
        select id, status
        from assessment.test_attempts
        where id = $1
          and ${ownerClause}
      `,
      [attemptId, ownerValue]
    );
    if (!attempt) {
      notFound("Attempt not found.");
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
  const isMainsRequest = input.question_family === "mains_subjective";
  await assertWithinQuestionCap(userId, input.question_count, isMainsRequest);

  return transaction(async (client) => {
    const isMains = isMainsRequest;
    const storedExamLevelId = await resolveStoredExamLevelId(client, input.exam_id, input.exam_level_id);

    // 1. Fetch questions matching criteria
    const params: unknown[] = [input.exam_id, input.subject_node_id];
    let fromAndWhere = "";
    let selectColumns = "";
    let outputColumns = "";
    let strataExpr = "";
    let recursiveCte: string | undefined;

    if (isMains) {
      const targetNodeId = input.subtopic_node_id || input.topic_node_id || input.subject_node_id;
      params[1] = targetNodeId;
      selectColumns = "q.id, qv.id as version_id, coalesce(mqd.marks, 10.0) as marks";
      outputColumns = "id, version_id, marks";
      strataExpr = "coalesce(mqtl.subtopic_node_id, mqtl.topic_node_id, mqtl.theme_node_id, mqtl.subject_area_node_id, mqtl.paper_node_id)";
      recursiveCte = `
        category_nodes as (
          select id from assessment.mains_taxonomy_nodes where id = $2
          union all
          select child.id from assessment.mains_taxonomy_nodes child
          join category_nodes parent on parent.id = child.parent_id
        )
      `;
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
      if (input.is_user_private) {
        params.push(userId);
        fromAndWhere += ` and q.created_by_user_id = $${params.length}`;
      } else {
        fromAndWhere += ` and (q.created_by_user_id is null or exists (select 1 from app.users u where u.id = q.created_by_user_id and u.role in ('admin', 'moderator', 'content_editor')))`;
      }

      if (input.exam_level_id) {
        params.push(input.exam_level_id);
        fromAndWhere += ` and mqtl.exam_level_id = $${params.length}`;
      }
      if (input.question_nature_id) {
        params.push(input.question_nature_id);
        fromAndWhere += ` and mqtl.question_nature_id = $${params.length}`;
      }
      if (!input.include_attempted) {
        params.push(userId);
        fromAndWhere += `
          and q.id not in (
            select distinct maqv.question_id
            from assessment.mains_answers ma
            join assessment.question_versions maqv on maqv.id = ma.question_version_id
            where ma.user_id = $${params.length}
          )
        `;
      }
    } else {
      selectColumns = "q.id, qv.id as version_id";
      outputColumns = "id, version_id";
      strataExpr = "coalesce(qtl.subtopic_node_id, qtl.topic_node_id, qtl.source_node_id, qtl.subject_node_id)";
      fromAndWhere = `
        from assessment.questions q
        join assessment.question_versions qv on qv.question_id = q.id and qv.is_current = true
        join assessment.question_taxonomy_links qtl on qtl.question_id = q.id
        where q.status = 'published'
          and q.question_family = 'objective'
          and qtl.exam_id = $1
          and qtl.subject_node_id = $2
      `;
      if (input.is_user_private) {
        params.push(userId);
        fromAndWhere += ` and q.created_by_user_id = $${params.length}`;
      } else {
        fromAndWhere += ` and (q.created_by_user_id is null or exists (select 1 from app.users u where u.id = q.created_by_user_id and u.role in ('admin', 'moderator', 'content_editor')))`;
      }

      if (input.exam_level_id) {
        params.push(input.exam_level_id);
        fromAndWhere += ` and qtl.exam_level_id = $${params.length}`;
      }
      if (input.topic_node_id) {
        params.push(input.topic_node_id);
        fromAndWhere += ` and qtl.topic_node_id = $${params.length}`;
      }
      if (input.subtopic_node_id) {
        params.push(input.subtopic_node_id);
        fromAndWhere += ` and qtl.subtopic_node_id = $${params.length}`;
      }
      if (input.question_nature_id) {
        params.push(input.question_nature_id);
        fromAndWhere += ` and qtl.question_nature_id = $${params.length}`;
      }
      if (!input.include_attempted) {
        params.push(userId);
        fromAndWhere += `
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
    const queryText = buildStratifiedSelectionQuery({
      recursiveCte,
      selectColumns,
      outputColumns,
      strataExpr,
      fromAndWhere,
      limitParamPlaceholder: `$${params.length}`
    });

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
          (title, slug, description, exam_id, exam_level_id, test_type, duration_minutes, total_marks, access_type, status, created_by_user_id, source)
        values ($1, $2, 'Dynamically generated practice session.', $3, $4, $5, $6, $7, 'free', 'published', $8, 'dynamic_practice')
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
  const totalRequested = input.categories.reduce((sum, c) => sum + c.question_count, 0);
  const isMainsCart = input.categories.some((c) => c.question_family === "mains_subjective");
  await assertWithinQuestionCap(userId, totalRequested, isMainsCart);

  return transaction(async (client) => {
    const selectedVersions: Array<{ question_id: number; version_id: number; marks: number; negative_marks: number; question_family: string }> = [];
    const storedExamLevelId = await resolveStoredExamLevelId(client, input.exam_id, input.exam_level_id);

    const selectedQuestionIds: number[] = [];

    // 1. Fetch questions matching each category specs
    for (const cat of input.categories) {
      const isMains = cat.question_family === "mains_subjective";
      const targetNodeId = cat.subtopic_node_id || cat.topic_node_id || cat.subject_node_id;
      const params: unknown[] = [input.exam_id, targetNodeId];
      let fromAndWhere = "";
      let selectColumns = "";
      let outputColumns = "";
      let strataExpr = "";
      let recursiveCte: string | undefined;

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
        if (cat.is_user_private) {
          params.push(userId);
          fromAndWhere += ` and q.created_by_user_id = $${params.length}`;
        } else {
          fromAndWhere += ` and (q.created_by_user_id is null or exists (select 1 from app.users u where u.id = q.created_by_user_id and u.role in ('admin', 'moderator', 'content_editor')))`;
        }

        if (input.exam_level_id) {
          params.push(input.exam_level_id);
          fromAndWhere += ` and mqtl.exam_level_id = $${params.length}`;
        }
        if (cat.question_nature_id) {
          params.push(cat.question_nature_id);
          fromAndWhere += ` and mqtl.question_nature_id = $${params.length}`;
        }
        if (!input.include_attempted) {
          params.push(userId);
          fromAndWhere += `
            and q.id not in (
              select distinct maqv.question_id
              from assessment.mains_answers ma
              join assessment.question_versions maqv on maqv.id = ma.question_version_id
              where ma.user_id = $${params.length}
            )
          `;
        }
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
        if (cat.is_user_private) {
          params.push(userId);
          fromAndWhere += ` and q.created_by_user_id = $${params.length}`;
        } else {
          fromAndWhere += ` and (q.created_by_user_id is null or exists (select 1 from app.users u where u.id = q.created_by_user_id and u.role in ('admin', 'moderator', 'content_editor')))`;
        }

        if (input.exam_level_id) {
          params.push(input.exam_level_id);
          fromAndWhere += ` and qtl.exam_level_id = $${params.length}`;
        }
        if (cat.question_nature_id) {
          params.push(cat.question_nature_id);
          fromAndWhere += ` and qtl.question_nature_id = $${params.length}`;
        }
        if (!input.include_attempted) {
          params.push(userId);
          fromAndWhere += `
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
    const allSelectedQuestionIds = selectedVersions.map(v => v.question_id);
    const passageLinksRes = allSelectedQuestionIds.length > 0 ? await client.query<{ question_id: string; passage_id: string }>(
      `
        select question_id, passage_id
        from assessment.passage_questions
        where question_id = any($1)
      `,
      [allSelectedQuestionIds]
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
    const title = input.title || `Compiled Test (${finalVersions.length} Qs)`;
    const slug = `compiled-${userId}-${Date.now()}`;

    // 3. Create test template
    const templateRes = await client.query<{ id: number }>(
      `
        insert into assessment.test_templates
          (title, slug, description, exam_id, exam_level_id, test_type, duration_minutes, total_marks, access_type, status, created_by_user_id, source)
        values ($1, $2, 'Custom compiled test session.', $3, $4, $5, $6, $7, 'free', 'published', $8, 'compiled_practice')
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
          (title, slug, description, exam_id, exam_level_id, test_type, duration_minutes, total_marks, access_type, status, created_by_user_id, source)
        values ($1, $2, 'Single question subjective practice canvas.', $3, $4, $5, $6, $7, 'free', 'published', $8, 'single_mains_question')
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

/** Reassigns a guest-taken attempt to a real account right after the guest registers/logs
 * in, so the test they just finished as a guest becomes visible under their new account. */
export async function claimGuestAttempt(
  attemptId: number,
  guestToken: string,
  userId: number
): Promise<{ id: number; result_id: number | null }> {
  return transaction(async (client) => {
    const attemptRes = await client.query<{
      id: string;
      user_id: string | null;
      guest_token: string | null;
      status: string;
    }>(
      `select id, user_id, guest_token, status from assessment.test_attempts where id = $1 for update`,
      [attemptId]
    );

    const attempt = attemptRes.rows[0];
    if (!attempt) notFound("Attempt not found.");

    if (attempt.user_id !== null) {
      if (Number(attempt.user_id) === userId) {
        // Already claimed by this same account — idempotent no-op.
      } else {
        forbidden("This attempt already belongs to another account.");
      }
    } else {
      if (!attempt.guest_token || attempt.guest_token !== guestToken) {
        forbidden("Guest session does not match this attempt.");
      }

      await client.query(
        `
          update assessment.test_attempts
          set user_id = $2, guest_token = null, claimed_at = now()
          where id = $1
        `,
        [attemptId, userId]
      );
    }

    const resultRes = await client.query<{ id: string }>(
      `select id from assessment.test_results where attempt_id = $1`,
      [attemptId]
    );
    const resultId = resultRes.rows[0]?.id ? Number(resultRes.rows[0].id) : null;

    if (resultId) {
      await backfillStudentTopicMetricsForResult(client, userId, resultId);
    }

    return { id: attemptId, result_id: resultId };
  });
}
