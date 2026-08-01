import crypto from 'node:crypto';

/**
 * Tracks which text this server generated, so it can refuse to publish it live.
 *
 * The rule — AI-written content always goes to drafts for a human to read —
 * used to live only in a Claude Code skill file. Any other client (Cowork,
 * Desktop, a script) would never see that file, and the rule would silently
 * cease to exist. So it lives here instead: enforced in code, on the same
 * process that did the generating, with no override flag and no env var to
 * disable it. A model cannot be talked out of it because it is not asked.
 *
 * Mechanism: fingerprint the prose each generation tool returns, then check
 * every commit against those fingerprints. Matching on the *content itself*
 * rather than on a session flag means posting a human-written document still
 * works normally, even in a session where something was generated earlier.
 *
 * Known limit, stated plainly: a draft a human has genuinely rewritten from
 * scratch will no longer match. That is the intended boundary — at that point a
 * person has read and rewritten it, which is exactly what review is for.
 */

/**
 * Prose is identified by shape, not by field name.
 *
 * An earlier version matched an allow-list of keys (`body`, `content`,
 * `question_statement`, …). Running it against a real style guide immediately
 * broke it: style guides carry their own `output_schema`, so a generated
 * article came back under `latest_updates[].description` and
 * `about_monetary_policy_committee`. Nothing was fingerprinted, and the
 * guardrail would have silently allowed the publish. Field names are
 * user-defined, so they cannot be the basis of a safety check.
 */

/**
 * Short strings collide across unrelated documents ("Introduction", a shared
 * heading), so only fingerprint passages long enough to be distinctive.
 */
const MIN_FINGERPRINT_CHARS = 80;

/**
 * Prose has spaces. This excludes URLs, slugs, ids, base64 blobs and long
 * tokens, which are legitimately reused between generated and human content
 * and would otherwise cause a human document to be blocked.
 */
const MIN_FINGERPRINT_WORDS = 8;

function isProse(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < MIN_FINGERPRINT_CHARS) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  return trimmed.split(/\s+/).length >= MIN_FINGERPRINT_WORDS;
}

/** How much of a passage to fingerprint — enough to identify, short enough to survive a trailing edit. */
const FINGERPRINT_WINDOW = 240;

const generatedFingerprints = new Set<string>();

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_`#>[\]()]/g, '') // markdown noise
    .replace(/\s+/g, ' ')
    .trim();
}

function fingerprint(text: string): string | null {
  if (!isProse(text)) return null;
  const normalized = normalize(text);
  if (normalized.length < MIN_FINGERPRINT_CHARS) return null;
  return crypto
    .createHash('sha256')
    .update(normalized.slice(0, FINGERPRINT_WINDOW))
    .digest('hex');
}

/** Walks any nested payload and yields every string in it, at any depth. */
function* walkText(value: unknown): Generator<string> {
  if (typeof value === 'string') {
    yield value;
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) yield* walkText(item);
    return;
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) {
      yield* walkText(child);
    }
  }
}

/** Called after every generation tool returns. */
export function recordGenerated(payload: unknown): number {
  let recorded = 0;
  for (const text of walkText(payload)) {
    const print = fingerprint(text);
    if (print && !generatedFingerprints.has(print)) {
      generatedFingerprints.add(print);
      recorded += 1;
    }
  }
  return recorded;
}

export interface GeneratedMatch {
  /** A short, human-recognisable excerpt of the offending passage. */
  excerpt: string;
}

/** Returns the passages in `payload` that this server generated. */
export function findGeneratedContent(payload: unknown): GeneratedMatch[] {
  const matches: GeneratedMatch[] = [];
  const seen = new Set<string>();
  for (const text of walkText(payload)) {
    const print = fingerprint(text);
    if (!print || !generatedFingerprints.has(print) || seen.has(print)) continue;
    seen.add(print);
    matches.push({ excerpt: normalize(text).slice(0, 90) + '…' });
  }
  return matches;
}

/**
 * The exact value a caller must pass to publish AI-written content live.
 *
 * Deliberately not a boolean: a bare `true` is the kind of thing a model sets
 * while pattern-matching a schema. A caller has to have read the refusal to
 * produce this string, which makes publishing a deliberate act rather than a
 * default that slipped through.
 */
export const PUBLISH_AI_CONFIRMATION = 'publish-ai-content';

export class GeneratedContentPublishError extends Error {
  constructor(readonly matches: GeneratedMatch[]) {
    super(
      `Held back: this batch contains ${matches.length} passage(s) written by the AI.\n\n` +
        matches.map((m) => `  • ${m.excerpt}`).join('\n') +
        `\n\nAI-written content goes to drafts unless publishing was explicitly asked for.\n\n` +
        `• If the user did NOT ask for this to go live: re-send with publish_mode: "review". ` +
        `It will be staged in the admin panel for them to read and publish.\n` +
        `• If the user DID ask, in this request, for it to be published live: re-send with ` +
        `publish_mode: "auto" and confirm_publish_ai_content: "${PUBLISH_AI_CONFIRMATION}".\n\n` +
        `Do not use the confirmation on your own initiative — it exists so a person, not a ` +
        `model, decides that unreviewed AI writing reaches students.`,
    );
    this.name = 'GeneratedContentPublishError';
  }
}

/**
 * Gate called by both commit tools.
 *
 * Drafts are the default for AI-written content; publishing it live requires
 * the caller to pass [PUBLISH_AI_CONFIRMATION], which the user has to have
 * asked for. Content the user supplied themselves is never gated — they have
 * already read it.
 */
export function assertPublishable(
  publishMode: string,
  payload: unknown,
  confirmation?: string,
): void {
  if (publishMode !== 'auto') return;
  if (confirmation === PUBLISH_AI_CONFIRMATION) return;
  const matches = findGeneratedContent(payload);
  if (matches.length > 0) throw new GeneratedContentPublishError(matches);
}

/** Test seam — production code never calls this. */
export function __resetProvenanceForTests(): void {
  generatedFingerprints.clear();
}
