import { z } from "zod";

const idSchema = z.coerce.number().int().positive();
const optionalIdSchema = z.coerce.number().int().positive().optional();

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(2000).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const idParamSchema = z.object({
  id: idSchema
});

export const examIdParamSchema = z.object({
  examId: idSchema
});

export const createExamSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().optional(),
  is_active: z.boolean().optional()
});

export const updateExamSchema = z.object({
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().nullable().optional(),
  is_active: z.boolean().optional()
});

export const createExamLevelSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const updateExamLevelSchema = z.object({
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const questionFamilySchema = z.enum(["objective", "mains_subjective"]);

export const createQuestionFormatSchema = z.object({
  question_family: questionFamilySchema,
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
  description: z.string().trim().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const updateQuestionFormatSchema = z.object({
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/).optional(),
  description: z.string().trim().nullable().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const listQuestionFormatsQuerySchema = listQuerySchema.extend({
  question_family: questionFamilySchema.optional()
});

export const taxonomyNodeTypeSchema = z.enum(["subject", "source_bucket", "topic", "subtopic"]);

export const createTaxonomyNodeSchema = z.object({
  exam_id: idSchema,
  parent_id: idSchema.nullable().optional(),
  node_type: taxonomyNodeTypeSchema,
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().nullable().optional(),
  image_url: z.string().trim().nullable().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  content_type: z.enum(["gk", "aptitude"]).default("gk")
});

export const updateTaxonomyNodeSchema = z.object({
  parent_id: idSchema.nullable().optional(),
  node_type: taxonomyNodeTypeSchema.optional(),
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().nullable().optional(),
  image_url: z.string().trim().nullable().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  content_type: z.enum(["gk", "aptitude"]).optional()
});

export const listTaxonomyNodesQuerySchema = listQuerySchema.extend({
  exam_id: optionalIdSchema,
  parent_id: z.coerce.number().int().positive().optional(),
  root_only: z.coerce.boolean().optional(),
  node_type: taxonomyNodeTypeSchema.optional(),
  content_type: z.enum(["gk", "aptitude"]).optional()
});

export const listAttemptsQuerySchema = listQuerySchema.extend({
  content_type: z.enum(["gk", "aptitude"]).optional()
});

export const createQuestionNatureSchema = z.object({
  exam_id: idSchema,
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const updateQuestionNatureSchema = z.object({
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().nullable().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const listQuestionNaturesQuerySchema = listQuerySchema.extend({
  exam_id: optionalIdSchema
});

export const createPassageSchema = z.object({
  title: z.string().trim().optional(),
  body: z.string().trim().min(1),
  status: z.enum(["draft", "in_review", "approved", "published", "archived"]).optional(),
  created_by_user_id: z.number().int().positive().optional(),
  is_ai_generated: z.boolean().optional()
});

export const updatePassageSchema = z.object({
  title: z.string().trim().nullable().optional(),
  body: z.string().trim().min(1).optional(),
  status: z.enum(["draft", "in_review", "approved", "published", "archived"]).optional(),
  is_ai_generated: z.boolean().optional()
});

export const questionVersionInputSchema = z.object({
  question_statement: z.string().trim().min(1),
  supplementary_statement: z.string().trim().nullable().optional(),
  statements_facts: z.array(z.unknown()).optional(),
  question_prompt: z.string().trim().nullable().optional(),
  options: z.array(z.unknown()).optional(),
  correct_answer: z.unknown().optional(),
  explanation: z.string().trim().nullable().optional(),
  content_json: z.record(z.unknown()).optional(),
  created_by_user_id: z.number().int().positive().optional()
});

export const questionTaxonomyInputSchema = z.object({
  exam_id: idSchema,
  exam_level_id: idSchema,
  subject_node_id: idSchema,
  source_node_id: idSchema.optional(),
  topic_node_id: idSchema.optional(),
  subtopic_node_id: idSchema.optional(),
  question_nature_id: idSchema.optional()
});

export const createQuestionSchema = z.object({
  question_family: questionFamilySchema.default("objective"),
  question_format_id: idSchema,
  status: z.enum(["draft", "in_review", "approved", "published", "archived"]).optional(),
  created_by_user_id: z.number().int().positive().optional(),
  is_ai_generated: z.boolean().optional(),
  version: questionVersionInputSchema,
  taxonomy: questionTaxonomyInputSchema.optional(),
  passage: z.object({
    passage_id: idSchema,
    display_order: z.number().int().optional()
  }).optional()
});

export const updateQuestionAdminSchema = z.object({
  question_format_id: idSchema.optional(),
  status: z.enum(["draft", "in_review", "approved", "published", "archived"]).optional(),
  is_ai_generated: z.boolean().optional()
});

export const addQuestionVersionSchema = questionVersionInputSchema;

export const replaceQuestionTaxonomySchema = questionTaxonomyInputSchema;

const arrayOrCSVCoerce = z.preprocess((val) => {
  if (typeof val === 'string' && val.trim() !== '') {
    return val.split(',').map((x) => Number(x.trim())).filter((x) => !isNaN(x));
  }
  if (Array.isArray(val)) {
    return val.map((x) => Number(x)).filter((x) => !isNaN(x));
  }
  if (typeof val === 'number') {
    return [val];
  }
  return val;
}, z.array(z.number().int().positive())).optional();

export const listQuestionsQuerySchema = listQuerySchema.extend({
  question_family: questionFamilySchema.optional(),
  status: z.enum(["draft", "in_review", "approved", "published", "archived"]).optional(),
  question_format_id: optionalIdSchema,
  exam_id: optionalIdSchema,
  exam_level_id: optionalIdSchema,
  subject_node_id: optionalIdSchema,
  source_node_id: optionalIdSchema,
  topic_node_id: optionalIdSchema,
  subtopic_node_id: optionalIdSchema,
  question_nature_id: optionalIdSchema,
  content_type: z.enum(["gk", "aptitude"]).optional(),
  subject_node_ids: arrayOrCSVCoerce,
  topic_node_ids: arrayOrCSVCoerce,
  subtopic_node_ids: arrayOrCSVCoerce
});

export const questionCountsQuerySchema = z.object({
  exam_id: idSchema,
  exam_level_id: idSchema.optional(),
  question_family: questionFamilySchema.optional()
});

export const bulkUpdateQuestionsTaxonomySchema = z.object({
  ids: z.array(idSchema),
  exam_id: idSchema.optional(),
  exam_level_id: idSchema.optional(),
  subject_node_id: idSchema.optional(),
  source_node_id: idSchema.optional().nullable(),
  topic_node_id: idSchema.optional().nullable(),
  subtopic_node_id: idSchema.optional().nullable(),
  question_nature_id: idSchema.optional().nullable(),
  status: z.enum(["draft", "in_review", "approved", "published", "archived"]).optional()
});

export const startDynamicAttemptSchema = z.object({
  exam_id: idSchema,
  exam_level_id: idSchema.optional(),
  subject_node_id: idSchema,
  topic_node_id: idSchema.optional().nullable(),
  subtopic_node_id: idSchema.optional().nullable(),
  question_nature_id: idSchema.optional().nullable(),
  question_count: z.coerce.number().int().min(1).max(100),
  test_type: z.enum(["quick_test", "sectional_test", "full_length_test", "pyq_test", "diagnostic_test"]),
  question_family: z.enum(["objective", "mains_subjective"]).default("objective").optional(),
  include_attempted: z.boolean().optional().default(false)
});

export const compiledCategorySchema = z.object({
  subject_node_id: idSchema,
  topic_node_id: idSchema.optional().nullable(),
  subtopic_node_id: idSchema.optional().nullable(),
  question_nature_id: idSchema.optional().nullable(),
  question_count: z.coerce.number().int().min(1).max(50),
  question_family: z.enum(["objective", "mains_subjective"]).default("objective").optional()
});

export const startCompiledAttemptSchema = z.object({
  exam_id: idSchema,
  exam_level_id: idSchema.optional(),
  test_type: z.enum(["quick_test", "sectional_test", "full_length_test", "pyq_test", "diagnostic_test"]),
  categories: z.array(compiledCategorySchema).min(1),
  include_attempted: z.boolean().optional().default(false),
  title: z.string().trim().min(1).optional()
});

export const createTestTemplateSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().optional(),
  exam_id: idSchema,
  exam_level_id: idSchema,
  test_type: z.enum(["quick_test", "sectional_test", "full_length_test", "pyq_test", "mains_test", "diagnostic_test"]).optional(),
  duration_minutes: z.number().int().positive(),
  total_marks: z.number().nonnegative().optional(),
  negative_marking_config: z.record(z.unknown()).optional(),
  cutoff_config: z.record(z.unknown()).optional(),
  access_type: z.enum(["free", "subscription", "paid", "private"]).optional(),
  subscription_plan_id: z.number().int().positive().optional(),
  status: z.enum(["draft", "in_review", "published", "archived"]).optional(),
  created_by_user_id: z.number().int().positive().optional(),
  published_at: z.string().datetime().optional()
});

export const updateTestTemplateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().nullable().optional(),
  exam_id: idSchema.optional(),
  exam_level_id: idSchema.optional(),
  test_type: z.enum(["quick_test", "sectional_test", "full_length_test", "pyq_test", "mains_test", "diagnostic_test"]).optional(),
  duration_minutes: z.number().int().positive().optional(),
  total_marks: z.number().nonnegative().optional(),
  negative_marking_config: z.record(z.unknown()).optional(),
  cutoff_config: z.record(z.unknown()).optional(),
  access_type: z.enum(["free", "subscription", "paid", "private"]).optional(),
  subscription_plan_id: z.number().int().positive().nullable().optional(),
  status: z.enum(["draft", "in_review", "published", "archived"]).optional(),
  published_at: z.string().datetime().nullable().optional()
});

export const listTestTemplatesQuerySchema = listQuerySchema.extend({
  exam_id: optionalIdSchema,
  exam_level_id: optionalIdSchema,
  status: z.enum(["draft", "in_review", "published", "archived"]).optional(),
  access_type: z.enum(["free", "subscription", "paid", "private"]).optional(),
  content_type: z.enum(["gk", "aptitude", "mains"]).optional()
});

export const bulkUpdateTestTemplatesTaxonomySchema = z.object({
  ids: z.array(idSchema),
  exam_id: idSchema.optional(),
  exam_level_id: idSchema.optional(),
  subject_node_id: idSchema.optional(),
  topic_node_id: idSchema.optional().nullable(),
  subtopic_node_id: idSchema.optional().nullable(),
  status: z.enum(["draft", "in_review", "published", "archived"]).optional()
});

export const createTestSectionSchema = z.object({
  title: z.string().trim().min(1),
  display_order: z.number().int().optional(),
  duration_minutes: z.number().int().positive().optional(),
  instructions: z.string().trim().optional()
});

export const updateTestSectionSchema = z.object({
  title: z.string().trim().min(1).optional(),
  display_order: z.number().int().optional(),
  duration_minutes: z.number().int().positive().nullable().optional(),
  instructions: z.string().trim().nullable().optional()
});

export const testTemplateIdParamSchema = z.object({
  testTemplateId: idSchema
});

export const addTestQuestionItemSchema = z.object({
  test_section_id: idSchema.optional(),
  question_version_id: idSchema,
  marks: z.number().nonnegative().optional(),
  negative_marks: z.number().nonnegative().optional(),
  display_order: z.number().int().optional()
});

export const updateTestQuestionItemSchema = z.object({
  test_section_id: idSchema.nullable().optional(),
  marks: z.number().nonnegative().optional(),
  negative_marks: z.number().nonnegative().optional(),
  display_order: z.number().int().optional()
});

export const startAttemptSchema = z.object({});

export const attemptIdParamSchema = z.object({
  attemptId: idSchema
});

export const leaderboardQuerySchema = listQuerySchema.extend({
  test_template_id: idSchema,
  result_id: idSchema.optional()
});

export const upsertAttemptResponseSchema = z.object({
  question_version_id: idSchema,
  selected_answer: z.unknown().optional(),
  answer_text: z.string().optional(),
  status: z.enum(["not_visited", "answered", "skipped", "marked_for_review"]).optional(),
  is_marked_for_review: z.boolean().optional(),
  time_spent_seconds: z.number().int().nonnegative().optional()
});

export const submitAttemptSchema = z.object({
  submit_idempotency_key: z.string().trim().min(8).optional(),
  time_spent_seconds: z.number().int().nonnegative().optional()
});

export type CreateExamInput = z.output<typeof createExamSchema>;
export type UpdateExamInput = z.output<typeof updateExamSchema>;
export type CreateExamLevelInput = z.output<typeof createExamLevelSchema>;
export type UpdateExamLevelInput = z.output<typeof updateExamLevelSchema>;
export type CreateQuestionFormatInput = z.output<typeof createQuestionFormatSchema>;
export type UpdateQuestionFormatInput = z.output<typeof updateQuestionFormatSchema>;
export type CreateTaxonomyNodeInput = z.output<typeof createTaxonomyNodeSchema>;
export type UpdateTaxonomyNodeInput = z.output<typeof updateTaxonomyNodeSchema>;
export type CreateQuestionNatureInput = z.output<typeof createQuestionNatureSchema>;
export type UpdateQuestionNatureInput = z.output<typeof updateQuestionNatureSchema>;
export type CreatePassageInput = z.output<typeof createPassageSchema>;
export type UpdatePassageInput = z.output<typeof updatePassageSchema>;
export type CreateQuestionInput = z.output<typeof createQuestionSchema>;
export type UpdateQuestionAdminInput = z.output<typeof updateQuestionAdminSchema>;
export type AddQuestionVersionInput = z.output<typeof addQuestionVersionSchema>;
export type ReplaceQuestionTaxonomyInput = z.output<typeof replaceQuestionTaxonomySchema>;
export type ListQuestionsQuery = z.output<typeof listQuestionsQuerySchema>;
export type QuestionCountsQuery = z.output<typeof questionCountsQuerySchema>;
export type CreateTestTemplateInput = z.output<typeof createTestTemplateSchema>;
export type UpdateTestTemplateInput = z.output<typeof updateTestTemplateSchema>;
export type ListTestTemplatesQuery = z.output<typeof listTestTemplatesQuerySchema>;
export type CreateTestSectionInput = z.output<typeof createTestSectionSchema>;
export type UpdateTestSectionInput = z.output<typeof updateTestSectionSchema>;
export type AddTestQuestionItemInput = z.output<typeof addTestQuestionItemSchema>;
export type UpdateTestQuestionItemInput = z.output<typeof updateTestQuestionItemSchema>;
export type StartAttemptInput = z.output<typeof startAttemptSchema>;
export type UpsertAttemptResponseInput = z.output<typeof upsertAttemptResponseSchema>;
export type SubmitAttemptInput = z.output<typeof submitAttemptSchema>;
export type LeaderboardQuery = z.output<typeof leaderboardQuerySchema>;
export type ListAttemptsQuery = z.output<typeof listAttemptsQuerySchema>;
export type BulkUpdateQuestionsTaxonomyInput = z.output<typeof bulkUpdateQuestionsTaxonomySchema>;
export type StartDynamicAttemptInput = z.output<typeof startDynamicAttemptSchema>;
export type StartCompiledAttemptInput = z.output<typeof startCompiledAttemptSchema>;
