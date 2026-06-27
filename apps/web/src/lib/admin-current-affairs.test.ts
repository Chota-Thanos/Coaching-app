import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adminSlug,
  contentFamilyForKind,
  joinAdminTags,
  splitAdminTags
} from "./admin-current-affairs.js";

test("adminSlug creates API-safe slugs", () => {
  assert.equal(adminSlug("RBI's New Policy: June 2026"), "rbi-s-new-policy-june-2026");
  assert.equal(adminSlug("   ", "article"), "article");
});

test("admin tag helpers trim empty entries", () => {
  assert.deepEqual(splitAdminTags("polity,  economy, , ethics"), ["polity", "economy", "ethics"]);
  assert.equal(joinAdminTags(["polity", "economy"]), "polity, economy");
});

test("content kinds map to category families", () => {
  assert.equal(contentFamilyForKind("daily_current_affairs"), "prelims");
  assert.equal(contentFamilyForKind("mains_topic_note"), "mains");
});
