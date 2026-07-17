import type { PoolClient } from "pg";
import { addCondition, addUpdate, requireUpdates } from "../../common/sql.js";
import { one, query, transaction } from "../../db.js";
import { calculateObjectiveScore } from "../assessment/score-calculator.js";
import { upsertStudentTopicMetric } from "../assessment/scoring.service.js";
import type { ScoreItem } from "../assessment/scoring.types.js";
import type { UserRole } from "../auth/schemas.js";
import type {
  CreatePlanItemInput,
  CreateStudyPlanInput,
  CreateStudyPlanQuestionInput,
  CreateStudyPlanTestInput,
  EnrollStudyPlanInput,
  ListStudyPlansQuery,
  ListStudyPlanTestsQuery,
  StartStudyPlanAttemptInput,
  SubmitStudyPlanAttemptInput,
  UpdatePlanItemInput,
  UpdateProgressInput,
  UpdateStudyPlanInput,
  UpdateStudyPlanQuestionInput,
  UpdateStudyPlanTestInput,
  UpsertStudyPlanResponseInput
} from "./schemas.js";

type AuthContext = { id: number; role: UserRole };
type StudyPlanTestType = "prelims_test" | "csat_test" | "mains_test";
type TaxonomyContentType = "gk" | "aptitude";
type StudyPlanQuestionContentMode = "gk" | "aptitude" | "csat_math" | "csat_passage" | "mains";
type TestTemplateMutationContext = {
  id: number;
  exam_id: number;
  test_type: StudyPlanTestType;
};
type StudyPlanQuestionLike = {
  question_family?: "objective" | "mains_subjective";
  subject_node_id?: number | null;
  topic_node_id?: number | null;
  subtopic_node_id?: number | null;
  question_nature_id?: number | null;
  source_payload?: Record<string, unknown> | string | null;
};

function isPrivileged(user?: AuthContext): boolean {
  return Boolean(user && ["admin", "moderator", "content_editor"].includes(user.role));
}

function accessDenied(message: string): never {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 403;
  throw error;
}

function notFound(message: string): never {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 404;
  throw error;
}

