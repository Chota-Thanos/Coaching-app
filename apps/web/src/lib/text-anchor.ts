import type { TextAnchor } from "./api";

const CONTEXT_LENGTH = 32;

type TextNodeSpan = {
  node: Text;
  start: number;
  end: number;
};

function collectTextNodes(container: Node): TextNodeSpan[] {
  const spans: TextNodeSpan[] = [];
  let offset = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? "";
    spans.push({ node: node as Text, start: offset, end: offset + text.length });
    offset += text.length;
    node = walker.nextNode();
  }
  return spans;
}

function flattenText(spans: TextNodeSpan[]): string {
  return spans.map((span) => span.node.textContent ?? "").join("");
}

/** Builds a resilient anchor (quote + surrounding context) from the user's current selection within `container`. */
export function computeAnchorFromSelection(container: HTMLElement, range: Range): TextAnchor | null {
  const quote = range.toString().trim();
  if (!quote) return null;

  const spans = collectTextNodes(container);
  const fullText = flattenText(spans);

  const preRange = document.createRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  const start = preRange.toString().length;

  const prefix = fullText.slice(Math.max(0, start - CONTEXT_LENGTH), start);
  const suffix = fullText.slice(start + quote.length, start + quote.length + CONTEXT_LENGTH);

  return { quote, prefix, suffix, start };
}

/** Finds the best-matching Range for a stored anchor within `container`, tolerant of minor body edits. */
export function locateAnchor(container: HTMLElement, anchor: TextAnchor): Range | null {
  if (!anchor?.quote) return null;

  const spans = collectTextNodes(container);
  const fullText = flattenText(spans);

  let matchStart = -1;

  const withContext = `${anchor.prefix}${anchor.quote}${anchor.suffix}`;
  if (anchor.prefix || anchor.suffix) {
    const contextIndex = fullText.indexOf(withContext);
    if (contextIndex !== -1) matchStart = contextIndex + anchor.prefix.length;
  }

  if (matchStart === -1) {
    const nearStart = Math.max(0, anchor.start);
    const around = fullText.indexOf(anchor.quote, Math.max(0, nearStart - anchor.quote.length));
    matchStart = around !== -1 ? around : fullText.indexOf(anchor.quote);
  }

  if (matchStart === -1) return null;
  const matchEnd = matchStart + anchor.quote.length;

  const startSpan = spans.find((span) => matchStart >= span.start && matchStart < span.end);
  const endSpan = spans.find((span) => matchEnd > span.start && matchEnd <= span.end);
  if (!startSpan || !endSpan) return null;

  const range = document.createRange();
  range.setStart(startSpan.node, matchStart - startSpan.start);
  range.setEnd(endSpan.node, matchEnd - endSpan.start);
  return range;
}
