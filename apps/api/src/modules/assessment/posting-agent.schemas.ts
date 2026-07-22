import { z } from "zod";

const idSchema = z.coerce.number().int().positive();

// Content types the assessment posting agent understands.
export const assessmentContentTypeSchema = z.enum(["gk", "aptitude", "mains"]);
export const assessmentStatusSchema = z.enum(["draft", "in_review", "approved", "published", "archived"]);

// Reuse the same file/url source contract as the current-affairs agent.
export const assessmentExtractSourceSchema = z
  .object({
    kind: z.enum(["file", "url"]),
    base64_data: z.string().optional(),
    mime_type: z.string().optional(),
    filename: z.string().optional(),
    url: z.string().url().optional()
  })
  .superRefine((value, ctx) => {
    if (value.kind === "file" && (!value.base64_data || !value.mime_type)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "base64_data and mime_type are required for file sources." });
    }
    if (value.kind === "url" && !value.url) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "url is required for url sources." });
    }
  });

export const parseAssessmentAgentSchema = z
  .object({
    raw_text: z.string().trim().min(1).optional(),
    source: assessmentExtractSourceSchema.optional(),
    content_type: assessmentContentTypeSchema,
    exam_id: idSchema,
    instructions: z.string().trim().max(4000).optional()
  })
  .superRefine((value, ctx) => {
    if (!value.raw_text && !value.source) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide either raw_text or a source to parse." });
    }
  });

// One parsed+classified question ready to commit. Taxonomy is the ordered node-id
// path from the tree root down (subject→topic→subtopic for objective;
// paper→subject_area→theme→topic for mains). The commit step maps it to the
// correct save slots.
export const assessmentAgentQuestionSchema = z.object({
  question_statement: z.string().trim().min(1),
  supp_question_statement: z.string().trim().optional(),
  question_prompt: z.string().trim().optional(),
  options: z
    .array(z.object({ label: z.string().trim(), text: z.string().trim() }))
    .optional(),
  correct_answer: z.string().trim().optional(),
  explanation: z.string().trim().optional(),
  // Mains-only fields.
  word_limit: z.number().int().positive().optional(),
  marks: z.number().positive().optional(),
  directive: z.string().trim().optional(),
  // Ordered taxonomy node ids, root → leaf.
  taxonomy_node_ids: z.array(idSchema).max(6).optional()
});

export const commitAssessmentAgentSchema = z.object({
  content_type: assessmentContentTypeSchema,
  exam_id: idSchema,
  publish_mode: z.enum(["auto", "review"]),
  default_status: assessmentStatusSchema.optional(),
  passage_title: z.string().trim().optional(),
  passage_text: z.string().trim().optional(),
  questions: z.array(assessmentAgentQuestionSchema).min(1).max(500)
});

export type AssessmentExtractSourceInput = z.output<typeof assessmentExtractSourceSchema>;
export type ParseAssessmentAgentInput = z.output<typeof parseAssessmentAgentSchema>;
export type CommitAssessmentAgentInput = z.output<typeof commitAssessmentAgentSchema>;
export type AssessmentAgentQuestion = z.output<typeof assessmentAgentQuestionSchema>;
