# Current Affairs Module Tracking Plan

Last updated: 2026-06-01

## Current Scope

Backend foundation and mobile-first SEO frontend for institute-published current affairs content and student personal workspaces.

## Implemented Schema Tables

- `current_affairs.category_nodes`
- `current_affairs.master_articles`
- `current_affairs.master_article_relations`
- `current_affairs.master_article_sections`
- `current_affairs.master_article_section_sources`
- `current_affairs.student_article_forks`
- `current_affairs.student_article_highlights`
- `current_affairs.student_article_notes`
- `current_affairs.student_articles`
- `current_affairs.student_collections`
- `current_affairs.student_collection_items`
- `current_affairs.student_article_reading_progress`
- `current_affairs.student_article_reading_events`
- `current_affairs.master_article_assets`
- `current_affairs.ingestion_jobs`
- `current_affairs.ingestion_items`
- `current_affairs.student_revision_notifications`
- `current_affairs.question_generation_jobs`

## Implemented Endpoints

Supported article kinds:

- `daily_current_affairs`
- `prelims_pyq`
- `daily_editorial_summary`
- `mains_topic_note`
- `mains_pyq`
- Legacy-compatible: `mains_summary`, `mains_article`, `study_note`

Category families:

- `prelims`: shared by daily current affairs and prelims PYQs.
- `mains`: shared by daily editorial summaries, mains topic notes, and mains PYQs.

Categories:

- `GET /api/v1/current-affairs/categories`
- `POST /api/v1/current-affairs/categories`
- `PATCH /api/v1/current-affairs/categories/:id`
- `GET /api/v1/current-affairs/categories/:id/page`
- `DELETE /api/v1/current-affairs/categories/:id`

Institute articles:

- `GET /api/v1/current-affairs/search`
- `GET /api/v1/current-affairs/articles`
- `POST /api/v1/current-affairs/articles`
- `GET /api/v1/current-affairs/articles/:id`
- `GET /api/v1/current-affairs/admin/articles/:id`
- `PATCH /api/v1/current-affairs/articles/:id`
- `POST /api/v1/current-affairs/articles/:id/archive`
- `DELETE /api/v1/current-affairs/articles/:id`
- `GET /api/v1/current-affairs/articles/:id/relations`
- `POST /api/v1/current-affairs/articles/:id/relations`
- `PATCH /api/v1/current-affairs/article-relations/:id`
- `DELETE /api/v1/current-affairs/article-relations/:id`
- `POST /api/v1/current-affairs/articles/:id/sections`
- `PATCH /api/v1/current-affairs/article-sections/:id`
- `DELETE /api/v1/current-affairs/article-sections/:id`
- `POST /api/v1/current-affairs/article-sections/:id/sources`
- `DELETE /api/v1/current-affairs/article-section-sources/:id`
- `GET /api/v1/current-affairs/articles/:id/assets`
- `POST /api/v1/current-affairs/articles/:id/assets`
- `PATCH /api/v1/current-affairs/article-assets/:id`
- `DELETE /api/v1/current-affairs/article-assets/:id`
- `GET /api/v1/current-affairs/admin/ingestion-jobs`
- `POST /api/v1/current-affairs/admin/ingestion-jobs`
- `GET /api/v1/current-affairs/admin/ingestion-jobs/:id`
- `PATCH /api/v1/current-affairs/admin/ingestion-items/:id`
- `POST /api/v1/current-affairs/admin/ingestion-items/:id/publish`
- `GET /api/v1/current-affairs/articles/:id/question-generation-jobs`
- `POST /api/v1/current-affairs/articles/:id/question-generation`

Student forks:

- `POST /api/v1/current-affairs/articles/:id/fork`
- `GET /api/v1/current-affairs/me/forks`
- `GET /api/v1/current-affairs/me/reading-dashboard`
- `GET /api/v1/current-affairs/me/forks/:id`
- `PATCH /api/v1/current-affairs/me/forks/:id`
- `PUT /api/v1/current-affairs/me/forks/:id/progress`
- `DELETE /api/v1/current-affairs/me/forks/:id`
- `GET /api/v1/current-affairs/me/revision-notifications`
- `PATCH /api/v1/current-affairs/me/revision-notifications/:id`
- `POST /api/v1/current-affairs/admin/revision-notifications/generate`

Student highlights and notes:

- `POST /api/v1/current-affairs/me/forks/:id/highlights`
- `PATCH /api/v1/current-affairs/me/highlights/:id`
- `DELETE /api/v1/current-affairs/me/highlights/:id`
- `POST /api/v1/current-affairs/me/forks/:id/notes`
- `PATCH /api/v1/current-affairs/me/notes/:id`
- `DELETE /api/v1/current-affairs/me/notes/:id`

Student-owned articles:

- `GET /api/v1/current-affairs/me/articles`
- `POST /api/v1/current-affairs/me/articles`
- `GET /api/v1/current-affairs/me/articles/:id`
- `PATCH /api/v1/current-affairs/me/articles/:id`
- `DELETE /api/v1/current-affairs/me/articles/:id`

Collections:

