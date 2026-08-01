import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchTopicContext } from "./ai.service.js";

/**
 * Regression cover for the silent-research failure.
 *
 * These helpers used to return `""` for every failure mode, which the generator
 * could not tell apart from "this topic needs no context" — so a blocked search
 * produced an article written from model priors that looked identical to a
 * researched one. Every failure must now carry an `error`.
 */

test("an unreachable source URL reports an error instead of empty context", async () => {
  // Port 9 is the discard port: a deterministic, offline connection refusal.
  const context = await fetchTopicContext("http://127.0.0.1:9/some-article");

  assert.equal(context.text, "");
  assert.equal(context.method, "url_scrape");
  assert.ok(context.error, "expected an error explaining why context is missing");
  assert.match(context.error, /could not fetch source url/i);
});

test("a source URL that 404s reports the status, not silence", async () => {
  const context = await fetchTopicContext("https://example.com/definitely-not-a-real-page-xyz");

  if (context.text.length > 0) {
    // example.com serves a soft 200 for unknown paths in some environments;
    // that is a genuine success, not a regression.
    assert.equal(context.error, undefined);
    return;
  }
  assert.ok(context.error, "an empty scrape must always be accompanied by an error");
});

test("long free text is grounding material itself, not a failed search", async () => {
  const body = "The Monetary Policy Committee met this week. ".repeat(12);
  const context = await fetchTopicContext(body);

  assert.equal(context.method, "none");
  assert.equal(context.text, "");
  assert.equal(context.error, undefined, "passing an article body is not a research failure");
});

test("context carries the topic it was gathered for", async () => {
  const context = await fetchTopicContext("http://127.0.0.1:9/x");
  assert.equal(context.topic, "http://127.0.0.1:9/x");
});
