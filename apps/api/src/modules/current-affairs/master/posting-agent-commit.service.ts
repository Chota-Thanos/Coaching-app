import { createMasterArticle } from "./articles.service.js";
import { query } from "../../../db.js";
import type {
  CommitPostingAgentInput,
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
  /** Draft articles created in review mode, editable in the Articles Library. */
  drafts?: { id: number; slug: string; title: string }[];
}

/**
 * Commits reviewed agent candidates. Per-batch choice:
 *   - "auto":   each article is created and published immediately.
 *   - "review": each article is created as a real draft in the Articles
 *               Library, where it can be opened and edited with the normal
 *               article editor before publishing.
 *
 * Review mode used to stage into the ingestion buffer instead. That buffer
 * exists to hold *raw parsed material* awaiting a shaping pass — but agent
 * candidates have already been through parsing and normalisation by this
 * point, so the extra hop bought nothing and split editing across two
 * screens, with the queue offering only approve/reject rather than a real
 * editor. A draft is equally invisible to students: every public read filters
 * on status = 'published'. This also matches what the assessment side already
 * does with its own review mode.
 */
/**
 * Records the image the generator specified.
 *
 * Usually there is no file yet — the model describes the picture it wants
 * rather than producing one — so the search query and alt text are kept in
 * `metadata` and a placeholder `file_url` is stored. That way the intent
 * survives to whoever sources the image, instead of being discarded at commit
 * and silently lost.
 *
 * Never fails the commit: an article without its picture is still an article.
 */
async function attachImage(
  articleId: number,
  image: { url?: string; alt_text?: string; caption?: string; search_query?: string } | undefined,
  userId: number
): Promise<void> {
  if (!image) return;
  if (!image.url && !image.search_query && !image.alt_text) return;

  try {
    await query(
      `insert into current_affairs.master_article_assets
         (article_id, asset_type, file_name, file_url, alt_text, caption, metadata, uploaded_by_user_id)
       values ($1, 'image', $2, $3, $4, $5, $6, $7)`,
      [
        articleId,
        image.search_query?.slice(0, 120) || image.alt_text?.slice(0, 120) || "ai-suggested-image",
        image.url ?? "",
        image.alt_text ?? null,
        image.caption ?? null,
        JSON.stringify({
          source: "ai_generated",
          pending_upload: !image.url,
          search_query: image.search_query ?? null
        }),
        userId
      ]
    );
  } catch (err) {
    console.error(`[commit] could not record image for article ${articleId}:`, err);
  }
}

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
        await attachImage(article.id, item.image, userId);
        published.push({ id: article.id, slug: article.slug, title: article.title });
      } catch (err) {
        failed.push({ title: item.title, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { mode: "auto", content_kind: input.content_kind, published, failed };
  }

  // Review mode → create each as a real draft article, editable in the
  // Articles Library. `default_status` is ignored here on purpose: the whole
  // point of review mode is that nothing is published without a human doing so
  // from the editor, so the status is forced to "draft" regardless of what the
  // caller passed.
  const drafts: CommitResult["drafts"] = [];
  const failed: CommitResult["failed"] = [];
  for (const item of input.articles) {
    try {
      const article = (await createMasterArticle(toArticleInput(input, item, "draft"), userId)) as {
        id: number;
        slug: string;
        title: string;
      };
      await attachImage(article.id, item.image, userId);
      drafts.push({ id: article.id, slug: article.slug, title: article.title });
    } catch (err) {
      failed.push({ title: item.title, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { mode: "review", content_kind: input.content_kind, published: [], failed, drafts };
}