- `GET /api/v1/current-affairs/me/collections`
- `GET /api/v1/current-affairs/me/collections/:id`
- `POST /api/v1/current-affairs/me/collections`
- `PATCH /api/v1/current-affairs/me/collections/:id`
- `DELETE /api/v1/current-affairs/me/collections/:id`
- `POST /api/v1/current-affairs/me/collections/:id/items`
- `DELETE /api/v1/current-affairs/me/collection-items/:id`

Search and filters:

- Article lists support content family, content kind, status, category, descendant categories, date window, title/body search, institute tag, source name, and asset presence filters.
- Full-text search supports article/section search with content family, content kind, category, descendant categories, date window, institute tag, and source filters.

## Student Reading Interface Support

Added a backend feature for the student interface:

- Per-article reading progress with current position, furthest position, last section, total reading seconds, and completion time.
- Reading event history for weekly time-spent summaries.
- Automatic read-status update when an article is completed.
- Default seven-day revision scheduling when a completed article does not provide a custom revision time.
- A reading dashboard endpoint that returns continue-reading items, due revisions, unread saved articles, recent recommended articles, and summary stats.
- Revision notifications can be generated from due scheduled revisions and then marked sent/read/dismissed by scoped users.

## Frontend Implementation

- New `apps/web` Next.js App Router frontend for public SEO pages, authenticated student overlays, and authenticated admin operations.
- Public routes: `/current-affairs/daily-news`, `/current-affairs/editorial-summary`, `/current-affairs/mains-topic-notes`, `/current-affairs/prelims-pyq`, `/current-affairs/mains-pyq`, and `/current-affairs/articles/[slug]`.
- Mobile-first list UI uses compact cards, category/month filters for non-PYQ pages, category/year filters for PYQs, sticky mobile filter sheet, desktop sidebar filters, and numbered pagination.
- Student workspace routes: `/current-affairs/workspace` and `/current-affairs/workspace/repositories/[id]`.
- Authenticated workspace UI supports saved/forked article lists, reading dashboard stats, revision queues, repository creation, repository item management, and personal article drafts.
- Article cards include a client-only save action so students can fork articles directly from list pages.
- Article detail pages render public server-side content, metadata, JSON-LD article data, sections/assets/relations, and client-only student save/read actions.
- Admin route: `/current-affairs/admin`.
- Authenticated admin/editor UI supports article filtering, create/edit, publish/archive/delete, section creation/deletion, asset creation/deletion, category creation/activation/deactivation/deletion, raw-text ingestion job creation, ingestion item approval/rejection, and publishing approved ingestion items.
- Frontend-facing API reads provide slug lookup, paginated list totals, and available category/month/year filter values.

## Admin Workflow Support

- Article asset records cover images, thumbnails, PDFs, source files, audio, and other external storage URLs.
- Ingestion jobs support raw text, manual JSON article candidates, and external parser/AI payload review before publishing.
- Approved ingestion items can publish directly into `master_articles`.
- Current affairs articles can generate draft assessment import batches for existing assessment review/publish workflows.
- Admin lifecycle endpoints support article archive/delete and category delete.
- Student lifecycle endpoints support fork, student-article, and collection deletion.
- A focused API integration test suite covers admin article/category creation, student RBAC denial, student fork/progress/dashboard flow, repository item organization, asset creation, and ingestion job creation.

## Backend File Structure

Current affairs backend code is split by responsibility instead of large route/service files:

- `master/`: institute-published article APIs, search/category discovery, relations, and section/source management.
- `workspace/`: student forks, reading progress, highlights/notes, student-owned articles, and collections.
- `schemas/`: shared enums plus category, master-article, and workspace request/response validation schemas.
- Top-level `master-articles.routes.ts`, `master-articles.service.ts`, `workspace.routes.ts`, and `workspace.service.ts` remain thin aggregators for stable imports.

## Security Decisions

- Only admin/editor roles can create or update institute categories and master articles.
- Public article reads only expose published master articles.
- Student fork, note, highlight, personal article, and collection APIs are scoped by authenticated `user_id`.
- Student reading progress, reading events, and dashboard APIs are scoped by authenticated `user_id`.
- Student revision notifications are generated from scoped forks and can only be read or dismissed by the owning user.
- Student forks are overlay records; master article content remains read-only and live-linked.
- Reading progress is stored separately from fork metadata so the UI can support "continue reading", revision queues, and time-spent summaries without mutating the master article.
- Article kinds are constrained to the correct category family.
- Article categories must match the article's `content_family`.
- Mains topic note sections are stored separately so section headings can be indexed and rendered as SEO-searchable H2 blocks.
- Cross-links use generic article relations instead of copying the older app's model directly.

## Remaining Backend Work

The backend foundation for the current affairs module is now implemented. Remaining items are production integrations and hardening rather than missing module surfaces:

- Wire `external_ai` and OCR/parser providers behind the ingestion and question-generation job tables when provider credentials and model choices are finalized.
- Connect `master_article_assets.file_url` to the chosen storage provider upload/signing service.
- Broaden automated API integration tests as future frontend workflows expose more edge cases.
