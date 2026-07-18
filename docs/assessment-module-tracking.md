# Assessment Module Tracking Plan

Last updated: 2026-07-18

## Current Implementation Status

The assessment backend foundation and first mobile-first student frontend slice are implemented.

Current affairs backend work has started and is tracked separately in:

- `docs/current-affairs-module-tracking.md`

Study Plans now replace the user-facing Test Series experience and are tracked separately in:

- `docs/study-plan-module-tracking.md`

The immediate schema correction is implemented in:

- `database/migrations/001_assessment_objective_questions.sql`
- `database/migrations/002_assessment_tests_attempts.sql`
- `database/migrations/003_identity_billing_foundation.sql`
- `database/migrations/004_assessment_mains.sql`
- `database/migrations/005_assessment_series_analytics_review.sql`

The first Node.js backend implementation is in:

- `apps/api`

Assessment code is intentionally split by responsibility:

- Route modules: catalog, questions, tests, mains, legacy series, review, and imports.
- Service modules: catalog, questions, test templates, attempts, scoring, leaderboard, mains, series, review, imports, and schema checks.
- Scoring helpers: answer matching, score calculation, and scoring types are separate from database persistence.

## Architecture Decision

- Node.js will be the main public backend for tests, attempts, subscriptions, student activity, and admin workflows.
- FastAPI will be an internal service for parsing, OCR, AI generation, classification, mains evaluation, and analytics enrichment.
- PostgreSQL is the primary database.
- Redis will be used for queues, locks, autosave buffering, rate limits, and idempotency.

## Objective Question Schema Decisions

- Maths and CSAT questions must not use a separate table from GK/prelims questions.
- A maths/CSAT standalone question is represented as:
  - `question_family = objective`
  - `question_format = standard_quiz`
  - `exam_level = CSAT` or the relevant objective level
  - `subject_node = Maths`
- Passage questions are not a separate question system.
  - They use the same `questions` and `question_versions` tables.
  - They are linked to a passage only when needed through `passage_questions`.
- `question_prompt` is the only prompt/mid-statement field.
  - `mid_question_statement` must not exist.
- `model_solution` must not exist in objective quiz versions.
  - Model answers/solutions belong only to mains question details later.
- Question nature is dynamic and admin-managed through `question_natures`.
  - It is not a hardcoded enum.

## Implemented Schema Tables

- `assessment.exams`
- `assessment.exam_levels`
- `assessment.assessment_taxonomy_nodes`
- `assessment.question_natures`
- `assessment.question_formats`
- `assessment.questions`
- `assessment.question_versions`
- `assessment.passages`
- `assessment.passage_questions`
- `assessment.question_taxonomy_links`
- `assessment.test_templates`
- `assessment.test_sections`
- `assessment.test_question_items`
- `assessment.test_attempts`
- `assessment.attempt_responses`
- `assessment.attempt_events`
- `assessment.test_results`
- `assessment.result_topic_breakdowns`
- `app.users`
- `app.audit_logs`
- `billing.plans`
- `billing.plan_prices`
- `billing.subscriptions`
- `billing.payment_events`
- `billing.entitlements`
- `assessment.mains_taxonomy_nodes`
- `assessment.mains_question_details`
- `assessment.mains_question_taxonomy_links`
- `assessment.mains_answer_attempts`
- `assessment.test_series`
- `assessment.test_series_items`
- `assessment.error_types`
- `assessment.student_error_logs`
- `assessment.student_bookmarks`
- `assessment.student_topic_metrics`
- `assessment.question_import_batches`
- `assessment.question_import_items`
- `app.home_collections` (migration `042_home_collections.sql`) — admin-curated lists of taxonomy nodes shown on the student Home screen: slug, title, subtitle, cover_image_url, display_order, is_active.
- `app.home_collection_items` (migration `042_home_collections.sql`) — collection_id, taxonomy_type (`objective`|`mains`), node_id, display_order, cover_image_url.

## Implemented Backend Endpoints

Base path: `/api/v1/assessment`

