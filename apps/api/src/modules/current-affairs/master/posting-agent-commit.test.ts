import assert from "node:assert/strict";
import { after, test } from "node:test";
import { pool, query } from "../../../db.js";
import { commitPostingAgent } from "./posting-agent-commit.service.js";

/**
 * Regression cover for the bug that motivated this file's rewrite: a Cowork
 * session reported "job #31, item #31, staged in the Ingestion Queue" for an
 * article that, on inspection, had never actually been persisted anywhere —
 * GET .../ingestion-jobs/31 returned a plain 404. Review mode used to create
 * an ingestion job + item pair rather than a real article, and that extra hop
 * is exactly where the silent loss happened.
 *
 * Review mode now creates a real row in current_affairs.master_articles
 * directly, with status forced to "draft" — the same table, same visibility
 * rules, as everything else in the Articles Library. There is no longer an
 * intermediate object that can exist in a response but not in the database.
 */

const createdArticleIds: number[] = [];

after(async () => {
  if (createdArticleIds.length > 0) {
    await query(`delete from current_affairs.master_articles where id = any($1)`, [createdArticleIds]);
  }
  await pool.end();
});

// A real user id is required by the foreign key; reuse whichever admin exists.
async function anyAdminUserId(): Promise<number> {
  const rows = await query<{ id: number }>(
    `select id from app.users where role in ('admin', 'moderator', 'content_editor') limit 1`
  );
  const row = rows[0];
  if (!row) throw new Error("No admin user in the dev database to attribute the test article to.");
  return row.id;
}

test("review mode creates a real, queryable draft article — not an ingestion job", async () => {
  const userId = await anyAdminUserId();
  const stamp = Date.now();

  const result = await commitPostingAgent(
    {
      content_kind: "daily_current_affairs",
      publish_mode: "review",
      articles: [
        {
          title: `Regression test article ${stamp}`,
          body: "Body text long enough to be a real article for the purposes of this check."
        }
      ]
    } as never,
    userId
  );

  assert.equal(result.mode, "review");
  assert.equal(result.drafts?.length, 1);
  assert.equal(result.published.length, 0, "review mode must not populate published");

  const draftId = result.drafts![0]!.id;
  createdArticleIds.push(draftId);

  // The actual, load-bearing assertion: fetch the row back from the database
  // by id, the same way the earlier live investigation fetched job 31 and got
  // a 404. If this ever regresses to "reports success but nothing is there",
  // this is the line that catches it.
  const persisted = await query<{ id: number; status: string; title: string }>(
    `select id, status, title from current_affairs.master_articles where id = $1`,
    [draftId]
  );
  assert.equal(persisted.length, 1, "the article the tool reported creating must actually exist");
  assert.equal(persisted[0]!.status, "draft");
  assert.equal(persisted[0]!.title, `Regression test article ${stamp}`);
});

test("a draft created this way is invisible to the public reader", async () => {
  const userId = await anyAdminUserId();
  const result = await commitPostingAgent(
    {
      content_kind: "daily_current_affairs",
      publish_mode: "review",
      articles: [{ title: `Visibility check ${Date.now()}`, body: "Body text for the visibility check." }]
    } as never,
    userId
  );
  const draftId = result.drafts![0]!.id;
  createdArticleIds.push(draftId);

  // Mirrors the exact filter every public route uses (frontend-read.service.ts).
  const publiclyVisible = await query(
    `select id from current_affairs.master_articles where id = $1 and status = 'published'`,
    [draftId]
  );
  assert.equal(publiclyVisible.length, 0, "a draft must not satisfy the public status='published' filter");
});

test("default_status is ignored in review mode — nothing can be forced live via that field", async () => {
  const userId = await anyAdminUserId();
  const result = await commitPostingAgent(
    {
      content_kind: "daily_current_affairs",
      publish_mode: "review",
      default_status: "published", // an attempt to sneak a live status through review mode
      articles: [{ title: `Status override check ${Date.now()}`, body: "Body text for the override check." }]
    } as never,
    userId
  );
  const draftId = result.drafts![0]!.id;
  createdArticleIds.push(draftId);

  const row = await query<{ status: string }>(
    `select status from current_affairs.master_articles where id = $1`,
    [draftId]
  );
  assert.equal(row[0]!.status, "draft", "review mode must force draft regardless of default_status");
});

test("auto mode is unchanged — still creates a real published article directly", async () => {
  const userId = await anyAdminUserId();
  const result = await commitPostingAgent(
    {
      content_kind: "daily_current_affairs",
      publish_mode: "auto",
      articles: [{ title: `Auto mode check ${Date.now()}`, body: "Body text for the auto-mode check." }]
    } as never,
    userId
  );
  assert.equal(result.mode, "auto");
  assert.equal(result.published.length, 1);
  const articleId = result.published[0]!.id;
  createdArticleIds.push(articleId);

  const row = await query<{ status: string }>(
    `select status from current_affairs.master_articles where id = $1`,
    [articleId]
  );
  assert.equal(row[0]!.status, "published");
});

/**
 * The AI writer describes the picture it would like far more often than it
 * produces one. That intent used to be stored as an asset row with an empty
 * `file_url`, which nothing ever read and which the admin editor could only
 * draw as a broken image — on the live site every single asset row was one of
 * these, and not one carried a real file. An article with no picture is now
 * an article with no asset row.
 */
test("an image the model only described, without a file, creates no asset row", async () => {
  const userId = await anyAdminUserId();

  const result = await commitPostingAgent(
    {
      content_kind: "daily_current_affairs",
      publish_mode: "auto",
      articles: [
        {
          title: `Image intent check ${Date.now()}`,
          body: "Body text for the image-intent check.",
          image: {
            alt_text: "Illustration showing industrial sectors feeding into an output index.",
            search_query: "clean educational illustration of the Index of Industrial Production"
          }
        }
      ]
    } as never,
    userId
  );

  const articleId = result.published[0]!.id;
  createdArticleIds.push(articleId);

  const assets = await query<{ id: number }>(
    `select id from current_affairs.master_article_assets where article_id = $1`,
    [articleId]
  );
  assert.equal(assets.length, 0, "a description of an image is not an image");
});

test("an image with a real url is still attached", async () => {
  const userId = await anyAdminUserId();

  const result = await commitPostingAgent(
    {
      content_kind: "daily_current_affairs",
      publish_mode: "auto",
      articles: [
        {
          title: `Image url check ${Date.now()}`,
          body: "Body text for the image-url check.",
          image: {
            url: "https://waytoias.com/logo.png",
            alt_text: "WayToIAS logo"
          }
        }
      ]
    } as never,
    userId
  );

  const articleId = result.published[0]!.id;
  createdArticleIds.push(articleId);

  const assets = await query<{ file_url: string; alt_text: string | null }>(
    `select file_url, alt_text from current_affairs.master_article_assets where article_id = $1`,
    [articleId]
  );
  assert.equal(assets.length, 1);
  assert.equal(assets[0]!.file_url, "https://waytoias.com/logo.png");
  assert.equal(assets[0]!.alt_text, "WayToIAS logo");
});
