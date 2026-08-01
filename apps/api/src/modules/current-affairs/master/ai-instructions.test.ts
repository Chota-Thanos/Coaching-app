import assert from "node:assert/strict";
import { after, test } from "node:test";
import { one, pool, query } from "../../../db.js";
import { EMPTY_RULES, loadSavedRules, renderSavedRules } from "./ai-instructions.service.js";

/**
 * Runs against the dev database.
 *
 * The subtle part is the vocabulary mismatch: an admin saves rules against the
 * generation names ("prelims_ca", "mains_ca") while an uploaded document is
 * posted under the posting names ("daily_current_affairs",
 * "daily_editorial_summary"). If the alias mapping is not applied, the lookup
 * silently finds nothing and the rules are quietly ignored — which is exactly
 * the failure this change exists to remove, so it is worth asserting rather
 * than assuming.
 */

const createdIds: number[] = [];

async function seedRule(params: {
  scope: string;
  contentType: string | null;
  title: string;
  prompt: string;
}) {
  const row = await one<{ id: number }>(
    `insert into current_affairs.ai_instructions (scope, title, content_type, prompt, is_active)
     values ($1, $2, $3, $4, true)
     returning id`,
    [params.scope, params.title, params.contentType, params.prompt]
  );
  if (row) createdIds.push(row.id);
  return row!.id;
}

after(async () => {
  if (createdIds.length > 0) {
    await query(`delete from current_affairs.ai_instructions where id = any($1)`, [createdIds]);
  }
  await pool.end();
});

// The table allows at most one rule per (scope, content_type), so seed the two
// rows this file needs once rather than per test.
const stamp = Date.now();
const aliasTitle = `alias-${stamp}`;
const exactTitle = `exact-${stamp}`;

test("rules saved under the settings name are found by the posting name", async () => {
  // Uses the 'premium' scope so no rules already in the database can influence
  // the result — the point here is purely that the name alias resolves.
  await seedRule({
    scope: "premium",
    contentType: "mains_ca",
    title: aliasTitle,
    prompt: "Always end with a 'Why in news' box."
  });

  // "mains_summary" has no rule of its own, so it must resolve to "mains_ca".
  const rules = await loadSavedRules({ scope: "premium", contentType: "mains_summary" });

  assert.equal(rules.base, "Always end with a 'Why in news' box.");
  assert.ok(rules.applied.includes(aliasTitle));
});

test("a rule for the exact content type beats any related one", async () => {
  await seedRule({
    scope: "article",
    contentType: "mains_topic_note",
    title: exactTitle,
    prompt: "EXACT"
  });

  const rules = await loadSavedRules({ scope: "article", contentType: "mains_topic_note" });

  assert.equal(rules.base, "EXACT");
  assert.ok(rules.applied.includes(exactTitle));
});

test("assessment rules saved in the settings screen reach uploaded papers", async () => {
  // The settings screen saves mains question rules as "mains_question_generation";
  // an uploaded mains paper is posted as "mains". Without the bridge the rules
  // are silently ignored.
  const title = `mains-quiz-rules-${stamp}`;
  await seedRule({
    scope: "quiz",
    contentType: "mains_question_generation",
    title,
    prompt: "Every question must state marks and word limit."
  });

  const rules = await loadSavedRules({ scope: "quiz", contentType: "mains" });

  assert.equal(rules.base, "Every question must state marks and word limit.");
  assert.ok(rules.applied.includes(title));
});

test("CSAT papers pick up the comprehension rules", async () => {
  const title = `csat-rules-${stamp}`;
  await seedRule({
    scope: "quiz",
    contentType: "premium_passage_quiz",
    title,
    prompt: "Keep the passage under 300 words."
  });

  const rules = await loadSavedRules({ scope: "quiz", contentType: "aptitude" });

  assert.equal(rules.base, "Keep the passage under 300 words.");
  assert.ok(rules.applied.includes(title));
});

test("a content type with no saved rules reports that plainly", async () => {
  const rules = await loadSavedRules({
    scope: "quiz",
    contentType: `nonexistent_kind_${Date.now()}`
  });

  assert.equal(rules.base, null);
  assert.deepEqual(rules.applied, []);
});

test("rendering is empty when nothing is configured, so callers can append blindly", () => {
  assert.equal(renderSavedRules(EMPTY_RULES), "");
});

test("rendered rules are labelled and yield to the editor's own note", () => {
  const text = renderSavedRules({
    base: "House rule text.",
    subject: "Economy rule text.",
    applied: ["a", "b"]
  });

  assert.match(text, /HOUSE RULES FOR THIS CONTENT TYPE/);
  assert.match(text, /SUBJECT-SPECIFIC RULES/);
  assert.match(text, /editor's instructions win/i);
});
