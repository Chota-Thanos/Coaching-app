import { query } from "../../db.js";
import {
  extractFromDocument,
  extractFromUrl,
  type ExtractedSource
} from "../current-affairs/master/extraction.service.js";
import { parseQuizAI, generateText, parseJsonRobust } from "../current-affairs/master/ai.service.js";
import type { AssessmentExtractSourceInput, ParseAssessmentAgentInput } from "./posting-agent.schemas.js";

interface TaxNodeRow {
  id: string | number;
  parent_id: string | number | null;
  node_type: string;
  name: string;
}

export interface TaxTreeEntry {
  id: number;
  parent_id: number | null;
  node_type: string;
  name: string;
  path: string;
}

export interface AssessmentAgentCandidate {
  question_statement: string;
  supp_question_statement?: string;
  question_prompt?: string;
  options?: { label: string; text: string }[];
  correct_answer?: string;
  explanation?: string;
  // Mains fields.
  word_limit?: number;
  marks?: number;
  directive?: string;
  /** Ordered taxonomy node ids, root → leaf. */
  taxonomy_node_ids: number[];
  taxonomy_path: string;
  warnings: string[];
}

export interface AssessmentParseResult {
  content_type: string;
  exam_id: number;
  extraction_method: string;
  passage_title?: string;
  passage_text?: string;
  candidates: AssessmentAgentCandidate[];
}

/**
 * Loads the taxonomy tree for an exam + content type as flat entries carrying a
 * human-readable path. GK/CSAT use assessment_taxonomy_nodes (filtered by
 * content_type); Mains uses mains_taxonomy_nodes (no content_type dimension).
 */
export async function loadAssessmentTaxonomyTree(
  examId: number,
  contentType: "gk" | "aptitude" | "mains"
): Promise<{ entries: TaxTreeEntry[]; byId: Map<number, TaxTreeEntry> }> {
  const rows =
    contentType === "mains"
      ? await query<TaxNodeRow>(
          `select id, parent_id, node_type, name
             from assessment.mains_taxonomy_nodes
            where exam_id = $1 and is_active is not false
            order by parent_id nulls first, display_order, name`,
          [examId]
        )
      : await query<TaxNodeRow>(
          `select id, parent_id, node_type, name
             from assessment.assessment_taxonomy_nodes
            where exam_id = $1 and content_type = $2 and is_active is not false
            order by parent_id nulls first, display_order, name`,
          [examId, contentType]
        );

  const rawById = new Map<number, TaxNodeRow>();
  for (const row of rows) rawById.set(Number(row.id), row);

  function pathFor(row: TaxNodeRow): string {
    const parts: string[] = [row.name];
    let cursor = row.parent_id ? rawById.get(Number(row.parent_id)) : undefined;
    let guard = 0;
    while (cursor && guard < 10) {
      parts.unshift(cursor.name);
      cursor = cursor.parent_id ? rawById.get(Number(cursor.parent_id)) : undefined;
      guard += 1;
    }
    return parts.join(" > ");
  }

  const entries: TaxTreeEntry[] = rows.map((row) => ({
    id: Number(row.id),
    parent_id: row.parent_id != null ? Number(row.parent_id) : null,
    node_type: row.node_type,
    name: row.name,
    path: pathFor(row)
  }));

  const byId = new Map<number, TaxTreeEntry>();
  for (const entry of entries) byId.set(entry.id, entry);
  return { entries, byId };
}

/** Reconstructs the ordered node-id path (root → leaf) from a leaf id. */
function ancestryPath(leafId: number, byId: Map<number, TaxTreeEntry>): number[] {
  const ids: number[] = [];
  let cursor: TaxTreeEntry | undefined = byId.get(leafId);
  let guard = 0;
  while (cursor && guard < 10) {
    ids.unshift(cursor.id);
    cursor = cursor.parent_id != null ? byId.get(cursor.parent_id) : undefined;
    guard += 1;
  }
  return ids;
}

/**
 * Classifies each question into the single DEEPEST applicable taxonomy node.
 * Returns one leaf id (or null) per question; ancestors are reconstructed by the
 * caller so the full tree path is populated.
 */
