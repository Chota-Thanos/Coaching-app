import { addUpdate, requireUpdates } from "../../../common/sql.js";
import { one } from "../../../db.js";
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
