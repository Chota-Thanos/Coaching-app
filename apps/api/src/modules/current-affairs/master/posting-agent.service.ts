import { query } from "../../../db.js";
import { deriveContentFamily } from "./content-family.js";
import { generateText, parseJsonRobust, hasAiCredentials, parseQuizAI } from "./ai.service.js";
import { extractFromDocument, extractFromUrl, type ExtractedSource } from "./extraction.service.js";
import type { ExtractSourceInput, ParsePostingAgentInput } from "../schemas.js";
import { loadSavedRules, renderSavedRules } from "./ai-instructions.service.js";
import { ensureHtmlBody } from "./html-body.js";

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
  /**
   * Titles of the saved AI-Settings rules applied to this parse. Empty means no
   * house rules are configured for this content type — worth surfacing so an
   * editor is not left assuming rules were followed when none exist.
   */
  applied_rules: string[];
  candidates: AgentArticleCandidate[];
}

/**
 * Markdown-to-HTML safety net for article bodies. Defined in `html-body.ts`
 * because article *edits* need the identical guarantee; re-exported here so
 * existing importers of this module keep working.
 */
export { looksLikeMarkdown, markdownToHtml, ensureHtmlBody } from "./html-body.js";

/**
 * Flags the "every fact got its own heading" pattern — a real bug seen in
 * production: a scheme's Ministry, Launch date, Objective and Beneficiaries
 * each rendered as their own <h2> with one short sentence under it, instead
 * of being grouped as bulleted facts under one shared heading.
 *
 * Deliberately a warning, never a rewrite. Which fields are "one fact" versus
 * "a genuine list" is an editorial call the writer already makes (or a human
 * reviewer makes on read-through) — this only makes sure the pattern doesn't
 * slip through unnoticed, the same role `ensureHtmlBody`'s conversion warning
 * already plays for literal Markdown leaking through.
 *
 * This function runs for every content kind that flows through this parser —
 * Mains Topic Notes and concepts included, both of which legitimately have
 * their own short standalone sections by design (a one-line "Constitutional
 * and Legal Basis" citing a single Article is correct there, not a bug). A
 * rewrite step would risk corrupting exactly that kind of legitimate short
 * section on a content type this function has no awareness of; a warning
 * cannot corrupt anything, so it is the safe layer to add for every content
 * kind, not just daily news. The threshold (3+ back-to-back short, list-less
 * headings) is set high enough that a normal, deliberately-short section
 * pair never trips it.
 */
