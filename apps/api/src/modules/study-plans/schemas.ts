import { z } from "zod";
import { listQuerySchema } from "../../common/http.js";

const idSchema = z.coerce.number().int().positive();
const optionalIdSchema = z.coerce.number().int().positive().optional();
const nullableIdSchema = z.coerce.number().int().positive().nullable().optional();

export const planStatusSchema = z.enum(["draft", "in_review", "published", "archived"]);
export const studyPlanTestTypeSchema = z.enum(["prelims_test", "csat_test", "mains_test"]);
export const planItemTypeSchema = z.enum([
  "reading",
  "revision",
  "prelims_test",
  "csat_test",
  "mains_test",
  "live_lecture"
]);

export const listStudyPlansQuerySchema = listQuerySchema.extend({
  exam_id: optionalIdSchema,
  status: planStatusSchema.optional()
});

export const createStudyPlanSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  subtitle: z.string().trim().optional(),
  description: z.string().trim().optional(),
  exam_id: idSchema,
  subject_node_id: nullableIdSchema,
  duration_weeks: z.coerce.number().int().positive(),
  level_label: z.string().trim().optional(),
  language: z.string().trim().min(1).default("English"),
  cover_image_url: z.string().trim().optional(),
  preview_video_url: z.string().trim().optional(),
  price_amount_minor: z.coerce.number().int().nonnegative().default(0),
  currency: z.string().trim().length(3).default("INR"),
  status: planStatusSchema.default("draft"),
  published_at: z.string().datetime().optional(),
  /** What kind of product this is — drives the card, the detail page and the
   *  workspace. See database/migrations/055. */
  plan_type: z.enum(["full_course", "self_prep", "test_series"]).default("self_prep"),
  /** How a learner gets in: bought outright, covered by a subscription, or free. */
  access_mode: z.enum(["one_time", "subscription", "free"]).default("one_time"),
  /** Which entitlement unlocks it when access_mode is "subscription". */
  required_entitlement_key: z.string().trim().nullable().optional(),
  weekly_hours: z.coerce.number().positive().nullable().optional(),
  /** Benchmark the depth signal compares a learner's test average against. */
  target_accuracy: z.coerce.number().positive().max(100).optional()
});

export const updateStudyPlanSchema = createStudyPlanSchema.partial().extend({
  subject_node_id: nullableIdSchema,
  subtitle: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  level_label: z.string().trim().nullable().optional(),
  cover_image_url: z.string().trim().nullable().optional(),
  preview_video_url: z.string().trim().nullable().optional(),
  published_at: z.string().datetime().nullable().optional()
});

export const createPlanItemSchema = z.object({
  week_no: z.coerce.number().int().positive(),
  day_no: z.coerce.number().int().min(1).max(7),
  display_order: z.coerce.number().int().default(0),
  item_type: planItemTypeSchema,
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  estimated_minutes: z.coerce.number().int().positive().optional(),
  resource_url: z.string().trim().optional(),
  lecture_url: z.string().trim().optional(),
  test_template_id: nullableIdSchema,
  is_preview: z.boolean().default(false)
});

export const updatePlanItemSchema = createPlanItemSchema.partial().extend({
  description: z.string().trim().nullable().optional(),
  estimated_minutes: z.coerce.number().int().positive().nullable().optional(),
  resource_url: z.string().trim().nullable().optional(),
  lecture_url: z.string().trim().nullable().optional(),
  test_template_id: nullableIdSchema
});

export const listStudyPlanTestsQuerySchema = listQuerySchema.extend({
  exam_id: optionalIdSchema,
  exam_level_id: optionalIdSchema,
  test_type: studyPlanTestTypeSchema.optional(),
  status: planStatusSchema.optional()
});

