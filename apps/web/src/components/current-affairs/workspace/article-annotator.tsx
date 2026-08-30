"use client";

import { useEffect, useRef, useState, useLayoutEffect} from "react";
import { Highlighter, MessageSquarePlus, Save, Trash2, X } from "lucide-react";
import type { StudentHighlight, StudentNote, TextAnchor } from "../../../lib/api";
import { ApiError, authenticatedDelete, authenticatedPatch, authenticatedPost, useAuth } from "../../auth/auth-context";
import { CapReachedNotice, isCapError } from "../../billing/cap-reached-notice";
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

// Stores the computed anchor (plain quote/prefix/suffix/offset data) rather
// than the live Range itself — a Range's boundaries can end up collapsing
// out from under it before the user acts on the toolbar (e.g. once the
// document's selection changes again), so anything the toolbar needs to act
// on later must be captured as inert data up front, not read lazily.
type SelectionToolbar = { x: number; y: number; anchor: TextAnchor };
type ActiveAnnotation = { type: "highlight" | "note"; id: number; x: number; y: number };

type ArticleAnnotatorProps = {
  forkId: number;
  body: string;
  highlights: StudentHighlight[];
  notes: StudentNote[];
  onChanged: () => Promise<void> | void;
  className?: string;
};


/**
 * Wrap everything a range covers, one text node at a time.
 *
 * `Range.surroundContents` throws the moment a range partially covers an
 * element rather than plain text — which is exactly what happens as soon as a
 * second highlight overlaps a first, since the first is now a <mark> in the
 * way. That threw for any overlapping or adjacent selection and the highlight
 * silently never appeared.
 *
 * Splitting the range across the text nodes it actually touches has no such
 * restriction: each piece is wrapped in its own clone of the wrapper, so
 * overlapping highlights nest instead of colliding.
 */
