"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, Link2, Loader2, NotebookPen, Plus, Star, Trash2 } from "lucide-react";
import {
  useAuth,
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete
} from "../auth/auth-context";

/**
 * What the student keeps after the call ends.
 *
 * A finished session previously left nothing behind: the video room closed and
 * the desk went quiet, so a student who had just paid for forty-five minutes of
 * an officer's time had no record of what they were told. This is that record —
 * the mentor's wrap-up, the action points the student works through over the
 * following weeks, and the rating that lets the next student choose better.
 */

type Resource = { label: string; url?: string | null };

type SessionNote = {
  id: number;
  covered: string | null;
  guidance: string | null;
  resources: Resource[];
  published_at: string | null;
};

type ActionItem = {
  id: number;
  title: string;
  detail: string | null;
  due_on: string | null;
  completed_at: string | null;
  created_by_user_id: number | null;
};

type Rating = { rating: number; comment: string | null; is_public: boolean };

type WrapUp = {
  note: SessionNote | null;
  note_is_draft: boolean;
  action_items: ActionItem[];
  rating: Rating | null;
  can_write_note: boolean;
  can_rate: boolean;
};

function formatDue(due: string | null): string | null {
  if (!due) return null;
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${due}T00:00:00`));
  } catch {
    return due;
  }
}

export function SessionWrapUp({ sessionId }: { sessionId: number }) {
  const { token } = useAuth();
  const [data, setData] = useState<WrapUp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setData(await authenticatedGet<WrapUp>(`/api/v1/mentorship/sessions/${sessionId}/wrap-up`, token));
      setError(null);
    } catch {
      setError("Could not load this session's notes.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addItem(): Promise<void> {
    const title = newTitle.trim();
    if (!token || !title) return;
    setBusy(true);
    try {
      await authenticatedPost(`/api/v1/mentorship/sessions/${sessionId}/action-items`, token, { title });
      setNewTitle("");
      await load();
    } catch {
      setError("Could not add that action point.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleItem(item: ActionItem): Promise<void> {
    if (!token) return;
    // Flip it locally first — ticking a checkbox should not wait on a round
    // trip, and `load()` reconciles a moment later.
    setData((current) =>
      current
        ? {
            ...current,
            action_items: current.action_items.map((row) =>
              row.id === item.id
                ? { ...row, completed_at: item.completed_at ? null : new Date().toISOString() }
                : row
            )
          }
        : current
    );
    try {
      await authenticatedPut(`/api/v1/mentorship/action-items/${item.id}`, token, {
        done: !item.completed_at
      });
    } finally {
      await load();
    }
  }

  async function removeItem(itemId: number): Promise<void> {
    if (!token) return;
    try {
      await authenticatedDelete(`/api/v1/mentorship/action-items/${itemId}`, token);
      await load();
    } catch {
      setError("Could not remove that action point.");
    }
  }

  async function rate(value: number): Promise<void> {
    if (!token) return;
    try {
      await authenticatedPut(`/api/v1/mentorship/sessions/${sessionId}/rating`, token, {
        rating: value,
        comment: data?.rating?.comment ?? null
      });
      await load();
    } catch {
      setError("Could not save your rating. A session can be rated once it has finished.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-[32px] border border-slate-200 bg-surface p-6 text-xs font-bold text-slate-500">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading session notes...
      </div>
    );
  }

  if (!data) return null;

  const done = data.action_items.filter((item) => item.completed_at).length;

  return (
    <div className="space-y-6 rounded-[32px] border border-slate-200 bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <NotebookPen aria-hidden="true" className="h-4 w-4 text-indigo-600" />
        <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950">After the session</h3>
        {data.note_is_draft && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800">
            Draft — not shared yet
          </span>
        )}
      </div>

      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

      {/* The mentor's wrap-up */}
      {data.note ? (
        <div className="space-y-4">
          {data.note.covered && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">What we covered</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">{data.note.covered}</p>
            </div>
          )}
          {data.note.guidance && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Guidance</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">{data.note.guidance}</p>
            </div>
          )}
          {data.note.resources.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recommended</p>
              <ul className="mt-1.5 space-y-1.5">
                {data.note.resources.map((resource, index) => (
                  <li className="flex items-start gap-2 text-sm text-slate-700" key={index}>
                    <Link2 aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    {resource.url ? (
                      <a
                        className="font-bold text-indigo-600 hover:underline"
                        href={resource.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {resource.label}
                      </a>
                    ) : (
                      <span className="font-medium">{resource.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs font-semibold text-slate-500">
          {data.can_write_note
            ? "You have not written a wrap-up for this session yet."
            : "Your mentor has not shared a wrap-up for this session yet."}
        </p>
      )}

      {/* Action points */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Action points {data.action_items.length > 0 && `— ${done} of ${data.action_items.length} done`}
          </p>
        </div>

        <ul className="mt-2 space-y-1.5">
          {data.action_items.map((item) => {
            const isDone = Boolean(item.completed_at);
            const due = formatDue(item.due_on);
            return (
              <li className="group flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5" key={item.id}>
                <button
                  aria-label={isDone ? `Mark "${item.title}" as not done` : `Mark "${item.title}" as done`}
                  className="mt-0.5 shrink-0 text-indigo-600"
                  onClick={() => void toggleItem(item)}
                  type="button"
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4 text-slate-300" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold ${isDone ? "text-slate-400 line-through" : "text-slate-800"}`}>
                    {item.title}
                  </p>
                  {item.detail && <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>}
                  {due && <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">By {due}</p>}
                </div>
                <button
                  aria-label={`Remove "${item.title}"`}
                  className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
                  onClick={() => void removeItem(item.id)}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-2 flex items-center gap-2">
          <input
            className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void addItem();
            }}
            placeholder="Add something you need to do"
            value={newTitle}
          />
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-xs font-bold text-white disabled:opacity-50"
            disabled={busy || newTitle.trim().length === 0}
            onClick={() => void addItem()}
            type="button"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Rating */}
      {data.can_rate && (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {data.rating ? "Your rating" : "How was this session?"}
          </p>
          <div className="mt-1.5 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => {
              const filled = (data.rating?.rating ?? 0) >= value;
              return (
                <button
                  aria-label={`Rate ${value} out of 5`}
                  className="text-amber-400 transition hover:scale-110"
                  key={value}
                  onClick={() => void rate(value)}
                  type="button"
                >
                  <Star className={`h-5 w-5 ${filled ? "fill-amber-400" : "text-slate-300"}`} />
                </button>
              );
            })}
            {data.rating && <span className="ml-2 text-xs font-bold text-slate-500">Thanks — you can change this any time.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
