# Study Plan Module Tracking Plan

Last updated: 2026-06-09

## Product Decisions

- Study Plans replace the user-facing Test Series experience.
- Legacy assessment test-series tables and APIs remain for compatibility, but the student and admin navigation now points to Study Plans.
- Plans are one-time purchases, not subscriptions.
- Plan schedules are relative: weeks and days, not fixed calendar dates.
- Students can preview the full curriculum outline before purchase, similar to a course marketplace.
- Reading and revision items are manually marked complete.
- Linked test items complete automatically after test submission.
- Study-plan quiz/test storage is separate from the assessment question bank.
- Study-plan tests still use the shared exam, exam level, and taxonomy systems.
- Objective study-plan test results are included in assessment-wide analytics and also kept in separate study-plan result tables.
- Mains plan tests can be created and submitted, but evaluator workflow is intentionally not implemented yet.
- Live lecture support exists as timeline metadata and links, but no scheduling or attendance workflow exists yet.

## Implemented Backend

- New schema and migration:
  - `database/migrations/015_study_plans.sql`
- New API module:
  - `apps/api/src/modules/study-plans/schemas.ts`
  - `apps/api/src/modules/study-plans/service.ts`
  - `apps/api/src/modules/study-plans/routes.ts`
- Server registration:
  - `apps/api/src/server.ts`
- Study-plan tables:
  - `study_plan.plans`
  - `study_plan.plan_items`
  - `study_plan.enrollments`
  - `study_plan.item_progress`
  - `study_plan.test_templates`
  - `study_plan.test_questions`
  - `study_plan.test_attempts`
  - `study_plan.attempt_responses`
  - `study_plan.test_results`
  - `study_plan.result_topic_breakdowns`
  - `study_plan.question_import_batches`
  - `study_plan.question_import_items`
- Admin APIs:
  - `GET /api/v1/study-plans`
  - `POST /api/v1/study-plans`
  - `PATCH /api/v1/study-plans/:id`
  - `POST /api/v1/study-plans/:id/items`
  - `PATCH /api/v1/study-plan-items/:id`
  - `DELETE /api/v1/study-plan-items/:id`
  - `GET /api/v1/study-plan-tests`
  - `POST /api/v1/study-plan-tests`
  - `GET /api/v1/study-plan-tests/:testTemplateId`
  - `PATCH /api/v1/study-plan-tests/:testTemplateId`
  - `POST /api/v1/study-plan-tests/:testTemplateId/questions`
  - `PATCH /api/v1/study-plan-questions/:id`
  - `DELETE /api/v1/study-plan-questions/:id`
  - `POST /api/v1/study-plans/admin/ai/parse`
  - `POST /api/v1/study-plans/admin/ai/save-draft`
- Student APIs:
  - `GET /api/v1/study-plans/:id`
  - `POST /api/v1/study-plans/:id/enroll`
  - `PATCH /api/v1/study-plan-items/:id/progress`
  - `GET /api/v1/study-plan-tests/:testTemplateId/paper`
  - `POST /api/v1/study-plan-tests/:testTemplateId/attempts/start`
  - `GET /api/v1/study-plan-attempts/:attemptId/paper`
  - `PUT /api/v1/study-plan-attempts/:attemptId/responses`
  - `POST /api/v1/study-plan-attempts/:attemptId/submit`
  - `GET /api/v1/study-plan-results/:id/review`
- Assessment analytics now include scored objective study-plan attempts in GS and CSAT summaries/trends.
- Study-plan objective submissions update `assessment.student_topic_metrics` for shared weak-topic analytics.
- Assessment taxonomy deletion now detaches study-plan references.
- Exam and exam-level deletion now clears linked study-plan tests before deleting shared records.

## Implemented Frontend

- Student pages:
  - `/study-plans`
  - `/study-plans/[id]`
  - `/study-plans/attempts/[attemptId]`
- Admin pages:
  - `/admin/study-plans`
  - `/admin/study-plans/[planId]`
  - `/admin/study-plans/tests/[testTemplateId]`
- Admin component:
  - `apps/web/src/components/admin/admin-study-plan-management.tsx`
  - `apps/web/src/components/admin/admin-study-plan-space.tsx`
  - `apps/web/src/components/admin/admin-study-plan-test-content.tsx`
  - The admin experience now starts on a management landing page with a plan list and Create New modal.
  - Opening a plan shows its detail page with editable basic details and week/day content controls.
  - Test steps link to a full-page test content manager for parsing, category mapping, question preview, save, edit, and delete.
- Student components:
  - `apps/web/src/components/study-plans/study-plan-detail-client.tsx`
  - `apps/web/src/components/study-plans/study-plan-attempt-engine.tsx`
- Shared frontend types/API helpers:
  - `apps/web/src/lib/study-plans.ts`
  - `apps/web/src/lib/study-plans-api.ts`
- Navigation changes:
  - Study Plans added to primary and mobile navigation.
  - Study Plans added to the admin module hub.
  - Study Plans added to the admin dropdown.
  - Admin Study Plan links point to the management landing page first.
  - Assessment admin no longer exposes the Test Series placeholder.
  - Legacy `/assessment/test-series` routes redirect to `/study-plans`.

## Remaining Work

- Replace the temporary manual enrollment endpoint with the real payment provider flow and webhook verification.
- Add inline edit controls for existing timeline step fields, not only delete/recreate.
- Add bulk reorder controls for week/day timeline items.
- Add richer lecture support: live date/time, attendance, recordings, and access windows.
- Add separate study-plan dashboard pages for plan-specific results and progress history.
- Add result review UI for `/api/v1/study-plan-results/:id/review`.
- Add evaluator workflow later for study-plan mains answers.
- Add schema-level passage grouping if passage identity must be shown as one shared block in all student attempt/result screens instead of repeated/stored metadata.
- Add automated API tests for plan enrollment, progress, objective scoring, and locked access.
- Add seed data for demo plans/tests after the first real plan structure is approved.

## Handoff Notes

- Do not merge study-plan question storage into `assessment.questions`; that separation is intentional.
- Do reuse `assessment.exams`, `assessment.exam_levels`, and taxonomy nodes.
- Keep old `assessment.test_series` code until existing data and routes are confirmed unused in production.
- If deleting shared taxonomy, continue the detach/null pattern instead of allowing foreign-key failures.
