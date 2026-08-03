-- Retires the manual concept-updates timeline (migration 046) in favor of the
-- relation-based timeline: a concept's news history is now derived from
-- current_affairs.master_article_relations (which event articles link here,
-- with a `note` per link) rather than hand-typed, undated entries.
--
-- The old table had three real limits the relation-based timeline does not:
-- entries were dated by when someone typed them (created_at, no way to
-- back-date to when a development actually happened), had no link to the news
-- article that caused them, and had to be remembered and typed by hand rather
-- than being created automatically when a news article is linked.
--
-- HOLD BEFORE RUNNING AGAINST PRODUCTION: this is a destructive drop. Check
-- `select count(*) from current_affairs.master_article_updates` against the
-- production database first — the local dev database had 0 rows at the time
-- this migration was written, which does not prove production is also empty.
-- If production has rows, decide with the team whether to migrate them into
-- relation notes before this runs; do not run it unattended.
-- Date: 2026-08-03

drop table if exists current_affairs.master_article_updates;
