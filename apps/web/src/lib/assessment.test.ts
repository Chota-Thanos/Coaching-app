import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatPercent,
  isSameAnswer,
  normalizeAssessmentPage,
  optionKey,
  optionText,
  selectedAnswerKey
} from "./assessment.js";

test("assessment page and percent helpers are stable", () => {
  assert.equal(normalizeAssessmentPage("3"), 3);
  assert.equal(normalizeAssessmentPage("-1"), 1);
  assert.equal(formatPercent("0.754"), "75%");
  assert.equal(formatPercent("82"), "82%");
});

test("question option helpers support object and primitive options", () => {
  assert.equal(optionKey({ key: "B", text: "Second" }, 1), "B");
  assert.equal(optionText({ key: "B", text: "Second" }, 1), "Second");
  assert.equal(optionKey("Plain option", 2), "C");
  assert.equal(optionText("Plain option", 2), "Plain option");
});

test("selected answer comparison normalizes keys", () => {
  assert.equal(selectedAnswerKey({ key: "A" }), "A");
  assert.equal(isSameAnswer({ key: "A" }, "A"), true);
  assert.equal(isSameAnswer({ value: "C" }, "B"), false);
});