export function detectFactHeadingSprawl(bodyHtml: string): boolean {
  const sections = bodyHtml.split(/(?=<h[1-6][ >])/i).filter((section) => /^<h[1-6][ >]/i.test(section));
  let shortNoListCount = 0;
  for (const section of sections) {
    const afterHeading = section.replace(/^<h[1-6][^>]*>.*?<\/h[1-6]>/is, "");
    // <details> is a Mains Note pointer (collapsed label + hidden explanation) —
    // a section built from several of these is a real list, just not a <ul> one.
    if (/<ul|<ol|<details/i.test(afterHeading)) continue; // has a real list underneath — not a bare fact
    const text = afterHeading.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text.length > 0 && text.length <= 160) shortNoListCount += 1;
  }
  return shortNoListCount >= 3;
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
): Promise<{ candidates: AgentArticleCandidate[]; appliedRules: string[] }> {
  const contentType = contentKind === "mains_pyq" ? "mains" : "gk";
  // Uploaded PYQ documents follow the same saved house rules as PYQs the AI
  // writes; the editor's per-request note still comes last and wins.
  const savedRules = await loadSavedRules({ scope: "article", contentType: contentKind });
  const rulesText = renderSavedRules(savedRules);
  const combinedInstructions = [rulesText.trim(), instructions?.trim()]
    .filter(Boolean)
    .join("\n\n");
  const quiz = await parseQuizAI({
    rawText: text,
    aiProvider: "gemini",
    aiModel: "gemini-2.5-flash",
    content_type: contentType,
    instructions: combinedInstructions || undefined
  });
  const questions: Record<string, unknown>[] = Array.isArray(quiz?.questions) ? quiz.questions : [];
  if (questions.length === 0) return { candidates: [], appliedRules: savedRules.applied };

  const pathById = new Map(tree.map((entry) => [entry.id, entry.path]));
  const statements = questions.map((q) => String(q.question_statement ?? ""));
  const categoryAssignments = await classifyIntoTree(statements, tree);
  const fallbackYear = fallbackDate.slice(0, 4);

  const candidates = questions.map((question, index) => {
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

  return { candidates, appliedRules: savedRules.applied };
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
    const pyq = await parsePyqCandidates(
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
      applied_rules: pyq.appliedRules,
      candidates: pyq.candidates
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

  // Mains Notes present their list-style points (Evolution, Issues and
  // Challenges, Recommendations, etc.) as collapsed-by-default pairs — a
  // short always-visible label plus a fuller explanation hidden until a
  // reader clicks it — instead of a plain bullet. This is the one place that
  // produces this content type's final HTML regardless of how the writer
  // drafted it, so it's the deterministic place to teach the exact shape
  // rather than relying on the writer to hand-type the tags correctly.
  const mainsNotePointerGuidance =
    input.content_kind === "mains_topic_note"
      ? `

MAINS NOTE POINTER FORMAT (applies only to this content type):
Inside list-style sections that genuinely have several distinct points
(Evolution, Issues and Challenges, Recommendations and Reforms, Components
and Constituents, Pillars of Cooperation, and similar — whichever the
template section actually is), write each point as a collapsed-by-default
pair instead of a plain <li>:

<details><summary>SHORT LABEL</summary><div data-type="detailsContent">FULLER EXPLANATION, ending with the source link if the source material supplies one.</div></details>

- <summary> is the scan-line — a student should recognise the point from it
  alone without opening it. A few words: a date, a named formula, a ruling's
  headline. Never put a link inside <summary>.
- <div data-type="detailsContent">...</div> holds the reasoning, figures and
  the source link, and stays hidden until a reader opens it. Keep the
  data-type="detailsContent" attribute exactly as written — it is not
  decorative, the site's rich text editor keys off it.
- Do not wrap this in <li>/<ul>. Stack <details> blocks directly, one point
  after another — nesting one inside a list item silently breaks it the first
  time the note is opened in the site's Visual Editor.
- This is for genuine multi-point lists only. A section that is really one
  short fact (e.g. Syllabus Mapping) stays plain text, not a <details> block.

SUB-POINTS — when one point genuinely breaks down further:
A point can itself have several distinct sub-points (e.g. a body's
"Composition" naming multiple members, or a point with two or three
sub-arguments). Two ways to structure that — pick whichever fits, and never
nest more than this one extra level:

- Sub-points that are simple, short facts: a plain list INSIDE the parent's
  detailsContent (bullets render correctly on the site — this is fine):
  <details><summary>Composition</summary><div data-type="detailsContent">It comprises:<ul><li>A retired Supreme Court judge (Chairperson).</li><li>The Chief Election Commissioner.</li></ul></div></details>
- Sub-points substantial enough to deserve their own scan-then-expand
  treatment: nest further <details> blocks directly inside the parent's
  detailsContent, after its own explanation text:
  <details><summary>Federal Structure Concerns</summary><div data-type="detailsContent">Two specific worries dominate the debate.<details><summary>Centre-State power imbalance</summary><div data-type="detailsContent">...</div></details><details><summary>Erosion of fiscal autonomy</summary><div data-type="detailsContent">...</div></details></div></details>

Only go one level deep. If a sub-point needs its own further breakdown, that
is usually a sign it should be promoted to its own top-level point instead.`
      : "";

  // Load the house rules an admin saved for this content type in AI Settings.
  // Until now only the *generation* path read these, so an uploaded document
  // ignored rules the same content type obeyed when the AI wrote it.
  const savedRules = await loadSavedRules({ scope: "article", contentType: input.content_kind });
  const savedRulesText = renderSavedRules(savedRules);

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
- "body" must be clean HTML, matching this platform's article format exactly: paragraphs as <p>, section headings as <h2>, bold as <strong>, bullet lists as <ul><li>...</li></ul>${input.content_kind === "mains_topic_note" ? " (except the collapsed-pointer sections — see MAINS NOTE POINTER FORMAT below)" : ""}. Do not use Markdown syntax (##, **, -, *) anywhere in "body" — every real article on the platform is stored as HTML, and Markdown left in this field renders as literal punctuation to readers, not formatting. Remove site chrome, ads, share buttons, cookie notices.
- "excerpt" is a 1-2 sentence summary.
${mainsNotePointerGuidance}
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
      "body": "string (HTML: <p>, <h2>, <strong>, <ul><li> — never Markdown)",
      "publication_date": "YYYY-MM-DD",
      "category_node_ids": [number, ...],
      "seo_title": "string",
      "seo_description": "string",
      "keywords": ["string", ...],
      "warnings": ["string", ...]
    }
  ]
}`;

  const userPrompt = `CONTENT KIND: ${input.content_kind} (family: ${contentFamily})${savedRulesText}
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

    const { body: bodyHtml, converted } = ensureHtmlBody(String(item.body ?? ""));
    if (converted) {
      warnings.push("Body arrived as Markdown despite the HTML instruction; converted automatically — check formatting before publishing.");
    }
    if (detectFactHeadingSprawl(bodyHtml)) {
      warnings.push(
        "Several short, single-fact headings detected (e.g. one-line \"Ministry\"/\"Launched\"/\"Aim\" sections). " +
          "These usually belong together under one shared heading as bulleted facts, not separate headings — review before publishing."
      );
    }

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
      body: bodyHtml,
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
    applied_rules: savedRules.applied,
    candidates
  };
}