export const createStudyPlanTestSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().optional(),
  exam_id: idSchema,
  exam_level_id: idSchema,
  test_type: studyPlanTestTypeSchema,
  duration_minutes: z.coerce.number().int().positive(),
  total_marks: z.coerce.number().nonnegative().default(0),
  negative_marks_per_question: z.coerce.number().nonnegative().default(0),
  instructions: z.string().trim().optional(),
  status: planStatusSchema.default("draft"),
  published_at: z.string().datetime().optional()
});

export const updateStudyPlanTestSchema = createStudyPlanTestSchema.partial().extend({
  description: z.string().trim().nullable().optional(),
  instructions: z.string().trim().nullable().optional(),
  published_at: z.string().datetime().nullable().optional()
});

export const createStudyPlanQuestionSchema = z.object({
  display_order: z.coerce.number().int().default(0),
  question_family: z.enum(["objective", "mains_subjective"]).default("objective"),
  question_statement: z.string().trim().min(1),
  supplementary_statement: z.string().trim().optional(),
  question_prompt: z.string().trim().optional(),
  options: z.array(z.unknown()).default([]),
  correct_answer: z.unknown().optional(),
  explanation: z.string().trim().optional(),
  model_answer: z.string().trim().optional(),
  marks: z.coerce.number().nonnegative().default(1),
  negative_marks: z.coerce.number().nonnegative().default(0),
  subject_node_id: nullableIdSchema,
  topic_node_id: nullableIdSchema,
  subtopic_node_id: nullableIdSchema,
  question_nature_id: nullableIdSchema,
  source_payload: z.record(z.unknown()).default({})
});

export const updateStudyPlanQuestionSchema = createStudyPlanQuestionSchema.partial().extend({
  supplementary_statement: z.string().trim().nullable().optional(),
  question_prompt: z.string().trim().nullable().optional(),
  explanation: z.string().trim().nullable().optional(),
  model_answer: z.string().trim().nullable().optional(),
  subject_node_id: nullableIdSchema,
  topic_node_id: nullableIdSchema,
  subtopic_node_id: nullableIdSchema,
  question_nature_id: nullableIdSchema
});

export const enrollStudyPlanSchema = z.object({
  /** The learner's chosen start date (YYYY-MM-DD). Defaults to today. */
  start_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** ISO weekdays the learner studies, Monday = 1 through Sunday = 7. */
  study_days: z.array(z.coerce.number().int().min(1).max(7)).min(1).max(7).optional(),
  provider: z.string().trim().optional(),
  provider_payment_id: z.string().trim().optional(),
  payment_status: z.enum(["free", "pending", "paid", "refunded", "failed"]).optional(),
  payment_amount: z.coerce.number().int().nonnegative().optional(),
  payment_currency: z.string().trim().length(3).optional(),
  razorpay_order_id: z.string().trim().optional(),
  razorpay_payment_id: z.string().trim().optional()
});

/** One attachment on a plan day — a chapter reference, a PDF, a link, a note. */
export const createPlanItemResourceSchema = z.object({
  title: z.string().trim().min(1),
  resource_kind: z.enum(["link", "pdf", "note", "video", "book_pages"]).default("link"),
  url: z.string().trim().nullable().optional(),
  body: z.string().trim().nullable().optional(),
  display_order: z.coerce.number().int().default(0)
}).refine((value) => Boolean(value.url) || Boolean(value.body), {
  message: "A resource needs either a URL or some body text."
});

export const updatePlanItemResourceSchema = z.object({
  title: z.string().trim().min(1).optional(),
  resource_kind: z.enum(["link", "pdf", "note", "video", "book_pages"]).optional(),
  url: z.string().trim().nullable().optional(),
  body: z.string().trim().nullable().optional(),
  display_order: z.coerce.number().int().optional()
});

export const updateProgressSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed"]),
  /** Seconds the learner actually spent on the item. Accumulated, not
   *  replaced, so re-opening a day adds to the total rather than resetting it.
   *  This is what lets the tracker's depth signal tell a read from a
   *  click-through. */
  time_spent_seconds: z.coerce.number().int().nonnegative().max(86400).optional(),
  /** Where the learner stopped watching, so "Resume" has somewhere to resume
   *  from. Replaced rather than accumulated — it is a position, not a total. */
  last_position_seconds: z.coerce.number().int().nonnegative().max(86400).optional()
});