function badRequest(message: string): never {
  const error = new Error(message) as Error & { statusCode?: number };
  error.name = "validation_error";
  error.statusCode = 400;
  throw error;
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function expectedTaxonomyContentType(testType: StudyPlanTestType): TaxonomyContentType {
  return testType === "csat_test" ? "aptitude" : "gk";
}

function allowedContentModesForTest(testType: StudyPlanTestType): StudyPlanQuestionContentMode[] {
  if (testType === "prelims_test") return ["gk"];
  if (testType === "csat_test") return ["aptitude", "csat_math", "csat_passage"];
  return ["mains"];
}

function formatStudyPlanTestType(testType: StudyPlanTestType): string {
  if (testType === "prelims_test") return "Prelims test";
  if (testType === "csat_test") return "CSAT test";
  return "Mains test";
}

function formatContentMode(mode: string): string {
  if (mode === "gk") return "Prelims GK";
  if (mode === "aptitude") return "CSAT aptitude";
  if (mode === "csat_math") return "CSAT maths/reasoning";
  if (mode === "csat_passage") return "CSAT passage";
  if (mode === "mains") return "Mains";
  return mode;
}

function isValidId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function readSourcePayload(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function readQuestionContentMode(question: StudyPlanQuestionLike): StudyPlanQuestionContentMode | undefined {
  const payload = readSourcePayload(question.source_payload);
  const mode = payload?.content_mode ?? payload?.content_type;
  if (typeof mode !== "string") return undefined;
  if (["gk", "aptitude", "csat_math", "csat_passage", "mains"].includes(mode)) {
    return mode as StudyPlanQuestionContentMode;
  }
  return undefined;
}

function readNestedRecord(parent: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  const value = parent?.[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function validateMainsPayloadForTest(
  client: PoolClient,
  template: TestTemplateMutationContext,
  question: StudyPlanQuestionLike
): Promise<void> {
  const payload = readSourcePayload(question.source_payload);
  const wordLimit = Number(payload?.word_limit);
  if (payload?.word_limit !== undefined && (!Number.isInteger(wordLimit) || wordLimit <= 0)) {
    badRequest("Mains word limit must be a positive whole number.");
  }

  const taxonomy = readNestedRecord(payload, "mains_taxonomy");
  if (!taxonomy) return;

  const expectedTypes = [
    ["paper_node_id", "paper"],
    ["subject_area_node_id", "subject_area"],
    ["theme_node_id", "theme"],
    ["topic_node_id", "topic"],
    ["subtopic_node_id", "subtopic"]
  ] as const;
  const requested = expectedTypes
    .map(([key, nodeType]) => ({ key, nodeType, id: Number(taxonomy[key]) }))
    .filter((item) => Number.isInteger(item.id) && item.id > 0);

  if (requested.length === 0) return;

  const result = await client.query<{ id: string; exam_id: string; node_type: string }>(
    `
      select id, exam_id, node_type
      from assessment.mains_taxonomy_nodes
      where id = any($1::bigint[])
    `,
    [requested.map((item) => item.id)]
  );

  if (result.rows.length !== requested.length) {
    badRequest("One selected Mains syllabus category no longer exists.");
  }

  for (const item of requested) {
    const row = result.rows.find((record) => Number(record.id) === item.id);
    if (!row) badRequest("One selected Mains syllabus category no longer exists.");
    if (Number(row.exam_id) !== template.exam_id) {
      badRequest("Selected Mains syllabus category belongs to a different exam.");
    }
    if (row.node_type !== item.nodeType) {
      badRequest(`Selected Mains syllabus category must be a ${item.nodeType} node.`);
    }
  }
}

async function getTestTemplateForQuestionMutation(
  client: PoolClient,
  testTemplateId: number
): Promise<TestTemplateMutationContext> {
  const result = await client.query<{ id: string; exam_id: string; test_type: StudyPlanTestType }>(
    `
      select id, exam_id, test_type
      from study_plan.test_templates
      where id = $1
    `,
    [testTemplateId]
  );
  const row = result.rows[0];
  if (!row) notFound("Study plan test not found.");
  return {
    id: Number(row.id),
    exam_id: Number(row.exam_id),
    test_type: row.test_type
  };
}

async function validateQuestionForTest(
  client: PoolClient,
  template: TestTemplateMutationContext,
  question: StudyPlanQuestionLike
): Promise<void> {
  const family = question.question_family ?? "objective";
  if (template.test_type === "mains_test" && family !== "mains_subjective") {
    badRequest("Mains tests can only contain mains subjective questions.");
  }
  if (template.test_type !== "mains_test" && family !== "objective") {
    badRequest("Prelims and CSAT tests can only contain objective questions.");
  }

  const mode = readQuestionContentMode(question);
  if (mode && !allowedContentModesForTest(template.test_type).includes(mode)) {
    badRequest(`${formatContentMode(mode)} questions cannot be saved inside a ${formatStudyPlanTestType(template.test_type)}.`);
  }

  const selectedTaxonomyIds = [
    question.subject_node_id,
    question.topic_node_id,
    question.subtopic_node_id
  ].filter(isValidId);

  if (template.test_type === "mains_test") {
    if (selectedTaxonomyIds.length > 0 || isValidId(question.question_nature_id)) {
      badRequest("Mains tests must use Assessment Mains taxonomy, not objective GK/CSAT taxonomy fields.");
    }
    await validateMainsPayloadForTest(client, template, question);
    return;
  }

  if (selectedTaxonomyIds.length > 0) {
    const uniqueIds = Array.from(new Set(selectedTaxonomyIds));
    const result = await client.query<{ id: string; exam_id: string; content_type: TaxonomyContentType | null }>(
      `
        select id, exam_id, content_type
        from assessment.assessment_taxonomy_nodes
        where id = any($1::bigint[])
      `,
      [uniqueIds]
    );
    if (result.rows.length !== uniqueIds.length) {
      badRequest("One selected syllabus category no longer exists.");
    }

    const expectedContentType = expectedTaxonomyContentType(template.test_type);
    for (const row of result.rows) {
      if (Number(row.exam_id) !== template.exam_id) {
        badRequest("Selected syllabus category belongs to a different exam.");
      }
      if (row.content_type !== expectedContentType) {
        badRequest(`Selected syllabus category is ${row.content_type ?? "unclassified"}, but this ${formatStudyPlanTestType(template.test_type)} requires ${expectedContentType} categories.`);
      }
    }
  }

  if (isValidId(question.question_nature_id)) {
    const nature = await client.query<{ id: string }>(
      `
        select id
        from assessment.question_natures
        where id = $1 and exam_id = $2
      `,
      [question.question_nature_id, template.exam_id]
    );
    if (!nature.rows[0]) badRequest("Selected question nature belongs to a different exam.");
  }
}

async function nextQuestionDisplayOrder(client: PoolClient, testTemplateId: number): Promise<number> {
  const result = await client.query<{ next_order: number }>(
    `
      select (coalesce(max(display_order), 0) + 1)::integer as next_order
      from study_plan.test_questions
      where test_template_id = $1
    `,
    [testTemplateId]
  );
  return Number(result.rows[0]?.next_order ?? 1);
}

async function refreshTestTemplateTotalMarks(client: PoolClient, testTemplateId: number): Promise<void> {
  await client.query(
    `
      update study_plan.test_templates tt
      set total_marks = coalesce((
        select sum(tq.marks)
        from study_plan.test_questions tq
        where tq.test_template_id = tt.id
      ), 0)
      where tt.id = $1
    `,
    [testTemplateId]
  );
}

async function getActiveEnrollment(
  client: PoolClient,
  userId: number,
  planId: number
): Promise<{ id: string } | null> {
  const result = await client.query<{ id: string }>(
    `
      select id
      from study_plan.enrollments
      where user_id = $1
        and plan_id = $2
        and status in ('active', 'completed')
      order by started_at desc
      limit 1
    `,
    [userId, planId]
  );
  return result.rows[0] ?? null;
}

async function refreshEnrollmentCompletion(client: PoolClient, enrollmentId: number): Promise<void> {
  await client.query(
    `
      update study_plan.enrollments e
      set
        status = case
          when exists (
            select 1
            from study_plan.plan_items pi
            where pi.plan_id = e.plan_id
              and not exists (
                select 1
                from study_plan.item_progress ip
                where ip.enrollment_id = e.id
                  and ip.plan_item_id = pi.id
                  and ip.status = 'completed'
              )
          ) then 'active'
          else 'completed'
        end,
        completed_at = case
          when exists (
            select 1
            from study_plan.plan_items pi
            where pi.plan_id = e.plan_id
              and not exists (
                select 1
                from study_plan.item_progress ip
                where ip.enrollment_id = e.id
                  and ip.plan_item_id = pi.id
                  and ip.status = 'completed'
              )
          ) then null
          else coalesce(e.completed_at, now())
        end,
        updated_at = now()
      where e.id = $1
    `,
    [enrollmentId]
  );
}

export async function listStudyPlans(options: ListStudyPlansQuery): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.exam_id) addCondition(conditions, params, "sp.exam_id = ?", options.exam_id);
  if (options.status) addCondition(conditions, params, "sp.status = ?", options.status);

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select
        sp.*,
        e.name as exam_name,
        atn.name as subject_name,
        coalesce(count(distinct pi.id), 0)::integer as item_count,
        coalesce(count(distinct pi.id) filter (where pi.item_type in ('prelims_test', 'csat_test', 'mains_test')), 0)::integer as test_count
      from study_plan.plans sp
      join assessment.exams e on e.id = sp.exam_id
      left join assessment.assessment_taxonomy_nodes atn on atn.id = sp.subject_node_id
      left join study_plan.plan_items pi on pi.plan_id = sp.id
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      group by sp.id, e.id, atn.id
      order by sp.created_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function createStudyPlan(input: CreateStudyPlanInput, userId: number): Promise<unknown> {
  return one(
    `
      insert into study_plan.plans
        (
          title,
          slug,
          subtitle,
          description,
          exam_id,
          subject_node_id,
          duration_weeks,
          level_label,
          language,
          cover_image_url,
          preview_video_url,
          price_amount_minor,
          currency,
          status,
          created_by_user_id,
          published_at
        )
      values
        ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, 'English'), $10, $11, coalesce($12, 0), coalesce($13, 'INR'), $14, $15, $16)
      returning *
    `,
    [
      input.title,
      input.slug,
      input.subtitle ?? null,
      input.description ?? null,
      input.exam_id,
      input.subject_node_id ?? null,
      input.duration_weeks,
      input.level_label ?? null,
      input.language ?? null,
      input.cover_image_url ?? null,
      input.preview_video_url ?? null,
      input.price_amount_minor ?? null,
      input.currency ?? null,
      input.status,
      userId,
      input.published_at ?? (input.status === "published" ? new Date() : null)
    ]
  );
}

export async function updateStudyPlan(id: number, input: UpdateStudyPlanInput): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "title", input.title);
  addUpdate(updates, params, "slug", input.slug);
  addUpdate(updates, params, "subtitle", input.subtitle);
  addUpdate(updates, params, "description", input.description);
  addUpdate(updates, params, "exam_id", input.exam_id);
  addUpdate(updates, params, "subject_node_id", input.subject_node_id);
  addUpdate(updates, params, "duration_weeks", input.duration_weeks);
  addUpdate(updates, params, "level_label", input.level_label);
  addUpdate(updates, params, "language", input.language);
  addUpdate(updates, params, "cover_image_url", input.cover_image_url);
  addUpdate(updates, params, "preview_video_url", input.preview_video_url);
  addUpdate(updates, params, "price_amount_minor", input.price_amount_minor);
  addUpdate(updates, params, "currency", input.currency);
  addUpdate(updates, params, "status", input.status);
  addUpdate(updates, params, "published_at", input.published_at);

  if (input.status === "published" && input.published_at === undefined) {
    addUpdate(updates, params, "published_at", new Date());
  }

  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update study_plan.plans
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function getStudyPlan(id: number, user?: AuthContext): Promise<unknown | null> {
  const plan = await one<{
    id: string;
    status: string;
    [key: string]: unknown;
  }>(
    `
      select
        sp.*,
        row_to_json(e.*) as exam,
        row_to_json(atn.*) as subject
      from study_plan.plans sp
      join assessment.exams e on e.id = sp.exam_id
      left join assessment.assessment_taxonomy_nodes atn on atn.id = sp.subject_node_id
      where sp.id = $1
    `,
    [id]
  );

  if (!plan) return null;
  if (plan.status !== "published" && !isPrivileged(user)) return null;

  const enrollment = user
    ? await one<{
        id: string;
        status: string;
        payment_status: string;
        completed_items: number;
        total_items: number;
        completed_tests: number;
        total_tests: number;
      }>(
        `
          select
            e.id,
            e.status,
            e.payment_status,
            coalesce(count(pi.id) filter (where ip.status = 'completed'), 0)::integer as completed_items,
            coalesce(count(pi.id), 0)::integer as total_items,
            coalesce(count(pi.id) filter (where ip.status = 'completed' and pi.item_type in ('prelims_test', 'csat_test', 'mains_test')), 0)::integer as completed_tests,
            coalesce(count(pi.id) filter (where pi.item_type in ('prelims_test', 'csat_test', 'mains_test')), 0)::integer as total_tests
          from study_plan.enrollments e
          left join study_plan.plan_items pi on pi.plan_id = e.plan_id
          left join study_plan.item_progress ip on ip.enrollment_id = e.id and ip.plan_item_id = pi.id
          where e.plan_id = $1
            and e.user_id = $2
            and e.status in ('active', 'completed')
          group by e.id
          order by e.started_at desc
          limit 1
        `,
        [id, user.id]
      )
    : null;

  const isFreePlan = !plan.price_amount_minor || Number(plan.price_amount_minor) === 0;
  const enrollmentIsValid = enrollment && (isFreePlan || enrollment.payment_status === "paid");
  const hasAccess = enrollmentIsValid || isPrivileged(user);
  const items = await query(
    `
      select
        pi.*,
        case when $2::boolean or pi.is_preview then pi.resource_url else null end as resource_url,
        case when $2::boolean or pi.is_preview then pi.lecture_url else null end as lecture_url,
        case when $2::boolean or pi.is_preview then pi.test_template_id else null end as test_template_id,
        row_to_json(tt.*) as test_template,
        row_to_json(ip.*) as progress
      from study_plan.plan_items pi
      left join study_plan.test_templates tt on tt.id = pi.test_template_id
      left join study_plan.item_progress ip
        on ip.plan_item_id = pi.id
       and ip.enrollment_id = $3
      where pi.plan_id = $1
      order by pi.week_no asc, pi.day_no asc, pi.display_order asc, pi.id asc
    `,
    [id, hasAccess, enrollment?.id ?? null]
  );

  const weekOverviews = await query<{
    week_no: number;
    title: string;
    description: string | null;
  }>(
    `
      select week_no, title, description
      from study_plan.plan_weeks
      where plan_id = $1
      order by week_no asc
    `,
    [id]
  );

  const reviewsSummary = await one<{
    average_rating: number;
    total_reviews: number;
  }>(
    `
      select
        coalesce(avg(rating), 0.0)::float as average_rating,
        coalesce(count(id), 0)::integer as total_reviews
      from study_plan.reviews
      where plan_id = $1
    `,
    [id]
  );

  return {
    ...plan,
    has_access: hasAccess,
    enrollment,
    progress_summary: enrollment
      ? {
          completed_items: Number(enrollment.completed_items ?? 0),
          total_items: Number(enrollment.total_items ?? 0),
          completed_tests: Number(enrollment.completed_tests ?? 0),
          total_tests: Number(enrollment.total_tests ?? 0)
        }
      : null,
    items,
    week_overviews: weekOverviews,
    reviews_summary: reviewsSummary ?? { average_rating: 0.0, total_reviews: 0 }
  };
}

export async function enrollStudyPlan(
  planId: number,
  input: EnrollStudyPlanInput,
  userId: number
): Promise<unknown> {
  return transaction(async (client) => {
    const plan = await client.query<{
      id: string;
      status: string;
      price_amount_minor: number;
      currency: string;
    }>(
      `
        select id, status, price_amount_minor, currency
        from study_plan.plans
        where id = $1
        for update
      `,
      [planId]
    );
    const record = plan.rows[0];
    if (!record) notFound("Study plan not found.");
    if (record.status !== "published") accessDenied("This study plan is not published.");

    const inserted = await client.query(
      `
        insert into study_plan.enrollments
          (
            user_id,
            plan_id,
            status,
            amount_paid_minor,
            currency,
            provider,
            provider_payment_id,
            payment_status,
            payment_amount,
            payment_currency,
            razorpay_order_id,
            razorpay_payment_id,
            purchased_at
          )
        values ($1, $2, 'active', $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
        on conflict (user_id, plan_id)
        do update set
          status = 'active',
          amount_paid_minor = excluded.amount_paid_minor,
          currency = excluded.currency,
          provider = coalesce(excluded.provider, study_plan.enrollments.provider),
          provider_payment_id = coalesce(excluded.provider_payment_id, study_plan.enrollments.provider_payment_id),
          payment_status = excluded.payment_status,
          payment_amount = excluded.payment_amount,
          payment_currency = excluded.payment_currency,
          razorpay_order_id = excluded.razorpay_order_id,
          razorpay_payment_id = excluded.razorpay_payment_id,
          purchased_at = coalesce(study_plan.enrollments.purchased_at, now()),
          updated_at = now()
        returning *
      `,
      [
        userId,
        planId,
        input.payment_amount ?? record.price_amount_minor,
        input.payment_currency ?? record.currency,
        input.provider ?? "manual",
        input.provider_payment_id ?? null,
        input.payment_status ?? "free",
        input.payment_amount ?? record.price_amount_minor,
        input.payment_currency ?? record.currency,
        input.razorpay_order_id ?? null,
        input.razorpay_payment_id ?? null
      ]
    );

    return inserted.rows[0];
  });
}

export async function addPlanItem(
  planId: number,
  input: CreatePlanItemInput
): Promise<unknown> {
  return one(
    `
      insert into study_plan.plan_items
        (
          plan_id,
          week_no,
          day_no,
          display_order,
          item_type,
          title,
          description,
          estimated_minutes,
          resource_url,
          lecture_url,
          test_template_id,
          is_preview
        )
      values ($1, $2, $3, coalesce($4, 0), $5, $6, $7, $8, $9, $10, $11, coalesce($12, false))
      returning *
    `,
    [
      planId,
      input.week_no,
      input.day_no,
      input.display_order ?? null,
      input.item_type,
      input.title,
      input.description ?? null,
      input.estimated_minutes ?? null,
      input.resource_url ?? null,
      input.lecture_url ?? null,
      input.test_template_id ?? null,
      input.is_preview ?? null
    ]
  );
}

export async function updatePlanItem(id: number, input: UpdatePlanItemInput): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "week_no", input.week_no);
  addUpdate(updates, params, "day_no", input.day_no);
  addUpdate(updates, params, "display_order", input.display_order);
  addUpdate(updates, params, "item_type", input.item_type);
  addUpdate(updates, params, "title", input.title);
  addUpdate(updates, params, "description", input.description);
  addUpdate(updates, params, "estimated_minutes", input.estimated_minutes);
  addUpdate(updates, params, "resource_url", input.resource_url);
  addUpdate(updates, params, "lecture_url", input.lecture_url);
  addUpdate(updates, params, "test_template_id", input.test_template_id);
  addUpdate(updates, params, "is_preview", input.is_preview);
  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update study_plan.plan_items
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function deletePlanItem(id: number): Promise<unknown | null> {
  return one(
    `
      delete from study_plan.plan_items
      where id = $1
      returning *
    `,
    [id]
  );
}

export async function updatePlanItemProgress(
  itemId: number,
  input: UpdateProgressInput,
  userId: number
): Promise<unknown> {
  return transaction(async (client) => {
    const item = await client.query<{ id: string; plan_id: string; item_type: string }>(
      `
        select id, plan_id, item_type
        from study_plan.plan_items
        where id = $1
      `,
      [itemId]
    );
    const row = item.rows[0];
    if (!row) notFound("Study plan item not found.");
    if (["prelims_test", "csat_test", "mains_test"].includes(row.item_type) && input.status === "completed") {
      accessDenied("Complete test items by submitting the linked test.");
    }

    const enrollment = await getActiveEnrollment(client, userId, Number(row.plan_id));
    if (!enrollment) accessDenied("Purchase this study plan to track progress.");

    const progress = await client.query(
      `
        insert into study_plan.item_progress
          (enrollment_id, plan_item_id, status, completed_at)
        values ($1, $2, $3, case when $3 = 'completed' then now() else null end)
        on conflict (enrollment_id, plan_item_id)
        do update set
          status = excluded.status,
          completed_at = case when excluded.status = 'completed' then coalesce(study_plan.item_progress.completed_at, now()) else null end,
          updated_at = now()
        returning *
      `,
      [enrollment.id, itemId, input.status]
    );

    await refreshEnrollmentCompletion(client, Number(enrollment.id));
    return progress.rows[0];
  });
}

export async function listStudyPlanTests(options: ListStudyPlanTestsQuery): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.exam_id) addCondition(conditions, params, "tt.exam_id = ?", options.exam_id);
  if (options.exam_level_id) addCondition(conditions, params, "tt.exam_level_id = ?", options.exam_level_id);
  if (options.test_type) addCondition(conditions, params, "tt.test_type = ?", options.test_type);
  if (options.status) addCondition(conditions, params, "tt.status = ?", options.status);

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select
        tt.*,
        e.name as exam_name,
        el.name as exam_level_name,
        coalesce(count(tq.id), 0)::integer as question_count
      from study_plan.test_templates tt
      join assessment.exams e on e.id = tt.exam_id
      join assessment.exam_levels el on el.id = tt.exam_level_id
      left join study_plan.test_questions tq on tq.test_template_id = tt.id
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      group by tt.id, e.id, el.id
      order by tt.created_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

