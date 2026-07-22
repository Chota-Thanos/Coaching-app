import { query } from "../../../db.js";
import { deriveContentFamily } from "./content-family.js";
import { generateText, parseJsonRobust, hasAiCredentials, parseQuizAI } from "./ai.service.js";
import { extractFromDocument, extractFromUrl, type ExtractedSource } from "./extraction.service.js";
import type { ExtractSourceInput, ParsePostingAgentInput } from "../schemas.js";

// ── Category tree loading ─────────────────────────────────────────────────────

interface CategoryNodeRow {
  id: string;
  parent_id: string | null;
  node_type: string;
  name: string;
  slug: string;
}

export interface CategoryTreeEntry {
  id: number;
  node_type: string;
  name: string;
  /** Human-readable path from root, e.g. "Polity > Constitution > Amendments". */
  path: string;
}

/**
 * Loads the active category tree for a content family as a flat list, each entry
 * carrying its full root→node path. This is what the classifier agent matches
 * against, and what the admin preview shows.
 */
export async function loadCategoryTree(contentFamily: string): Promise<CategoryTreeEntry[]> {
  const rows = await query<CategoryNodeRow>(
    `
      select id, parent_id, node_type, name, slug
      from current_affairs.category_nodes
      where content_family = $1 and is_active is not false
      order by parent_id nulls first, display_order, name
    `,
    [contentFamily]
  );

  const byId = new Map<number, CategoryNodeRow>();
  for (const row of rows) byId.set(Number(row.id), row);

  function pathFor(row: CategoryNodeRow): string {
    const parts: string[] = [row.name];
    let cursor = row.parent_id ? byId.get(Number(row.parent_id)) : undefined;
    let guard = 0;
    while (cursor && guard < 10) {
      parts.unshift(cursor.name);
      cursor = cursor.parent_id ? byId.get(Number(cursor.parent_id)) : undefined;
      guard += 1;
    }
    return parts.join(" > ");
  }

  return rows.map((row) => ({
    id: Number(row.id),
    node_type: row.node_type,
    name: row.name,
    path: pathFor(row)
  }));
}

// ── Text acquisition ──────────────────────────────────────────────────────────

export async function resolveSourceText(input: {
  raw_text?: string;
  source?: ExtractSourceInput;
}): Promise<ExtractedSource> {
  if (input.raw_text && input.raw_text.trim()) {
    return { text: input.raw_text.trim(), extraction_method: "plain_text" };
  }
  const source = input.source;
  if (!source) throw new Error("No text or source provided.");
  if (source.kind === "url") {
    return extractFromUrl(source.url!);
  }
  return extractFromDocument({
    base64_data: source.base64_data!,
    mime_type: source.mime_type!,
    filename: source.filename
  });
}

// ── Agent output types ────────────────────────────────────────────────────────

export interface AgentArticleCandidate {
  title: string;
  slug: string;
  body: string;
  body_json?: Record<string, unknown>;
  article_role?: "event" | "concept";
  excerpt?: string;
  publication_date?: string;
  category_node_ids: number[];
  category_paths: string[];
  source_name?: string;
  source_url?: string;
  institute_tags?: string[];
  seo_title?: string;
  seo_description?: string;
  keywords?: string[];
  /** Non-fatal notes surfaced to the editor (e.g. "date inferred", "no category matched"). */
  warnings: string[];
}

export interface AgentParseResult {
  content_kind: string;
  content_family: string;
  extraction_method: string;
  source_name?: string;
  source_url?: string;
  candidates: AgentArticleCandidate[];
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || `article-${Date.now()}`;
}

const PYQ_CONTENT_KINDS = new Set(["prelims_pyq", "mains_pyq"]);

/**
 * Batch-classifies free-text items into the live category tree. Used for PYQs,
 * where each question is classified independently from question generation.
 * Returns one id array per input item (empty when nothing matched).
 */
