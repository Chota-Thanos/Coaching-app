insert into assessment.exam_levels (exam_id, name, slug, display_order)
values
  (1, 'Prelims', 'prelims', 1),
  (1, 'CSAT', 'csat', 2),
  (1, 'Mains', 'mains', 3)
on conflict (exam_id, slug) do nothing;
