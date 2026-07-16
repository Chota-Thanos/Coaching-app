# Session Context — Development Briefing

> Last updated: 2026-07-17
> Use this as the briefing for the next task session. Supersedes all prior
> versions of this file — the guided tour section below describes a full
> rewrite of what an earlier version of this file documented.

---

## 1. Guided tour (rewritten this session)

The tour described in older versions of this file (`full-tour.ts`,
`full-tour-segment.tsx`, cross-page chaining, `CustomTestCreateScreen`,
`CustomTestsListScreen`) **no longer reflects the current implementation**.
It was replaced with a tour scoped to the real, current-user-facing
category-browsing/test-building screens instead of a separate demo flow.

### Mobile (`upsc_test_series`)
- Package: `showcaseview: ^3.0.0`.
- Lives inside `SelfTestBuilderTab` (`lib/features/assessment/presentation/self_test_builder_tab.dart`)
  and `TestsHubScreen` (`tests_hub_screen.dart`), wrapped in `ShowCaseWidget`.
- Content-type-aware: `AppTourService.builderScreenKeyFor(contentType)` gives a
  separate "seen" flag per content type (gk/aptitude/mains), and tour copy
  (`_tourBrowseDescription`, `_tourAddDescription`) changes based on `_activeTab`.
- Auto-start logic (`_maybeAutoStartBuilderTour`) retries up to 5×100ms waiting
  for the target `GlobalKey`'s context to attach before calling
  `AppTourService.markTourSeen()` — marking seen before the target exists was a
  real bug (tour silently never fired again). Fixed.
- `isActive` is threaded through `NavigationHome` → `TestsHubScreen` →
  `ContentTypeScreen` → `SelfTestBuilderTab`, because `IndexedStack` /
  `TabBarView` pre-build inactive tabs — without this the tour could
  auto-fire on a tab the user hadn't actually navigated to yet. Also fixed.
- Two showcase steps: `_tourBrowseKey` (on the active subject's tab in the
  category browser — see §2) and `_tourAddKey` (on the Add button of the
  first row shown under that tab). Both are reachable without navigation now
  that browsing is tabs + inline drill-down (§2), which is what makes
  reliably anchoring the "Add" step possible — it used to be skipped because
  its target only existed after pushing to a separate screen.

### Web (`apps/web`)
- Custom `GuidedTourController` (`components/app/guided-tour-engine.tsx`),
  driven by `fallbackSteps` defined per page — no DB-registered tour, so no
  `token` is passed (passing a token would make it check a DB completion
  record that can never exist for these ad hoc tours, and it'd replay every
  visit). Completion tracked in `localStorage` only, keyed by
  `` `assessment_builder_tour_${activeTab}_v1` ``.
- Single step per content type, targets `#tour-browse-btn` — now attached to
  the active subject's tab button (see §2), not a "Browse" button on a card
  (that markup no longer exists).
- Gated on `!loadingTree && tourAnchorId != null` so it never renders before
  its target is actually in the DOM.

### Design tokens (both platforms)
```
civic:   #4f46e5   indigo — primary CTA
brand:   #2563eb   blue
ink:     #0f172a   near-black text
paper:   #f1f5fb   off-white background
line:    #dde6f0   borders
berry:   #e11d48   error / delete
saffron: #f59e0b   warning / review
emerald: green     correct / done
muted:   grey      secondary text
```

---

## 2. Category browser — tabs + inline drill-down (rewritten this session)

The taxonomy is 4 levels deep for GK/CSAT (`subject → source_bucket → topic →
subtopic`) and 5 for Mains (`paper → subject_area → theme → topic →
subtopic`), stored in two separate tables (`assessment_taxonomy_nodes`,
`mains_taxonomy_nodes`) with no cross-table FK.

Went through **three** designs this session, in order:
1. Inline expand/collapse tree (original) — replaced because 4 levels deep
   nested indentation didn't scale.
