-- Removes the asset rows that never had an image behind them.
--
-- The posting agent used to record the picture the AI *described* as well as
-- the ones it produced: a row with an empty file_url and
-- metadata.pending_upload = true, carrying the search query for whoever would
-- source the image later. Nobody ever did, and nothing in the codebase ever
-- read that flag -- so the rows were not a queue, they were litter. Worse, an
-- empty file_url renders as <img src="">, which browsers draw as a broken
-- image, so an unfulfilled wish was indistinguishable from a corrupt upload.
--
-- A sweep of all 171 published articles found 10 asset rows, every one of them
-- fileless, and not a single row anywhere with a real file. Deleting them
-- discards no image, because there is no image: only the alt text and the
-- search query describing one that was never made.
--
-- attachImage() in posting-agent-commit.service.ts stopped creating these in
-- ffa03e8, so this is a one-off cleanup of what came before, not a recurring
-- chore.
--
-- Deliberately narrow. It matches only the two properties the agent's own
-- INSERT set together -- a blank file_url AND the pending_upload flag -- so a
-- fileless row from any other source is left alone for a human to look at
-- rather than being swept up by a migration.

do $$
declare
  removed integer;
begin
  with deleted as (
    delete from current_affairs.master_article_assets
    where coalesce(btrim(file_url), '') = ''
      and metadata->>'pending_upload' = 'true'
    returning 1
  )
  select count(*) into removed from deleted;

  raise notice 'Removed % fileless AI image placeholder row(s).', removed;
end
$$;
