import assert from "node:assert/strict";
import { test } from "node:test";
import { detectFactHeadingSprawl } from "./posting-agent.service.js";

/**
 * Regression cover for a real bug caught by looking at a live published
 * article: each single-fact field (Ministry, Launched, Objective,
 * Beneficiaries) rendered as its own <h2> with one short sentence under it,
 * instead of being grouped as bulleted facts under one shared "Basic
 * Details" heading — and "Key Findings" had no list under it at all. This is
 * a deterministic, purely-additive backstop: it only flags the pattern via a
 * warning, never rewrites the body, specifically so it cannot corrupt a
 * content type (Mains Topic Notes, concepts) that legitimately has its own
 * short standalone sections by design.
 */

test("flags the exact live-bug shape: several short one-fact headings in a row", () => {
  const html =
    "<h2>Ministry / Implementing Body</h2><p>Ministry of Youth Affairs and Sports.</p>" +
    "<h2>Launched</h2><p>2 August 2026, by Prime Minister Narendra Modi.</p>" +
    "<h2>Objective</h2><p>To unite young citizens in a national mission against drug abuse.</p>" +
    "<h2>Beneficiaries</h2><p>Youth mobilised through MY Bharat, NSS and youth clubs.</p>" +
    "<h2>Salient Features</h2><ul><li>Feature one.</li><li>Feature two.</li></ul>";
  assert.equal(detectFactHeadingSprawl(html), true);
});

test("does not flag a normal well-structured article with headings that have real content", () => {
  const html =
    "<h2>Basic Details</h2><ul><li><strong>Ministry:</strong> Ministry of X.</li>" +
    "<li><strong>Launched:</strong> 2 August 2026.</li></ul>" +
    "<h2>Salient Features</h2><ul><li>Feature one.</li><li>Feature two.</li></ul>" +
    "<h2>Significance</h2><ul><li>Angle one.</li><li>Angle two.</li></ul>";
  assert.equal(detectFactHeadingSprawl(html), false);
});

test("does not flag a legitimately short standalone section (e.g. a Mains Topic Note's Legal Basis)", () => {
  // Only two short, list-less headings — below the threshold, and exactly the
  // shape a deliberately terse section pair produces on other content types
  // this function has no awareness of.
  const html =
    "<h2>Concept</h2><p>A precise definition of the term, in one paragraph that runs " +
    "long enough not to look like a bare fact.</p>" +
    "<h2>Constitutional and Legal Basis</h2><p>Article 21.</p>";
  assert.equal(detectFactHeadingSprawl(html), false);
});

test("a heading followed by a real list is never counted, however short the list items are", () => {
  const html =
    "<h2>Key Findings</h2><ul><li>A.</li></ul>" +
    "<h2>Key Recommendations</h2><ul><li>B.</li></ul>" +
    "<h2>Significance</h2><ul><li>C.</li></ul>";
  assert.equal(detectFactHeadingSprawl(html), false);
});

test("a heading with a genuinely long paragraph under it is not a bare fact", () => {
  const longText =
    "<p>" + "This is a substantial paragraph explaining the ruling in detail. ".repeat(4) + "</p>";
  const html = `<h2>The Ruling</h2>${longText}<h2>Case Details</h2>${longText}<h2>Significance</h2>${longText}`;
  assert.equal(detectFactHeadingSprawl(html), false);
});

test("plain HTML with no headings at all is never flagged", () => {
  assert.equal(detectFactHeadingSprawl("<p>Just a paragraph, no headings.</p>"), false);
});