function inferTestTypeFromLevelName(levelName: string | undefined, fallback: StudyPlanTestType): StudyPlanTestType {
  const normalized = levelName?.toLowerCase() ?? "";
  if (normalized.includes("csat") || normalized.includes("aptitude")) return "csat_test";
  if (normalized.includes("mains")) return "mains_test";
  if (normalized.includes("prelims")) return "prelims_test";
  return fallback;
}

export async function createStudyPlanTest(input: CreateStudyPlanTestInput, userId: number): Promise<unknown> {
  const level = await one<{ name: string }>(
    `select name from assessment.exam_levels where id = $1`,
    [input.exam_level_id]
  );
  const inferredTestType = inferTestTypeFromLevelName(level?.name, input.test_type);

  return one(
    `
      insert into study_plan.test_templates
        (
          title,
          slug,
          description,
          exam_id,
          exam_level_id,
          test_type,
          duration_minutes,
          total_marks,
          negative_marks_per_question,
          instructions,
          status,
          created_by_user_id,
          published_at
        )
      values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 0), coalesce($9, 0), $10, $11, $12, $13)
      returning *
    `,
    [
      input.title,
      input.slug,
      input.description ?? null,
      input.exam_id,
      input.exam_level_id,
      inferredTestType,
      input.duration_minutes,
      input.total_marks ?? null,
      input.negative_marks_per_question ?? null,
      input.instructions ?? null,
      input.status,
      userId,
      input.published_at ?? (input.status === "published" ? new Date() : null)
    ]
  );
}

