"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useAuth, authenticatedGet, authenticatedPost, authenticatedPut } from "../auth/auth-context";

/**
 * The mentor writes what the student takes away.
 *
 * Kept as a draft until the mentor presses Share, because these get written in
 * the ten minutes after a call while the mentor is still thinking — a student
 * refreshing the page mid-sentence should not see half a thought. Publishing is
 * one-way on the server: once shared, the student's record cannot be withdrawn.
 */

type Resource = { label: string; url?: string | null };

type WrapUp = {
  note: { covered: string | null; guidance: string | null; resources: Resource[]; published_at: string | null } | null;
  note_is_draft: boolean;
  action_items: { id: number; title: string; completed_at: string | null }[];
  can_write_note: boolean;
};

export function SessionWrapUpEditor({ sessionId }: { sessionId: number }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [covered, setCovered] = useState("");
  const [guidance, setGuidance] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [published, setPublished] = useState(false);
  const [items, setItems] = useState<WrapUp["action_items"]>([]);
  const [newTask, setNewTask] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await authenticatedGet<WrapUp>(`/api/v1/mentorship/sessions/${sessionId}/wrap-up`, token);
      setAllowed(data.can_write_note);
      setCovered(data.note?.covered ?? "");
      setGuidance(data.note?.guidance ?? "");
      setResources(data.note?.resources ?? []);
      setPublished(Boolean(data.note?.published_at));
      setItems(data.action_items);
    } catch {
      setStatus("Could not load this session.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(publish: boolean): Promise<void> {
    if (!token) return;
    setBusy(true);
    setStatus(null);
    try {
      await authenticatedPut(`/api/v1/mentorship/sessions/${sessionId}/note`, token, {
        covered: covered.trim() || null,
        guidance: guidance.trim() || null,
        // Blank rows are how a mentor abandons a half-typed resource; they
        // should not reach the student as empty bullets.
        resources: resources.filter((resource) => resource.label.trim().length > 0),
        publish
      });
      setStatus(publish ? "Shared with your student." : "Draft saved.");
      await load();
    } catch {
      setStatus("Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function addTask(): Promise<void> {
    const title = newTask.trim();
    if (!token || !title) return;
    try {
      await authenticatedPost(`/api/v1/mentorship/sessions/${sessionId}/action-items`, token, { title });
      setNewTask("");
      await load();
    } catch {
      setStatus("Could not add that action point.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-xs font-bold text-slate-500">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950">Session wrap-up</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
            published ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {published ? "Shared" : "Draft"}
        </span>
      </div>

      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">What we covered</span>
        <textarea
          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm leading-6 text-slate-700 outline-none focus:border-indigo-400"
          onChange={(event) => setCovered(event.target.value)}
          placeholder="The three or four things this student should remember from today."
          rows={4}
          value={covered}
        />
      </label>

      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Guidance</span>
        <textarea
          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm leading-6 text-slate-700 outline-none focus:border-indigo-400"
          onChange={(event) => setGuidance(event.target.value)}
          placeholder="Longer-horizon advice that is not a task — how to approach the next two months."
          rows={3}
          value={guidance}
        />
      </label>

      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recommended reading</span>
        <div className="mt-1.5 space-y-2">
          {resources.map((resource, index) => (
            <div className="flex items-center gap-2" key={index}>
              <input
                className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
                onChange={(event) =>
                  setResources((current) =>
                    current.map((row, rowIndex) => (rowIndex === index ? { ...row, label: event.target.value } : row))
                  )
                }
                placeholder="Laxmikanth, chapter 12"
                value={resource.label}
              />
              <input
                className="h-9 w-48 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
                onChange={(event) =>
                  setResources((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, url: event.target.value || null } : row
                    )
                  )
                }
                placeholder="Link (optional)"
                value={resource.url ?? ""}
              />
              <button
                aria-label="Remove this recommendation"
                className="text-slate-300 hover:text-rose-500"
                onClick={() => setResources((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600"
            onClick={() => setResources((current) => [...current, { label: "", url: null }])}
            type="button"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Add a recommendation
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Action points for the student
        </span>
        <ul className="mt-1.5 space-y-1">
          {items.map((item) => (
            <li className="text-sm font-semibold text-slate-700" key={item.id}>
              • {item.title}
              {item.completed_at && <span className="ml-2 text-[10px] font-black uppercase text-emerald-600">Done</span>}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center gap-2">
          <input
            className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
            onChange={(event) => setNewTask(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void addTask();
            }}
            placeholder="Write 5 answers on federalism by Sunday"
            value={newTask}
          />
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-bold text-indigo-700 disabled:opacity-50"
            disabled={newTask.trim().length === 0}
            onClick={() => void addTask()}
            type="button"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        <p className="mt-1.5 text-[10px] font-semibold text-slate-400">
          Action points are visible to the student straight away — they are not held back with the draft.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50"
          disabled={busy}
          onClick={() => void save(false)}
          type="button"
        >
          Save draft
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
          disabled={busy || published}
          onClick={() => void save(true)}
          type="button"
        >
          {busy ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Send aria-hidden="true" className="h-3.5 w-3.5" />}
          {published ? "Already shared" : "Share with student"}
        </button>
        {status && <span className="text-xs font-bold text-slate-500">{status}</span>}
      </div>
    </div>
  );
}
