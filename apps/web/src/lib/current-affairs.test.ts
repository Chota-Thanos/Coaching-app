import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getHub,
  hubHref,
  monthLabel,
  normalizePage
} from "./current-affairs.js";

test("daily news hub maps to daily current affairs", () => {
  const hub = getHub("daily-news");
  assert.equal(hub?.contentKind, "daily_current_affairs");
  assert.equal(hub?.filterMode, "month");
});

test("hubHref omits empty filter values and preserves page", () => {
  const hub = getHub("prelims-pyq");
  assert.ok(hub);
  assert.equal(hubHref(hub, { category: "polity", year: "2025", page: 2 }), "/current-affairs/prelims-pyq?category=polity&year=2025&page=2");
  assert.equal(hubHref(hub, { category: "all", year: "", page: 1 }), "/current-affairs/prelims-pyq?page=1");
});

test("month labels and page normalization are stable", () => {
  assert.equal(monthLabel("2026-05"), "May 2026");
  assert.equal(normalizePage("3"), 3);
  assert.equal(normalizePage("-1"), 1);
});