async function classifyIntoTree(items: string[], tree: CategoryTreeEntry[]): Promise<number[][]> {
  const empty = items.map(() => [] as number[]);
  if (items.length === 0 || tree.length === 0) return empty;
  const validIds = new Set(tree.map((entry) => entry.id));

  const systemPrompt = `You classify each item into an Indian UPSC coaching platform's category tree.
For each item, return the id(s) of the MOST SPECIFIC matching node(s). An item may map to multiple trees — include every relevant one, but be precise. Only use ids that appear in the provided tree.
Return ONLY JSON: {"assignments":[{"index":number,"category_node_ids":[number,...]}]}`;
  const userPrompt = `CATEGORY TREE (id → path):
${JSON.stringify(tree.map((entry) => ({ id: entry.id, path: entry.path })))}

ITEMS:
${JSON.stringify(items.map((text, index) => ({ index, text: text.slice(0, 400) })))}`;

  try {
    const parsed = parseJsonRobust(await generateText(systemPrompt, userPrompt));
    const assignments: unknown[] = Array.isArray(parsed?.assignments) ? parsed.assignments : [];
    const out = items.map(() => [] as number[]);
    for (const raw of assignments) {
      const entry = (raw ?? {}) as Record<string, unknown>;
      const idx = Number(entry.index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) continue;
      const ids = Array.isArray(entry.category_node_ids)
        ? entry.category_node_ids.map((value) => Number(value)).filter((value) => validIds.has(value))
        : [];
      out[idx] = ids;
    }
    return out;
  } catch (err) {
    console.error("[Posting Agent] Category classification failed:", err);
    return empty;
  }
}

function renderPrelimsPyqBody(question: Record<string, unknown>, year: string): string {
  const options = Array.isArray(question.options) ? (question.options as Record<string, unknown>[]) : [];
  const optLines = options
    .map((opt, i) => `(${String.fromCharCode(97 + i)}) ${String(opt.text ?? "")}`)
    .join("\n");
  const stmt = String(question.question_statement ?? "");
  const supp = question.supp_question_statement ? `${String(question.supp_question_statement)}\n\n` : "";
  const prompt = question.question_prompt ? `${String(question.question_prompt)}\n\n` : "";
  return `### Year: ${year}\n\n**${stmt}**\n\n${supp}${prompt}${optLines}\n\n**Correct Answer: (${String(question.correct_answer ?? "")})**\n\n### Explanation\n${String(question.explanation ?? "")}`;
}

function renderMainsPyqBody(question: Record<string, unknown>, year: string): string {
  const marks = question.marks ?? question.max_marks ?? 15;
  const wordLimit = question.word_limit ?? 250;
  const stmt = String(question.question_statement ?? "");
  const model = String(question.explanation ?? question.model_answer ?? "");
  return `### Year: ${year} | Marks: ${marks} | Word Limit: ${wordLimit}\n\n**${stmt}**\n\n### Model Answer\n${model}`;
}

/**
 * PYQ branch: uses the proven quiz parser to structure questions, then classifies
 * each into the category tree and shapes it into the platform's PYQ body_json.
 */
