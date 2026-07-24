"use client";

import { useEffect, useRef, useState } from "react";
import { Highlighter, MessageSquarePlus, Save, Trash2, X } from "lucide-react";
import type { StudentHighlight, StudentNote, TextAnchor } from "../../../lib/api";
import { authenticatedDelete, authenticatedPatch, authenticatedPost, useAuth } from "../../auth/auth-context";
import { computeAnchorFromSelection, locateAnchor } from "../../../lib/text-anchor";
import { isHtml } from "../rendered-content";

const HIGHLIGHT_COLORS = [
  { value: "yellow", swatch: "bg-yellow-300" },
  { value: "green", swatch: "bg-emerald-300" },
  { value: "blue", swatch: "bg-sky-300" },
  { value: "pink", swatch: "bg-pink-300" }
] as const;

function colorSwatch(color: string): string {
  return HIGHLIGHT_COLORS.find((entry) => entry.value === color)?.swatch ?? "bg-yellow-300";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toRenderableHtml(content: string): string {
  if (isHtml(content)) return content;
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

type SelectionToolbar = { x: number; y: number; range: Range };
type ActiveAnnotation = { type: "highlight" | "note"; id: number; x: number; y: number };

type ArticleAnnotatorProps = {
  forkId: number;
  body: string;
  highlights: StudentHighlight[];
  notes: StudentNote[];
  onChanged: () => Promise<void> | void;
  className?: string;
};

export function ArticleAnnotator({ forkId, body, highlights, notes, onChanged, className }: ArticleAnnotatorProps) {
  const { token } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<SelectionToolbar | null>(null);
  const [noteDraft, setNoteDraft] = useState<SelectionToolbar | null>(null);
  const [noteDraftText, setNoteDraftText] = useState("");
  const [activeAnnotation, setActiveAnnotation] = useState<ActiveAnnotation | null>(null);
  const [editText, setEditText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const html = toRenderableHtml(body);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.querySelectorAll("[data-annotation-id]").forEach((el) => {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
    container.normalize();

    for (const highlight of highlights) {
      const anchor = highlight.anchor_json as TextAnchor;
      const range = locateAnchor(container, anchor);
      if (!range) continue;
      try {
        const mark = document.createElement("mark");
        mark.dataset.annotationId = `highlight-${highlight.id}`;
        mark.className = `${colorSwatch(highlight.color)} cursor-pointer rounded-sm px-0.5`;
        if (highlight.note) mark.title = highlight.note;
        range.surroundContents(mark);
      } catch {
        // Selection crosses an element boundary oddly (e.g. spans a link) - the list below still covers it.
      }
    }

    for (const note of notes) {
      const anchor = note.anchor_json as TextAnchor;
      const range = locateAnchor(container, anchor);
      if (!range) continue;
      try {
        const span = document.createElement("span");
        span.dataset.annotationId = `note-${note.id}`;
        span.className = "cursor-pointer border-b-2 border-dotted border-saffron bg-saffron/10";
        range.surroundContents(span);
      } catch {
        // ignore
      }
    }
  }, [html, highlights, notes]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const marker = target.closest("[data-annotation-id]") as HTMLElement | null;
      if (!marker) return;
      const [type, idStr] = (marker.dataset.annotationId ?? "").split("-");
      const id = Number(idStr);
      if (!id || (type !== "highlight" && type !== "note")) return;
      const rect = marker.getBoundingClientRect();
      setEditText(type === "highlight" ? highlights.find((h) => h.id === id)?.note ?? "" : notes.find((n) => n.id === id)?.note ?? "");
      setActiveAnnotation({ type, id, x: rect.left, y: rect.bottom + 6 });
      setToolbar(null);
      setNoteDraft(null);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [highlights, notes]);

  useEffect(() => {
    function handleSelectionChange() {
      const container = containerRef.current;
      const selection = window.getSelection();
      if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
        setToolbar(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer) || !range.toString().trim()) {
        setToolbar(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setToolbar({ x: rect.left, y: rect.top - 8, range: range.cloneRange() });
    }
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  async function createHighlight(color: string): Promise<void> {
    const container = containerRef.current;
    if (!container || !toolbar || !token) return;
    const anchor = computeAnchorFromSelection(container, toolbar.range);
    if (!anchor) return;
    setPending(true);
    setError(null);
    try {
      await authenticatedPost(`/api/v1/current-affairs/me/forks/${forkId}/highlights`, token, { anchor_json: anchor, color });
      window.getSelection()?.removeAllRanges();
      setToolbar(null);
      await onChanged();
    } catch {
      setError("Could not save highlight.");
    } finally {
      setPending(false);
    }
  }

  function startNoteDraft(): void {
    if (!toolbar) return;
    setNoteDraft(toolbar);
    setNoteDraftText("");
    setToolbar(null);
  }

  async function submitNoteDraft(): Promise<void> {
    const container = containerRef.current;
    if (!container || !noteDraft || !token || !noteDraftText.trim()) return;
    const anchor = computeAnchorFromSelection(container, noteDraft.range);
    if (!anchor) return;
    setPending(true);
    setError(null);
    try {
      await authenticatedPost(`/api/v1/current-affairs/me/forks/${forkId}/notes`, token, { anchor_json: anchor, note: noteDraftText.trim() });
      window.getSelection()?.removeAllRanges();
      setNoteDraft(null);
      setNoteDraftText("");
      await onChanged();
    } catch {
      setError("Could not save note.");
    } finally {
      setPending(false);
    }
  }

  async function saveActiveAnnotation(): Promise<void> {
    if (!activeAnnotation || !token) return;
    if (activeAnnotation.type === "note" && !editText.trim()) return;
    setPending(true);
    setError(null);
    try {
      const path =
        activeAnnotation.type === "highlight"
          ? `/api/v1/current-affairs/me/highlights/${activeAnnotation.id}`
          : `/api/v1/current-affairs/me/notes/${activeAnnotation.id}`;
      await authenticatedPatch(path, token, activeAnnotation.type === "highlight" ? { note: editText.trim() || null } : { note: editText.trim() });
      setActiveAnnotation(null);
      await onChanged();
    } catch {
      setError("Could not save changes.");
    } finally {
      setPending(false);
    }
  }

  async function deleteActiveAnnotation(): Promise<void> {
    if (!activeAnnotation || !token) return;
    setPending(true);
    setError(null);
    try {
      const path =
        activeAnnotation.type === "highlight"
          ? `/api/v1/current-affairs/me/highlights/${activeAnnotation.id}`
          : `/api/v1/current-affairs/me/notes/${activeAnnotation.id}`;
      await authenticatedDelete(path, token);
      setActiveAnnotation(null);
      await onChanged();
    } catch {
      setError("Could not delete.");
    } finally {
      setPending(false);
    }
  }

  function jumpTo(type: "highlight" | "note", id: number): void {
    const marker = containerRef.current?.querySelector(`[data-annotation-id="${type}-${id}"]`);
    marker?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function deleteById(type: "highlight" | "note", id: number): Promise<void> {
    if (!token) return;
    const path = type === "highlight" ? `/api/v1/current-affairs/me/highlights/${id}` : `/api/v1/current-affairs/me/notes/${id}`;
    await authenticatedDelete(path, token);
    await onChanged();
  }

  return (
    <div className="relative">
      <div className="mb-2 text-xs font-semibold text-ink/45">Select any text below to highlight it or attach a note.</div>
      <div className={className} dangerouslySetInnerHTML={{ __html: html }} ref={containerRef} />

      {toolbar && (
        <div
          className="fixed z-40 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-md border border-line bg-midnight px-2 py-1.5 shadow-xl"
          style={{ left: toolbar.x, top: toolbar.y }}
        >
          {HIGHLIGHT_COLORS.map((entry) => (
            <button
              className={`h-6 w-6 rounded-full border-2 border-white/70 ${entry.swatch} disabled:opacity-50`}
              disabled={pending}
              key={entry.value}
              onClick={() => createHighlight(entry.value)}
              title={`Highlight ${entry.value}`}
              type="button"
            >
              <span className="sr-only">Highlight {entry.value}</span>
            </button>
          ))}
          <button
            className="ml-1 inline-flex h-6 items-center gap-1 rounded-full bg-white/10 px-2 text-xs font-bold text-white hover:bg-white/20"
            onClick={startNoteDraft}
            type="button"
          >
            <MessageSquarePlus aria-hidden="true" className="h-3.5 w-3.5" />
            Note
          </button>
        </div>
      )}

      {noteDraft && (
        <div
          className="fixed z-40 w-72 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface p-3 shadow-xl"
          style={{ left: noteDraft.x, top: noteDraft.y }}
        >
          <p className="text-xs font-black uppercase tracking-wide text-civic">Add a note</p>
          <p className="mt-1 line-clamp-2 text-xs italic text-ink/50">"{noteDraft.range.toString().trim()}"</p>
          <textarea
            autoFocus
            className="mt-2 min-h-20 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-civic"
            onChange={(event) => setNoteDraftText(event.target.value)}
            placeholder="What should this remind you of?"
            value={noteDraftText}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-surface px-3 text-xs font-bold text-ink"
              onClick={() => {
                setNoteDraft(null);
                window.getSelection()?.removeAllRanges();
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-civic px-3 text-xs font-bold text-white disabled:opacity-60"
              disabled={pending || !noteDraftText.trim()}
              onClick={submitNoteDraft}
              type="button"
            >
              <Save aria-hidden="true" className="h-3.5 w-3.5" />
              Save note
            </button>
          </div>
        </div>
      )}

      {activeAnnotation && (
        <div
          className="fixed z-40 w-72 rounded-lg border border-line bg-surface p-3 shadow-xl"
          style={{ left: activeAnnotation.x, top: activeAnnotation.y }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wide text-civic">
              {activeAnnotation.type === "highlight" ? "Highlight note" : "Note"}
            </p>
            <button onClick={() => setActiveAnnotation(null)} type="button">
              <X aria-hidden="true" className="h-4 w-4 text-ink/50" />
            </button>
          </div>
          <textarea
            autoFocus
            className="mt-2 min-h-16 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-civic"
            onChange={(event) => setEditText(event.target.value)}
            placeholder={activeAnnotation.type === "highlight" ? "Optional note for this highlight..." : "Note text..."}
            value={editText}
          />
          <div className="mt-2 flex justify-between gap-2">
            <button
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-berry/30 bg-berry/10 px-3 text-xs font-bold text-berry"
              disabled={pending}
              onClick={deleteActiveAnnotation}
              type="button"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              Delete
            </button>
            <button
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-civic px-3 text-xs font-bold text-white disabled:opacity-60"
              disabled={pending || (activeAnnotation.type === "note" && !editText.trim())}
              onClick={saveActiveAnnotation}
              type="button"
            >
              <Save aria-hidden="true" className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-semibold text-berry">{error}</p>}

      {(highlights.length > 0 || notes.length > 0) && (
        <section className="mt-4 rounded-lg border border-line bg-paper/30 p-3">
          <p className="inline-flex items-center gap-2 text-sm font-black text-ink">
            <Highlighter aria-hidden="true" className="h-4 w-4 text-civic" />
            Highlights &amp; notes ({highlights.length + notes.length})
          </p>
          <div className="mt-2 grid gap-2">
            {highlights.map((highlight) => (
              <div className="flex items-start justify-between gap-2 rounded-md border border-line bg-surface p-2.5" key={`highlight-${highlight.id}`}>
                <button className="min-w-0 flex-1 text-left" onClick={() => jumpTo("highlight", highlight.id)} type="button">
                  <span className={`mr-2 inline-block h-3 w-3 rounded-full align-middle ${colorSwatch(highlight.color)}`} />
                  <span className="text-sm italic text-ink/70">"{(highlight.anchor_json as TextAnchor).quote}"</span>
                  {highlight.note && <span className="mt-1 block text-sm text-ink/85">{highlight.note}</span>}
                </button>
                <button className="shrink-0 text-ink/40 hover:text-berry" onClick={() => deleteById("highlight", highlight.id)} type="button">
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            ))}
            {notes.map((note) => (
              <div className="flex items-start justify-between gap-2 rounded-md border border-saffron/25 bg-saffron/5 p-2.5" key={`note-${note.id}`}>
                <button className="min-w-0 flex-1 text-left" onClick={() => jumpTo("note", note.id)} type="button">
                  <span className="text-sm italic text-ink/60">"{(note.anchor_json as TextAnchor).quote}"</span>
                  <span className="mt-1 block text-sm font-semibold text-ink/85">{note.note}</span>
                </button>
                <button className="shrink-0 text-ink/40 hover:text-berry" onClick={() => deleteById("note", note.id)} type="button">
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