export async function updateStudyPlanTest(id: number, input: UpdateStudyPlanTestInput): Promise<unknown | null> {
  return transaction(async (client) => {
    // 1. Fetch current test template details
    const current = await client.query<{ exam_level_id: string; test_type: StudyPlanTestType }>(
      `select exam_level_id, test_type from study_plan.test_templates where id = $1`,
      [id]
    );
    const currentRow = current.rows[0];
    if (!currentRow) return null;

    const examLevelId = input.exam_level_id !== undefined ? input.exam_level_id : Number(currentRow.exam_level_id);

    // 2. Fetch exam level name to infer test type
    const level = await client.query<{ name: string }>(
      `select name from assessment.exam_levels where id = $1`,
      [examLevelId]
    );
    const levelName = level.rows[0]?.name;
    const inferredTestType = inferTestTypeFromLevelName(levelName, input.test_type ?? currentRow.test_type);

    // 3. Update test template
    const params: unknown[] = [];
    const updates: string[] = [];

    addUpdate(updates, params, "title", input.title);
    addUpdate(updates, params, "slug", input.slug);
    addUpdate(updates, params, "description", input.description);
    addUpdate(updates, params, "exam_id", input.exam_id);
    addUpdate(updates, params, "exam_level_id", input.exam_level_id);
    addUpdate(updates, params, "test_type", inferredTestType);
    addUpdate(updates, params, "duration_minutes", input.duration_minutes);
    addUpdate(updates, params, "total_marks", input.total_marks);
    addUpdate(updates, params, "negative_marks_per_question", input.negative_marks_per_question);
    addUpdate(updates, params, "instructions", input.instructions);
    addUpdate(updates, params, "status", input.status);
    addUpdate(updates, params, "published_at", input.published_at);

    if (input.status === "published" && input.published_at === undefined) {
      addUpdate(updates, params, "published_at", new Date());
    }

    requireUpdates(updates);
    params.push(id);

    const testResult = await client.query(
      `
        update study_plan.test_templates
        set ${updates.join(", ")}, updated_at = now()
        where id = $${params.length}
        returning *
      `,
      params
    );

    // 4. Sync linked plan items if test_type changed
    if (inferredTestType !== currentRow.test_type) {
      await client.query(
        `
          update study_plan.plan_items
          set item_type = $1, updated_at = now()
          where test_template_id = $2
        `,
        [inferredTestType, id]
      );

      // 5. Migrate questions content_mode in source_payload
      if (inferredTestType === "csat_test") {
        await client.query(
          `
            update study_plan.test_questions
            set source_payload = jsonb_set(source_payload, '{content_mode}', '"csat_math"')
            where test_template_id = $1
              and (source_payload->>'content_mode' = 'gk' or source_payload->>'content_type' = 'gk')
          `,
          [id]
        );
      } else if (inferredTestType === "prelims_test") {
        await client.query(
          `
            update study_plan.test_questions
            set source_payload = jsonb_set(source_payload, '{content_mode}', '"gk"')
            where test_template_id = $1
              and source_payload->>'content_mode' in ('aptitude', 'csat_math', 'csat_passage')
          `,
          [id]
        );
      } else if (inferredTestType === "mains_test") {
        await client.query(
          `
            update study_plan.test_questions
            set question_family = 'mains_subjective',
                source_payload = jsonb_set(source_payload, '{content_mode}', '"mains"')
            where test_template_id = $1
          `,
          [id]
        );
      }
    }

    return testResult.rows[0] ?? null;
  });
}

export async function getStudyPlanTest(id: number): Promise<unknown | null> {
  return one(
    `
      select
        tt.*,
        row_to_json(e.*) as exam,
        row_to_json(el.*) as exam_level,
        coalesce((
          select jsonb_agg(to_jsonb(tq.*) order by tq.display_order, tq.id)
          from study_plan.test_questions tq
          where tq.test_template_id = tt.id
        ), '[]'::jsonb) as questions
      from study_plan.test_templates tt
      join assessment.exams e on e.id = tt.exam_id
      join assessment.exam_levels el on el.id = tt.exam_level_id
      where tt.id = $1
    `,
    [id]
  );
}

