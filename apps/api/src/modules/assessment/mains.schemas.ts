import { z } from "zod";
import { listQuerySchema } from "../../common/http.js";
import { questionVersionInputSchema } from "./schemas.js";

const idSchema = z.coerce.number().int().positive();

export const mainsNodeTypeSchema = z.enum(["paper", "subject_area", "theme", "topic", "subtopic"]);

export const createMainsTaxonomyNodeSchema = z.object({
  exam_id: idSchema,
  parent_id: idSchema.nullable().optional(),
  node_type: mainsNodeTypeSchema,
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().nullable().optional(),
  image_url: z.string().trim().nullable().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const updateMainsTaxonomyNodeSchema = z.object({
  parent_id: idSchema.nullable().optional(),
  node_type: mainsNodeTypeSchema.optional(),
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().nullable().optional(),
  image_url: z.string().trim().nullable().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const listMainsTaxonomyQuerySchema = listQuerySchema.extend({
  exam_id: idSchema.optional(),
  parent_id: idSchema.optional(),
  root_only: z.coerce.boolean().optional(),
  node_type: mainsNodeTypeSchema.optional(),
  search: z.string().trim().min(1).optional()
});

export const mainsDetailsInputSchema = z.object({
  word_limit: z.number().int().positive().optional(),
  marks: z.number().nonnegative().optional(),
  directive: z.string().trim().nullable().optional(),
  model_answer: z.string().trim().nullable().optional(),
  answer_framework: z.record(z.unknown()).optional(),
  key_points: z.array(z.unknown()).optional(),
  evaluation_rubric: z.record(z.unknown()).optional()
});

export const mainsTaxonomyInputSchema = z.object({
  exam_id: idSchema,
  exam_level_id: idSchema,
  paper_node_id: idSchema.optional(),
  subject_area_node_id: idSchema.optional(),
  theme_node_id: idSchema.optional(),
  topic_node_id: idSchema.optional(),
  subtopic_node_id: idSchema.optional(),
  question_nature_id: idSchema.optional()
});

export const createMainsQuestionSchema = z.object({
  question_format_id: idSchema,
  status: z.enum(["draft", "in_review", "approved", "published", "archived"]).optional(),
  is_ai_generated: z.boolean().optional(),
  version: questionVersionInputSchema,
  details: mainsDetailsInputSchema,
  taxonomy: mainsTaxonomyInputSchema.optional()
});

export const updateMainsQuestionSchema = z.object({
  question_format_id: idSchema.optional(),
  status: z.enum(["draft", "in_review", "approved", "published", "archived"]).optional(),
  is_ai_generated: z.boolean().optional(),
  details: mainsDetailsInputSchema.partial().optional(),
  taxonomy: mainsTaxonomyInputSchema.optional()
});

export const addMainsQuestionVersionSchema = questionVersionInputSchema.pick({
  question_statement: true,
  supplementary_statement: true,
  statements_facts: true,
  question_prompt: true,
  explanation: true,
  content_json: true
});

export const listMainsQuestionsQuerySchema = listQuerySchema.extend({
  status: z.enum(["draft", "in_review", "approved", "published", "archived"]).optional(),
  exam_id: idSchema.optional(),
  exam_level_id: idSchema.optional(),
  topic_node_id: idSchema.optional(),
  subtopic_node_id: idSchema.optional()
});

export const listMainsEvaluationQueueQuerySchema = listQuerySchema.extend({
  status: z.enum(["pending", "ai_evaluating", "evaluated", "needs_manual_review", "all"]).optional()
});

export const submitMainsAnswerSchema = z.object({
  question_version_id: idSchema,
  attempt_id: idSchema.optional(),
  student_answer_text: z.string().trim().nullable().optional(),
  answer_file_url: z.string().url().nullable().optional()
}).refine((value) => Boolean(value.student_answer_text || value.answer_file_url), {
  message: "Either student_answer_text or answer_file_url is required."
});

export const evaluateMainsAnswerSchema = z.object({
  score: z.number().nonnegative(),
  max_score: z.number().positive(),
  feedback: z.string().trim().nullable().optional(),
  checked_copy_url: z.string().url().nullable().optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional()
});

export type CreateMainsTaxonomyNodeInput = z.output<typeof createMainsTaxonomyNodeSchema>;
export type UpdateMainsTaxonomyNodeInput = z.output<typeof updateMainsTaxonomyNodeSchema>;
export type ListMainsTaxonomyQuery = z.output<typeof listMainsTaxonomyQuerySchema>;
export type CreateMainsQuestionInput = z.output<typeof createMainsQuestionSchema>;
export type UpdateMainsQuestionInput = z.output<typeof updateMainsQuestionSchema>;
export type AddMainsQuestionVersionInput = z.output<typeof addMainsQuestionVersionSchema>;
export type ListMainsQuestionsQuery = z.output<typeof listMainsQuestionsQuerySchema>;
export type ListMainsEvaluationQueueQuery = z.output<typeof listMainsEvaluationQueueQuerySchema>;
export type SubmitMainsAnswerInput = z.output<typeof submitMainsAnswerSchema>;
export type EvaluateMainsAnswerInput = z.output<typeof evaluateMainsAnswerSchema>;

export const mainsOCRRequestSchema = z.object({
  images_base64: z.array(z.string().min(1))
});

export type MainsOCRRequestInput = z.output<typeof mainsOCRRequestSchema>;