2. A pushed drill-down screen (mobile: `_CategoryDrillDownScreen`, one level
   per screen, breadcrumb via route names) + a grid of subject tiles as the
   entry point, with web using a `drillPath` state + breadcrumb inline
   (no separate route). Replaced because the user wanted subjects to behave
   like **tabs** (select → children shown below, same screen) rather than
   grid tiles you navigate away from, and because only *leaf* rows had
   Add/Start controls — folder-level categories (which can have hundreds of
   rolled-up questions across their subtree) had no way to pull a test
   directly from them.
3. **Current**: tabs + inline breadcrumb drill-down, every row (folder or
   leaf) has Add/Start using the rolled-up total. This is what's live now.

### Current behavior (both platforms)
- Top-level nodes (subjects/papers) render as a horizontal tab strip.
- Selecting a tab shows that node's children directly below, on the same
  screen — no pushed route, no separate screen.
- A breadcrumb appears once you've drilled past the tab level; tapping a
  crumb truncates back to that depth.
- **Every row**, whether it has children (folder) or not (leaf), shows a
  quantity stepper + Add + Start, using the *rolled-up total question count*
  across its whole subtree (mobile: `_getAvailableCount` /
  `_sumNodeQuestions`, recursive; web: existing `getAvailableCount`). Folders
  drilling deeper is a separate tap target (the row body / chevron) from the
  Add/Start controls.
- "Add your questions" (manual write / AI parse) is available at every level
  too, not just leaves.

### Key files
| File | What |
|---|---|
| `upsc_test_series/lib/features/assessment/presentation/self_test_builder_tab.dart` | `_buildCategoryBrowser`, `_buildSubjectTabStrip`, `_buildBrowseBreadcrumb`, `_buildBrowseRow`, `_showAddQuestionsSheet` — new. `_browseActiveSubjectId` / `_browseDrillPath` — new state. `_buildSubjectGrid`/`_buildSubjectTile` deleted (fully superseded). |
| `upsc_test_series/lib/features/assessment/presentation/category_drill_down_screen.dart` | Old pushed-screen implementation (`_CategoryDrillDownScreen`). **Now dead code** — only reachable via the already-legacy `_buildTreeNodes`/`_buildPracticeCategoryRow`/`_buildRootCategoryCard` path (itself unreachable from `build()`, flagged for removal previously). Left in place, not yet deleted — same deferred-cleanup status as the code it's nested under. |
| `apps/web/src/components/assessment/assessment-home.tsx` | `effectiveDrillPath` / `currentLevelNodes` (new `useMemo`s) replace the old `drillPath.length === 0 ? filteredTree : ...` branch. Subject tab strip added inline in the render (no separate component). `TreeRow`'s `isRoot` branch (the old vertical subject-card UI with no Add/Start) **deleted** — subjects never reach `TreeRow` anymore, only their children do, so the branch was unreachable. `isTourAnchor` prop removed from `TreeRow` (moved to the tab button directly). |

### Known gaps / deferred
- The pre-existing dead code flagged in earlier sessions (`_buildTreeNodes`,
  `_buildRootCategoryCard`, `_buildPracticeCategoryRow`, `_expandedNodes` in
  the Flutter file; the hardcoded "100 Qs" cap display in the compiled-cart
  UI) is **still** in place — not touched this session, same deferred status.
- **Web was not live-verified** at hand-off. Typechecks clean, logic mirrors
  the verified mobile implementation, but I could not get a clean browser
  test: the `loadExams` effect (code untouched by this session) never
  resolved `examId` even on a hard reload against the long-running local dev
  server, and I couldn't rule out environment interference (port 3000 was
  occupied by an untracked, hardcoded-port dev server process I couldn't
  restart). **Test this first** in the next session before trusting it live.
- Mains-taxonomy tab strip / breadcrumb uses the same code path as GK/CSAT —
  not separately spot-checked beyond the shared logic being identical.

---

## 3. Entitlements / paywall

- **3 free tests, one-time (not monthly)** across GK/CSAT/Mains combined,
  reusing the previously-dead `billing.entitlements` table
  (`entitlement_key` = `assessment.free_tests_remaining`,
  `limit_value`). Enforced in `apps/api/src/modules/assessment/tests.routes.ts`
  (`requireFreeTestAllowance`) and `free-test-allowance.ts`
  (`FREE_TEST_LIMIT = 3`, `getFreeTestUsage`).
