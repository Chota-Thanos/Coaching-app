"use client";

import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { authenticatedGet, authenticatedPost, useAuth } from "../auth/auth-context";
import { browserBaseUrl } from "../../lib/api";
import type { StudyPlanItemResource } from "../../lib/study-plans";

/**
 * Attachments on a single plan day.
 *
 * A plan item used to carry exactly one `resource_url`, so a self-preparation
 * plan built around study material could not put a chapter reference, a summary
 * PDF and a supporting link on the same day. `plan_item_resources` (migration
 * 055) fixed the storage; this is the only thing that writes to it.
 */

const KINDS: { value: StudyPlanItemResource["resource_kind"]; label: string; hint: string }[] = [
  { value: "book_pages", label: "Book pages", hint: "e.g. Laxmikanth Ch. 18 — pages 244–261" },
  { value: "pdf", label: "PDF", hint: "A downloadable file link" },
  { value: "link", label: "Link", hint: "Any web page" },
  { value: "video", label: "Video", hint: "A recording link" },
  { value: "note", label: "Note", hint: "Text shown inline — no link needed" }
];

const EMPTY = { title: "", resource_kind: "book_pages" as StudyPlanItemResource["resource_kind"], url: "", body: "" };

export function PlanItemResourcesEditor({ planItemId }: { planItemId: number }) {
  const { token } = useAuth();
  const [resources, setResources] = useState<StudyPlanItemResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const rows = await authenticatedGet<StudyPlanItemResource[]>(
        `/api/v1/study-plan-items/${planItemId}/resources`,
        token
      );
      setResources(rows ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError("Could not load resources for this step.");
    } finally {
      setLoading(false);
    }
  }, [token, planItemId]);

  useEffect(() => {
    void load();
  }, [load]);

  // A note carries its text in `body`; everything else carries a URL. The API
  // rejects a resource with neither, so the form enforces the same rule.
  const isNote = draft.resource_kind === "note";
  const canSave = draft.title.trim().length > 0 && (isNote ? draft.body.trim().length > 0 : draft.url.trim().length > 0);

  /**
   * Uploads through the app's existing media endpoint and drops the returned
   * URL into the draft, so a PDF can be attached from disk rather than needing
   * to be hosted somewhere first.
   */
  const uploadFile = async (file: File) => {
    if (!token) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("usage_scope", "study_plan_resource");
      const response = await fetch(`${browserBaseUrl}/api/v1/media/upload`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form
      });
      if (!response.ok) throw new Error(`Upload failed with ${response.status}`);
      const asset = (await response.json()) as { file_url?: string };
      if (!asset.file_url) throw new Error("Upload succeeded but returned no URL.");
      setDraft((current) => ({
        ...current,
        url: asset.file_url as string,
        title: current.title || file.name.replace(/\.[^.]+$/, "")
      }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload that file.");
    } finally {
      setUploading(false);
    }
  };

  const add = async () => {
    if (!token || !canSave) return;
    setBusy(true);
    setError(null);
    try {
      await authenticatedPost(`/api/v1/study-plan-items/${planItemId}/resources`, token, {
        title: draft.title.trim(),
        resource_kind: draft.resource_kind,
        url: isNote ? null : draft.url.trim(),
        body: isNote ? draft.body.trim() : null,
        display_order: resources.length
      });
      setDraft(EMPTY);
      await load();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not add that resource.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${browserBaseUrl}/api/v1/study-plan-item-resources/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`Delete failed with ${response.status}`);
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove that resource.");
    } finally {
      setBusy(false);
    }
  };

  const activeKind = KINDS.find((kind) => kind.value === draft.resource_kind);

  return (
    <div className="mt-4 rounded-md border border-line bg-paper p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">Resources for this day</p>
          <p className="mt-0.5 text-xs font-semibold text-ink/50">
            Everything the student opens here — a chapter, a summary sheet, a link. Shown in this order.
          </p>
        </div>
        <span className="rounded-md bg-surface px-2 py-1 text-xs font-black text-ink/60">{resources.length}</span>
      </div>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-xs font-bold text-ink/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading resources…
        </p>
      ) : resources.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-line bg-surface p-3 text-xs font-semibold text-ink/50">
          No resources yet. A reading day with nothing attached shows the student an empty page.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {resources.map((resource) => (
            <li
              key={resource.id}
              className="flex items-start gap-3 rounded-md border border-line bg-surface p-2.5"
            >
              <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-ink/50">
                {KINDS.find((kind) => kind.value === resource.resource_kind)?.label ?? resource.resource_kind}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{resource.title}</p>
                {resource.url && <p className="truncate text-[11px] font-semibold text-ink/45">{resource.url}</p>}
                {resource.body && <p className="line-clamp-2 text-[11px] font-semibold text-ink/45">{resource.body}</p>}
              </div>
              <button
                type="button"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                disabled={busy}
                onClick={() => remove(resource.id)}
                aria-label={`Remove ${resource.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid gap-2 rounded-md border border-civic/20 bg-surface p-3">
        <p className="text-xs font-black uppercase tracking-wide text-civic">Add a resource</p>
        <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
          <select
            className="h-9 rounded-md border border-line px-2 text-sm"
            value={draft.resource_kind}
            onChange={(event) =>
              setDraft({ ...draft, resource_kind: event.target.value as StudyPlanItemResource["resource_kind"] })
            }
          >
            {KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
          <input
            className="h-9 rounded-md border border-line px-3 text-sm"
            placeholder="Title the student sees"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </div>
        {isNote ? (
          <textarea
            className="min-h-16 rounded-md border border-line p-2.5 text-sm"
            placeholder="Note text shown inline"
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          />
        ) : (
          <div className="grid gap-2">
            <input
              className="h-9 rounded-md border border-line px-3 text-sm"
              placeholder={activeKind?.hint ?? "https://…"}
              value={draft.url}
              onChange={(event) => setDraft({ ...draft, url: event.target.value })}
            />
            {(draft.resource_kind === "pdf" || draft.resource_kind === "video") && (
              <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-md border border-line bg-paper px-3 text-xs font-bold text-ink/70 hover:border-civic/40">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Uploading…" : "Upload a file instead"}
                <input
                  type="file"
                  className="hidden"
                  accept={draft.resource_kind === "pdf" ? "application/pdf" : "video/*"}
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadFile(file);
                    event.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        )}
        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-civic px-3 text-sm font-black text-white disabled:opacity-50"
          disabled={busy || !canSave}
          onClick={add}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add resource
        </button>
      </div>
    </div>
  );
}