export const startStudyPlanAttemptSchema = z.object({
  plan_item_id: optionalIdSchema
});

export const upsertStudyPlanResponseSchema = z.object({
  question_id: idSchema,
  selected_answer: z.unknown().optional(),
  answer_text: z.string().optional(),
  status: z.enum(["not_visited", "answered", "skipped", "marked_for_review"]).optional(),
  is_marked_for_review: z.boolean().optional(),
  time_spent_seconds: z.coerce.number().int().nonnegative().optional()
});

export const submitStudyPlanAttemptSchema = z.object({
  time_spent_seconds: z.coerce.number().int().nonnegative().optional(),
  submit_idempotency_key: z.string().trim().optional()
});

export const saveStudyPlanQuestionsDraftSchema = z.object({
  test_template_id: idSchema,
  questions: z.array(createStudyPlanQuestionSchema).min(1)
});

export const parseStudyPlanQuestionsSchema = z.object({
  raw_text: z.string().trim().min(1),
  content_type: z.enum(["gk", "aptitude", "csat_math", "csat_passage", "mains"]).optional(),
  instructions: z.string().trim().optional()
});

export const idParamSchema = z.object({ id: idSchema });
export const testTemplateIdParamSchema = z.object({ testTemplateId: idSchema });
export const attemptIdParamSchema = z.object({ attemptId: idSchema });
export const liveClassIdParamSchema = z.object({ liveClassId: idSchema });

export const liveClassActivityQuerySchema = z.object({
  /** Last message id the caller already has; 0 or absent means "from the top". */
  after: z.coerce.number().int().nonnegative().optional()
});

export const postLiveClassMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000)
});

export const setLiveClassHandSchema = z.object({
  raised: z.boolean(),
  /** Host only, to lower a student's hand after calling on them. */
  user_id: optionalIdSchema
});

export const scheduleLiveClassSchema = z.object({
  plan_item_id: optionalIdSchema,
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  host_user_id: idSchema,
  scheduled_start: z.string().datetime(),
  scheduled_end: z.string().datetime().optional()
});

export type ListStudyPlansQuery = z.output<typeof listStudyPlansQuerySchema>;
export type ScheduleLiveClassInput = z.output<typeof scheduleLiveClassSchema>;
export type CreateStudyPlanInput = z.output<typeof createStudyPlanSchema>;
export type UpdateStudyPlanInput = z.output<typeof updateStudyPlanSchema>;
export type CreatePlanItemInput = z.output<typeof createPlanItemSchema>;
export type UpdatePlanItemInput = z.output<typeof updatePlanItemSchema>;
export type ListStudyPlanTestsQuery = z.output<typeof listStudyPlanTestsQuerySchema>;
export type CreateStudyPlanTestInput = z.output<typeof createStudyPlanTestSchema>;
export type UpdateStudyPlanTestInput = z.output<typeof updateStudyPlanTestSchema>;
export type CreateStudyPlanQuestionInput = z.output<typeof createStudyPlanQuestionSchema>;
export type UpdateStudyPlanQuestionInput = z.output<typeof updateStudyPlanQuestionSchema>;
export type EnrollStudyPlanInput = z.output<typeof enrollStudyPlanSchema>;
export type CreatePlanItemResourceInput = z.output<typeof createPlanItemResourceSchema>;
export type UpdatePlanItemResourceInput = z.output<typeof updatePlanItemResourceSchema>;
export type UpdateProgressInput = z.output<typeof updateProgressSchema>;
export type StartStudyPlanAttemptInput = z.output<typeof startStudyPlanAttemptSchema>;
export type UpsertStudyPlanResponseInput = z.output<typeof upsertStudyPlanResponseSchema>;
export type SubmitStudyPlanAttemptInput = z.output<typeof submitStudyPlanAttemptSchema>;
