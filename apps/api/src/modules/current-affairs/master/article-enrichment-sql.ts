// Shared jsonb_build_object pairs for enriching a `ma` (master_articles) row with
// its sections, relations, appearance count, and concept updates timeline.
// Mirrors the fields exposed on the public article page (frontend-read.service.ts
// getPublishedArticleBySlug) so student workspace views (forks/collections) stay
// live against the same source data instead of a frozen copy.
export const masterArticleEnrichmentJsonbPairs = `
  'sections', coalesce((
    select jsonb_agg(to_jsonb(sec.*) order by sec.display_order, sec.id)
    from current_affairs.master_article_sections sec
    where sec.article_id = ma.id
      and sec.is_active = true
  ), '[]'::jsonb),
  'outgoing_relations', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', rel.id,
        'relation_type', rel.relation_type,
        'label', rel.label,
        'note', rel.note,
        'display_order', rel.display_order,
        'target_article', to_jsonb(target.*)
      )
      order by rel.display_order, rel.id
    )
    from current_affairs.master_article_relations rel
    join current_affairs.master_articles target on target.id = rel.target_article_id
    where rel.source_article_id = ma.id
      and target.status = 'published'
  ), '[]'::jsonb),
  'incoming_relations', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', rel.id,
        'relation_type', rel.relation_type,
        'label', rel.label,
        'note', rel.note,
        'display_order', rel.display_order,
        'source_article', to_jsonb(source.*)
      )
      order by rel.display_order, rel.id
    )
    from current_affairs.master_article_relations rel
    join current_affairs.master_articles source on source.id = rel.source_article_id
    where rel.target_article_id = ma.id
      and source.status = 'published'
  ), '[]'::jsonb),
  'appearance_count', (
    select count(*)::integer
    from current_affairs.master_article_relations rel
    join current_affairs.master_articles source on source.id = rel.source_article_id
    where rel.target_article_id = ma.id
      and source.status = 'published'
  ),
  'updates', coalesce((
    select jsonb_agg(to_jsonb(upd.*) order by upd.created_at desc)
    from current_affairs.master_article_updates upd
    where upd.article_id = ma.id
  ), '[]'::jsonb)
`;
