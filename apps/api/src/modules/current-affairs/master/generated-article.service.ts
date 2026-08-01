import { deriveContentFamily } from "./content-family.js";

/**
 * Turns one generated item into an article ready for the posting-agent commit
 * step.
 *
 * This conversion previously existed only inside the admin browser screen
 * (`article-creator-ai-workspace.tsx`), hardwired per content type. That meant
 * generation and posting were two disconnected halves: an agent could generate
 * content but had nothing to turn the result into an article, and any custom
 * output format an admin configured in AI Settings was silently dropped because
 * the browser converter only knew about `sections[]` and the PYQ fields.
 *
 * Moving it here gives both callers one implementation, and adds a generic
 * fallback so a custom format still produces a readable article instead of an
 * empty one.
 */

export interface GeneratedArticle {
  title: string;
  slug?: string;
  body: string;
  body_json?: Record<string, unknown>;
  excerpt?: string;
  publication_date?: string;
  category_node_ids?: number[];
  source_name?: string;
  source_url?: string;
  seo_title?: string;
  seo_description?: string;
  keywords?: string[];
  /**
   * What picture should accompany the article. The generator specifies it; the
   * file itself is attached later, so `url` is usually absent at this point.
   */
  image?: { url?: string; alt_text?: string; caption?: string; search_query?: string };
  /** Fields the converter could not place, so nothing is silently lost. */
  warnings?: string[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitKeywords(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  const text = asString(value);
  if (!text) return [];
  return text
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Turns a heading-ish key like "about_monetary_policy" into "About Monetary Policy". */
function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Renders arbitrary generated JSON as readable markdown.
 *
 * Used when an admin has configured a custom output format, so the article
 * carries the content they asked for rather than an empty body. Deliberately
 * conservative: headings from keys, prose as paragraphs, arrays as lists.
 */
function renderUnknownShape(
  value: unknown,
  depth = 2,
  skipKeys = new Set<string>()
): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          // A {title, description}-ish entry reads better as a sub-heading.
          const heading =
            asString(record.title) || asString(record.heading) || asString(record.name);
          const rendered = renderUnknownShape(item, depth + 1, new Set(["title", "heading", "name"]));
          return heading ? `${"#".repeat(Math.min(depth + 1, 6))} ${heading}\n\n${rendered}` : rendered;
        }
        const text = renderUnknownShape(item, depth + 1);
        return text ? `- ${text}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !skipKeys.has(key))
      .map(([key, child]) => {
        const rendered = renderUnknownShape(child, depth + 1);
        if (!rendered) return "";
        // Short scalar values read as "**Label:** value" rather than a heading.
        if (typeof child === "string" && child.trim().length < 80 && !child.includes("\n")) {
          return `**${humanizeKey(key)}:** ${child.trim()}`;
        }
        return `${"#".repeat(Math.min(depth, 6))} ${humanizeKey(key)}\n\n${rendered}`;
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return "";
}

/** Metadata keys handled explicitly, so the generic renderer must not repeat them. */
const META_KEYS = new Set([
  "title",
  "meta_title",
  "article_title",
  "heading",
  "name",
  "slug",
  "sections",
  "meta_description",
  "meta_keywords",
  "seo_title",
  "seo_description",
  "keywords",
  "source_url",
  "source_name",
  "news_date",
  "publication_date",
  "category_node_id",
  "category_node_ids",
  "suggested_category_slug",
  "excerpt",
  "image",
  "images",
  "research"
]);

function buildPrelimsPyqBody(item: Record<string, unknown>): string {
  const options = Array.isArray(item.options) ? (item.options as Record<string, unknown>[]) : [];
  const byLabel = (label: string, index: number) =>
    asString(options[index]?.text) ||
    asString(options.find((o) => asString(o.label).toUpperCase() === label)?.text);

  const parts = [
    `### Year: ${asString(item.year) || new Date().getFullYear()}`,
    `**${asString(item.question_statement)}**`
  ];
  const supp = asString(item.supp_question_statement);
  if (supp) parts.push(supp);
  const prompt = asString(item.question_prompt);
  if (prompt) parts.push(prompt);
  parts.push(
    `(a) ${byLabel("A", 0)}\n(b) ${byLabel("B", 1)}\n(c) ${byLabel("C", 2)}\n(d) ${byLabel("D", 3)}`
  );
  parts.push(`**Correct Answer: (${asString(item.correct_answer) || "A"})**`);
  const explanation = asString(item.explanation);
  if (explanation) parts.push(`### Explanation\n${explanation}`);
  return parts.join("\n\n");
}

function buildMainsPyqBody(item: Record<string, unknown>): string {
  const parts = [
    `### Year: ${asString(item.year) || new Date().getFullYear()} | Marks: ${
      asString(item.max_marks) || "15"
    } | Word Limit: ${asString(item.word_limit) || "250"}`,
    `**${asString(item.question_statement)}**`
  ];
  const approach = asString(item.answer_approach);
  if (approach) parts.push(`### Answer Approach\n${approach}`);
  const model = asString(item.model_answer);
  if (model) parts.push(`### Model Answer\n${model}`);
  return parts.join("\n\n");
}