- `GET /exams`
- `POST /exams`
- `PATCH /exams/:id`
- `GET /exams/:examId/levels`
- `POST /exams/:examId/levels`
- `PATCH /exam-levels/:id`
- `GET /question-formats`
- `POST /question-formats`
- `PATCH /question-formats/:id`
- `GET /taxonomy-nodes`
- `POST /taxonomy-nodes`
- `PATCH /taxonomy-nodes/:id`
- `GET /question-natures`
- `POST /question-natures`
- `PATCH /question-natures/:id`
- `POST /passages`
- `GET /passages/:id`
- `PATCH /passages/:id`
- `GET /questions`
- `POST /questions`
- `GET /questions/:id`
- `PATCH /questions/:id`
- `POST /questions/:id/versions`
- `PUT /questions/:id/taxonomy`
- `GET /test-templates`
- `POST /test-templates`
- `GET /test-templates/:testTemplateId`
- `GET /test-templates/:testTemplateId/paper`
- `PATCH /test-templates/:testTemplateId`
- `POST /test-templates/:testTemplateId/sections`
- `PATCH /test-sections/:id`
- `POST /test-templates/:testTemplateId/questions`
- `PATCH /test-question-items/:id`
- `DELETE /test-question-items/:id`
- `POST /test-templates/:testTemplateId/attempts/start`
- `GET /attempts/:attemptId`
- `GET /attempts/:attemptId/paper`
- `GET /me/attempts`
- `PUT /attempts/:attemptId/responses`
- `POST /attempts/:attemptId/submit`
- `GET /results/:id`
- `GET /results/:id/review`

Health/docs:

- `GET /health`
- `GET /health/db`
- `GET /docs`