export async function addStudyPlanQuestion(
  testTemplateId: number,
  input: CreateStudyPlanQuestionInput
): Promise<unknown> {
  return transaction(async (client) => {
    const template = await getTestTemplateForQuestionMutation(client, testTemplateId);
    await validateQuestionForTest(client, template, input);
    const displayOrder = input.display_order > 0 ? input.display_order : await nextQuestionDisplayOrder(client, testTemplateId);
    const result = await client.query(
      `
        insert into study_plan.test_questions
          (
            test_template_id,
            display_order,
            question_family,
            question_statement,
            supplementary_statement,
            question_prompt,
            options,
            correct_answer,
            explanation,
            model_answer,
            marks,
            negative_marks,
            subject_node_id,
            topic_node_id,
            subtopic_node_id,
            question_nature_id,
            source_payload
          )
        values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, coalesce($11, 1), coalesce($12, 0), $13, $14, $15, $16, $17)
        returning *
      `,
      [
        testTemplateId,
        displayOrder,
        input.question_family,
        input.question_statement,
        input.supplementary_statement ?? null,
        input.question_prompt ?? null,
        JSON.stringify(input.options ?? []),
        input.correct_answer === undefined ? null : toJson(input.correct_answer),
        input.explanation ?? null,
        input.model_answer ?? null,
        input.marks ?? null,
        input.negative_marks ?? null,
        input.subject_node_id ?? null,
        input.topic_node_id ?? null,
        input.subtopic_node_id ?? null,
        input.question_nature_id ?? null,
        JSON.stringify(input.source_payload ?? {})
      ]
    );
    await refreshTestTemplateTotalMarks(client, testTemplateId);
    return result.rows[0] ?? null;
  });
}

export async function addStudyPlanQuestions(
  testTemplateId: number,
  questions: CreateStudyPlanQuestionInput[]
): Promise<unknown[]> {
  return transaction(async (client) => {
    const template = await getTestTemplateForQuestionMutation(client, testTemplateId);
    const baseDisplayOrder = await nextQuestionDisplayOrder(client, testTemplateId);
    const inserted: unknown[] = [];
    for (const [index, question] of questions.entries()) {
      await validateQuestionForTest(client, template, question);
      const displayOrder = question.display_order > 0 ? question.display_order : baseDisplayOrder + index;
      const result = await client.query(
        `
          insert into study_plan.test_questions
            (
              test_template_id,
              display_order,
              question_family,
              question_statement,
              supplementary_statement,
              question_prompt,
              options,
              correct_answer,
              explanation,
              model_answer,
              marks,
              negative_marks,
              subject_node_id,
              topic_node_id,
              subtopic_node_id,
              question_nature_id,
              source_payload
            )
          values
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          returning *
        `,
        [
          testTemplateId,
          displayOrder,
          question.question_family,
          question.question_statement,
          question.supplementary_statement ?? null,
          question.question_prompt ?? null,
          JSON.stringify(question.options ?? []),
          question.correct_answer === undefined ? null : toJson(question.correct_answer),
          question.explanation ?? null,
          question.model_answer ?? null,
          question.marks,
          question.negative_marks,
          question.subject_node_id ?? null,
          question.topic_node_id ?? null,
          question.subtopic_node_id ?? null,
          question.question_nature_id ?? null,
          JSON.stringify(question.source_payload ?? {})
        ]
      );
      if (result.rows[0]) inserted.push(result.rows[0]);
    }

    await refreshTestTemplateTotalMarks(client, testTemplateId);

    return inserted;
  });
}

export async function updateStudyPlanQuestion(
  id: number,
  input: UpdateStudyPlanQuestionInput
): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "display_order", input.display_order);
  addUpdate(updates, params, "question_family", input.question_family);
  addUpdate(updates, params, "question_statement", input.question_statement);
  addUpdate(updates, params, "supplementary_statement", input.supplementary_statement);
  addUpdate(updates, params, "question_prompt", input.question_prompt);
  addUpdate(updates, params, "options", input.options === undefined ? undefined : JSON.stringify(input.options));
  addUpdate(updates, params, "correct_answer", input.correct_answer === undefined ? undefined : toJson(input.correct_answer));
  addUpdate(updates, params, "explanation", input.explanation);
  addUpdate(updates, params, "model_answer", input.model_answer);
  addUpdate(updates, params, "marks", input.marks);
  addUpdate(updates, params, "negative_marks", input.negative_marks);
  addUpdate(updates, params, "subject_node_id", input.subject_node_id);
  addUpdate(updates, params, "topic_node_id", input.topic_node_id);
  addUpdate(updates, params, "subtopic_node_id", input.subtopic_node_id);
  addUpdate(updates, params, "question_nature_id", input.question_nature_id);
  addUpdate(updates, params, "source_payload", input.source_payload === undefined ? undefined : JSON.stringify(input.source_payload));
  requireUpdates(updates);

  return transaction(async (client) => {
    const existing = await client.query<{
      test_template_id: string;
      test_type: StudyPlanTestType;
      exam_id: string;
      question_family: "objective" | "mains_subjective";
      subject_node_id: number | null;
      topic_node_id: number | null;
      subtopic_node_id: number | null;
      question_nature_id: number | null;
      source_payload: Record<string, unknown> | null;
    }>(
      `
        select
          tq.test_template_id,
          tt.test_type,
          tt.exam_id,
          tq.question_family,
          tq.subject_node_id,
          tq.topic_node_id,
          tq.subtopic_node_id,
          tq.question_nature_id,
          tq.source_payload
        from study_plan.test_questions tq
        join study_plan.test_templates tt on tt.id = tq.test_template_id
        where tq.id = $1
      `,
      [id]
    );
    const current = existing.rows[0];
    if (!current) return null;

    const template: TestTemplateMutationContext = {
      id: Number(current.test_template_id),
      exam_id: Number(current.exam_id),
      test_type: current.test_type
    };
    await validateQuestionForTest(client, template, {
      question_family: input.question_family ?? current.question_family,
      subject_node_id: input.subject_node_id === undefined ? current.subject_node_id : input.subject_node_id,
      topic_node_id: input.topic_node_id === undefined ? current.topic_node_id : input.topic_node_id,
      subtopic_node_id: input.subtopic_node_id === undefined ? current.subtopic_node_id : input.subtopic_node_id,
      question_nature_id: input.question_nature_id === undefined ? current.question_nature_id : input.question_nature_id,
      source_payload: input.source_payload === undefined ? current.source_payload : input.source_payload
    });

    params.push(id);
    const result = await client.query(
      `
        update study_plan.test_questions
        set ${updates.join(", ")}, updated_at = now()
        where id = $${params.length}
        returning *
      `,
      params
    );
    await refreshTestTemplateTotalMarks(client, template.id);
    return result.rows[0] ?? null;
  });
}

export async function deleteStudyPlanQuestion(id: number): Promise<unknown | null> {
  return transaction(async (client) => {
    const result = await client.query<{ test_template_id: string } & Record<string, unknown>>(
      `
        delete from study_plan.test_questions
        where id = $1
        returning *
      `,
      [id]
    );
    const row = result.rows[0] ?? null;
    if (row) await refreshTestTemplateTotalMarks(client, Number(row.test_template_id));
    return row;
  });
}