async function parsePyqCandidates(
  text: string,
  contentKind: string,
  tree: CategoryTreeEntry[],
  fallbackDate: string,
  extracted: ExtractedSource,
  instructions?: string
): Promise<AgentArticleCandidate[]> {
  const contentType = contentKind === "mains_pyq" ? "mains" : "gk";
  const quiz = await parseQuizAI({
    rawText: text,
    aiProvider: "gemini",
    aiModel: "gemini-2.5-flash",
    content_type: contentType,
    instructions
  });
  const questions: Record<string, unknown>[] = Array.isArray(quiz?.questions) ? quiz.questions : [];
  if (questions.length === 0) return [];

  const pathById = new Map(tree.map((entry) => [entry.id, entry.path]));
  const statements = questions.map((q) => String(q.question_statement ?? ""));
  const categoryAssignments = await classifyIntoTree(statements, tree);
  const fallbackYear = fallbackDate.slice(0, 4);

  return questions.map((question, index) => {
    const yearRaw = question.year ? String(question.year) : "";
    const year = /^\d{4}$/.test(yearRaw) ? yearRaw : fallbackYear;
    const categoryIds = categoryAssignments[index] ?? [];
    const warnings: string[] = [];
    if (categoryIds.length === 0) warnings.push("No category matched — assign one before publishing.");

    const statement = statements[index] ?? "Question";
    const title = statement.length > 90 ? `${statement.slice(0, 87)}...` : statement || `PYQ ${index + 1}`;

    const options = Array.isArray(question.options)
      ? (question.options as Record<string, unknown>[]).map((opt, i) => ({
          label: String(opt.label ?? String.fromCharCode(65 + i)),
          text: String(opt.text ?? "")
        }))
      : [];

    const bodyJson: Record<string, unknown> =
      contentKind === "mains_pyq"
        ? {
            year,
            question_statement: statement,
            supp_question_statement: question.supp_question_statement ?? undefined,
            word_limit: question.word_limit ?? 250,
            max_marks: question.marks ?? question.max_marks ?? 15,
            model_answer: question.explanation ?? question.model_answer ?? ""
          }
        : {
            year,
            question_statement: statement,
            supp_question_statement: question.supp_question_statement ?? undefined,
            question_prompt: question.question_prompt ?? undefined,
            options,
            correct_answer: question.correct_answer ?? "",
            explanation: question.explanation ?? ""
          };

    const body =
      contentKind === "mains_pyq"
        ? renderMainsPyqBody(question, year)
        : renderPrelimsPyqBody({ ...question, options }, year);

    return {
      title,
      slug: `${slugify(title)}-${year}-${index + 1}`,
      body,
      body_json: bodyJson,
      publication_date: fallbackDate,
      category_node_ids: categoryIds,
      category_paths: categoryIds.map((id) => pathById.get(id) ?? String(id)),
      source_name: extracted.source_name,
      source_url: extracted.source_url,
      warnings
    };
  });
}

// ── The agent ─────────────────────────────────────────────────────────────────

/**
 * Turns a raw document/web page into one or more ready-to-post articles.
 * Reuses the router→generator LLM approach already proven in parseQuizAI:
 *   1. Segment the text into distinct articles.
 *   2. Resolve each article's real publication date (enables back-dating).
 *   3. Classify each into one or more nodes of the live category tree, honouring
 *      any category reference the editor embedded in the source.
 *   4. Normalise into clean, publishable fields.
 */