export function convertGeneratedToArticle(params: {
  contentKind: string;
  item: Record<string, unknown>;
  /** Applied when the generated item carries no category of its own. */
  fallbackCategoryNodeIds?: number[];
  /** Resolves the model's `suggested_category_slug` to a real node id. */
  categorySlugToId?: Map<string, number>;
  fallbackDate?: string;
}): GeneratedArticle {
  const { contentKind, item } = params;
  const warnings: string[] = [];

  // A custom output format may not call the title "title" — a live run put it
  // under `meta_title`, which made every article come out as "Untitled".
  const title =
    asString(item.title) ||
    asString(item.meta_title) ||
    asString(item.article_title) ||
    asString(item.seo_title) ||
    asString(item.heading) ||
    asString(item.name) ||
    asString(item.question_statement).slice(0, 120) ||
    "Untitled";

  let body = "";
  if (contentKind === "prelims_pyq") {
    body = buildPrelimsPyqBody(item);
  } else if (contentKind === "mains_pyq") {
    body = buildMainsPyqBody(item);
  } else if (Array.isArray(item.sections) && item.sections.length > 0) {
    // Section keys vary with the configured output format: a live run used
    // `heading` rather than `section_title`, and returned `content` as an array
    // of paragraphs rather than a string. Both produced an empty article until
    // this branch stopped assuming one shape.
    body = (item.sections as Record<string, unknown>[])
      .map((section) => {
        const heading =
          asString(section.section_title) ||
          asString(section.title) ||
          asString(section.heading) ||
          asString(section.name);
        const raw = section.content ?? section.body ?? section.text;
        const content = typeof raw === "string" ? raw.trim() : renderUnknownShape(raw, 3);
        if (!heading && !content) return "";
        return heading ? `## ${heading}\n\n${content}` : content;
      })
      .filter(Boolean)
      .join("\n\n");
  } else {
    // Custom output format — render whatever the admin configured rather than
    // producing an empty article.
    body = renderUnknownShape(item, 2, META_KEYS);
    if (body) {
      warnings.push(
        "Built from a custom output format; check the layout before publishing."
      );
    }
  }

  if (!body.trim()) {
    warnings.push("Generation returned no usable body text.");
  }

  const categoryFromItem =
    typeof item.category_node_id === "number"
      ? [item.category_node_id]
      : Array.isArray(item.category_node_ids)
        ? (item.category_node_ids as unknown[]).map(Number).filter((n) => Number.isFinite(n))
        : [];

  // The model reports the category it chose as a slug; resolve it before
  // falling back, otherwise a correctly-classified article lands uncategorised.
  const suggestedSlug = asString(item.suggested_category_slug);
  const fromSlug =
    suggestedSlug && params.categorySlugToId?.has(suggestedSlug)
      ? [params.categorySlugToId.get(suggestedSlug)!]
      : [];

  const categories =
    categoryFromItem.length > 0
      ? categoryFromItem
      : fromSlug.length > 0
        ? fromSlug
        : params.fallbackCategoryNodeIds ?? [];
  if (categories.length === 0) {
    warnings.push("No category resolved — this would be filed as uncategorised.");
  }

  const keywords = splitKeywords(item.keywords ?? item.meta_keywords);

  const rawImage = (item.image ?? (Array.isArray(item.images) ? item.images[0] : null)) as
    | Record<string, unknown>
    | null;
  const image = rawImage
    ? {
        url: asString(rawImage.url) || asString(rawImage.file_url) || undefined,
        alt_text: asString(rawImage.alt_text) || asString(rawImage.alt) || undefined,
        caption: asString(rawImage.caption) || undefined,
        search_query: asString(rawImage.search_query) || asString(rawImage.query) || undefined
      }
    : undefined;
  if (image && !image.alt_text && !image.search_query) {
    warnings.push("Image was suggested without alt text or a search query.");
  }

  // A malformed date would otherwise be written straight to a date column and
  // rejected by the database, or silently land the article on the wrong day.
  const rawDate =
    asString(item.publication_date) || asString(item.news_date) || params.fallbackDate || "";
  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
  if (rawDate && !isIsoDate) {
    warnings.push(`Ignored an unusable publication date ("${rawDate}"); used today instead.`);
  }
  const publicationDate = isIsoDate ? rawDate : new Date().toISOString().slice(0, 10);

  return {
    title,
    slug: asString(item.slug) || slugify(title) || undefined,
    body,
    excerpt: asString(item.excerpt) || undefined,
    publication_date: publicationDate,
    category_node_ids: categories.length > 0 ? categories : undefined,
    source_name: asString(item.source_name) || "AI Research Engine",
    source_url: asString(item.source_url) || undefined,
    seo_title: asString(item.seo_title) || asString(item.meta_title) || title,
    seo_description:
      asString(item.seo_description) ||
      asString(item.meta_description) ||
      asString(item.question_statement) ||
      undefined,
    keywords: keywords.length > 0 ? keywords : undefined,
    image,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Normalises a whole generation response into commit-ready articles.
 *
 * Generation returns either `{ articles: [...] }` or a single bare object,
 * depending on the configured output schema — both are handled here so callers
 * never have to guess.
 */
export function convertGenerationResult(params: {
  contentKind: string;
  generated: unknown;
  fallbackCategoryNodeIds?: number[];
  categorySlugToId?: Map<string, number>;
  fallbackDate?: string;
}): { articles: GeneratedArticle[]; content_family: string } {
  const generated = (params.generated ?? {}) as Record<string, unknown>;
  const rawItems: Record<string, unknown>[] = Array.isArray(generated.articles)
    ? (generated.articles as Record<string, unknown>[])
    : Array.isArray(generated.questions)
      ? (generated.questions as Record<string, unknown>[])
      : [generated];

  return {
    content_family: deriveContentFamily(params.contentKind),
    articles: rawItems
      .filter((item) => item && typeof item === "object")
      .map((item) =>
        convertGeneratedToArticle({
          contentKind: params.contentKind,
          item,
          fallbackCategoryNodeIds: params.fallbackCategoryNodeIds,
          categorySlugToId: params.categorySlugToId,
          fallbackDate: params.fallbackDate
        })
      )
  };
}