- **AI answer evaluation is paywalled independently** of the free-test
  allowance — gated on `assessment.ai_evaluation` or
  `assessment.premium_tests` entitlement (`mains.routes.ts`,
  `result-review.tsx`'s `ApiError` catch → paywall modal → redirect to
  `/pricing`; Flutter `result_review_screen.dart`'s `_showAiEvaluationPaywall`).
- **Question caps** (`question-caps.ts`, `getQuestionCap`): free 50
  GK/CSAT · 10 Mains; premium 100 GK/CSAT · 25 Mains. Enforced server-side
  (`assertWithinQuestionCap` in `attempts.service.ts`,
  `test-templates.service.ts`) and reflected in UI copy
  (`custom_test_create_screen.dart`, `custom_test_create_screen.tsx`-equivalent
  web pages).

---

## 4. Balanced/stratified question sampling

Fixed a real bug: selecting N questions from a high-level category (e.g. 100
from a subject with 4 sub-levels of ~120 each) previously could return an
unbalanced sample skewed toward whichever sub-level happened to sort first,
not a proportionally-random spread. `attempts.service.ts`'s
`buildStratifiedSelectionQuery()` now partitions by the deepest taxonomy
node per question (`row_number() over (partition by strata_id order by
random())`) and caps each stratum at `ceil(limit / stratum_count)` before a
final random ordering — used by both `startDynamicAttempt` and
`startCompiledAttempt`, both mains and objective branches.

Caught two real SQL bugs building this, both only found by executing against
the live dev DB (not just typecheck): `count(distinct x) over (...)` is
invalid Postgres (window functions don't support `distinct` — moved into a
separate `strata_meta` CTE), and an early draft's mains branch cross-joined
in a way that could duplicate question rows across matching OR-conditions
(fixed by reverting to a proper recursive-CTE `IN` subquery).

**Practice established this session**: for any SQL change, actually execute
it against the live dev database inside a rolled-back transaction (ad hoc
`tsx` script using the project's own `pool`/`db.js`, deleted after) — not
just typecheck. Caught real bugs typecheck alone would have missed.

---

## 5. Home collections (curated category lists on the student Home screen)

New feature: admin-curated lists of taxonomy nodes (any level, any mix of
objective/mains) shown on the student Home screen with a cover image — e.g.
"PYQs across all subjects" or "Current Affairs links across all subjects".
Multiple independent lists supported.

- **Migration**: `database/migrations/042_home_collections.sql` —
  `app.home_collections` (slug, title, subtitle, cover_image_url,
  display_order, is_active) + `app.home_collection_items`
  (collection_id, taxonomy_type `'objective'|'mains'`, node_id,
  display_order, cover_image_url). Applied to the local dev DB; **not yet
  applied to production** — will happen via `deploy.sh`'s `db:migrate` step
  on next deploy.
- **Backend**: `apps/api/src/modules/assessment/home-collections.routes.ts`
  — public `GET /api/v1/assessment/home-collections` (resolves each item's
  name/image/node_type/rolled-up question count against whichever taxonomy
  tree it belongs to), full admin CRUD + `PUT .../items` bulk-reorder
  (transaction-wrapped delete-then-reinsert). Registered in
  `assessment/routes.ts`. Verified against live dev DB in a rolled-back
  transaction (name/image/count resolution confirmed correct for both
  taxonomy trees).
- **Admin UI**: new "Home Collections" tab in `AdminAssessmentSpace`
  (`admin-home-collections-manager.tsx`) — list/create/activate/delete
  collections, and a two-pane item manager (chosen items, ordered, with
  up/down + remove; searchable candidate picker with a taxonomy-type tab and
  node-type/level filter, reusing the `search` query param newly added to
  both `/assessment/taxonomy-nodes` and `/assessment/mains/taxonomy-nodes`).
- **Not yet built**: student-facing Home display (mobile or web) — explicitly
  deferred until a real collection exists to test against. Once you (or the
  next session) create a real collection via the new admin UI, this is the
  next piece.

---

## 6. Bookmark "content_type" bug (fixed this session)

Two independent, unrelated mechanisms both use "revision" language and were
being conflated:
1. The **in-attempt "Review" star** (`is_marked_for_review` on
   `attempt_responses`) — write-only, scoped to a single attempt, never read
   back anywhere else. Confirmed this is a *different* feature from what was
   actually broken (the user clarified mid-session) — **left as-is, not
   fixed**. Still a known gap if anyone expects it to feed a durable list.
2. The **post-test "Mark for Revision" / bookmark button** (result-review
   screen → `assessment.student_bookmarks` table → "Bookmarks & Revision"
   list screen) — this is the one that was actually broken and got fixed.

Root cause: `listBookmarks()` (`review.service.ts`) never returned a
`content_type` field, but both frontends filtered the bookmarks list by
`bookmark.question_version.taxonomy_content_type` — a field that never
existed on that object. Whenever a student opened the revision list for a
specific content type (GK/CSAT/Mains tab — the normal entry point), the
filter silently matched nothing, so bookmarked questions appeared to vanish
even though they saved correctly.

Fixed by adding a real `content_type` field to the `taxonomy` object
`listBookmarks()` already returns (coalescing `assessment_taxonomy_nodes
.content_type` for objective questions, hardcoding `'mains'` for Mains
questions), and updating both frontends
(`assessment-home.tsx` ×5 call sites, `self_test_builder_tab.dart` ×3) to
read `bookmark.taxonomy.content_type` instead. Verified against live dev DB.

**Not done**: Study Plan (paid weekly plan) test flow has neither the
in-attempt flag wired to anything nor any bookmark/revision-list capability
at all — flagged, not built.

---

## 7. Other standing items from earlier sessions (not touched this round)

- Guest login/register UX, welcome-screen CanvasKit crash fix — done,
  earlier session.
- Deleted dead web routes (`/assessment/category/[nodeId]`,
  `category-detail-page.tsx`) and a stale broken link — done, earlier
  session, per explicit "remove unused code" instruction.

---

## Repo structure (relevant paths)

```
E:/Coaching App/
├── apps/
│   ├── api/                                   # Fastify backend
│   │   └── src/modules/assessment/
│   │       ├── attempts.service.ts             # stratified sampling, question caps
│   │       ├── tests.routes.ts                 # free-test allowance gate
│   │       ├── question-caps.ts                # NEW
│   │       ├── free-test-allowance.ts          # NEW
│   │       ├── home-collections.routes.ts      # NEW
│   │       ├── review.service.ts               # bookmark content_type fix
│   │       └── mains.routes.ts                 # AI-eval gating
│   └── web/                                    # Next.js frontend
│       └── src/components/
│           ├── assessment/assessment-home.tsx  # category browser tabs, bookmark fix
│           └── admin/admin-home-collections-manager.tsx  # NEW
├── database/migrations/042_home_collections.sql  # NEW
├── deploy.sh                                    # canonical production deploy script
├── ecosystem.config.cjs                         # PM2 process config (coaching-api, coaching-web)
└── upsc_test_series/                            # Flutter mobile app (gitignored — not in this repo's git history)
    └── lib/features/assessment/presentation/
        ├── self_test_builder_tab.dart           # category browser tabs, tour
        └── category_drill_down_screen.dart      # now-dead pushed-screen approach
```

## Deployment

Production is a VPS at `139.84.171.75`, path `/var/www/coaching`, run via
PM2 (`ecosystem.config.cjs`: `coaching-api` on :4000, `coaching-web` on
:3000), DB is Supabase Postgres. `deploy.sh` (tracked in git, run from
`/var/www/coaching` on the server) does: `git pull origin main` → `npm
install` → `npm run db:migrate` → `npm run build` → PM2 restart/save. There
is no CI/CD — deploys are triggered manually via SSH.

**The Flutter mobile app is not part of this git repo** (`upsc_test_series/`
is gitignored) — a "push to production" of this repo does not ship any
mobile changes. Mobile release is a separate, unaddressed process.
