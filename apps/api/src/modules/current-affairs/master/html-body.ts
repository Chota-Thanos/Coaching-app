/**
 * Guarantees article bodies are stored as HTML, never Markdown.
 *
 * Every real article on this platform stores `body` as HTML (`<p>`, `<h2>`,
 * `<strong>`, `<ul><li>`) — confirmed by reading a live published article
 * directly. The AI prompts that produce articles ask for HTML explicitly, but
 * a prompt is a request, not a guarantee: models have been seen ignoring that
 * instruction, and a raw `## Heading` reaching the rich-text editor renders to
 * readers as literal punctuation rather than a heading.
 *
 * Lives in its own module because both write paths need it — articles created
 * by the posting agent and articles *edited* afterwards (a correction written
 * by an agent is just as likely to arrive as Markdown as the original was).
 *
 * Deliberately hand-rolled instead of pulling in a Markdown library: the
 * surface this needs to cover is exactly what the prompts ask for (headings,
 * bold, bullet lists, paragraphs, and — for genuinely tabular data — a real
 * HTML table) — so a small, fully-tested function is safer than a new
 * runtime dependency for a handful of patterns.
 */

export function looksLikeMarkdown(text: string): boolean {
  // `a` is in this list for a specific reason: Mains Notes carry pointers that
  // each link back to their source article, so their bodies routinely contain
  // <a href> among otherwise plain text. Without `a` here, such a body reads
  // as Markdown, gets converted, and the converter escapes the anchor into
  // visible "&lt;a&gt;" — destroying exactly the reference links the notes
  // exist to carry. Treating any real anchor as "already HTML" is the safer
  // failure: the worst case is prose left unconverted and visible in review,
  // versus links silently broken on a published page.
  //
  // `details`/`summary` are here for the same reason: a Mains Note pointer's
  // hidden-detail wrapper (<details><summary>label</summary>...</details>) is
  // real HTML that must never be run through the Markdown converter.
  //
  // Deliberately NOT extended to `table` here: a Daily News or Editorial
  // Summary body is still genuinely built from Markdown-ish sections (see
  // content-type-prompts.ts), and one section adding a real <table> block for
  // tabular data must not make this check back off and leave every OTHER
  // section's "##"/"-"/"**" sitting unconverted across the whole article. A
  // bare table with no surrounding prose doesn't match the shape checks below
  // anyway, so it is already left alone; a table inside Markdown-ish text is
  // handled inside markdownToHtml() below instead, which preserves a
  // <table>...</table> block untouched while still converting the Markdown
  // around it.
  if (/<\/?(p|h[1-6]|ul|ol|li|strong|em|div|a|details|summary)\b/i.test(text)) return false; // already has real HTML
  return /^#{1,6}\s/m.test(text) || /^[-*]\s/m.test(text) || /\*\*[^*]+\*\*/.test(text);
}

export function markdownToHtml(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const htmlBlocks: string[] = [];
  let listBuffer: string[] = [];
  let paraBuffer: string[] = [];
  // Raw lines collected while inside a <table>...</table> block written
  // directly as real HTML for tabular data (see content-type-prompts.ts) —
  // null when not currently inside one.
  let tableBuffer: string[] | null = null;

  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const flushList = () => {
    if (listBuffer.length === 0) return;
    htmlBlocks.push(`<ul>${listBuffer.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
    listBuffer = [];
  };
  const flushPara = () => {
    if (paraBuffer.length === 0) return;
    htmlBlocks.push(`<p>${inline(paraBuffer.join(" "))}</p>`);
    paraBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // A table is written as real HTML even inside otherwise-Markdown text
    // (writers are told to do exactly this for genuinely tabular data) — it
    // must survive byte-for-byte, not get read as a run of stray paragraph
    // lines and HTML-escaped into visible "&lt;table&gt;" punctuation. Once a
    // <table line is seen, every line up to and including the matching
    // </table> is copied through untouched; nothing on those lines is
    // interpreted as a heading, bullet or paragraph.
    if (tableBuffer) {
      tableBuffer.push(rawLine);
      if (/<\/table\s*>/i.test(line)) {
        htmlBlocks.push(tableBuffer.join("\n"));
        tableBuffer = null;
      }
      continue;
    }
    if (/^<table[\s>]/i.test(line)) {
      flushList();
      flushPara();
      tableBuffer = [rawLine];
      if (/<\/table\s*>/i.test(line)) {
        // Whole table on one line — close it immediately rather than waiting
        // for a </table> that has already gone by.
        htmlBlocks.push(tableBuffer.join("\n"));
        tableBuffer = null;
      }
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);

    if (!line) {
      flushList();
      flushPara();
    } else if (heading) {
      flushList();
      flushPara();
      // Every real article's section headings are h2 (confirmed against a live
      // article); collapse whatever heading depth the model used down to that.
      htmlBlocks.push(`<h2>${inline(heading[2]!)}</h2>`);
    } else if (bullet) {
      flushPara();
      listBuffer.push(bullet[1]!);
    } else {
      flushList();
      paraBuffer.push(line);
    }
  }
  flushList();
  flushPara();
  // An unterminated <table> (the model cut off, or omitted the closing tag)
  // still gets emitted rather than silently dropping the content — the
  // resulting markup may be invalid HTML, but that is visible and fixable in
  // review, unlike vanishing text.
  if (tableBuffer) htmlBlocks.push(tableBuffer.join("\n"));

  return htmlBlocks.join("");
}

/** Applies the Markdown safety net above, only when it's actually needed. */
export function ensureHtmlBody(body: string): { body: string; converted: boolean } {
  const trimmed = body.trim();
  if (!trimmed || !looksLikeMarkdown(trimmed)) return { body: trimmed, converted: false };
  return { body: markdownToHtml(trimmed), converted: true };
}
