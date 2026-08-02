import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureHtmlBody, looksLikeMarkdown, markdownToHtml } from "./posting-agent.service.js";

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
