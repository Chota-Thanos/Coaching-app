import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { after, test } from "node:test";
import sharp from "sharp";
import { pool, query } from "../../../db.js";
import { getMediaUploadRoot } from "../../media/storage.js";
import { compressImageBuffer } from "../../media/service.js";
import { commitPostingAgent } from "./posting-agent-commit.service.js";
import { insertBodyImage } from "./body-image.service.js";

/**
 * Cover for two things that were asked for together: pictures that sit between
 * paragraphs rather than only at the top of an article, and pictures that do
 * not fill the disk.
 */

const createdArticleIds: number[] = [];
// These tests write real files to the uploads directory, so they clean up the
// disk as well as the database — otherwise every run leaves orphans behind in
// exactly the folder this work is meant to keep from filling up.
const createdFileUrls: string[] = [];

after(async () => {
  if (createdArticleIds.length > 0) {
    await query(`delete from current_affairs.master_articles where id = any($1)`, [createdArticleIds]);
  }
  for (const fileUrl of createdFileUrls) {
    const relative = fileUrl.replace(/^\/uploads\//, "");
    await unlink(join(getMediaUploadRoot(), relative)).catch(() => undefined);
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

/** A believably photographic image: flat colour would compress unrealistically well. */
async function noisyPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      noise: { type: "gaussian", mean: 128, sigma: 40 }
    }
  })
    .png()
    .toBuffer();
}

test("a large photo is resized and re-encoded, not stored as it arrived", async () => {
  const original = await noisyPng(3200, 2400);
  const result = await compressImageBuffer(original, "image/png");

  assert.equal(result.mime_type, "image/webp", "re-encoded to WebP");
  assert.ok(
    result.compressed_bytes < result.original_bytes,
    `expected a smaller file, got ${result.compressed_bytes} from ${result.original_bytes}`
  );

  const meta = await sharp(result.buffer).metadata();
  assert.ok((meta.width ?? 0) <= 1600, `longest edge capped, got ${meta.width}`);
  assert.ok((meta.height ?? 0) <= 1600, `longest edge capped, got ${meta.height}`);
});

test("a small image is never upscaled", async () => {
  const original = await noisyPng(320, 240);
  const result = await compressImageBuffer(original, "image/png");
  const meta = await sharp(result.buffer).metadata();
  assert.equal(meta.width, 320);
  assert.equal(meta.height, 240);
});

test("compression that would inflate a file is discarded", async () => {
  // A 1x1 PNG is already smaller than any WebP container can be.
  const tiny = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#fff" } })
    .png()
    .toBuffer();
  const result = await compressImageBuffer(tiny, "image/png");
  assert.ok(result.compressed_bytes <= result.original_bytes);
});

test("a non-image is passed through untouched", async () => {
  const pdfish = Buffer.from("%PDF-1.4 not really a pdf");
  const result = await compressImageBuffer(pdfish, "application/pdf");
  assert.equal(result.mime_type, "application/pdf");
  assert.equal(result.compressed_bytes, pdfish.byteLength);
});

test("an image is placed between the chosen blocks, not appended to the end", async () => {
  const userId = await anyAdminUserId();

  const commit = await commitPostingAgent(
    {
      content_kind: "daily_current_affairs",
      publish_mode: "auto",
      articles: [
        {
          title: `Inline image placement ${Date.now()}`,
          body: "<p>First block.</p><h2>Second block</h2><p>Third block.</p><p>Fourth block.</p>"
        }
      ]
    } as never,
    userId
  );
  const articleId = commit.published[0]!.id;
  createdArticleIds.push(articleId);

  const png = await noisyPng(2000, 1400);
  const result = (await insertBodyImage(
    {
      article_id: articleId,
      file_name: "diagram.png",
      base64_data: png.toString("base64"),
      mime_type: "image/png",
      alt_text: "A diagram",
      caption: "How it fits together",
      after_block: 2
    },
    userId
  )) as { file_url: string; inserted_after_block: number; blocks_in_body: number; size_bytes: number };
  createdFileUrls.push(result.file_url);

  assert.equal(result.blocks_in_body, 4);
  assert.equal(result.inserted_after_block, 2);
  assert.ok(result.file_url.startsWith("/uploads/"), `site-relative path, got ${result.file_url}`);
  assert.ok(result.file_url.endsWith(".webp"), "stored compressed, with an honest extension");

  const rows = await query<{ body: string }>(
    `select body from current_affairs.master_articles where id = $1`,
    [articleId]
  );
  const body = rows[0]!.body;

  // The figure must land after the second block and before the third.
  const figureAt = body.indexOf("<figure>");
  assert.ok(figureAt > body.indexOf("Second block"), "after the second block");
  assert.ok(figureAt < body.indexOf("Third block"), "before the third block");
  assert.ok(body.includes("<figcaption>How it fits together</figcaption>"));
  assert.ok(body.includes('alt="A diagram"'));

  // And it is listed as an asset so the editor can delete it, but as
  // 'inline_image' so it does not become the article's header picture.
  const assets = await query<{ asset_type: string; file_url: string }>(
    `select asset_type, file_url from current_affairs.master_article_assets where article_id = $1`,
    [articleId]
  );
  assert.equal(assets.length, 1);
  assert.equal(assets[0]!.asset_type, "inline_image");
});

test("omitting a position appends the image at the end", async () => {
  const userId = await anyAdminUserId();

  const commit = await commitPostingAgent(
    {
      content_kind: "daily_current_affairs",
      publish_mode: "auto",
      articles: [{ title: `Inline image default ${Date.now()}`, body: "<p>Only block.</p>" }]
    } as never,
    userId
  );
  const articleId = commit.published[0]!.id;
  createdArticleIds.push(articleId);

  const png = await noisyPng(600, 400);
  const appended = (await insertBodyImage(
    {
      article_id: articleId,
      file_name: "chart.png",
      base64_data: png.toString("base64"),
      mime_type: "image/png"
    },
    userId
  )) as { file_url: string };
  createdFileUrls.push(appended.file_url);

  const rows = await query<{ body: string }>(
    `select body from current_affairs.master_articles where id = $1`,
    [articleId]
  );
  assert.ok(rows[0]!.body.indexOf("<figure>") > rows[0]!.body.indexOf("Only block"));
});
