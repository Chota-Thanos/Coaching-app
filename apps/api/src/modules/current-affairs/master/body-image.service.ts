import { one, query } from "../../../db.js";
import { saveImageBuffer } from "../../media/service.js";
import type { InsertBodyImageInput } from "../schemas.js";

/**
 * Puts a picture *inside* an article's text, between two blocks.
 *
 * This is the gap `attachImageBytes()` left. That one files an image as an
 * article asset — the hero slot — and says so: it "does not touch the article's
 * text". So an agent had no way to place a diagram after the paragraph it
 * explains, short of resupplying the whole body through the corrections path,
 * which exists to make an agent stop and ask first. Adding a picture is not a
 * correction, so it should not have to travel through one.
 *
 * The stored `src` is the site-relative "/uploads/yyyy/mm/..." path, which is
 * exactly what the editor's own Image button writes, so both routes produce
 * identical markup and the reading page's `resolveBodyMedia()` makes them
 * absolute the same way.
 */

type ArticleRow = {
  id: number;
  body: string | null;
  content_kind: string;
  body_json: Record<string, unknown> | null;
};

function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The figure markup to splice in.
 *
 * A `<figure>` rather than a bare `<img>` so a caption travels with its picture
 * and cannot be separated from it by a later edit. The editor's Image button
 * writes an `<img>` plus a following `<em>` paragraph instead, because the
 * TipTap schema has no figure node — both render, and this path is not
 * constrained by that schema.
 */
function buildFigure(fileUrl: string, altText?: string, caption?: string): string {
  const alt = escapeHtml(altText ?? caption ?? "");
  const figcaption = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "";
  return `<figure><img src="${escapeHtml(fileUrl)}" alt="${alt}" />${figcaption}</figure>`;
}

/**
 * Splits a body into its top-level blocks so a picture can go *between* two of
 * them rather than inside a sentence.
 *
 * Uses jsdom rather than a regex: article bodies contain nested lists and
 * tables, and counting "<p>" with a pattern would happily insert a figure in
 * the middle of a `<table>`, producing markup that renders as a broken layout.
 * jsdom is already a dependency here (extraction.service.ts uses it), so this
 * costs nothing new.
 */
async function insertIntoBody(
  body: string,
  figureHtml: string,
  afterBlock: number | undefined
): Promise<{ body: string; blockCount: number; insertedAfter: number }> {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(`<div id="root">${body}</div>`);
  const document = dom.window.document;
  const root = document.getElementById("root")!;

  const blocks = Array.from(root.children);
  const blockCount = blocks.length;

  // Omitted means "at the end", which is the sane default for "add a picture to
  // this article" when no position is given. Clamped rather than rejected: an
  // agent asking for block 40 of a 12-block article means the end.
  const target = afterBlock === undefined ? blockCount : Math.max(0, Math.min(afterBlock, blockCount));

  const figure = document.createElement("div");
  figure.innerHTML = figureHtml;
  const figureNode = figure.firstElementChild!;

  if (target === 0) {
    root.insertBefore(figureNode, root.firstChild);
  } else if (target >= blockCount) {
    root.appendChild(figureNode);
  } else {
    root.insertBefore(figureNode, blocks[target]!);
  }

  return { body: root.innerHTML, blockCount, insertedAfter: target };
}

export async function insertBodyImage(input: InsertBodyImageInput, userId: number): Promise<unknown> {
  const article = await one<ArticleRow>(
    "select id, body, content_kind, body_json from current_affairs.master_articles where id = $1",
    [input.article_id]
  );
  if (!article) throw httpError(404, "Article not found.");

  /*
   * PYQ bodies are rendered from `body_json` by the interactive question
   * components, not from `body` — so a figure spliced into `body` would be
   * written successfully and then never appear to a single reader. Refusing is
   * the honest answer; attaching it as an article asset still works.
   */
  const isStructured =
    (article.content_kind === "prelims_pyq" || article.content_kind === "mains_pyq") &&
    article.body_json !== null &&
    Object.keys(article.body_json).length > 0;
  if (isStructured) {
    throw httpError(
      422,
      "This is a PYQ article whose content is rendered from its structured questions, not from its body text — an image placed in the body would never be shown. Use attach-image instead."
    );
  }

  const buffer = Buffer.from(input.base64_data, "base64");
  const saved = await saveImageBuffer(buffer, input.file_name, input.mime_type);

  const figureHtml = buildFigure(saved.file_url, input.alt_text, input.caption);
  const placed = await insertIntoBody(article.body ?? "", figureHtml, input.after_block);

  await query(
    "update current_affairs.master_articles set body = $1, updated_at = now() where id = $2",
    [placed.body, input.article_id]
  );

  /*
   * Also recorded as an asset row, so the picture is visible and deletable in
   * the admin editor's image list rather than being buried in the body HTML
   * where the only way to remove it is to hand-edit markup.
   */
  await query(
    `insert into current_affairs.master_article_assets
       (article_id, asset_type, file_name, file_url, mime_type, size_bytes, alt_text, caption, metadata, uploaded_by_user_id)
     values ($1, 'inline_image', $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.article_id,
      saved.file_name,
      saved.file_url,
      saved.mime_type,
      saved.size_bytes,
      input.alt_text ?? null,
      input.caption ?? null,
      JSON.stringify({ source: "agent_inline", placed_after_block: placed.insertedAfter }),
      userId
    ]
  );

  return {
    article_id: input.article_id,
    file_url: saved.file_url,
    mime_type: saved.mime_type,
    size_bytes: saved.size_bytes,
    original_bytes: buffer.byteLength,
    blocks_in_body: placed.blockCount,
    inserted_after_block: placed.insertedAfter
  };
}
