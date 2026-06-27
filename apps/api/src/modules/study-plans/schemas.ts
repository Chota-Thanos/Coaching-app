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
  published_at: z.string().datetime().optional()
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
  provider: z.string().trim().optional(),
  provider_payment_id: z.string().trim().optional(),
  payment_status: z.enum(["free", "pending", "paid", "refunded", "failed"]).optional(),
  payment_amount: z.coerce.number().int().nonnegative().optional(),
  payment_currency: z.string().trim().length(3).optional(),
  razorpay_order_id: z.string().trim().optional(),
  razorpay_payment_id: z.string().trim().optional()
});

export const updateProgressSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed"])
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

export type ListStudyPlansQuery = z.output<typeof listStudyPlansQuerySchema>;
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
export type UpdateProgressInput = z.output<typeof updateProgressSchema>;
export type StartStudyPlanAttemptInput = z.output<typeof startStudyPlanAttemptSchema>;
export type UpsertStudyPlanResponseInput = z.output<typeof upsertStudyPlanResponseSchema>;
export type SubmitStudyPlanAttemptInput = z.output<typeof submitStudyPlanAttemptSchema>;