async function resolveAttemptAccess(
  client: PoolClient,
  testTemplateId: number,
  input: StartStudyPlanAttemptInput,
  user: AuthContext
): Promise<{ planItemId: number | null; enrollmentId: number | null }> {
  if (isPrivileged(user)) {
    return { planItemId: input.plan_item_id ?? null, enrollmentId: null };
  }

  const accessResult = await client.query<{ plan_item_id: string; enrollment_id: string }>(
    `
      select pi.id as plan_item_id, e.id as enrollment_id
      from study_plan.plan_items pi
      join study_plan.enrollments e on e.plan_id = pi.plan_id
      where pi.test_template_id = $1
        and e.user_id = $2
        and e.status in ('active', 'completed')
        and ($3::bigint is null or pi.id = $3::bigint)
      order by e.started_at desc, pi.week_no asc, pi.day_no asc, pi.display_order asc
      limit 1
    `,
    [testTemplateId, user.id, input.plan_item_id ?? null]
  );

  const row = accessResult.rows[0];
  if (!row) accessDenied("Purchase the linked study plan to attempt this test.");
  return {
    planItemId: Number(row.plan_item_id),
    enrollmentId: Number(row.enrollment_id)
  };
}

export async function getStudyPlanTestPaper(
  testTemplateId: number,
  user?: AuthContext,
  planItemId?: number
): Promise<unknown | null> {
  const test = await one<{ id: string; status: string; [key: string]: unknown }>(
    `
      select
        tt.*,
        row_to_json(e.*) as exam,
        row_to_json(el.*) as exam_level
      from study_plan.test_templates tt
      join assessment.exams e on e.id = tt.exam_id
      join assessment.exam_levels el on el.id = tt.exam_level_id
      where tt.id = $1
    `,
    [testTemplateId]
  );
  if (!test) return null;

  if (test.status !== "published" && !isPrivileged(user)) return null;

  if (!isPrivileged(user)) {
    if (!user) accessDenied("Sign in to access this study plan test.");
    const hasAccess = await one<{ exists: boolean }>(
      `
        select exists (
          select 1
          from study_plan.plan_items pi
          join study_plan.enrollments e on e.plan_id = pi.plan_id
          where pi.test_template_id = $1
            and e.user_id = $2
            and e.status in ('active', 'completed')
            and ($3::bigint is null or pi.id = $3::bigint)
        ) as exists
      `,
      [testTemplateId, user.id, planItemId ?? null]
    );
    if (!hasAccess?.exists) accessDenied("Purchase the linked study plan to view this test.");
  }

  const questions = await query(
    `
      select
        id,
        test_template_id,
        display_order,
        question_family,
        question_statement,
        supplementary_statement,
        question_prompt,
        options,
        case when question_family = 'mains_subjective' then model_answer else null end as model_answer,
        marks,
        negative_marks,
        subject_node_id,
        topic_node_id,
        subtopic_node_id,
        question_nature_id,
        source_payload
      from study_plan.test_questions
      where test_template_id = $1
      order by display_order asc, id asc
    `,
    [testTemplateId]
  );

  return {
    ...test,
    questions
  };
}

export async function startStudyPlanAttempt(
  testTemplateId: number,
  input: StartStudyPlanAttemptInput,
  user: AuthContext
): Promise<unknown | null> {
  return transaction(async (client) => {
    const test = await client.query<{ id: string; status: string; duration_minutes: number }>(
      `
        select id, status, duration_minutes
        from study_plan.test_templates
        where id = $1
      `,
      [testTemplateId]
    );
    const testRow = test.rows[0];
    if (!testRow) return null;
    if (testRow.status !== "published" && !isPrivileged(user)) accessDenied("This test is not published.");

    const access = await resolveAttemptAccess(client, testTemplateId, input, user);

    const attempt = await client.query(
      `
        insert into study_plan.test_attempts
          (user_id, test_template_id, plan_item_id, enrollment_id, expires_at)
        values ($1, $2, $3, $4, now() + make_interval(mins => $5))
        returning *
      `,
      [
        user.id,
        testTemplateId,
        access.planItemId,
        access.enrollmentId,
        testRow.duration_minutes
      ]
    );

    if (access.enrollmentId && access.planItemId) {
      await client.query(
        `
          insert into study_plan.item_progress
            (enrollment_id, plan_item_id, status)
          values ($1, $2, 'in_progress')
          on conflict (enrollment_id, plan_item_id)
          do update set
            status = case when study_plan.item_progress.status = 'completed' then 'completed' else 'in_progress' end,
            updated_at = now()
        `,
        [access.enrollmentId, access.planItemId]
      );
    }

    return attempt.rows[0];
  });
}

export async function getStudyPlanAttemptPaper(attemptId: number, user: AuthContext): Promise<unknown | null> {
  const ownerFilter = isPrivileged(user) ? "" : "and ta.user_id = $2";
  const params = isPrivileged(user) ? [attemptId] : [attemptId, user.id];

  const attempt = await one(
    `
      select
        ta.*,
        row_to_json(tt.*) as test_template,
        row_to_json(tr.*) as result
      from study_plan.test_attempts ta
      join study_plan.test_templates tt on tt.id = ta.test_template_id
      left join study_plan.test_results tr on tr.attempt_id = ta.id
      where ta.id = $1
        ${ownerFilter}
    `,
    params
  );
  if (!attempt) return null;

  const questions = await query(
    `
      select
        tq.id,
        tq.test_template_id,
        tq.display_order,
        tq.question_family,
        tq.question_statement,
        tq.supplementary_statement,
        tq.question_prompt,
        tq.options,
        tq.marks,
        tq.negative_marks,
        tq.source_payload,
        row_to_json(ar.*) as response
      from study_plan.test_questions tq
      join study_plan.test_attempts ta on ta.test_template_id = tq.test_template_id
      left join study_plan.attempt_responses ar
        on ar.attempt_id = ta.id
       and ar.question_id = tq.id
      where ta.id = $1
      order by tq.display_order asc, tq.id asc
    `,
    [attemptId]
  );

  return {
    ...attempt,
    questions
  };
}

