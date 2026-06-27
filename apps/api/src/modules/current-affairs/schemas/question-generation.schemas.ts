import { z } from "zod";
import { idSchema } from "./base.js";

export const generateAssessmentQuestionsSchema = z.object({
  question_format_id: idSchema,
  question_count: z.coerce.number().int().min(1).max(20).default(5),
  instructions: z.string().trim().optional(),
  taxonomy: z.object({
    exam_id: idSchema,
    exam_level_id: idSchema,
    subject_node_id: idSchema,
    source_node_id: idSchema.optional(),
    topic_node_id: idSchema.optional(),
    subtopic_node_id: idSchema.optional(),
    question_nature_id: idSchema.optional()
  }).optional()
});

export type GenerateAssessmentQuestionsInput = z.output<typeof generateAssessmentQuestionsSchema>;