Auth:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id`

Billing:

- `GET /api/v1/billing/plans`
- `POST /api/v1/billing/plans`
- `PATCH /api/v1/billing/plans/:id`
- `POST /api/v1/billing/plans/:id/prices`
- `PATCH /api/v1/billing/plan-prices/:id`
- `POST /api/v1/billing/plans/:id/entitlements`
- `PATCH /api/v1/billing/entitlements/:id`
- `GET /api/v1/billing/subscriptions`
- `POST /api/v1/billing/subscriptions`
- `PATCH /api/v1/billing/subscriptions/:id`

Mains:

- `GET /api/v1/assessment/mains/taxonomy-nodes`
- `POST /api/v1/assessment/mains/taxonomy-nodes`
- `PATCH /api/v1/assessment/mains/taxonomy-nodes/:id`
- `GET /api/v1/assessment/mains/questions`
- `POST /api/v1/assessment/mains/questions`
- `GET /api/v1/assessment/mains/questions/:id`
- `PATCH /api/v1/assessment/mains/questions/:id`
- `POST /api/v1/assessment/mains/questions/:id/versions`
- `POST /api/v1/assessment/mains/answers`
- `PATCH /api/v1/assessment/mains/answers/:id/evaluation`

Review and analytics:

- `GET /api/v1/assessment/error-types`
- `POST /api/v1/assessment/error-types`
- `PATCH /api/v1/assessment/error-types/:id`
- `GET /api/v1/assessment/me/bookmarks`
- `POST /api/v1/assessment/me/bookmarks`
- `GET /api/v1/assessment/me/error-logs`
- `POST /api/v1/assessment/me/error-logs`
- `GET /api/v1/assessment/me/dashboard`
- `GET /api/v1/assessment/leaderboard`

User-owned custom tests (student self-built tests, distinct from admin-authored `test-templates`):

- `POST /api/v1/assessment/user/custom-tests` — creates a private test template. Accepts either `question_ids` (explicit list) or `categories` (array of `{node_id, taxonomy_type, quantity, ...}` — resolved server-side via `resolveCategoriesToQuestions()` against the same recursive/stratified taxonomy rollup used for compiled attempts, so a parent category's full subtree resolves correctly; added 2026-07-17, see `apps/api/src/modules/assessment/test-templates.service.ts`).
- `POST /api/v1/assessment/user/custom-tests/:testTemplateId/add-questions` — same `question_ids`/`categories` duality; when using `categories`, excludes question versions already in the target test (avoids the `test_question_items_test_template_id_question_version_id_key` duplicate-key error) and returns a `no_matching_questions` 404 if nothing new resolves.
- `POST /api/v1/assessment/user/ai/parse-file`
- `POST /api/v1/assessment/user/ai/parse-images`
- `POST /api/v1/assessment/user/ai/parse-text`
- `POST /api/v1/assessment/user/ai/save-questions`

Home collections (curated taxonomy-node lists shown on the student Home screen, added 2026-07-17):

- `GET /api/v1/assessment/home-collections` — public; resolves each item's name/image/node_type/rolled-up question count against whichever taxonomy tree it belongs to (objective or mains).
- Admin CRUD for `app.home_collections` + `app.home_collection_items`, including a `PUT .../items` transaction-wrapped bulk-reorder (delete-then-reinsert). See `apps/api/src/modules/assessment/home-collections.routes.ts`.
- Student-facing display (mobile or web) is **not yet built** — deferred until a real collection exists to test against.

Legacy test series:

- `GET /api/v1/assessment/test-series`
- `POST /api/v1/assessment/test-series`
- `GET /api/v1/assessment/test-series/:id`
- `PATCH /api/v1/assessment/test-series/:id`
- `POST /api/v1/assessment/test-series/:id/items`
- `PATCH /api/v1/assessment/test-series-items/:id`
- `DELETE /api/v1/assessment/test-series-items/:id`

Import review:

- `GET /api/v1/assessment/import-batches`
- `POST /api/v1/assessment/import-batches`
- `GET /api/v1/assessment/import-batches/:id`
- `PATCH /api/v1/assessment/import-items/:id`
- `POST /api/v1/assessment/import-items/:id/publish`

## Default Question Formats Seeded

These are seeded as configurable records, not application hardcoded branches:

- Standard quiz
- Statement-based quiz
- Assertion-reason
- Match the following
- Passage-linked quiz

## Frontend Implementation

- New assessment frontend routes in `apps/web`:
  - `/assessment`
  - `/assessment/tests`
  - `/assessment/tests/[id]`
  - `/assessment/test-series`
  - `/assessment/test-series/[id]`
  - `/assessment/attempts/[attemptId]`
  - `/assessment/results/[resultId]`
  - `/assessment/dashboard`
- Public pages are server-rendered for test discovery, test detail, and test-series discovery.
- Authenticated client pages cover attempt taking, private result review, and student dashboard.
- Test detail pages use linked step sections and a suggested approach panel to guide students before starting.
- Attempt UI includes timer, mobile bottom controls, question palette, answer autosave, skip, mark for review, and final submit.
- Result review includes score summary, per-question review, explanations, and weak-topic suggestions from topic breakdowns.
- Student dashboard shows summary stats, recent attempts with resume/review actions, and weak-topic suggestions.
- Root web route now redirects to `/assessment`.

## New Frontend-Support Backend Reads

- `GET /api/v1/assessment/test-templates/:testTemplateId/paper` returns a published test paper without correct answers or explanations.
- `GET /api/v1/assessment/attempts/:attemptId/paper` returns an authenticated attempt paper with existing responses.
- `GET /api/v1/assessment/me/attempts` returns authenticated attempt history for dashboard/resume.
- `GET /api/v1/assessment/results/:id/review` returns private post-submit review data with correct answers, explanations, response data, score items, and topic breakdowns.

## Remaining Assessment Backend Work

These are the remaining backend tasks for the next implementation pass. The Node.js assessment CRUD, attempt, scoring, result, admin, billing foundation, and mains manual-evaluation APIs are already in place.

### AI and Parser Service

- Add internal FastAPI service for AI/parsing workloads.
- Add DOCX/PDF/OCR parser flow that creates `assessment.question_import_batches` and `assessment.question_import_items`.
- Add AI question generation for selected exam/level/subject/topic/subtopic/nature.
- Add AI category/classification suggestions for imported questions.
- Add AI-generated recommendations from weak topic metrics.
- Add AI-assisted mains answer evaluation as a draft/review workflow, not direct final scoring.

### Import Workflow

- Replace current manual JSON import with real file upload + parser job orchestration.
- Add import validation summary endpoint before publishing.
- Add bulk approve/reject/publish operations for import items.
- Add parser job status tracking and failure retry behavior.

### Concurrency and Attempt Operations

- Add Redis-backed autosave buffering for high-concurrency attempts.
- Add Redis/job-backed attempt expiry handling.
- Add attempt event logging endpoint for navigation, timer, question visit, tab-switch, and pacing graph data.
- Strengthen idempotency keys for start attempt, autosave, and submit operations.
- Add rate limits specific to attempt autosave and submit endpoints.

### Advanced Analytics

- Add pacing graph data endpoint.
- Add productive vs wasted time analytics.
- Add topper-choice comparison/top-percentile behavior analytics.
- Add topic/subtopic trend history beyond the current aggregate `student_topic_metrics`.
- Add notification/recommendation jobs for weak topics and revision reminders.
- Add downloadable report generation endpoint, preferably PDF.

### Subscription and Payments

- Add production payment provider webhook verification.
- Convert webhook events into `billing.payment_events` and `billing.subscriptions` updates.
- Add subscription audit/admin timeline endpoint.
- Add entitlement checks for all premium assessment surfaces once frontend routes are defined.

### Auth and Security Hardening

- Add refresh tokens or server-side sessions.
- Add password reset flow.
- Add email verification flow.
- Add device/session revocation.
- Add audit log writes for admin mutations.
- Add stricter production secrets/config validation.

### Test Coverage

- Add automated API integration tests for auth/RBAC.
- Add test coverage for question schema guardrails.
- Add test coverage for objective attempt scoring, duplicate submit, rank/percentile, and topic metrics.
- Add test coverage for mains question/evaluation APIs.
- Add test coverage for billing entitlement access checks.
- Add test coverage for import review/publish flow.

## Tracking Checklist

- [x] Objective question schema corrected for GK, maths, CSAT, and passage-linked questions.
- [x] Removed duplicate `mid_question_statement`.
- [x] Removed objective `model_solution`.
- [x] Added dynamic `question_formats`.
- [x] Added dynamic `question_natures`.
- [x] Added passage link model without forcing all objective questions into passage structure.
- [x] Added Node.js Fastify API scaffold.
- [x] Added PostgreSQL migration runner.
- [x] Applied first migration to local `coaching_app` PostgreSQL database.
- [x] Added assessment CRUD endpoints for the objective question foundation.
- [x] Smoke-tested standalone CSAT maths standard quiz creation.
- [x] Smoke-tested DB guardrail rejecting mains questions with objective formats.
- [x] Added test template, section, test question item, attempt, response, event, result, and topic-breakdown schema.
- [x] Applied second migration to local `coaching_app` PostgreSQL database.
- [x] Added API endpoints for test creation, attempt start, response autosave, and submit.
- [x] Smoke-tested full objective test flow with server-side scoring.
- [x] Smoke-tested duplicate submit returns existing result.
- [x] Added identity, login, JWT auth, and role guards.
- [x] Added billing plans, prices, subscriptions, and entitlement-backed access checks.
- [x] Added mains-specific taxonomy and mains details schema.
- [x] Added mains question, answer submission, and evaluator scoring APIs.
- [x] Added legacy test series schema and APIs.
- [x] Added separate Study Plans module as the user-facing replacement for Test Series.
- [x] Added bookmarks, error logs, error types, topic metrics, dashboard analytics, and leaderboard.
- [x] Added cutoff status, rank snapshot, and percentile snapshot in result generation.
- [x] Added question import batch/item review tables and APIs.
- [x] Added approved import item publishing into the question bank.
- [x] Added result detail API with attempt, test, summary, and topic breakdowns.
- [x] Added admin CRUD/status management for assessment catalog, questions, tests, mains, series, error types, users, subscriptions, plans, prices, and entitlements.
- [x] Split assessment route layer into catalog, questions, tests, mains, series, review, and import route modules.
- [x] Split assessment service layer into focused services and scoring helpers.
- [x] Add test builder schema.
- [x] Add test attempt and result schema.
- [x] Add analytics and weakness tracking schema.
- [x] Add subscription schema.
- [x] Added home collections (curated taxonomy-node lists) — schema, backend CRUD + public resolve endpoint, admin UI. Student-facing display still pending.
- [x] Fixed bookmark `content_type` filtering bug — `listBookmarks()` was silently dropping all bookmarks whenever the revision list was filtered by content type.
- [x] Redesigned category browser as tabs + inline drill-down (mobile and web) — every row (folder or leaf) can now start/add from its rolled-up total, not just leaves.
- [x] Fixed category-based question resolution for saved/existing custom tests — adding from a parent category previously failed with "no questions available" because the endpoint matched taxonomy nodes exactly instead of resolving the subtree.
- [x] Reworked the custom-test builder cart flow (mobile + web) to silent-accumulate-then-choose-destination instead of forcing add-destination decisions per action.
- [x] Rolled up category-wise performance on results and dashboards so a subject/book/chapter reflects the combined accuracy of its topics, not just questions tagged directly on that node. Added a shared `buildPerformanceTree()` helper (`apps/api/src/modules/assessment/taxonomy-rollup.ts`), a new `GET /api/v1/assessment/me/performance-tree` endpoint, and a `topic_performance_tree` field on `GET /results/:id/review`. Mobile's dashboard (GK/Aptitude tabs) and Result Review "Topics" tab already did this rollup client-side and were left as-is; fixed the Result Review Summary tab's "Priority Revision Areas" (was reading raw flat breakdowns) to use the rolled-up tree instead. Web previously had no rollup anywhere — added a `PerformanceTree` component (`apps/web/src/components/assessment/performance-tree.tsx`) used by both the dashboard ("Full Syllabus Performance" section, replacing the flat "Weakness Heatmap") and the result page's Topics tab (replacing the flat `TopicHeatmap` for objective tests; mains tests still fall back to the flat heatmap since mains questions aren't tagged against the objective taxonomy). Categories with no directly-tagged questions anywhere in their subtree are pruned rather than shown as empty.
- [x] Fixed custom test creation FK violation (`exam_level_id` foreign key error) — clients previously guessed a raw `exam_level_id` that only happened to match one environment's row ids (migration `038_seed_exam_levels.sql` added a second slug convention, `prelims`/`csat`/`mains`, alongside the original `prelims-gs`/`prelims-csat`/`mains-written`). `POST /user/custom-tests` now accepts `content_type` instead and resolves the exam level server-side (`resolveExamLevelId` in `test-templates.service.ts`), trying every known slug. Also fixed `getUserCustomTests` filtering (was using the same broken hardcoded id, hiding successfully-created tests from "My Tests") to use the server's `content_type` filter instead.
- [x] Added marks-percentage-based category ranking (migration `043_add_max_score_tracking.sql`) — `result_topic_breakdowns.max_score` and `student_topic_metrics.total_score`/`total_max_score` track the denominator needed for `score_percent = score / max_score * 100`, which (unlike accuracy, a 0..1 correct-vs-incorrect ratio) reflects negative marking and can go negative. `buildPerformanceTree()`, `getStudentPerformanceTree()`, and `getStudentCategoryPerformance()` all now compute and rank by `score_percent`. Mobile dashboard (hero, weak/strong insights, category extremes, full-syllabus tree) and `CategoryPerformanceDetailScreen` updated to display it; web not yet updated (still accuracy-only for now, sort order changed but display didn't).
- [x] Redesigned mobile Performance dashboard: dark-gradient hero (was plain white, and previously never showed overall accuracy at all), "Category Level Extremes" table replaced with tappable cards (was a cramped `Table` widget where only the name text itself was tappable), fixed the "highest == lowest" duplicate-category bug when few categories are attempted (was taking top-3/bottom-3 from the same short list — now splits into disjoint halves first), and moved the full category tree ("Category Performance Table") to right after the hero instead of the bottom of the page. Tree rows: leaf categories now open their performance page on tap of the whole row (previously only a tiny icon button worked, and tapping a leaf row did nothing); parent categories still expand on tap but get an explicit "View" chip.
- [x] Fixed category detail navigation landing on "Create Test" instead of "Performance" every time a category was opened from a performance page — `CategoryDetailScreen` now takes an `initialTabIndex`, passed as 1 (Performance) from all performance-page entry points.
- [x] Mobile Performance dashboard iteration after user feedback: reduced excessive bold typography (was mostly w700-w900, including tiny caption/badge labels), removed sections duplicating the new hero and category list (old metric grid, "Top & Bottom Performers"), fixed a genuine Flutter rendering bug where mixing a non-uniform `Border` with `borderRadius`+`boxShadow` on one `BoxDecoration` silently blanked a card's child content on web (question record cards) — replaced with a separate accent-bar widget. Mocked up 4 alternative layouts for the category list (flat list / level-grouped sections / folder drill-down / dense table) as an HTML artifact for the user to pick from; replaced the nested expandable tree with the chosen level-grouped-sections design (Subjects/Books/Chapters/Topics, each a flat weakest-first list, no expand/collapse).
- [x] Centralized performance tracking across attempt sources (migration `044_test_attempt_source_tracking.sql`) — audited every place a student can generate a result (custom tests, dynamic/compiled practice, revision — which turned out to have no backend distinction from custom tests at all — user-uploaded questions, Study Plans). Found Study Plan attempts ran a fully parallel pipeline (own schema, own question bank, a hand-copied `student_topic_metrics` upsert missing `total_score`/`total_max_score` entirely) that never fed the central Performance dashboard for objective content, and never fed it at all for Mains. Fixed:
  - Added `assessment.test_templates.source` (`official`/`custom_test`/`dynamic_practice`/`compiled_practice`/`single_mains_question`/`study_plan`) and `assessment.test_attempts.study_plan_attempt_id`, tagging every attempt-creation flow so results can be classified by origin later if needed. Question-authorship classification (official bank vs. self-uploaded) already existed via `assessment.questions.created_by_user_id`/`is_user_question`/`is_ai_generated` — no new work needed there.
  - Exported `upsertStudentTopicMetric` from `scoring.service.ts` so it's the single canonical writer everywhere, replacing Study Plan's hand-duplicated SQL.
  - `submitStudyPlanAttempt()` now mirrors non-mains (GK/CSAT) submissions into `assessment.test_templates`/`test_attempts`/`test_results`/`result_topic_breakdowns` (tagged `source='study_plan'`, taxonomy nodes already shared between schemas so no id-mapping needed) purely to feed the central rollup — Study Plan keeps its own separate result page/tables untouched. Smoke-tested end-to-end against local DB (submit → mirror rows land correctly → `student_topic_metrics` totals correct → idempotent on resubmit).
  - Added `source <> 'study_plan'` filters everywhere a mirror could otherwise leak into user-facing lists or double-count: `listMyAttempts`, `getLeaderboard` (+ 404s on direct access to a mirrored template id), `listTestTemplates`/`getTestTemplate` (test catalog), and the `assessment.*` arm of the dashboard's GK/Aptitude summary/trend unions (the `study_plan.*` arm was already correct and untouched). Verified live: mirrored rows invisible in "My Tests" and the catalog, dashboard totals count each attempt exactly once.
  - Mains stays on its existing separate summary-card view rather than the GK/Aptitude rollup tree (subjective scoring doesn't fit the objective breakdown shape) — fixed `mainsStrongTopics`, which only read `student_topic_metrics` for `content_type='mains'`, a column nothing has ever written to for Mains from any source, so it was always empty. Rewritten to match `mainsWeakTopics`'s existing union pattern.
  - Found but deliberately did NOT fix (separate, larger feature, flagged for the user): Study Plan Mains answers are written with `result_status='submitted_unscored'` and nothing anywhere in the backend ever transitions them to `'scored'` — there's no evaluation queue for them like `assessment.mains_answer_attempts` has (`listMainsEvaluationQueue`/`evaluateMainsAnswer`). `mainsCategoryTrends` was left un-unioned with Study Plan data since it would surface nothing until that gap is closed.
- [x] Study Plan live classes + course-based presentation redesign (migration `045_study_plan_live_classes.sql`). Live classes: `study_plan.live_classes` (one-to-many Agora broadcast sessions, optionally linked to a `plan_items` row) + `study_plan.live_class_attendance`; real signed Agora RTC tokens via the `agora-token` npm package (`apps/api/src/common/agora.ts`), replacing mentorship's previous fake-string token generator (`007`-prefixed AccessToken2 tokens confirmed against the real App ID/Certificate) — host role for the assigned host or any admin/moderator/content_editor, audience role for enrolled students only, gated by class status (can't join before start, can't join after end — verified with a full smoke test including the rejection-message bug this caught: "hasn't started yet" was firing even for already-ended classes, fixed to distinguish the two). New endpoints: schedule/list/start/end/token. Mobile: added `agora_rtc_engine`, `permission_handler`, `flutter_html` dependencies, camera/mic permissions (Android manifest + iOS Info.plist), and a new `LiveClassScreen` (broadcaster view for hosts, audience view for students, live badge, participant count, mic/camera controls). Noted but did not change: the mobile app's login flow blocks `admin`/`mentor` roles entirely ("Admins and Mentors must use the web dashboard") — only `moderator`/`content_editor` accounts can actually host from mobile today; a web admin UI for *scheduling* new live classes wasn't built (the backend endpoint exists, just no web form yet).
  Course-based presentation redesign, per explicit user direction to mix elements from three earlier mockup options: catalog (`study_plan_list_screen.dart`) is now a 2-column grid of cards (Option 1) with a rating badge overlay; detail screen (`study_plan_detail_screen.dart`) curriculum is a vertical roadmap with named weeks from `plan_weeks`/`week_overviews` (Option 2's "list system", previously fetched by the backend but never parsed by the Flutter model), only the current week auto-expanded; day items within a week use a checkmark + strikethrough treatment for completed items (Option 3's progress style) instead of a plain checkbox. Added a fully HTML-rendered, expandable plan description (`flutter_html`, "Read more/Show less") — the description field itself needed no schema change since it was already `text`. Also fixed two real bugs found along the way: the curriculum's "OPEN" button for reading/lecture resources was a dead no-op stub (now uses `url_launcher`), and star ratings were entirely unparsed from the API response despite the backend already returning them via `reviews_summary`.
- [x] Fixed a blank Study Plan detail screen ("Cannot hit test a render box with no size") — the roadmap's week-connector line put `Expanded` inside a `Column` that was a `Row` child with no bounded height (the `Row` sits in a scrollable). Wrapped the `Row` in `IntrinsicHeight` so the connector has a real height to fill; audited every other `Expanded`/`Flexible` added this session for the same bug class (none found).
- [x] Live-class chat + raise-hand-to-speak (`live_class_screen.dart`, mobile only, no schema change) — open, instant text chat over Agora's own RTC data stream (`createDataStream`/`sendStreamMessage`/`onStreamMessage`), scoped to the live session only, nothing persisted once the call ends. Students can raise a hand; only the host sees the request queue and can grant it, which promotes that one student from audience to broadcaster (`setClientRole` + `enableLocalAudio`) so they can unmute and ask out loud, with a "Done" control (or the host revoking) reverting them back to audience. Chosen over Agora RTM or a custom backend chat table to avoid a second SDK/dependency and keep everything on the connection already open for video.
- [x] Fixed the locked-plan header/color regressions the user caught by direct comparison against the chosen mockup: locked week status circle could still render as "current" (filled civic, glowing) since `isCurrent` never checked `locked`; the "unify locked treatment via Opacity" pass replaced explicit `locked ? muted : civic` checks with `Opacity(0.5)` alone, which doesn't desaturate a color -- civic at half-opacity on white just reads as light purple, not grey (restored explicit color checks); the detail header was missing the "PRELIMS · POLITY"-style level pill entirely (catalog cards had it, detail screen never did); "N sessions across N weeks" didn't pluralize for N=1. Also disabled the week header's default `InkWell` splash color (was leaving a stray purple rectangle after tapping to expand/collapse). Then matched every font-size/weight in the screen to the chosen mockup's actual CSS values on request (plan title 22->19, "Course Schedule" header 16->13, sticky bar price 18->15, etc.).
- [x] End-to-end live-class verification, admin creation through student access. Added the missing piece: a web admin UI to schedule/start/end a live class (`admin-study-plan-space.tsx`), hooked into the existing `live_lecture` step form -- host defaults to the scheduling admin, since any admin/moderator/content_editor already gets host access server-side regardless of who's recorded as host, so a separate host-picker wasn't needed. Verified the full loop for real, not just by code review: real HTTP requests (not the service-layer bypass used in earlier smoke tests) confirmed schedule -> list -> start -> host-gets-token(role=host) -> enrolled-student-gets-token(role=audience) -> non-enrolled-outsider correctly 403s; a real browser session (login as a moderator test account, fill the form, click submit) confirmed the step appears in the timeline, "Start now" flips status to live, "End class" flips it to ended, with the UI updating correctly at each step. What's still unverified and can only be tested on real devices: actual audio/video transmission and the chat/raise-hand data-stream protocol, since this environment has no camera/microphone hardware.
- [x] Centralized mobile text styling into `AppTypography` (`app_theme.dart`), the root fix for the repeated "why doesn't this match the mockup" font/color regressions this session. Colors were already centralized via `AppColors`, but every screen hand-typed its own `GoogleFonts.plusJakartaSans(fontSize: X, fontWeight: Y)` inline, which had drifted to 16+ near-duplicate sizes across the three Study Plan screens alone, with the same visual role (e.g. a "locked" eyebrow label) reimplemented independently in multiple places. Added 9 named roles (`title`, `sectionHeader`, `cardTitle`, `statValue`, `button`, `eyebrowLarge`, `eyebrowSmall`, `body`, `caption`) and migrated `study_plan_list_screen.dart`, `study_plan_detail_screen.dart`, and `live_class_screen.dart` to reference them via `.copyWith()` for legitimate per-context deviations (locked-state colors, the live-class screen's white-on-black video overlay palette). Scoped to the Study Plan feature area for now; not yet extended to the rest of the app (home, mentors, current affairs, auth) or to the web app, pending user direction on scope. Verified with `dart analyze lib` (0 errors project-wide) and `dart format`.
- [x] Extended centralization to shape/state tokens, per explicit follow-up request to cover "as many elements as possible": added `AppRadius` (sm/md/lg/sheet/pill), consolidating 7 distinct hand-typed corner-radius values (9/10/12/14/16/18/999) across the three Study Plan screens into 5 named roles; `AppOpacity.locked` naming the 0.5 "locked" dimming value that was previously a bare literal duplicated in two spots (the exact value that caused the earlier purple-tint regression); and `AppButtonStyles.filled`/`.outlined` factories replacing every independently-typed `ElevatedButton.styleFrom(backgroundColor/foregroundColor/shape)` block (the same pattern that caused the earlier black-vs-civic button bug) with one shared code path. Fixed a real mismatch this surfaced: the catalog card's `InkWell` ripple used 14px while its own `Container` decoration used 16px -- both now reference `AppRadius.lg`. Deliberately left spacing/padding values as literals -- they were pixel-matched to the approved mockup earlier this session, and snapping them onto a generic scale risks reintroducing the exact "doesn't match the mockup" drift this whole effort exists to prevent. Verified with `dart analyze lib` (0 errors project-wide).
- [x] Extended `AppTypography` from Study Plan-only to the entire mobile app, per explicit follow-up request ("implement the designs based on the study plan fonts") clarified via user choice to restyle every screen onto Study Plan's actual type scale rather than just structurally refactor while keeping each screen's old inconsistent sizes. Added a 10th role, `display` (26px/w800, for hero/marketing headlines Study Plan itself never needed). Migrated all 28 remaining files across auth (3), home/navigation (2), mentors (3), the rest of Study Plans (2), shared core widgets (2), and the entire assessment module (16, the largest chunk -- `self_test_builder_tab.dart` alone was 4,253 lines/97 call sites) -- eliminating roughly 630 hand-typed `GoogleFonts.plusJakartaSans`/`.inter(...)` inline style calls plus a separate, largely-unused `Theme.of(context).textTheme.*` styling system discovered along the way, and a smaller set of bare `TextStyle(...)` literals that were silently falling back to the system default font entirely (a more severe instance of the same drift bug class, since they weren't using the app's font family at all). Also fixed a genuine "doesn't match the mockup" bug this surfaced: `assessment_dashboard_screen.dart`'s fl_chart tooltip/axis callbacks and several other spots used `const TextStyle(...)` literals, which needed `const` removed from enclosing widget trees to swap in the new non-const `AppTypography` styles. Verified with `dart analyze lib` (0 errors project-wide) and `dart format` after every file. One file (`result_review_screen.dart`, ~125 call sites, the single largest file at 3,333 lines) was split across a background agent and direct follow-up work after the agent hit a session limit partway through -- verified clean on completion the same way as every other file.
- [ ] Add FastAPI internal AI/parsing service.
- [ ] Replace manual JSON import flow with real DOCX/PDF parser service.
- [ ] Add Redis-backed autosave, attempt expiry, and event logging.
- [ ] Add advanced analytics endpoints for pacing, topper comparison, and recommendations.
- [ ] Add downloadable report generation.
- [ ] Add production payment webhook integration.
- [ ] Add auth hardening: refresh/session, password reset, email verification.
- [ ] Add automated API integration test suite.

## Handoff Notes

- Do not recreate the assessment schema from scratch. Continue from migrations `001` to `005`.
- Current affairs uses migrations `006` and `007`; keep it separate from assessment migrations unless a feature genuinely crosses modules.
- Objective questions use `questions`, `question_versions`, `question_formats`, `question_taxonomy_links`, and optional `passage_questions`.
- Mains questions use the same base `questions` and `question_versions`, plus `mains_question_details` and `mains_question_taxonomy_links`.
- Objective quiz versions intentionally do not have `model_solution`.
- There is intentionally no `mid_question_statement`; use `question_prompt`.
- Question nature remains admin-managed through `question_natures`.
- Backend docs passed verification after the latest code changes with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run db:migrate`
