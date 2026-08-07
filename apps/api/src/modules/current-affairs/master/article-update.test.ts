import assert from "node:assert/strict";
import { after, test } from "node:test";
import { pool, query } from "../../../db.js";
import { createMasterArticle, getMasterArticle, updateMasterArticle } from "./articles.service.js";

/**
 * Cover for editing an article after it is posted — the path used to correct a
 * piece that turns out to be factually wrong.
 *
 * The formatting guarantee matters as much here as on create: a correction is
 * written by the same agents, in the same session, and arrives as Markdown for
 * the same reasons the original body did. An edit that silently stored
 * "## Heading" would reintroduce the exact bug creates were fixed for.
 */

const createdArticleIds: number[] = [];

after(async () => {
  if (createdArticleIds.length > 0) {
    await query(`delete from current_affairs.master_articles where id = any($1)`, [createdArticleIds]);
  }
  await pool.end();
});

async function anyAdminUserId(): Promise<number> {
  const rows = await query<{ id: number }>(
    `select id from app.users where role in ('admin', 'moderator', 'content_editor') limit 1`
  );
  const row = rows[0];
  if (!row) throw new Error("No admin user in the dev database to attribute the test article to.");
  return row.id;
}

async function makeArticle(
  userId: number,
  overrides: Record<string, unknown> = {}
): Promise<{ id: number }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const article = (await createMasterArticle(
    {
      content_kind: "daily_current_affairs",
      title: `Update test ${suffix}`,
      slug: `update-test-${suffix}`,
      body: "<p>Original body.</p>",
      status: "draft",
      ...overrides,
    } as never,
    userId
  )) as { id: number };
  createdArticleIds.push(article.id);
  return article;
}

test("an edited body is stored, and replaces the old one", async () => {
  const userId = await anyAdminUserId();
  const article = await makeArticle(userId);

  await updateMasterArticle(article.id, { body: "<p>Corrected body.</p>" } as never, userId);

  const fetched = (await getMasterArticle(article.id, true)) as { body: string };
  assert.match(fetched.body, /Corrected body/);
  assert.doesNotMatch(fetched.body, /Original body/);
});

test("a correction written as Markdown is converted to HTML, not stored raw", async () => {
  const userId = await anyAdminUserId();
  const article = await makeArticle(userId);

  await updateMasterArticle(
    article.id,
    { body: "## Corrected Facts\n- The figure is 8.2 per cent.\n- Revised on review." } as never,
    userId
  );

  const fetched = (await getMasterArticle(article.id, true)) as { body: string };
  assert.match(fetched.body, /<h2>Corrected Facts<\/h2>/);
  assert.match(fetched.body, /<ul><li>The figure is 8\.2 per cent\.<\/li>/);
  assert.doesNotMatch(fetched.body, /##/);
});

test("HTML corrections pass through untouched", async () => {
  const userId = await anyAdminUserId();
  const article = await makeArticle(userId);
  const html = "<p>Fixed.</p><h2>Background</h2><ul><li>Point</li></ul>";

  await updateMasterArticle(article.id, { body: html } as never, userId);

  const fetched = (await getMasterArticle(article.id, true)) as { body: string };
  assert.equal(fetched.body, html);
});

test("a concept post is editable the same way a news post is", async () => {
  const userId = await anyAdminUserId();
  // Concepts are rows in the same table, distinguished only by article_role,
  // so the correction path must not be news-only.
  const concept = await makeArticle(userId, { article_role: "concept" });

  await updateMasterArticle(concept.id, { body: "## Revised definition\nUpdated." } as never, userId);

  const fetched = (await getMasterArticle(concept.id, true)) as { body: string; article_role: string };
  assert.equal(fetched.article_role, "concept");
  assert.match(fetched.body, /<h2>Revised definition<\/h2>/);
});

test("editing one field leaves the others alone", async () => {
  const userId = await anyAdminUserId();
  const article = await makeArticle(userId);

  await updateMasterArticle(article.id, { title: "Corrected headline" } as never, userId);

  const fetched = (await getMasterArticle(article.id, true)) as { title: string; body: string; status: string };
  assert.equal(fetched.title, "Corrected headline");
  assert.match(fetched.body, /Original body/);
  assert.equal(fetched.status, "draft");
});
