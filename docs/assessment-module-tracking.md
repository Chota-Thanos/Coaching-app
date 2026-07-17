# Assessment Module Tracking Plan

Last updated: 2026-07-17

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
