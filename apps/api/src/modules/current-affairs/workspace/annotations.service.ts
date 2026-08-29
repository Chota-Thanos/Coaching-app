import { addUpdate, requireUpdates } from "../../../common/sql.js";
import { one, query as query_ } from "../../../db.js";
import type {
  CreateHighlightInput,
  CreateNoteInput,
  UpdateHighlightInput,
  UpdateNoteInput
} from "../schemas.js";

export async function createHighlight(
  forkId: number,
  input: CreateHighlightInput,
  userId: number
): Promise<unknown | null> {
  return one(
    `
      insert into current_affairs.student_article_highlights (fork_id, anchor_json, color, note)
      select saf.id, $3, $4, $5
      from current_affairs.student_article_forks saf
      where saf.id = $1
        and saf.user_id = $2
      returning *
    `,
    [forkId, userId, JSON.stringify(input.anchor_json), input.color, input.note ?? null]
  );
}

export async function updateHighlight(id: number, input: UpdateHighlightInput, userId: number): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "anchor_json", input.anchor_json === undefined ? undefined : JSON.stringify(input.anchor_json));
  addUpdate(updates, params, "color", input.color);
  addUpdate(updates, params, "note", input.note);
  requireUpdates(updates);

  params.push(id, userId);
  return one(
    `
      update current_affairs.student_article_highlights sah
      set ${updates.join(", ")}, updated_at = now()
      from current_affairs.student_article_forks saf
      where sah.id = $${params.length - 1}
        and sah.fork_id = saf.id
        and saf.user_id = $${params.length}
      returning sah.*
    `,
    params
  );
}

export async function deleteHighlight(id: number, userId: number): Promise<unknown | null> {
  return one(
    `
      delete from current_affairs.student_article_highlights sah
      using current_affairs.student_article_forks saf
      where sah.id = $1
        and sah.fork_id = saf.id
        and saf.user_id = $2
      returning sah.*
    `,
    [id, userId]
  );
}

export async function createNote(forkId: number, input: CreateNoteInput, userId: number): Promise<unknown | null> {
  return one(
    `
      insert into current_affairs.student_article_notes (fork_id, anchor_json, note)
      select saf.id, $3, $4
      from current_affairs.student_article_forks saf
      where saf.id = $1
        and saf.user_id = $2
      returning *
    `,
    [forkId, userId, JSON.stringify(input.anchor_json), input.note]
  );
}

export async function updateNote(id: number, input: UpdateNoteInput, userId: number): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "anchor_json", input.anchor_json === undefined ? undefined : JSON.stringify(input.anchor_json));
  addUpdate(updates, params, "note", input.note);
  requireUpdates(updates);

  params.push(id, userId);
  return one(
    `
      update current_affairs.student_article_notes san
      set ${updates.join(", ")}, updated_at = now()
      from current_affairs.student_article_forks saf
      where san.id = $${params.length - 1}
        and san.fork_id = saf.id
        and saf.user_id = $${params.length}
      returning san.*
    `,
    params
  );
}

export async function deleteNote(id: number, userId: number): Promise<unknown | null> {
  return one(
    `
      delete from current_affairs.student_article_notes san
      using current_affairs.student_article_forks saf
      where san.id = $1
        and san.fork_id = saf.id
        and saf.user_id = $2
      returning san.*
    `,
    [id, userId]
  );
}

export type ListAnnotationsQuery = {
  collection_id?: number;
  color?: string;
  tag?: string;
  /** "highlight" | "note" — omit for both. */
  kind?: string;
  /** Only highlights that carry the learner's own margin note. */
  with_note?: boolean;
  search?: string;
  limit: number;
  offset: number;
};

export type AnnotationRow = {
  id: number;
  kind: "highlight" | "note";
  fork_id: number;
  master_article_id: number;
  article_title: string;
  color: string | null;
  quote: string | null;
  note: string | null;
  personal_tags: string[];
  collection_id: number | null;
  collection_name: string | null;
  created_at: string;
};

