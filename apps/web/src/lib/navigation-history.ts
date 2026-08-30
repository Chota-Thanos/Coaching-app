/**
 * Where the learner was before this screen.
 *
 * A back button needs to answer two questions: is there anywhere in this app
 * to go back to, and where. Neither is available from the platform once the
 * app is running:
 *
 *   - `document.referrer` is only set by a full page load. After the first
 *     client-side navigation it is stale or empty, so it cannot tell you the
 *     previous in-app screen.
 *   - `history.length` counts every entry from every site in the tab.
 *   - Next's App Router keeps no public index in `history.state`.
 *
 * Without an answer, back buttons fall back to `router.push("/somewhere")`,
 * which appends a history entry instead of removing one — so the browser's own
 * back button returns to the screen you just left, and the two bounce off each
 * other indefinitely. That is exactly what the create-test wizard did.
 *
 * This keeps a short trail of visited paths in `sessionStorage`: scoped to the
 * tab, cleared when it closes, and small enough to be free.
 */

const KEY = "wtias_nav_trail";
const MAX = 10;

function read(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    // Private windows, blocked storage, or malformed JSON. A back button that
    // falls back to a sensible default is far better than a crash.
    return [];
  }
}

function write(trail: string[]): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-MAX)));
  } catch {
    /* Storage unavailable; the trail is a convenience, not state we own. */
  }
}

/** Called on every route change. Consecutive duplicates are collapsed so a
 *  re-render or a query-string tweak does not stack up entries. */
export function recordPath(path: string): void {
  const trail = read();
  if (trail[trail.length - 1] === path) return;
  trail.push(path);
  write(trail);
}

/**
 * The screen before `currentPath`, or null if this is where the learner
 * arrived. Skips repeats of the current path so that landing on the same
 * screen twice does not make "back" a no-op.
 */
export function previousPath(currentPath: string): string | null {
  const trail = read();
  for (let i = trail.length - 1; i >= 0; i--) {
    const entry = trail[i];
    if (entry && entry !== currentPath) return entry;
  }
  return null;
}

/** Whether `router.back()` will land somewhere inside this app. */
export function hasAppHistory(currentPath: string): boolean {
  return previousPath(currentPath) !== null;
}