function wrapRange(range: Range, wrapper: HTMLElement): void {
  const root = range.commonAncestorContainer;
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(
    root.nodeType === Node.TEXT_NODE ? (root.parentNode as Node) : root,
    NodeFilter.SHOW_TEXT
  );

  const touched: Text[] = [];
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (range.intersectsNode(node) && (node.textContent ?? "").length > 0) touched.push(node);
    node = walker.nextNode() as Text | null;
  }

  for (const text of touched) {
    // Trim each node to the part the range actually covers.
    const startOffset = text === range.startContainer ? range.startOffset : 0;
    const endOffset = text === range.endContainer ? range.endOffset : (text.textContent ?? "").length;
    if (endOffset <= startOffset) continue;

    let target = text;
    if (endOffset < (target.textContent ?? "").length) target.splitText(endOffset);
    if (startOffset > 0) target = target.splitText(startOffset);

    const clone = wrapper.cloneNode(false) as HTMLElement;
    target.parentNode?.insertBefore(clone, target);
    clone.appendChild(target);
  }
}

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
  const [capError, setCapError] = useState<ApiError | null>(null);

  const html = toRenderableHtml(body);

  /* The article body is written into the container by hand rather than through
     dangerouslySetInnerHTML.
     React re-commits that prop on every render, and each commit replaced the
     whole subtree -- discarding every highlight this component had painted and
     collapsing any selection the reader was in the middle of making. Writing it
     ourselves, only when the body actually changes, means React never touches
     the subtree after mount: highlights stay painted and a selection survives
     until the reader acts on it. */
  const renderedHtmlRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (renderedHtmlRef.current === html) return;
    container.innerHTML = html;
    renderedHtmlRef.current = html;
  }, [html]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Repaint only when what is on screen no longer matches what should be.
    //
    // This effect runs after every commit so it can repair React's wiping of
    // the subtree, but the repaint replaces text nodes -- and replacing the
    // text nodes under a live selection destroys it. Selecting a sentence
    // therefore deselected it instantly, before a colour could be chosen.
    // Comparing first means the common render touches nothing at all.
    const painted = new Set(
      [...container.querySelectorAll("[data-annotation-id]")].map(
        (el) => (el as HTMLElement).dataset.annotationId ?? ""
      )
    );
    const wanted = new Set([
      ...highlights.map((h) => `highlight-${h.id}`),
      ...notes.map((n) => `note-${n.id}`)
    ]);
    const upToDate =
      painted.size === wanted.size && [...wanted].every((id) => painted.has(id));
    if (upToDate) return;

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
        wrapRange(range, mark);
      } catch {
        // Nothing left to try for this one; the list below the article still
        // shows it, so the annotation is not lost, only unpainted.
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
        wrapRange(range, span);
      } catch {
        // ignore
      }
    }
    // Deliberately no dependency array.
    //
    // The article body is rendered through dangerouslySetInnerHTML, so React
    // owns that subtree; whenever it re-commits it, every <mark> this effect
    // inserted is wiped. With a dependency list the effect had already run and
    // did not run again, so the highlights simply disappeared and stayed gone
    // until a reload -- which is what "my highlights vanish when I select
    // something else" was. Running after every commit repaints them straight
    // back. It is cheap: the loop is a handful of ranges over one article.
  });

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

  // The toolbar must only appear once a selection gesture is finished
  // (mouseup/touchend) — reacting to every "selectionchange" tick during
  // the drag itself pops the floating toolbar up mid-drag, right under the
  // pointer, which then intercepts the rest of the drag and breaks
  // selecting text at all. A mousedown elsewhere clears any stale toolbar
  // first, but is ignored when it starts inside the annotator's own
  // floating UI so clicking a color/Note/Save button isn't cancelled by
  // its own mousedown before the click can register.
  useEffect(() => {
    function resolveSelectionToolbar(): SelectionToolbar | null {
      const container = containerRef.current;
      const selection = window.getSelection();
      if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) return null;
      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer) || !range.toString().trim()) return null;
      const anchor = computeAnchorFromSelection(container, range);
      if (!anchor) return null;
      const rect = range.getBoundingClientRect();
      return { x: rect.left, y: rect.top - 8, anchor };
    }

    function handleSelectionFinished(event: Event) {
      // Releasing the button over the toolbar is not the end of a selection
      // gesture -- it is the click. Without this guard the sequence was:
      // mousedown on a swatch (ignored, correctly), the browser collapses the
      // selection, mouseup lands here and finds nothing selected, the toolbar
      // is torn down, and the click handler then returns early because there is
      // no toolbar left. Every highlight and note silently did nothing, which
      // is exactly what it looked like from the outside: the selection
      // vanishing and the buttons doing nothing.
      const target = event.target as HTMLElement | null;
      if (target && typeof target.closest === "function" && target.closest("[data-annotator-ui]")) return;
      setToolbar(resolveSelectionToolbar());
    }

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("[data-annotator-ui]")) return;
      setToolbar(null);
    }

    document.addEventListener("mouseup", handleSelectionFinished);
    document.addEventListener("touchend", handleSelectionFinished);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleSelectionFinished);
      document.removeEventListener("touchend", handleSelectionFinished);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  async function createHighlight(color: string): Promise<void> {
    if (!toolbar || !token) return;
    setPending(true);
    setError(null);
    setCapError(null);
    try {
      await authenticatedPost(`/api/v1/current-affairs/me/forks/${forkId}/highlights`, token, { anchor_json: toolbar.anchor, color });
      window.getSelection()?.removeAllRanges();
      setToolbar(null);
      await onChanged();
    } catch (err) {
      if (isCapError(err)) setCapError(err);
      else setError("Could not save highlight.");
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
    if (!noteDraft || !token || !noteDraftText.trim()) return;
    setPending(true);
    setError(null);
    setCapError(null);
    try {
      await authenticatedPost(`/api/v1/current-affairs/me/forks/${forkId}/notes`, token, { anchor_json: noteDraft.anchor, note: noteDraftText.trim() });
      window.getSelection()?.removeAllRanges();
      setNoteDraft(null);
      setNoteDraftText("");
      await onChanged();
    } catch (err) {
      if (isCapError(err)) setCapError(err);
      else setError("Could not save note.");
    } finally {
      setPending(false);
    }
  }

  async function saveActiveAnnotation(): Promise<void> {
    if (!activeAnnotation || !token) return;
    if (activeAnnotation.type === "note" && !editText.trim()) return;
    setPending(true);
    setError(null);
    setCapError(null);
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
    setCapError(null);
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
      {/* Intentionally not dangerouslySetInnerHTML: see renderedHtmlRef. */}
      <div className={className} ref={containerRef} />

      {toolbar && (
        <div
          className="fixed z-40 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-md border border-line bg-midnight px-2 py-1.5 shadow-xl"
          data-annotator-ui
          /* Pressing a control here would otherwise move focus, and the browser
             collapses the selection when it does -- so the text a reader had
             just dragged over visibly deselected the instant they reached for a
             colour. Refusing the default keeps it selected while they choose. */
          onMouseDown={(event) => event.preventDefault()}
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
          data-annotator-ui
          style={{ left: noteDraft.x, top: noteDraft.y }}
        >
          <p className="text-xs font-black uppercase tracking-wide text-civic">Add a note</p>
          <p className="mt-1 line-clamp-2 text-xs italic text-ink/50">"{noteDraft.anchor.quote}"</p>
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
          data-annotator-ui
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
      {capError && (
        <div className="mt-3">
          <CapReachedNotice error={capError} module="current_affairs" compact />
        </div>
      )}

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