export async function parsePostingAgent(input: ParsePostingAgentInput): Promise<AgentParseResult> {
  if (!hasAiCredentials()) {
    throw new Error("AI credentials are not configured on the server (set OPENAI_API_KEY, GEMINI_API_KEY, or Vertex AI env vars).");
  }

  const contentFamily = deriveContentFamily(input.content_kind);
  const extracted = await resolveSourceText({ raw_text: input.raw_text, source: input.source });
  if (!extracted.text.trim()) {
    throw new Error("The source produced no text to parse.");
  }

  const tree = await loadCategoryTree(contentFamily);
  const validIds = new Set(tree.map((entry) => entry.id));
  const pathById = new Map(tree.map((entry) => [entry.id, entry.path]));

  const today = new Date().toISOString().slice(0, 10);
  const fallbackDate = input.default_publication_date ?? today;
  const roleMode: "event" | "concept" | "auto" = input.article_role ?? "event";

  // PYQ content kinds are structured as questions, not prose — route them through
  // the quiz parser and shape the results into the platform's PYQ body_json.
  if (PYQ_CONTENT_KINDS.has(input.content_kind)) {
    const candidates = await parsePyqCandidates(
      extracted.text,
      input.content_kind,
      tree,
      fallbackDate,
      extracted,
      input.instructions
    );
    return {
      content_kind: input.content_kind,
      content_family: contentFamily,
      extraction_method: extracted.extraction_method,
      source_name: extracted.source_name,
      source_url: extracted.source_url,
      candidates
    };
  }

  const roleGuidanceByMode: Record<"event" | "concept" | "auto", string> = {
    concept: `MODE: CONCEPT PRIMERS (evergreen). Treat EVERY item as a reusable concept primer.
- These are evergreen explainers of a concept/topic (e.g. "Fiscal Deficit", "Collegium System") — NOT dated news.
- The editor typically writes the concept's name as a title/heading line above each block; use that as the title and start a new article at each such heading.
- "publication_date" is just the date the primer is compiled; use the editor's embedded date if present, otherwise the fallback date. Do not hunt for a news dateline.
- Write a clean, self-contained explainer: definition, why it matters, key dimensions. Do not tie it to a single day's event.
- Set "article_role": "concept" on every item.`,
    event: `MODE: NEWS EVENTS (dated). Treat EVERY item as dated news.
- Segment the input into distinct articles. One coherent story = one article. If the input clearly contains multiple separate items, return multiple articles.
- Preserve the original reporting/publication date. Infer "publication_date" (YYYY-MM-DD) from datelines, "on <date>", "yesterday/today" relative to any dateline, or an editor's explicit date reference embedded in the text. If no date is present anywhere, use the provided fallback date. Back-dating to the real date is expected and correct.
- Set "article_role": "event" on every item.`,
    auto: `MODE: AUTO-CLASSIFY. For EACH item independently decide "article_role":
- "concept" = an evergreen explainer/primer of a topic with no time anchor (definitions, "what is / how it works", background theory). The editor usually places the concept's name as a title/heading line directly above it — treat a titled, timeless block as a concept.
- "event" = dated news tied to a specific happening (datelines, "on <date>", announcements, reports, budgets).
- Honour explicit editor markers FIRST (see EDITOR MARKERS). Only infer when no marker is present. When genuinely unsure, choose "event" and add a warning saying the role was guessed.
- Write each item in the style of its resolved role: events preserve/back-date the reporting date; concepts are self-contained and date-light (embedded or fallback date).`
  };
  const roleGuidance = roleGuidanceByMode[roleMode];

  const systemPrompt = `You are a precise current-affairs desk editor for an Indian UPSC coaching platform. You convert raw source material (news articles, editorials, notes, concept primers, possibly several items concatenated together) into clean, structured, publishable articles.

${roleGuidance}

EDITOR MARKERS (the editor may embed these in the source; when present they OVERRIDE your own inference — treat them as authoritative):
- A title/heading line above a block names that item's title. For concepts, the editor writes the concept's name as the heading above the block.
- "Category:" / "Categories:" lines list target categories. ">" denotes depth in a single tree (Parent > Child > Grandchild); ";" or "|" separates MULTIPLE distinct category trees. Map each to the closest node id in the live tree.
- "Date:" / "Dated:" gives the publication date (accept YYYY-MM-DD or a natural date and normalise to YYYY-MM-DD).
- "[CONCEPT]" / "[EVENT]", or "Type: concept|event", sets that item's article_role explicitly.
- A line of three or more dashes ("---") separates two distinct items.
- "Instructions:" / "Note to editor:" lines are directions for YOU, not article content — follow them and do NOT include them in the output body.
- Never emit any marker text inside "title", "body", or "excerpt".

STRICT RULES:
- Do NOT invent facts. Only restructure and lightly copy-edit the provided text. If the source is thin, keep the article thin — never fabricate.
- "body" must be clean Markdown (headings, bullet points where natural). Remove site chrome, ads, share buttons, cookie notices.
- "excerpt" is a 1-2 sentence summary.

CATEGORY CLASSIFICATION:
- You are given the platform's live category tree with numeric ids and human paths.
- For each article, choose "category_node_ids": the id(s) of the MOST SPECIFIC matching node(s). An article may belong to MULTIPLE category trees at once — include every relevant tree, but be precise, not greedy.
- An editor "Category:"/"Categories:" marker is authoritative: map each listed path to the closest node id, even if you would have chosen differently.
- Only use ids that exist in the provided tree. If a marked category has no matching node, leave it out and add a warning naming the unmatched category. If nothing matches at all, return an empty array and add a warning.

Return ONLY JSON in this exact shape:
{
  "articles": [
    {
      "title": "string",
      "article_role": "event | concept",
      "excerpt": "string",
      "body": "string (markdown)",
      "publication_date": "YYYY-MM-DD",
      "category_node_ids": [number, ...],
      "seo_title": "string",
      "seo_description": "string",
      "keywords": ["string", ...],
      "warnings": ["string", ...]
    }
  ]
}`;

  const userPrompt = `CONTENT KIND: ${input.content_kind} (family: ${contentFamily})
FALLBACK PUBLICATION DATE (use only if none found in text): ${fallbackDate}
TODAY: ${today}
${input.instructions ? `EDITOR INSTRUCTIONS: ${input.instructions}\n` : ""}
LIVE CATEGORY TREE (id → path):
${JSON.stringify(tree.map((entry) => ({ id: entry.id, path: entry.path })))}

RAW SOURCE TEXT:
"""
${extracted.text}
"""`;

  const response = await generateText(systemPrompt, userPrompt);
  const parsed = parseJsonRobust(response);
  const rawArticles: unknown[] = Array.isArray(parsed?.articles) ? parsed.articles : [];

  const candidates: AgentArticleCandidate[] = rawArticles.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const title = String(item.title ?? "").trim() || "Untitled";
    const warnings: string[] = Array.isArray(item.warnings) ? item.warnings.map((w) => String(w)) : [];

    // Validate category ids against the live tree; drop unknowns with a warning.
    const requestedIds: number[] = Array.isArray(item.category_node_ids)
      ? item.category_node_ids.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];
    const categoryIds = requestedIds.filter((id) => validIds.has(id));
    if (requestedIds.length > categoryIds.length) {
      warnings.push("Some suggested categories did not match the live tree and were dropped.");
    }
    if (categoryIds.length === 0) {
      warnings.push("No category matched — assign one before publishing.");
    }

    const pubDate = typeof item.publication_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.publication_date)
      ? item.publication_date
      : fallbackDate;
    if (!item.publication_date) warnings.push(`Publication date defaulted to ${fallbackDate}.`);

    const keywords = Array.isArray(item.keywords) ? item.keywords.map((k) => String(k)).filter(Boolean) : undefined;

    // Resolve the role. In explicit modes the editor's batch choice is authoritative;
    // in auto mode we trust the per-item classification but validate it defensively.
    const suggestedRole = String(item.article_role ?? "").trim().toLowerCase();
    let resolvedRole: "event" | "concept";
    if (roleMode === "auto") {
      if (suggestedRole === "concept") {
        resolvedRole = "concept";
      } else {
        resolvedRole = "event";
        if (suggestedRole !== "event") {
          warnings.push("Role could not be classified from the source — defaulted to Event. Flip to Concept if needed.");
        }
      }
    } else {
      resolvedRole = roleMode;
    }

    return {
      title,
      slug: `${slugify(title)}-${pubDate}`,
      body: String(item.body ?? "").trim(),
      article_role: resolvedRole,
      excerpt: item.excerpt ? String(item.excerpt).trim() : undefined,
      publication_date: pubDate,
      category_node_ids: categoryIds,
      category_paths: categoryIds.map((id) => pathById.get(id) ?? String(id)),
      source_name: extracted.source_name,
      source_url: extracted.source_url,
      institute_tags: input.default_tags,
      seo_title: item.seo_title ? String(item.seo_title).trim() : undefined,
      seo_description: item.seo_description ? String(item.seo_description).trim() : undefined,
      keywords,
      warnings
    };
  });

  return {
    content_kind: input.content_kind,
    content_family: contentFamily,
    extraction_method: extracted.extraction_method,
    source_name: extracted.source_name,
    source_url: extracted.source_url,
    candidates
  };
}