/**
 * Every highlight and margin note the learner has made, across every article.
 *
 * Both tables were readable only through a single fork's detail response, so
 * reviewing a term's worth of highlighting meant reopening each article one at
 * a time — which is the opposite of what highlighting is for. The quote is
 * pulled out of anchor_json rather than stored twice; the annotator writes the
 * selected text there when it computes the anchor.
 */
export async function listAnnotations(
  userId: number,
  query: ListAnnotationsQuery
): Promise<AnnotationRow[]> {
  const params: unknown[] = [userId];
  const where: string[] = [];

  if (query.collection_id) {
    params.push(query.collection_id);
    where.push(`sci.collection_id = $${params.length}`);
  }
  if (query.color) {
    params.push(query.color);
    where.push(`a.color = $${params.length}`);
  }
  if (query.tag) {
    params.push(JSON.stringify([query.tag]));
    where.push(`saf.personal_tags @> $${params.length}::jsonb`);
  }
  if (query.kind === "highlight" || query.kind === "note") {
    params.push(query.kind);
    where.push(`a.kind = $${params.length}`);
  }
  if (query.with_note) {
    where.push(`nullif(btrim(coalesce(a.note, '')), '') is not null`);
  }
  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(
      `(a.quote ilike $${params.length} or a.note ilike $${params.length} or ma.title ilike $${params.length})`
    );
  }

  params.push(query.limit, query.offset);
  const limitPos = params.length - 1;
  const offsetPos = params.length;

  return query_(
    `
      with annotations as (
        select
          h.id,
          'highlight'::text as kind,
          h.fork_id,
          h.color,
          h.anchor_json ->> 'quote' as quote,
          h.note,
          h.created_at
        from current_affairs.student_article_highlights h

        union all

        select
          n.id,
          'note'::text as kind,
          n.fork_id,
          null::text as color,
          n.anchor_json ->> 'quote' as quote,
          n.note,
          n.created_at
        from current_affairs.student_article_notes n
      )
      select
        a.id,
        a.kind,
        a.fork_id,
        saf.master_article_id,
        ma.title as article_title,
        a.color,
        a.quote,
        a.note,
        coalesce(saf.personal_tags, '[]'::jsonb) as personal_tags,
        sci.collection_id,
        sc.name as collection_name,
        a.created_at
      from annotations a
      join current_affairs.student_article_forks saf on saf.id = a.fork_id
      join current_affairs.master_articles ma on ma.id = saf.master_article_id
      left join current_affairs.student_collection_items sci on sci.fork_id = saf.id
      left join current_affairs.student_collections sc on sc.id = sci.collection_id
      where saf.user_id = $1
        ${where.length ? `and ${where.join(" and ")}` : ""}
      order by a.created_at desc, a.id desc
      limit $${limitPos} offset $${offsetPos}
    `,
    params
  ) as Promise<AnnotationRow[]>;
}

/** Counts per colour and per repository, for the review screen's filter chips. */
export async function annotationFacets(userId: number): Promise<unknown> {
  const byColor = await query_(
    `
      select h.color, count(*)::int as count
      from current_affairs.student_article_highlights h
      join current_affairs.student_article_forks saf on saf.id = h.fork_id
      where saf.user_id = $1
      group by h.color
      order by count desc
    `,
    [userId]
  );
  const totals = await one<{ highlights: number; notes: number }>(
    `
      select
        (select count(*)::int from current_affairs.student_article_highlights h
           join current_affairs.student_article_forks f on f.id = h.fork_id where f.user_id = $1) as highlights,
        (select count(*)::int from current_affairs.student_article_notes n
           join current_affairs.student_article_forks f on f.id = n.fork_id where f.user_id = $1) as notes
    `,
    [userId]
  );
  return { by_color: byColor, totals: totals ?? { highlights: 0, notes: 0 } };
}
