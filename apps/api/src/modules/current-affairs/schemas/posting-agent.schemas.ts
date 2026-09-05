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
        questions: z.array(z.record(z.unknown())).optional(),
        // What picture should accompany the article. `url` is usually absent at
        // this point — the generator specifies the image, the file is attached
        // later — so the intent is stored rather than dropped.
        image: z
          .object({
            url: z.string().url().optional(),
            alt_text: z.string().trim().optional(),
            caption: z.string().trim().optional(),
            search_query: z.string().trim().optional()
          })
          .optional()
      })
    )
    .min(1)
    .max(500)
});

// ── Attach an actual image file to an already-committed article ─────────────
// (`commitPostingAgentSchema`'s `image` field above only ever carries a URL
// or an intent; this carries real bytes for an article that already exists.)

export const attachImageBytesSchema = z.object({
  article_id: idSchema,
  file_name: z.string().trim().min(1),
  base64_data: z.string().trim().min(1),
  mime_type: z.string().trim().min(1),
  alt_text: z.string().trim().optional(),
  caption: z.string().trim().optional()
});

// ── Put an image inside an article's body text ──────────────────────────────
// (`attachImageBytes` above files a picture as the article's hero asset and
// leaves the text alone; this one places it between two blocks of the body.)

export const insertBodyImageSchema = z.object({
  article_id: idSchema,
  file_name: z.string().trim().min(1),
  base64_data: z.string().trim().min(1),
  mime_type: z.string().trim().min(1),
  alt_text: z.string().trim().optional(),
  caption: z.string().trim().optional(),
  // Which top-level block to place the picture after: 0 puts it above
  // everything, omitted appends it to the end. Out-of-range values are clamped
  // rather than rejected — asking for block 40 of a 12-block article plainly
  // means "at the end", and failing the upload over it would be unhelpful.
  after_block: z.number().int().min(0).max(500).optional()
});

// ── Editor rewording (Phase 6) ───────────────────────────────────────────────

const rewordModeEnum = z.enum(["concise", "expand", "simplify", "exam_tone", "grammar"]);

// Accepts either the legacy single `mode` (still what the MCP tool sends) or
// the newer `modes` array (the editor's multi-select combo, e.g. simplify +
// grammar applied together in one pass). Both normalise to `modes: string[]`
// so reword.service.ts only has to handle one shape.
export const rewordSchema = z
  .object({
    text: z.string().trim().min(1).max(20000),
    mode: rewordModeEnum.optional(),
    modes: z.array(rewordModeEnum).min(1).max(5).optional(),
    instructions: z.string().trim().max(2000).optional()
  })
  .transform(({ text, mode, modes, instructions }) => ({
    text,
    modes: Array.from(new Set(modes && modes.length > 0 ? modes : [mode || "exam_tone"])),
    instructions
  }));

export type ExtractSourceInput = z.output<typeof extractSourceSchema>;
export type ParsePostingAgentInput = z.output<typeof parsePostingAgentSchema>;
export type CommitPostingAgentInput = z.output<typeof commitPostingAgentSchema>;
export type AttachImageBytesInput = z.output<typeof attachImageBytesSchema>;
export type InsertBodyImageInput = z.output<typeof insertBodyImageSchema>;
export type RewordInput = z.output<typeof rewordSchema>;
