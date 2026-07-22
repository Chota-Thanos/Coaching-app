import { createMasterArticle } from "./articles.service.js";
import { createIngestionJob } from "./ingestion.service.js";
import type {
  CommitPostingAgentInput,
  CreateIngestionJobInput,
  CreateMasterArticleInput
} from "../schemas.js";

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || `article-${Date.now()}`;
}

type CommitArticle = CommitPostingAgentInput["articles"][number];

/**
 * Maps a reviewed agent candidate to the master-article create payload.
 * The first category id becomes the primary link; the full list drives the
 * multi-category join table. Publication date is preserved verbatim (back-dating).
 */
function toArticleInput(
  commit: CommitPostingAgentInput,
  item: CommitArticle,
  status: CreateMasterArticleInput["status"]
): CreateMasterArticleInput {
  const contentKind = item.content_kind ?? commit.content_kind;
  const publicationDate = item.publication_date;
  const slug = item.slug?.trim() || `${slugify(item.title)}-${publicationDate ?? new Date().toISOString().slice(0, 10)}`;
  const primaryCategory = item.category_node_ids?.[0];

  return {
    content_kind: contentKind,
    article_role: item.article_role ?? commit.article_role,
    title: item.title,
    slug,
    body: item.body,
    // An explicit body_json (PYQ structure) wins; otherwise fold excerpt/questions in.
    body_json:
      item.body_json ??
      (item.excerpt || item.questions
        ? { ...(item.excerpt ? { excerpt: item.excerpt } : {}), ...(item.questions ? { questions: item.questions } : {}) }
        : undefined),
    category_node_id: primaryCategory,
    category_node_ids: item.category_node_ids,
    source_name: item.source_name,
    source_url: item.source_url,
    publication_date: publicationDate,
    institute_tags: item.institute_tags,
    status,
    is_ai_generated: true,
    seo_title: item.seo_title,
    seo_description: item.seo_description ?? item.excerpt,
    keywords: item.keywords
  };
}

export interface CommitResult {
  mode: "auto" | "review";
  content_kind: string;
  published: { id: number; slug: string; title: string }[];
  failed: { title: string; error: string }[];
  job?: unknown;
}

/**
 * Commits reviewed agent candidates. Per-batch choice:
 *   - "auto":   each article is created and published immediately.
 *   - "review": articles are staged into the existing ingestion review buffer
 *               (parser_kind "manual_json" so the AI re-parse worker is skipped),
 *               where the editor approves/publishes them one click at a time.
 */
export async function commitPostingAgent(
  input: CommitPostingAgentInput,
  userId: number
): Promise<CommitResult> {
  const targetStatus = input.default_status ?? "published";

  if (input.publish_mode === "auto") {
    const published: CommitResult["published"] = [];
    const failed: CommitResult["failed"] = [];
    for (const item of input.articles) {
      try {
        const article = (await createMasterArticle(toArticleInput(input, item, targetStatus), userId)) as {
          id: number;
          slug: string;
          title: string;
        };
        published.push({ id: article.id, slug: article.slug, title: article.title });
      } catch (err) {
        failed.push({ title: item.title, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { mode: "auto", content_kind: input.content_kind, published, failed };
  }

  // Review mode → stage into the ingestion buffer with the target status baked in,
  // so a single "publish" click later produces a live (or approved) article.
  const firstWithSource = input.articles.find((item) => item.source_name || item.source_url);
  const jobInput: CreateIngestionJobInput = {
    source_kind: "ai_prompt",
    parser_kind: "manual_json",
    source_name: firstWithSource?.source_name,
    source_url: firstWithSource?.source_url,
    default_content_kind: input.content_kind,
    default_status: targetStatus,
    articles: input.articles.map((item) => toArticleInput(input, item, targetStatus))
  };
  const job = await createIngestionJob(jobInput, userId);

  return { mode: "review", content_kind: input.content_kind, published: [], failed: [], job };
}
