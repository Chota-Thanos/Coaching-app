# Deployment Guide

## Live server

- Host: `139.84.171.75`, SSH as `root`.
- App directory on the server: `/var/www/coaching`.
- Process manager: PM2, config at repo root (`ecosystem.config.cjs`) — runs `coaching-api` (port 4000) and `coaching-web` (`next start`, port 3000).
- Database: Supabase (aws-1 pooler, ap-south-1). Migrations run via `npm run db:migrate` against `DATABASE_URL`.
- Credentials (SSH password, `DATABASE_URL`, `JWT_SECRET`) live in `scratch/deploy_app.js` at the repo root. That folder is gitignored and has never been committed — do not move these values into a tracked file.

## Connecting via SSH

Windows machines that already have an SSH key set up (for example a GitHub key at `~/.ssh/id_ed25519`) will get prompted for that key's **passphrase** instead of the server's password, because SSH tries public-key authentication first and stops to unlock the local key before ever asking the server for a password. A passphrase and a password are two different secrets — typing the server's root password into a "passphrase" prompt will never work.

Force password authentication explicitly so it skips the local key:

```bash
ssh -o PubkeyAuthentication=no -o PreferredAuthentications=password root@139.84.171.75
```

That should prompt `root@139.84.171.75's password:` — that's where the server's root password goes.

## Deploying

Once connected:

```bash
cd /var/www/coaching
bash deploy.sh
```

`deploy.sh` runs, in order:

1. `git pull origin main`
2. `npm install`
3. `npm run db:migrate`
4. `npm run build` (builds both `apps/api` and `apps/web`)
5. `pm2 restart ecosystem.config.cjs --env production` (or `pm2 start` if the processes aren't already running)
6. `pm2 save`

If any step fails, the script exits immediately (`set -e`) rather than continuing partway through a broken deploy.

## Deployment Log

Record every deployment here — date, commit(s) shipped, a one-line summary, who/what ran it, and the outcome. Add a new row per deployment; don't edit past rows except to fix a factual error.

| Date | Commit(s) | Summary | Run by | Outcome |
|------|-----------|---------|--------|---------|
| 2026-07-18 | `3467564` | Web Study Plans typography fix + roadmap/curriculum redesign to match the mobile app | User, manual SSH (`deploy.sh`) | SSH access resolved (passphrase/password mixup); `deploy.sh` completion not explicitly confirmed back to assistant -- verify `pm2 status` and the live site on next login |
| 2026-07-18 | `83b27c1` | Added this deployment runbook/log and the SSH connection gotcha fix to `deploy.sh` | Not yet deployed | _not yet deployed -- commit not pushed to origin (blocked by harness classifier, see below)_ |
| 2026-07-19 | `29e1c7e`, `dff23b6` | Mentorship module: vertical phase-based lifecycle tracker (web + mobile), admin Live Engagements oversight, Razorpay order-create/verify integration, shared chat/agenda/side-panel components | Pushed to origin by assistant; live SSH deploy left to user (harness blocks direct prod SSH, see below) | _pushed to origin -- run `deploy.sh` on the server to actually ship it_ |
| 2026-07-20 | `e11643e` | Current affairs: fixed broken article import/export/link tooling (web + mobile), added concept-article reuse system (article_role, updates timeline, appearance tracking), consolidated the two admin connection UIs into one. Includes migration `046_current_affairs_concept_articles.sql`. | Pushed to origin by assistant; live SSH deploy left to user (harness blocks direct prod SSH, see below) | _pushed to origin -- run `deploy.sh` on the server to actually ship it; `deploy.sh` will apply migration 046 against the Supabase prod DB via `npm run db:migrate`_ |
| 2026-07-20 | Coaching-app `a86c9d2`, Current-Affairs-Mobile `7be1b8a` | Current affairs: live concepts/relations/updates in saved notes, anchor-based highlight/note UI with watermarked PDF export (single + "download all"), new GS Paper category tier for mains (migration `047_current_affairs_gs_paper_level.sql`), cascading GS Paper/Subject/Topic/Subtopic category filters above the content-type tabs. Mirrored on mobile (current_affairs_pro), plus a fix for a pre-existing bug where the Mains tab loaded Prelims content on first open. | Pushed to origin by assistant (both repos); live SSH deploy left to user (harness blocks direct prod SSH, see below) | _pushed to origin -- run `deploy.sh` on the server to ship the web/API side; `deploy.sh` will apply migration 047 against the Supabase prod DB via `npm run db:migrate`. Mobile repo push has no server-side deploy step here -- it's a separate Flutter app build/release process, not part of this VPS._ |
| 2026-07-21 | `4fb8f0e` | Razorpay payment webhook (`POST /api/v1/billing/razorpay/webhook`, idempotent reconciliation of billing/study-plan/mentorship payments, HMAC-verified) + admin direct-promote-to-mentor endpoint & web UI + mentor-profile upsert. No new DB migration. Also activates Google Sign-In (backend/web already coded) — needs env vars set on the server. | Pushed to origin by assistant; live SSH deploy left to user (harness blocks direct prod SSH) | _pushed to origin -- before `deploy.sh`, add to `/var/www/coaching/.env`: `GOOGLE_CLIENT_ID_WEB`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `apps/web/.env`; then run `bash deploy.sh`. No migration this time._ |

| 2026-07-21 | `04ecda4`, `629c521` | **Security:** the three payment verify endpoints derived `isSimulated` from the client-supplied `razorpay_order_id`, so anyone could POST `sim_order_x` to skip HMAC verification and grant themselves a paid subscription / study plan / mentorship for free — even with real keys set. Simulated orders are now only honoured when the server genuinely has no Razorpay keys. **Auth:** Google client ID now falls back in code (it's public and ships in the browser bundle anyway) since `apps/web/.env` is gitignored and could never arrive via `git push`; backend Google token *audience* validation, previously skipped when unconfigured, is now always enforced. | Pushed to origin by assistant; live SSH deploy left to user | _pushed to origin -- `bash deploy.sh` ships all of it. Google Sign-In now needs NO server env editing. Still required in `/var/www/coaching/.env`: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — until those are set the server stays in simulated mode, where self-granting is inherent by design, so the security fix only takes effect once real keys exist. No migration._ |

| 2026-08-13 | `22539fb`, `fcd47a9`, `16dad94`, `0d5930d` | Removed a leftover subscription paywall on the Current Affairs Mains hub listing (Editorial Summaries/Mains Notes/Mains PYQ were blocked for everyone without a paid plan, no login option). Fixed the dashboard's Daily Feed widget showing empty (its fetch call was missing a required `content_kind` param, silently failing). Mains Note "pointers" (Evolution/Issues/Recommendations items etc.) now render as a short always-visible label with the fuller explanation hidden behind a magnifying-glass toggle (`<details>`/`<summary>`), instead of one flat bulleted sentence — covers both the Cowork-skill-driven creation path (`ca_parse`) and the separate in-app "AI Ingestion & Generation Workspace". Reword AI (the article editor's AI rewrite tool) no longer leaks a raw JSON envelope into reworded text, and can now apply several modes together (e.g. Simplify + Fix grammar) in one pass instead of one at a time. | Pushed to origin by assistant; live SSH deploy left to user | _pushed to origin -- `bash deploy.sh` ships all of it. No new DB migration. The already-published "Mecca Pact" mains note (id 120) was created against the pre-deploy server and still has the old flat-bullet pointer format — it is NOT retroactively fixed by this deploy; only pointers added after the deploy get the new format. Separately, the `waytoias-ca-mains-notes` Cowork skill also needs re-uploading (a `.skill` file was sent to the user) for the hand-authored pointer-linking workflow to pick up the new format — deploying the server alone does not update that._ |
| 2026-08-29 | `d2d2928`, `7ce90bd`, `0202aa2`, `d407e7e`, `1bd499c`, `15693d4`, `4a7ffc3`, `8c07c70` (branch `feat/performance-and-study-plans`) | **Performance page** rebuilt around one weakness surface (the same weak-topic list was rendered three times); lands on `/assessment/dashboard` and the Performance tab of the GK/CSAT/Mains hubs at once, since they share the component. **Study plans** given real types (`full_course` / `self_prep` / `test_series`), subscription-aware access, learner-chosen start dates with a pace/depth tracker, three type-specific workspaces, per-day resources with PDF/video handling, and admin authoring for all of it. **Current affairs**: articles moved to a reading serif; the pointer-detail marker fixed (inline chip at the end of the point, document icon in blue-800, content visible while authoring). Includes migrations `055_study_plan_types_and_tracking.sql` and `056_study_plan_watch_position.sql`. | Pushed to origin by assistant; live SSH deploy left to user (harness blocks direct prod SSH, see below) | _pushed to origin on a branch — merge to `main` or check the branch out on the server, then `bash deploy.sh`, which applies both migrations via `npm run db:migrate`. **Note:** the Flutter app (`upsc_test_series/`) is gitignored, so its share of this work — plan types, health card, schedule sheet, and a new day screen with video playback — is NOT in this push and exists only on the author's machine; it also newly depends on `video_player`. The three study-plan workspaces, the video player and inline PDF rendering are verified by typecheck/build/DB round-trips but have not been exercised in a browser with real media or a real enrolment — worth checking on the live site first._ |

**Note on "blocked by harness classifier":** the assistant's tool-use environment refuses to run an actual SSH deploy against this production server on its own — it's an irreversible action against shared infrastructure using hardcoded root credentials, so it always hands the commands back to a human instead of executing them, even after explicit confirmation. Run the `ssh` + `deploy.sh` commands above yourself to complete a deploy; the assistant will push commits and update this log, but won't SSH in and restart PM2 unattended.
