-- Lets an article asset say it lives inside the body text.
--
-- Images placed between paragraphs are recorded as asset rows too, so they show
-- up in the admin editor's image list and can be deleted there instead of by
-- hand-editing the body HTML. They cannot reuse asset_type 'image', though:
-- the reading page picks the article's hero from the first 'image'/'thumbnail'
-- row, so an inline diagram filed as 'image' would silently become the article's
-- header picture as well, appearing twice.
--
-- 'inline_image' keeps them out of that selection while still being an image.

alter table current_affairs.master_article_assets
  drop constraint if exists master_article_assets_asset_type_check;

alter table current_affairs.master_article_assets
  add constraint master_article_assets_asset_type_check
  check (asset_type in ('image', 'inline_image', 'thumbnail', 'pdf', 'source_file', 'audio', 'other'));