export async function upsertStudyPlanResponse(
  attemptId: number,
  input: UpsertStudyPlanResponseInput,
  user: AuthContext
): Promise<unknown> {
  if (!isPrivileged(user)) {
    const attempt = await one<{ id: string; status: string }>(
      `
        select id, status
        from study_plan.test_attempts
        where id = $1
          and user_id = $2
      `,
      [attemptId, user.id]
    );
    if (!attempt) notFound("Attempt not found.");
    if (attempt.status !== "in_progress") accessDenied("Cannot update responses after submission.");
  }

  const status =
    input.status ??
    (input.selected_answer !== undefined || input.answer_text ? "answered" : "not_visited");

  return one(
    `
      insert into study_plan.attempt_responses
        (
          attempt_id,
          question_id,
          selected_answer,
          answer_text,
          status,
          is_marked_for_review,
          time_spent_seconds,
          answered_at
        )
      values ($1, $2, $3, $4, $5, coalesce($6, false), coalesce($7, 0), case when $5 in ('answered', 'marked_for_review') then now() else null end)
      on conflict (attempt_id, question_id)
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
      input.question_id,
      input.selected_answer === undefined ? null : toJson(input.selected_answer),
      input.answer_text ?? null,
      status,
      input.is_marked_for_review ?? null,
      input.time_spent_seconds ?? null
    ]
  );
}

export async function submitStudyPlanAttempt(
  attemptId: number,
  input: SubmitStudyPlanAttemptInput,
  user: AuthContext
): Promise<unknown | null> {
  const resultId = await transaction(async (client) => {
    const attemptResult = await client.query<{
      id: string;
      test_template_id: string;
      user_id: string;
      plan_item_id: string | null;
      enrollment_id: string | null;
      status: string;
      started_at: Date;
      test_type: string;
      template_title: string;
      exam_id: string;
      exam_level_id: string;
      duration_minutes: number;
    }>(
      `
        select
          ta.id,
          ta.test_template_id,
          ta.user_id,
          ta.plan_item_id,
          ta.enrollment_id,
          ta.status,
          ta.started_at,
          tt.test_type,
          tt.title as template_title,
          tt.exam_id,
          tt.exam_level_id,
          tt.duration_minutes
        from study_plan.test_attempts ta
        join study_plan.test_templates tt on tt.id = ta.test_template_id
        where ta.id = $1
        for update
      `,
      [attemptId]
    );

    const attempt = attemptResult.rows[0];
    if (!attempt) notFound("Attempt not found.");
    if (!isPrivileged(user) && Number(attempt.user_id) !== user.id) notFound("Attempt not found.");

    const existing = await client.query<{ id: string }>(
      "select id from study_plan.test_results where attempt_id = $1",
      [attemptId]
    );
    if (existing.rows[0]?.id) return Number(existing.rows[0].id);

    if (attempt.status !== "in_progress") {
      const error = new Error(`Attempt cannot be submitted from status ${attempt.status}.`) as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }

    const isMains = attempt.test_type === "mains_test";
    const items = await client.query<ScoreItem & { source_payload?: any; answer_text?: string | null }>(
      `
        select
          tq.id::text as question_version_id,
          tq.marks::text as marks,
          tq.negative_marks::text as negative_marks,
          tq.correct_answer,
          ar.selected_answer,
          ar.status as response_status,
          ar.time_spent_seconds as response_time_seconds,
          ar.answer_text as answer_text,
          tq.subject_node_id::text as subject_node_id,
          tq.topic_node_id::text as topic_node_id,
          tq.subtopic_node_id::text as subtopic_node_id,
          tq.question_nature_id::text as question_nature_id,
          tq.source_payload
        from study_plan.test_questions tq
        left join study_plan.attempt_responses ar
          on ar.attempt_id = $1
         and ar.question_id = tq.id
        where tq.test_template_id = $2
        order by tq.display_order asc, tq.id asc
      `,
      [attemptId, attempt.test_template_id]
    );

    const maxScore = items.rows.reduce((sum, item) => sum + Number(item.marks ?? 0), 0);

    let objectiveScore;
    if (isMains) {
      let unattemptedCount = 0;
      let correctCount = 0;
      const perQuestion: Array<Record<string, unknown>> = [];
      const breakdownsMap = new Map<number, {
        mainsTaxonomyNodeId: number;
        total: number;
        correct: number;
        incorrect: number;
        unattempted: number;
        score: number;
        time: number;
      }>();

      for (const item of items.rows) {
        const hasAnswer = Boolean(item.selected_answer || item.answer_text?.trim());
        const payload = readSourcePayload(item.source_payload);
        const taxonomy = readNestedRecord(payload, "mains_taxonomy");
        const mainsTaxonomyNodeId = taxonomy
          ? (Number(taxonomy.subtopic_node_id) ||
             Number(taxonomy.topic_node_id) ||
             Number(taxonomy.theme_node_id) ||
             Number(taxonomy.subject_area_node_id) ||
             Number(taxonomy.paper_node_id) ||
             null)
          : null;

        if (!hasAnswer) {
          unattemptedCount++;
        } else {
          correctCount++;
        }

        if (mainsTaxonomyNodeId) {
          if (!breakdownsMap.has(mainsTaxonomyNodeId)) {
            breakdownsMap.set(mainsTaxonomyNodeId, {
              mainsTaxonomyNodeId,
              total: 0,
              correct: 0,
              incorrect: 0,
              unattempted: 0,
              score: 0,
              time: 0
            });
          }
          const b = breakdownsMap.get(mainsTaxonomyNodeId)!;
          b.total += 1;
          b.time += Number(item.response_time_seconds ?? 0);
          if (!hasAnswer) {
            b.unattempted += 1;
          } else {
            b.correct += 1;
          }
        }

        perQuestion.push({
          question_version_id: item.question_version_id,
          outcome: hasAnswer ? "correct" : "unattempted",
          selected_answer: item.selected_answer,
          correct_answer: item.correct_answer,
          score: 0,
          time_spent_seconds: item.response_time_seconds ?? 0
        });
      }

      objectiveScore = {
        score: 0,
        maxScore,
        accuracy: items.rows.length > 0 ? (items.rows.length - unattemptedCount) / items.rows.length : 0,
        totalQuestions: items.rows.length,
        correctCount,
        incorrectCount: 0,
        unattemptedCount,
        negativeMarks: 0,
        perQuestion,
        breakdowns: Array.from(breakdownsMap.values())
      };
    } else {
      objectiveScore = calculateObjectiveScore(items.rows);
    }

    const insertedResult = await client.query<{ id: string }>(
      `
        insert into study_plan.test_results
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
            result_status,
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
        isMains ? "submitted_unscored" : "scored",
        JSON.stringify({ per_question: objectiveScore.perQuestion })
      ]
    );

    const newResultId = insertedResult.rows[0]?.id;
    if (!newResultId) throw new Error("Study plan result insert failed.");

    // Mirror non-mains (objective) attempts into the central assessment schema so this
    // attempt counts toward assessment.student_topic_metrics / the Performance dashboard
    // the same way a custom test or dynamic practice session does. Tagged source='study_plan'
    // and excluded from catalogs/leaderboards/"My Results" -- Study Plan keeps its own
    // result page above; this mirror exists purely for central performance metrics.
    // Mains stays on the existing read-time union in review.service.ts (subjective scoring
    // doesn't fit the objective breakdown shape this mirror relies on).
    let mirroredResultId: number | null = null;
    if (!isMains) {
      const mirrorTemplateResult = await client.query<{ id: string }>(
        `
          insert into assessment.test_templates
            (title, slug, description, exam_id, exam_level_id, test_type, duration_minutes, total_marks, access_type, status, source)
          values ($1, $2, 'Study Plan attempt mirror -- feeds performance metrics only, not browsable.', $3, $4, 'sectional_test', $5, $6, 'private', 'archived', 'study_plan')
          returning id
        `,
        [
          attempt.template_title,
          `study-plan-mirror-${attemptId}`,
          attempt.exam_id,
          attempt.exam_level_id,
          attempt.duration_minutes,
          objectiveScore.maxScore
        ]
      );
      const mirrorTemplateId = mirrorTemplateResult.rows[0]?.id;
      if (!mirrorTemplateId) throw new Error("Failed to mirror study plan template.");

      const mirrorAttemptResult = await client.query<{ id: string }>(
        `
          insert into assessment.test_attempts
            (user_id, test_template_id, status, started_at, submitted_at, study_plan_attempt_id)
          values ($1, $2, 'submitted', $3, now(), $4)
          returning id
        `,
        [attempt.user_id, mirrorTemplateId, attempt.started_at, attemptId]
      );
      const mirrorAttemptId = mirrorAttemptResult.rows[0]?.id;
      if (!mirrorAttemptId) throw new Error("Failed to mirror study plan attempt.");

      const mirrorResultResult = await client.query<{ id: string }>(
        `
          insert into assessment.test_results
            (attempt_id, score, max_score, accuracy, total_questions, correct_count, incorrect_count, unattempted_count, negative_marks, summary_json)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          returning id
        `,
        [
          mirrorAttemptId,
          objectiveScore.score,
          objectiveScore.maxScore,
          objectiveScore.accuracy,
          objectiveScore.totalQuestions,
          objectiveScore.correctCount,
          objectiveScore.incorrectCount,
          objectiveScore.unattemptedCount,
          objectiveScore.negativeMarks,
          JSON.stringify({ mirrored_from: "study_plan", study_plan_attempt_id: attemptId })
        ]
      );
      mirroredResultId = Number(mirrorResultResult.rows[0]?.id) || null;
      if (!mirroredResultId) throw new Error("Failed to mirror study plan result.");
    }

    for (const breakdown of objectiveScore.breakdowns) {
      await client.query(
        `
          insert into study_plan.result_topic_breakdowns
            (
              result_id,
              taxonomy_node_id,
              mains_taxonomy_node_id,
              question_nature_id,
              total_questions,
              correct_count,
              incorrect_count,
              unattempted_count,
              score,
              accuracy,
              avg_time_seconds
            )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          newResultId,
          isMains ? null : (breakdown as any).taxonomyNodeId,
          isMains ? (breakdown as any).mainsTaxonomyNodeId : null,
          isMains ? null : (breakdown as any).questionNatureId,
          breakdown.total,
          breakdown.correct,
          breakdown.incorrect,
          breakdown.unattempted,
          breakdown.score,
          breakdown.correct + breakdown.incorrect > 0
            ? breakdown.correct / (breakdown.correct + breakdown.incorrect)
            : 0,
          breakdown.total > 0 ? breakdown.time / breakdown.total : 0
        ]
      );

      if (!isMains && (breakdown as any).taxonomyNodeId) {
        if (mirroredResultId) {
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
              mirroredResultId,
              (breakdown as any).taxonomyNodeId,
              (breakdown as any).questionNatureId,
              breakdown.total,
              breakdown.correct,
              breakdown.incorrect,
              breakdown.unattempted,
              breakdown.score,
              (breakdown as any).maxScore,
              breakdown.correct + breakdown.incorrect > 0
                ? breakdown.correct / (breakdown.correct + breakdown.incorrect)
                : 0,
              breakdown.total > 0 ? breakdown.time / breakdown.total : 0
            ]
          );
        }

        await upsertStudentTopicMetric(client, Number(attempt.user_id), {
          taxonomyNodeId: (breakdown as any).taxonomyNodeId,
          questionNatureId: (breakdown as any).questionNatureId,
          total: breakdown.total,
          correct: breakdown.correct,
          incorrect: breakdown.incorrect,
          unattempted: breakdown.unattempted,
          score: breakdown.score,
          maxScore: (breakdown as any).maxScore
        });
      }
    }

    await client.query(
      `
        update study_plan.test_attempts
        set
          status = 'submitted',
          submitted_at = now(),
          time_spent_seconds = coalesce($2, time_spent_seconds),
          submit_idempotency_key = coalesce($3, submit_idempotency_key)
        where id = $1
      `,
      [attemptId, input.time_spent_seconds ?? null, input.submit_idempotency_key ?? null]
    );

    if (attempt.enrollment_id && attempt.plan_item_id) {
      await client.query(
        `
          insert into study_plan.item_progress
            (enrollment_id, plan_item_id, status, test_attempt_id, completed_at)
          values ($1, $2, 'completed', $3, now())
          on conflict (enrollment_id, plan_item_id)
          do update set
            status = 'completed',
            test_attempt_id = excluded.test_attempt_id,
            completed_at = coalesce(study_plan.item_progress.completed_at, now()),
            updated_at = now()
        `,
        [attempt.enrollment_id, attempt.plan_item_id, attemptId]
      );
      await refreshEnrollmentCompletion(client, Number(attempt.enrollment_id));
    }

    return Number(newResultId);
  });

  return one(
    `
      select *
      from study_plan.test_results
      where id = $1
    `,
    [resultId]
  );
}

export async function getStudyPlanResultReview(resultId: number, user: AuthContext): Promise<unknown | null> {
  const ownerFilter = isPrivileged(user) ? "" : "and ta.user_id = $2";
  const params = isPrivileged(user) ? [resultId] : [resultId, user.id];

  const result = await one(
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
              'taxonomy_name', coalesce(atn.name, mtn.name),
              'taxonomy_content_type', coalesce(atn.content_type, 'mains'),
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
      from study_plan.test_results tr
      join study_plan.test_attempts ta on ta.id = tr.attempt_id
      join study_plan.test_templates tt on tt.id = ta.test_template_id
      left join study_plan.result_topic_breakdowns rtb on rtb.result_id = tr.id
      left join assessment.assessment_taxonomy_nodes atn on atn.id = rtb.taxonomy_node_id
      left join assessment.mains_taxonomy_nodes mtn on mtn.id = rtb.mains_taxonomy_node_id
      left join assessment.question_natures qn on qn.id = rtb.question_nature_id
      where tr.id = $1
        ${ownerFilter}
      group by tr.id, ta.id, tt.id
    `,
    params
  );
  if (!result) return null;

  const questions = await query(
    `
      select
        tq.*,
        row_to_json(ar.*) as response,
        score_item.item as score_item
      from study_plan.test_results tr
      join study_plan.test_attempts ta on ta.id = tr.attempt_id
      join study_plan.test_questions tq on tq.test_template_id = ta.test_template_id
      left join study_plan.attempt_responses ar
        on ar.attempt_id = ta.id
       and ar.question_id = tq.id
      left join lateral (
        select item
        from jsonb_array_elements(coalesce(tr.summary_json->'per_question', '[]'::jsonb)) item
        where (item->>'question_version_id')::bigint = tq.id
        limit 1
      ) score_item on true
      where tr.id = $1
      order by tq.display_order asc, tq.id asc
    `,
    [resultId]
  );

  return {
    ...result,
    questions
  };
}

