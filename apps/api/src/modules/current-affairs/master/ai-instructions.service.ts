import { one } from "../../../db.js";
import { getAlternativeContentTypes } from "./ai.service.js";

/**
 * Reads the per-content-type writing rules an admin has saved in AI Settings
 * (`current_affairs.ai_instructions`).
 *
 * These rules already shaped AI-*written* content, because generateContentAffairsAI
 * loads them itself. The posting/parsing path did not read them at all, so the
 * same content type behaved differently depending on whether the AI wrote it or
 * an editor uploaded a document. That split is the reason this lives in a shared
 * service instead of being inlined again: one place to look up "what are the
 * rules for this kind of content", used by every path that produces articles or
 * questions.
 *
 * Only the free-text `prompt` is used here — not `output_schema`. The posting
 * agent has its own strict output contract that downstream commit code depends
 * on, and letting a saved schema override it would break the commit step rather
 * than change the writing.
 */

export interface SavedRules {
  /** Rules for the content type itself. */
  base: string | null;
  /** Extra rules for one subject, layered on top of the base. */
  subject: string | null;
  /** Human-readable note of what was applied, echoed back to the caller. */
  applied: string[];
}

export const EMPTY_RULES: SavedRules = { base: null, subject: null, applied: [] };

/**
 * Bridges the assessment posting vocabulary to the names the AI-Settings screen
 * saves rules under.
 *
 * `getAlternativeContentTypes` only knows current-affairs names, so without this
 * a rule saved as "Mains Question Generation" was invisible to an uploaded
 * mains paper, which arrives as content type `mains`. The rules would be
 * silently ignored — the exact failure this feature exists to prevent.
 *
 * CSAT maps to two: the settings screen splits it into comprehension and
 * maths/reasoning, while a posted paper is simply `aptitude`.
 */
const ASSESSMENT_RULE_ALIASES: Record<string, string[]> = {
  gk: ["premium_gk_quiz"],
  aptitude: ["premium_passage_quiz", "premium_maths_quiz"],
  mains: ["mains_question_generation"]
};

export async function loadSavedRules(params: {
  /** 'article' for prose and PYQ documents, 'quiz' for question banks. */
  scope: "article" | "quiz";
  /** Content kind/type as the caller knows it, e.g. "daily_current_affairs" or "gk". */
  contentType: string;
  subjectNodeId?: number | null;
}): Promise<SavedRules> {
  const applied: string[] = [];

  // The saved rules and the posting agent use different names for the same
  // content ("prelims_ca" vs "daily_current_affairs"), so match through the
  // existing alias map rather than requiring admins to duplicate rows.
  const candidates = [
    params.contentType,
    ...(ASSESSMENT_RULE_ALIASES[params.contentType] ?? []),
    ...getAlternativeContentTypes(params.contentType)
  ];

  const baseRow = await one<{ title: string; prompt: string }>(
    `select title, prompt
       from current_affairs.ai_instructions
      where scope = $1 and content_type = any($2) and is_active = true
      order by case when content_type = $3 then 1 else 2 end, updated_at desc
      limit 1`,
    [params.scope, candidates, params.contentType]
  );
  if (baseRow) applied.push(baseRow.title);

  let subjectRow: { title: string; prompt: string } | null = null;
  if (params.subjectNodeId) {
    subjectRow = await one<{ title: string; prompt: string }>(
      `select title, prompt
         from current_affairs.ai_instructions
        where scope = 'subject' and subject_node_id = $1 and is_active = true
        order by
          case
            when content_type = $2 then 1
            when content_type = any($3) then 2
            when content_type is null then 3
            else 4
          end,
          updated_at desc
        limit 1`,
      [params.subjectNodeId, params.contentType, candidates]
    );
    if (subjectRow) applied.push(subjectRow.title);
  }

  return {
    base: baseRow?.prompt ?? null,
    subject: subjectRow?.prompt ?? null,
    applied
  };
}

/**
 * Renders saved rules for a prompt. Returns "" when nothing is configured, so
 * callers can append unconditionally.
 *
 * Deliberately labelled as house rules rather than merged silently: the model
 * must be able to tell these apart from the editor's per-request note, which
 * overrides them.
 */
export function renderSavedRules(rules: SavedRules): string {
  const parts: string[] = [];
  if (rules.base) {
    parts.push(`[HOUSE RULES FOR THIS CONTENT TYPE]\n${rules.base}`);
  }
  if (rules.subject) {
    parts.push(`[SUBJECT-SPECIFIC RULES]\n${rules.subject}`);
  }
  if (parts.length === 0) return "";
  return `\n\n${parts.join("\n\n")}\n\nIf the editor's instructions below conflict with these house rules, the editor's instructions win.`;
}
