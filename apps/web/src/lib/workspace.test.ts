import assert from "node:assert/strict";
import { test } from "node:test";
import {
  progressLabel,
  readingSecondsLabel,
  workspaceSlug
} from "./workspace.js";

test("workspaceSlug creates stable repository slugs", () => {
  assert.equal(workspaceSlug("Polity + Governance 2026"), "polity-governance-2026");
  assert.equal(workspaceSlug("   "), "repository");
});

test("progress and reading time labels are compact", () => {
  assert.equal(progressLabel({
    id: 1,
    master_article_id: 2,
    read_status: "unread",
    scheduled_revision_at: null,
    reading_progress: { progress_percent: "45.4", completed_at: null }
  }), "45% read");
  assert.equal(readingSecondsLabel(7260), "2h 1m");
});