export async function upsertStudyPlanWeek(
  planId: number,
  weekNo: number,
  input: { title: string; description?: string }
): Promise<unknown> {
  const res = await query(
    `
      insert into study_plan.plan_weeks (plan_id, week_no, title, description)
      values ($1, $2, $3, $4)
      on conflict (plan_id, week_no) do update set
        title = excluded.title,
        description = excluded.description,
        updated_at = now()
      returning *
    `,
    [planId, weekNo, input.title, input.description ?? null]
  );
  return res[0];
}

export async function getStudyPlanReviews(planId: number): Promise<unknown[]> {
  return query(
    `
      select
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        r.updated_at,
        row_to_json(u.*) as user
      from study_plan.reviews r
      join app.users u on u.id = r.user_id
      where r.plan_id = $1
      order by r.created_at desc
    `,
    [planId]
  );
}

export async function upsertStudyPlanReview(
  planId: number,
  userId: number,
  input: { rating: number; comment?: string }
): Promise<unknown> {
  const res = await query(
    `
      insert into study_plan.reviews (plan_id, user_id, rating, comment)
      values ($1, $2, $3, $4)
      on conflict (plan_id, user_id) do update set
        rating = excluded.rating,
        comment = excluded.comment,
        updated_at = now()
      returning *
    `,
    [planId, userId, input.rating, input.comment ?? null]
  );
  return res[0];
}

export async function checkUserEnrollment(planId: number, userId: number): Promise<boolean> {
  const res = await one(
    `
      select 1 from study_plan.enrollments
      where plan_id = $1
        and user_id = $2
        and status in ('active', 'completed')
      limit 1
    `,
    [planId, userId]
  );
  return !!res;
}
