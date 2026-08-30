"use client";

import { useLayoutEffect, useRef } from "react";
import type { StudentHighlight, TextAnchor } from "../../../lib/api";
import { locateAnchor } from "../../../lib/text-anchor";

/**
 * The article copy with the reader's highlights painted on it, read-only.
 *
 * The folder list showed the plain body while the reader page showed the same
 * article marked up, so opening an article you had worked through in the folder
 * looked like the work had been lost. This paints the same marks, without any
 * of the annotator's editing machinery — you cannot highlight from here, only
 * see what is already there.
 */

const COLOR_CLASS: Record<string, string> = {
  yellow: "bg-yellow-300",
  green: "bg-emerald-300",
  blue: "bg-sky-300",
  pink: "bg-pink-300"
};

/** Wrap a range one text node at a time, so overlapping highlights nest
 *  instead of throwing the way `surroundContents` does. */
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

function isHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function toHtml(content: string): string {
  if (isHtml(content)) return content;
  return content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function HighlightedContent({
  content,
  highlights,
  className = ""
}: {
  content: string;
  highlights: StudentHighlight[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<string | null>(null);

  const html = toHtml(content);

  // Written by hand rather than through dangerouslySetInnerHTML: React
  // re-commits that prop on every render and would wipe the marks below with it.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (renderedRef.current === html) return;
    container.innerHTML = html;
    renderedRef.current = html;
  }, [html]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const painted = new Set(
      [...container.querySelectorAll("[data-annotation-id]")].map(
        (el) => (el as HTMLElement).dataset.annotationId ?? ""
      )
    );
    const wanted = new Set(highlights.map((h) => `highlight-${h.id}`));
    if (painted.size === wanted.size && [...wanted].every((id) => painted.has(id))) return;

    container.querySelectorAll("[data-annotation-id]").forEach((el) => {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
    container.normalize();

    for (const highlight of highlights) {
      const range = locateAnchor(container, highlight.anchor_json as TextAnchor);
      if (!range) continue;
      try {
        const mark = document.createElement("mark");
        mark.dataset.annotationId = `highlight-${highlight.id}`;
        mark.className = `${COLOR_CLASS[highlight.color] ?? "bg-yellow-300"} rounded-sm px-0.5`;
        if (highlight.note) mark.title = highlight.note;
        wrapRange(range, mark);
      } catch {
        // The list on the reader page still carries it; only the paint failed.
      }
    }
  });

  return <div className={className} ref={containerRef} />;
}
