import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureHtmlBody, looksLikeMarkdown, markdownToHtml } from "./html-body.js";

/**
 * Regression cover for a real bug caught by looking at a live draft: every
 * article on the platform is stored as HTML, but the parsing prompt asked its
 * own AI for "clean Markdown", so a real article rendered in the admin editor
 * as one unbroken line of literal "## Heading" and "* bullet" punctuation
 * instead of headings and a list. The prompt is now fixed to ask for HTML
 * directly; these tests cover the safety net that also catches it if the
 * model reverts to Markdown anyway.
 */

test("detects Markdown by its structural markers, not just any '#' or '*'", () => {
  assert.equal(looksLikeMarkdown("## Why in News\nSome text."), true);
  assert.equal(looksLikeMarkdown("- a bullet\n- another"), true);
  assert.equal(looksLikeMarkdown("This is **bold** text."), true);
  assert.equal(looksLikeMarkdown("Plain prose with a # symbol mid-sentence, not a heading."), false);
});

test("real HTML is left alone, even if it happens to contain a literal '*' or '#'", () => {
  const html = "<p>Section 370 was abrogated.</p><h2>Background</h2><ul><li>Point one</li></ul>";
  assert.equal(looksLikeMarkdown(html), false);
  assert.equal(ensureHtmlBody(html).converted, false);
  assert.equal(ensureHtmlBody(html).body, html);
});

test("converts the exact shape the live bug produced", () => {
  // Reduced from the actual body that rendered broken in the admin editor.
  const markdown =
    "## Why in News Prime Minister Narendra Modi launched the campaign today.\n\n" +
    "## Key Facts\n" +
    "- The campaign runs for 100 weeks.\n" +
    "- Activities are held every Sunday.\n\n" +
    "## Significance\n" +
    "**Social welfare**: Frames the issue as a public-health concern.";

  const html = markdownToHtml(markdown);

  assert.match(html, /<h2>Why in News Prime Minister Narendra Modi launched the campaign today\.<\/h2>/);
  assert.match(html, /<h2>Key Facts<\/h2>/);
  assert.match(html, /<ul><li>The campaign runs for 100 weeks\.<\/li><li>Activities are held every Sunday\.<\/li><\/ul>/);
  assert.match(html, /<strong>Social welfare<\/strong>: Frames the issue as a public-health concern\./);
  // Nothing of the original Markdown syntax should survive.
  assert.doesNotMatch(html, /##/);
  assert.doesNotMatch(html, /\*\*/);
});

test("plain paragraphs with no headings or lists still get wrapped in <p>", () => {
  const html = markdownToHtml("Just a sentence.\n\nAnother paragraph.");
  assert.equal(html, "<p>Just a sentence.</p><p>Another paragraph.</p>");
});

test("HTML-unsafe characters in the source text are escaped, not injected", () => {
  const html = markdownToHtml("Growth was 8.2% & rising, using a < b comparison.");
  assert.match(html, /8\.2% &amp; rising/);
  assert.match(html, /&lt; b comparison/);
});

test("a body carrying reference links is never converted, so the links survive", () => {
  // Mains Notes route pointers from summaries and daily news into their
  // sections, each with an <a href> back to the source. Converting such a
  // body would escape the anchor into visible "&lt;a&gt;" and break every
  // reference link on the page.
  const withLink =
    '<p>SC struck down the provision. <a href="https://waytoias.com/current-affairs/articles/x">Source</a></p>';
  assert.equal(looksLikeMarkdown(withLink), false);
  assert.equal(ensureHtmlBody(withLink).converted, false);
  assert.equal(ensureHtmlBody(withLink).body, withLink);

  // Even mixed with Markdown-looking punctuation, a real anchor wins.
  const mixed = '## Issues\n- Struck down. <a href="https://waytoias.com/x">Source</a>';
  assert.equal(looksLikeMarkdown(mixed), false);
  assert.doesNotMatch(ensureHtmlBody(mixed).body, /&lt;a/);
});

test("a <table> block inside otherwise-Markdown text survives conversion untouched, and the Markdown around it still converts", () => {
  const mixed =
    "## Key Facts\n" +
    "- The scheme covers 12 states.\n\n" +
    "## Comparison\n" +
    "<table><thead><tr><th>State</th><th>Coverage</th></tr></thead>" +
    "<tbody><tr><td>Bihar</td><td>68%</td></tr></tbody></table>\n\n" +
    "## Significance\n" +
    "**Fiscal federalism**: Widens central transfers to states.";

  const html = markdownToHtml(mixed);

  assert.match(html, /<h2>Key Facts<\/h2>/);
  assert.match(html, /<ul><li>The scheme covers 12 states\.<\/li><\/ul>/);
  assert.match(html, /<h2>Comparison<\/h2>/);
  // The table survives byte-for-byte — not escaped, not wrapped in a <p>.
  assert.match(
    html,
    /<table><thead><tr><th>State<\/th><th>Coverage<\/th><\/tr><\/thead><tbody><tr><td>Bihar<\/td><td>68%<\/td><\/tr><\/tbody><\/table>/
  );
  assert.doesNotMatch(html, /&lt;table/);
  // The Markdown on either side of the table still converted normally.
  assert.match(html, /<h2>Significance<\/h2>/);
  assert.match(html, /<strong>Fiscal federalism<\/strong>: Widens central transfers to states\./);
  assert.doesNotMatch(html, /##/);
  assert.doesNotMatch(html, /\*\*/);
});

test("a <table> spanning several lines is preserved with its original line breaks", () => {
  const withMultilineTable =
    "Some intro text.\n\n" +
    "<table>\n" +
    "<tr><th>Year</th><th>GDP Growth</th></tr>\n" +
    "<tr><td>2023</td><td>7.2%</td></tr>\n" +
    "</table>\n\n" +
    "More text after.";

  const html = markdownToHtml(withMultilineTable);
  assert.match(html, /<p>Some intro text\.<\/p>/);
  assert.match(html, /<table>\n<tr><th>Year<\/th><th>GDP Growth<\/th><\/tr>\n<tr><td>2023<\/td><td>7\.2%<\/td><\/tr>\n<\/table>/);
  assert.match(html, /<p>More text after\.<\/p>/);
});

test("ensureHtmlBody reports whether it actually had to convert anything", () => {
  const untouched = ensureHtmlBody("<p>Already fine.</p>");
  assert.equal(untouched.converted, false);

  const fixed = ensureHtmlBody("## Heading\nSome text.");
  assert.equal(fixed.converted, true);
  assert.match(fixed.body, /<h2>Heading<\/h2>/);

  const empty = ensureHtmlBody("   ");
  assert.equal(empty.converted, false);
  assert.equal(empty.body, "");
});