async function classifyDeepest(items: string[], entries: TaxTreeEntry[]): Promise<(number | null)[]> {
  const empty = items.map(() => null as number | null);
  if (items.length === 0 || entries.length === 0) return empty;
  const validIds = new Set(entries.map((e) => e.id));

  const systemPrompt = `You classify each exam question into an Indian UPSC coaching platform's taxonomy tree.
For each question, pick the id of the SINGLE most specific node that fits — go as deep as the tree confidently allows (a leaf topic/subtopic if one matches, otherwise its parent subject). Only use ids that appear in the provided tree. If nothing fits, use null.
Return ONLY JSON: {"assignments":[{"index":number,"node_id":number|null}]}`;
  const userPrompt = `TAXONOMY TREE (id → path):
${JSON.stringify(entries.map((e) => ({ id: e.id, path: e.path })))}

QUESTIONS:
${JSON.stringify(items.map((text, index) => ({ index, text: text.slice(0, 500) })))}`;

  try {
    const parsed = parseJsonRobust(await generateText(systemPrompt, userPrompt));
    const assignments: unknown[] = Array.isArray(parsed?.assignments) ? parsed.assignments : [];
    const out = items.map(() => null as number | null);
    for (const raw of assignments) {
      const entry = (raw ?? {}) as Record<string, unknown>;
      const idx = Number(entry.index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) continue;
      const nodeId = Number(entry.node_id);
      out[idx] = validIds.has(nodeId) ? nodeId : null;
    }
    return out;
  } catch (err) {
    console.error("[Assessment Agent] Taxonomy classification failed:", err);
    return empty;
  }
}

async function acquireText(
  raw_text: string | undefined,
  source: AssessmentExtractSourceInput | undefined
): Promise<ExtractedSource> {
  if (raw_text) return { text: raw_text.trim(), extraction_method: "plain_text" };
  if (source?.kind === "url" && source.url) return extractFromUrl(source.url);
  if (source?.kind === "file" && source.base64_data && source.mime_type) {
    return extractFromDocument({
      base64_data: source.base64_data,
      mime_type: source.mime_type,
      filename: source.filename
    });
  }
  throw new Error("No usable source provided.");
}

/**
 * Turns a raw document/web page into structured, taxonomy-classified questions
 * ready to post. Reuses the proven parseQuizAI parser and adds full-tree
 * classification (subject→topic→subtopic for objective; paper→…→topic for mains).
 */
export async function parseAssessmentAgent(input: ParseAssessmentAgentInput): Promise<AssessmentParseResult> {
  const extracted = await acquireText(input.raw_text, input.source);
  if (!extracted.text) {
    throw new Error("No text could be extracted from the source.");
  }

  const quiz = await parseQuizAI({
    rawText: extracted.text,
    aiProvider: "gemini",
    aiModel: "gemini-2.5-flash",
    content_type: input.content_type,
    instructions: input.instructions
  });

  const questions: Record<string, unknown>[] = Array.isArray(quiz?.questions) ? quiz.questions : [];
  const { entries, byId } = await loadAssessmentTaxonomyTree(input.exam_id, input.content_type);
  const statements = questions.map((q) => String(q.question_statement ?? ""));
  const leafIds = await classifyDeepest(statements, entries);

  const isMains = input.content_type === "mains";
  const candidates: AssessmentAgentCandidate[] = questions.map((q, index) => {
    const warnings: string[] = [];
    const leafId = leafIds[index] ?? null;
    const taxonomyIds = leafId != null ? ancestryPath(leafId, byId) : [];
    if (taxonomyIds.length === 0) {
      warnings.push("No taxonomy node matched — assign one before publishing.");
    }
    const taxonomyPath = leafId != null ? byId.get(leafId)?.path ?? "" : "";

    const options = Array.isArray(q.options)
      ? (q.options as Record<string, unknown>[]).map((opt, i) => ({
          label: String(opt.label ?? String.fromCharCode(65 + i)),
          text: String(opt.text ?? "")
        }))
      : undefined;

    if (!isMains && (!options || options.length < 2)) {
      warnings.push("Fewer than 2 options parsed — check the question.");
    }

    return {
      question_statement: String(q.question_statement ?? "").trim(),
      supp_question_statement: q.supp_question_statement ? String(q.supp_question_statement).trim() : undefined,
      question_prompt: q.question_prompt ? String(q.question_prompt).trim() : undefined,
      options: isMains ? undefined : options,
      correct_answer: q.correct_answer ? String(q.correct_answer).trim() : undefined,
      explanation: q.explanation ? String(q.explanation).trim() : undefined,
      word_limit: isMains && q.word_limit ? Number(q.word_limit) : undefined,
      marks: isMains && q.marks ? Number(q.marks) : undefined,
      directive: isMains && q.directive ? String(q.directive).trim() : undefined,
      taxonomy_node_ids: taxonomyIds,
      taxonomy_path: taxonomyPath,
      warnings
    };
  });

  return {
    content_type: input.content_type,
    exam_id: input.exam_id,
    extraction_method: extracted.extraction_method,
    passage_title: typeof quiz?.passage_title === "string" ? quiz.passage_title : undefined,
    passage_text: typeof quiz?.passage_text === "string" ? quiz.passage_text : undefined,
    candidates
  };
}
