import { z } from "zod";
import { articleRoleSchema, idSchema, masterArticleKindSchema, masterArticleStatusSchema } from "./base.js";

// ── Extraction (Phase 1) ─────────────────────────────────────────────────────

export const extractSourceSchema = z
  .object({
    kind: z.enum(["file", "url"]),
    // File source (base64, mirrors the assessment parser contract).
    base64_data: z.string().optional(),
    mime_type: z.string().optional(),
    filename: z.string().optional(),
    // URL source.
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

// ── Agent parse (Phase 2) ────────────────────────────────────────────────────

export const parsePostingAgentSchema = z.object({
  // Raw text already extracted by /extract, OR a source to extract inline.
  raw_text: z.string().trim().min(1).optional(),
  source: extractSourceSchema.optional(),
  content_kind: masterArticleKindSchema,
  // "concept" = evergreen reusable primer (kept out of the daily feed); "event" = dated news;
  // "auto" = let the agent classify each item as event or concept.
  article_role: z.enum(["event", "concept", "auto"]).optional(),
  // Fallback publication date if the agent cannot infer one from the text.
  default_publication_date: z.string().date().optional(),
  default_status: masterArticleStatusSchema.optional(),
  default_tags: z.array(z.string().trim().min(1)).optional(),
  // Optional editorial guidance passed to the agent.
  instructions: z.string().trim().max(4000).optional()
}).superRefine((value, ctx) => {
  if (!value.raw_text && !value.source) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide either raw_text or a source to parse." });
  }
});

// Per-batch publish choice made when committing agent output.
export const commitPostingAgentSchema = z.object({
  content_kind: masterArticleKindSchema,
  article_role: articleRoleSchema.optional(),
  publish_mode: z.enum(["auto", "review"]),
  default_status: masterArticleStatusSchema.optional(),
  articles: z
    .array(
      z.object({
        content_kind: masterArticleKindSchema.optional(),
        article_role: articleRoleSchema.optional(),
        title: z.string().trim().min(1),
        slug: z.string().trim().optional(),
        body: z.string().trim().min(1),
        // Structured payload for PYQs (question_statement, options, etc.) or any
        // extra fields the article stores in body_json.
        body_json: z.record(z.unknown()).optional(),
        excerpt: z.string().trim().optional(),
        publication_date: z.string().date().optional(),
        category_node_ids: z.array(idSchema).max(50).optional(),
        source_name: z.string().trim().optional(),
        source_url: z.string().url().optional(),
        institute_tags: z.array(z.string().trim().min(1)).optional(),
        seo_title: z.string().trim().optional(),
        seo_description: z.string().trim().optional(),
        keywords: z.array(z.string().trim()).optional(),
        // Structured questions for PYQ content kinds (Phase 4).
        questions: z.array(z.record(z.unknown())).optional()
      })
    )
    .min(1)
    .max(500)
});

// ── Editor rewording (Phase 6) ───────────────────────────────────────────────

export const rewordSchema = z.object({
  text: z.string().trim().min(1).max(20000),
  mode: z.enum(["concise", "expand", "simplify", "exam_tone", "grammar"]).default("exam_tone"),
  instructions: z.string().trim().max(2000).optional()
});

export type ExtractSourceInput = z.output<typeof extractSourceSchema>;
export type ParsePostingAgentInput = z.output<typeof parsePostingAgentSchema>;
export type CommitPostingAgentInput = z.output<typeof commitPostingAgentSchema>;
export type RewordInput = z.output<typeof rewordSchema>;
