# Coaching App

Node-first coaching platform workspace with the API, database migrations, mobile-first assessment frontend, and current affairs frontend.

## Current Scope

The current implementation focuses on the assessment module database and backend foundation.

Implemented:

- PostgreSQL migration runner
- Assessment objective question schema
- Assessment test, attempt, response, and result schema
- Identity/RBAC with JWT auth
- Billing plans, subscriptions, and assessment entitlement checks
- Mains taxonomy, questions, answer submissions, and evaluator scoring
- Test series
- Bookmarks, error logs, topic metrics, dashboard analytics, rank/percentile, cutoff, and leaderboard
- Question import batch review workflow
- Fastify API scaffold
- Assessment admin/content APIs for exams, levels, taxonomy, question natures, question formats, passages, and questions
- Assessment test APIs for templates, sections, question items, attempts, autosave responses, and server-side submit/scoring
- Result detail API with topic breakdowns for review screens
- Admin import review and publish workflow for moving normalized items into the question bank
- Split assessment backend structure with separate route, service, scoring helper, and schema modules
- Admin CRUD/status APIs for assessment content, users, billing plans, prices, entitlements, and subscriptions
- Current affairs backend foundation with institute articles, student forks, highlights, notes, personal articles, and collections
- Current affairs category pages, article relations, SEO-searchable note sections, and section source imports
- Mobile-first assessment frontend with public test discovery, test series, guided test detail pages, authenticated attempt flow, result review, and student dashboard
- Mobile-first SEO current affairs frontend with public article lists, filters, article detail pages, student reading actions, student workspace repositories, and admin content operations

## Local Setup

1. Copy environment values:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Start dependencies:

   ```powershell
   docker compose up -d postgres redis
   ```

3. Install packages:

   ```powershell
   npm install
   ```

4. Run migrations:

   ```powershell
   npm run db:migrate
   ```

5. Start the API:

   ```powershell
   npm run dev:api
   ```

Default API URL: `http://localhost:4000`

6. Start the web frontend:

   ```powershell
   npm run dev:web
   ```

Default web URL: `http://localhost:3000`

Assessment frontend routes:

- `/assessment`
- `/assessment/tests`
- `/assessment/tests/[id]`
- `/assessment/test-series`
- `/assessment/test-series/[id]`
- `/assessment/attempts/[attemptId]`
- `/assessment/results/[resultId]`
- `/assessment/dashboard`

Current affairs frontend routes:

- `/current-affairs/daily-news`
- `/current-affairs/editorial-summary`
- `/current-affairs/mains-topic-notes`
- `/current-affairs/prelims-pyq`
- `/current-affairs/mains-pyq`
- `/current-affairs/articles/[slug]`
- `/current-affairs/workspace`
- `/current-affairs/workspace/repositories/[id]`
- `/current-affairs/admin`

## Main Files

- `database/migrations`
- `docs/assessment-module-tracking.md`
- `docs/current-affairs-module-tracking.md`
- `apps/api/src/modules/assessment`
- `apps/web/src/app/assessment`
- `apps/api/src/modules/current-affairs`
- `apps/web/src/app/current-affairs`
- `apps/api/src/modules/auth`
- `apps/api/src/modules/billing`
