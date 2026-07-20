# Current Affairs Module Tracking Plan

Last updated: 2026-07-20

## Current Scope

Backend foundation and mobile-first SEO frontend for institute-published current affairs content and student personal workspaces.

## Recent Changes (2026-07-20)

Web (`Coaching-app` `a86c9d2`, `3ea46c7`) and mobile (`Current-Affairs-Mobile` `7be1b8a`), both pushed to origin; server deploy left to the user per the SSH-blocked convention (see `docs/deployment.md`).

**Live concepts/relations/updates in saved notes** — a student's saved fork previously froze the master article's relations/updates as of save time. `forks.service.ts` (`listForks`, `getFork`) and `collections.service.ts` (`getCollection`) now merge each `master_article` with the same `sections`/`outgoing_relations`/`incoming_relations`/`appearance_count`/`updates` subqueries that already power the public article page, via a shared SQL fragment (`master/article-enrichment-sql.ts`). So if an admin adds a concept update or a new relation after a student has saved an article, the student's saved copy reflects it automatically instead of going stale.

**Anchor-based highlight/note UI** — the `student_article_highlights`/`student_article_notes` tables and CRUD endpoints existed with no frontend; built out this session:
- Web: `lib/text-anchor.ts` (quote + prefix/suffix + offset anchoring over DOM Ranges, tolerant of minor body edits), `components/current-affairs/workspace/article-annotator.tsx` (select text → floating toolbar → highlight color or note; click an existing mark to edit/delete), a dedicated reading page at `/current-affairs/workspace/articles/[forkId]`.
- Mobile: `core/utils/text_anchor.dart` (offset-based, simpler than DOM since Flutter's `SelectableText.rich` selection is already offset-native), `presentation/fork_reader_screen.dart`, `presentation/widgets/source_article_connections.dart`.
- Deliberate platform difference: mobile renders the annotatable body as plain text (markdown syntax stripped) since Flutter has no rich+selectable+annotatable widget equivalent to a DOM.

**PDF export** — `lib/export-pdf.ts` (web) rasterizes saved notes into image-based PDF pages (not selectable text, so they can't be copy-pasted out) with a canvas-drawn diagonal watermark ("Personal copy - {email}"); a "Download all notes" button bundles every saved article + own article across all repositories into one file. Mobile (`core/utils/export_pdf.dart`, `pdf`/`printing` packages) produces a standard native-text PDF instead — rasterizing to images isn't idiomatic there and native PDFs are normal practice for Flutter apps — still carrying the same watermark on every page.

**GS Paper category tier (mains)** — migration `047_current_affairs_gs_paper_level.sql` adds `gs_paper` to `category_nodes.node_type`, seeds GS Paper I–IV as new root nodes for `content_family = mains`, and reparents the 12 existing mains subjects underneath them per the standard UPSC syllabus split (GS-I: History/Geography/Society; GS-II: Governance/Social Issues/International Relations; GS-III: Indian Economy/Environment/Internal Security/Disaster Management/Science & Tech; GS-IV: Ethics). Prelims categories are untouched — Prelims has no GS Paper tier. Threaded through:
- Admin category manager (create/edit/bulk-create/bulk-reassign) — `nodeTypeForParent` is now content-family-aware.
- Admin article create/edit category selector (`cascading-category-selector.tsx`) — new leading GS Paper select for mains, gates which subjects show.
- Public category filters and student bulk-import modal (web + mobile) — same cascading pattern.

**Category filter redesign** — went through two iterations before landing on the final shape:
1. First attempt built a separate "browse by category" flow (new picker screen → detail screen → view-all screen, replacing the existing tabs entirely). The user flagged this as over-executed — it changed page structure that should have stayed a single page, and dropped Topic/Subtopic-level filtering in the process.
2. Reverted the separate-screens approach on both platforms. Final design: the *existing* single hub page (web: `/current-affairs/[hub]`; mobile: `DailyNewsFeedScreen`) gets the category filter repositioned *above* the content-type tabs instead of below, and the filter itself became a proper cascade — GS Paper (mains only) → Subject → Topic (only rendered if the subject has topics) → Subtopic (only if the topic has subtopics). Picking any level is a complete, valid filter on its own; picking a subject does not require picking a GS Paper first (it's optional narrowing, not a gate) — verified identical behavior on both platforms, including correct ancestor backfill when reloading a URL that already has a deep category selected.

**Mobile-only fixes**:
- Fixed a pre-existing bug where the Mains bottom-nav tab loaded Prelims Daily News content on first open, because `initState` never called the function that derives the active hub from the selected tab (only fixed once a sub-tab was manually tapped).
- Replaced the home page's hardcoded subject list (`["Polity", "Economy", ...]` with fake ids) with real category data, fixed a stale hardcoded date and fake "2h ago" timestamps, and removed the fully-fabricated "Daily Quiz #242" / "Quick Facts" / "GS Paper Progress" widgets rather than leaving invented numbers in place — there's no real quiz-attempt or syllabus-coverage tracking behind them.

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
- `current_affairs.master_article_updates` — dated updates timeline for concept articles
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
