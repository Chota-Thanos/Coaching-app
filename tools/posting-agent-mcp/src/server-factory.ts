/**
 * Builds the MCP server and registers every tool.
 *
 * Transport-agnostic on purpose: `index.ts` connects this over stdio for
 * local clients (Claude Desktop, Claude Code), `http-server.ts` connects the
 * same server over Streamable HTTP for remote clients. One set of tool
 * definitions, two ways to reach them — never duplicate a tool between the
 * two entry points.
 *
 * All extraction, AI parsing, classification and publishing already live in
 * the API (`/api/v1/{current-affairs,assessment}/admin/agent/*`). This wraps
 * those endpoints so an agent can drive them, with editorial judgement
 * supplied by the skills in `tools/cowork-skills/`.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiError, CoachingApi, loadConfig } from './client.js';
import { assertPublishable, recordGenerated } from './provenance.js';

const api = new CoachingApi(loadConfig());

/**
 * A fresh McpServer per call, never shared across requests. Cheap — ~25
 * synchronous tool registrations, no I/O — and it is the pattern the SDK
 * itself ships for stateless Streamable HTTP: one server+transport pair
 * per request, closed when the response ends (see http-server.ts). The
 * stdio entry point (index.ts) calls this exactly once, at startup.
 */
export function createServer(): McpServer {
const server = new McpServer({
  name: 'coaching-posting-agent',
  version: '0.1.0',
});

/** Uniform tool result: JSON on success, a readable error the model can act on. */
async function run(work: () => Promise<unknown>) {
  try {
    const result = await work();
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? `API call failed (${error.status}) on ${error.path}\n${error.body}`
        : error instanceof Error
          ? error.message
          : String(error);
    return {
      content: [{ type: 'text' as const, text: message }],
      isError: true,
    };
  }
}

/**
 * Same as `run`, but fingerprints whatever prose the tool produced so the
 * commit tools can later refuse to publish it live. Every generation tool must
 * go through this rather than `run`.
 */
async function runGeneration(work: () => Promise<unknown>) {
  try {
    const result = await work();
    recordGenerated(result);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return run(() => Promise.reject(error));
  }
}

const MIME_BY_EXT: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/** Reads a local file into the base64 source contract both agents share. */
async function fileSource(filePath: string) {
  const absolute = path.resolve(filePath);
  const extension = path.extname(absolute).toLowerCase();
  const mime = MIME_BY_EXT[extension];
  if (!mime) {
    throw new Error(
      `Unsupported file type "${extension}". Supported: ${Object.keys(MIME_BY_EXT).join(', ')}`,
    );
  }
  const buffer = await readFile(absolute);
  return {
    kind: 'file' as const,
    base64_data: buffer.toString('base64'),
    mime_type: mime,
    filename: path.basename(absolute),
  };
}

// ─── Connection / discovery ──────────────────────────────────────────────────

server.registerTool(
  'whoami',
  {
    title: 'Check API connection',
    description:
      'Verifies the configured API key and returns the account it authenticates as, including its role. Call this first if any other tool returns 401 or 403.',
    inputSchema: {},
  },
  async () => run(() => api.get('/api/v1/auth/me')),
);

server.registerTool(
  'list_exams',
  {
    title: 'List exams',
    description:
      'Lists exams. Assessment posting requires an exam_id — get it here rather than guessing (there is usually exactly one, UPSC CSE).',
    inputSchema: {},
  },
  async () => run(() => api.get('/api/v1/assessment/exams')),
);

server.registerTool(
  'list_current_affairs_categories',
  {
    title: 'List current-affairs categories',
    description:
      'Lists the current-affairs category tree used to classify articles. Use root_only to see top-level nodes, then parent_id to walk down. Returns node ids for use in ca_commit.category_node_ids AND, separately, ca_link_concept.concept.category_node_ids — a concept\'s own category is usually a different lookup than the news article\'s category, since the concept is filed under the entity itself rather than under today\'s event.',
    inputSchema: {
      content_family: z.enum(['prelims', 'mains']).optional(),
      parent_id: z.number().int().positive().optional().describe('Show children of this node.'),
      root_only: z.boolean().optional(),
      node_type: z.enum(['gs_paper', 'subject', 'topic', 'subtopic']).optional(),
      limit: z.number().int().positive().max(500).optional(),
    },
  },
  async (args) => run(() => api.get('/api/v1/current-affairs/categories', args)),
);

server.registerTool(
  'list_assessment_taxonomy',
  {
    title: 'List assessment taxonomy',
    description:
      'Lists the assessment taxonomy. GK/CSAT use the objective tree (subject → source_bucket → topic → subtopic); Mains uses a separate tree (paper → subject_area → theme → topic). Returns node ids for taxonomy_node_ids in assessment_commit.',
    inputSchema: {
      tree: z
        .enum(['objective', 'mains'])
        .describe('"objective" for gk/aptitude questions, "mains" for mains questions.'),
      content_type: z
        .enum(['gk', 'aptitude'])
        .optional()
        .describe('Objective tree only.'),
      exam_id: z.number().int().positive().optional(),
      parent_id: z.number().int().positive().optional(),
      root_only: z.boolean().optional(),
      search: z.string().optional().describe('Free-text node-name search.'),
      limit: z.number().int().positive().max(500).optional(),
    },
  },
  async ({ tree, ...rest }) =>
    run(() =>
      api.get(
        tree === 'mains'
          ? '/api/v1/assessment/mains/taxonomy-nodes'
          : '/api/v1/assessment/taxonomy-nodes',
        rest,
      ),
    ),
);

// ─── Current affairs ─────────────────────────────────────────────────────────

server.registerTool(
  'ca_extract',
  {
    title: 'Extract text (current affairs)',
    description:
      'Phase 1. Pulls raw text out of a local Word/PDF/image file or a URL. Scanned PDFs fall back to OCR automatically. Use this when you want to read and edit the text before parsing; ca_parse can also take a source directly.',
    inputSchema: {
      file_path: z.string().optional().describe('Absolute or relative path to a local file.'),
      url: z.string().url().optional().describe('Web page to extract instead of a file.'),
    },
  },
  async ({ file_path, url }) =>
    run(async () => {
      if (!file_path && !url) throw new Error('Provide either file_path or url.');
      const source = url ? { kind: 'url' as const, url } : await fileSource(file_path!);
      return api.post('/api/v1/current-affairs/admin/agent/extract', source);
    }),
);

server.registerTool(
  'ca_parse',
  {
    title: 'Parse current affairs',
    description:
      'Phase 2. Segments a document into individual articles, resolves and back-dates each publication_date, classifies each into the live category tree, and normalises the body. Returns candidates for review — nothing is written to the site yet. Editor markers in the source text (Title:, Categories: A > B; C > D, Date:, [CONCEPT]/[EVENT], --- separators, Instructions:) override the agent\'s inference.',
    inputSchema: {
      raw_text: z.string().optional().describe('Text to parse (e.g. the output of ca_extract).'),
      file_path: z.string().optional().describe('Parse a local file directly, skipping ca_extract.'),
      url: z.string().url().optional().describe('Parse a URL directly.'),
      content_kind: z
        .enum([
          'daily_current_affairs',
          'prelims_pyq',
          'daily_editorial_summary',
          'mains_topic_note',
          'mains_pyq',
          'mains_summary',
          'mains_article',
          'study_note',
        ])
        .describe('What kind of content this document holds.'),
      article_role: z
        .enum(['event', 'concept', 'auto'])
        .optional()
        .describe(
          '"event" = dated news; "concept" = evergreen primer kept out of the daily feed; "auto" = classify per item. Only meaningful for daily_current_affairs.',
        ),
      default_publication_date: z
        .string()
        .optional()
        .describe('YYYY-MM-DD fallback when the text carries no date.'),
      default_tags: z.array(z.string()).optional(),
      instructions: z
        .string()
        .max(4000)
        .optional()
        .describe('Editorial guidance passed through to the parsing prompt.'),
    },
  },
  async ({ raw_text, file_path, url, ...rest }) =>
    run(async () => {
      const body: Record<string, unknown> = { ...rest };
      if (raw_text) body.raw_text = raw_text;
      else if (url) body.source = { kind: 'url', url };
      else if (file_path) body.source = await fileSource(file_path);
      else throw new Error('Provide raw_text, file_path or url.');
      return api.post('/api/v1/current-affairs/admin/agent/parse', body);
    }),
);

server.registerTool(
  'ca_commit',
  {
    title: 'Publish current affairs',
    description:
      'Phase 3 — THIS WRITES TO THE LIVE SITE. publish_mode "auto" publishes immediately; "review" stages the batch as drafts for a human to approve in the admin UI. Prefer "review" unless the user has explicitly asked to publish. Pass the (possibly edited) candidates from ca_parse.',
    inputSchema: {
      content_kind: z.enum([
        'daily_current_affairs',
        'prelims_pyq',
        'daily_editorial_summary',
        'mains_topic_note',
        'mains_pyq',
        'mains_summary',
        'mains_article',
        'study_note',
      ]),
      publish_mode: z
        .enum(['auto', 'review'])
        .describe('"auto" = live immediately. "review" = staged as drafts.'),
      confirm_publish_ai_content: z
        .string()
        .optional()
        .describe(
          'Only when the user explicitly asked, in this request, to publish AI-written content live. See the refusal message for the exact value. Never set this on your own initiative.',
        ),
      article_role: z.enum(['event', 'concept']).optional(),
      articles: z
        .array(
          z.object({
            title: z.string().min(1),
            body: z.string().min(1),
            slug: z.string().optional(),
            excerpt: z.string().optional(),
            article_role: z.enum(['event', 'concept']).optional(),
            publication_date: z.string().optional().describe('YYYY-MM-DD.'),
            category_node_ids: z
              .array(z.number().int().positive())
              .max(50)
              .optional()
              .describe('First id is the primary category; the rest are extra tree links.'),
            source_name: z.string().optional(),
            source_url: z.string().url().optional(),
            seo_title: z.string().optional(),
            seo_description: z.string().optional(),
            keywords: z.array(z.string()).optional(),
            body_json: z.record(z.string(), z.unknown()).optional(),
            questions: z.array(z.record(z.string(), z.unknown())).optional(),
            image: z
              .object({
                url: z.string().url().optional(),
                alt_text: z.string().optional(),
                caption: z.string().optional(),
                search_query: z.string().optional(),
              })
              .optional()
              .describe('The picture to accompany the article. A search_query without a url is normal — the file is sourced later.'),
          }),
        )
        .min(1)
        .max(500),
    },
  },
  async (args) =>
    run(() => {
      const { confirm_publish_ai_content, ...body } = args;
      assertPublishable(args.publish_mode, args.articles, confirm_publish_ai_content);
      return api.post('/api/v1/current-affairs/admin/agent/commit', body);
    }),
);

// ─── Background concepts ─────────────────────────────────────────────────────
//
// A concept is an evergreen primer (`article_role: "concept"`) kept out of the
// daily feed. Events link to it instead of re-explaining it every time.
//
// The editorial rule these two tools serve: a first-of-its-kind story is one
// event article and no concept, because the background *is* the news. A
// development on something that already exists splits — the durable half is the
// concept, only what changed is the event.
//
// The failure they exist to prevent is a *second copy* of a concept. Once
// "Nasha Mukt Bharat Abhiyaan" exists, every later development has to link that
// same row; a duplicate splits the concept's news timeline in two and neither
// half is right. Hence: search first, link by id, create only as a last resort.

function conceptSlug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-') || 'concept'
  );
}

interface ConceptRow {
  id: number;
  title: string;
  slug: string;
  status?: string;
  article_role?: string;
  category?: { id: number; name: string } | null;
}

/**
 * Searches concepts across drafts as well as published rows.
 *
 * A concept staged for review this morning is still a concept — creating a
 * second one because the first has not been published yet is exactly the
 * duplication this is meant to stop. The admin list only looks past `published`
 * when an explicit status is passed, which is why this costs two calls.
 */
async function findConcepts(search: string, limit = 25): Promise<ConceptRow[]> {
  const base = { article_role: 'concept', search, limit };
  const [published, drafts] = await Promise.all([
    api.get<ConceptRow[]>('/api/v1/current-affairs/articles', base),
    api.get<ConceptRow[]>('/api/v1/current-affairs/articles', { ...base, status: 'draft' }),
  ]);
  const byId = new Map<number, ConceptRow>();
  for (const row of [...(published ?? []), ...(drafts ?? [])]) byId.set(row.id, row);
  return [...byId.values()];
}

server.registerTool(
  'ca_find_concepts',
  {
    title: 'Find existing background concepts',
    description:
      'Searches existing concept primers by text in their title or body, drafts included. Call this BEFORE writing anything about a development on an existing law, scheme, body, index or institution — if a concept already exists it must be reused, never rewritten as a second copy. Returns ids for ca_link_concept.concept_article_id, plus each concept\'s own current category so you can tell at a glance whether it already has one. An empty result is itself an answer: it means this is a first occurrence, which is written as a single news article with no concept.',
    inputSchema: {
      search: z
        .string()
        .min(2)
        .describe('The name of the underlying entity, e.g. "Nasha Mukt Bharat" or "Forest Rights Act".'),
      limit: z.number().int().positive().max(100).optional(),
    },
  },
  async ({ search, limit }) =>
    run(async () => {
      const matches = await findConcepts(search, limit ?? 25);
      return {
        count: matches.length,
        concepts: matches.map((c) => ({
          id: c.id,
          title: c.title,
          slug: c.slug,
          status: c.status,
          category: c.category ? { id: c.category.id, name: c.category.name } : null,
        })),
      };
    }),
);

/**
 * Correcting already-posted content.
 *
 * News posts and concept primers are rows in the same table, separated only by
 * `article_role`, so one set of tools covers both. The find → read → change
 * sequence is deliberate: an id guessed from a title is the one mistake here
 * that silently rewrites the wrong article.
 */
interface ArticleRow {
  id: number;
  title: string;
  slug: string;
  status: string;
  article_role: string;
  content_kind: string;
  publication_date: string | null;
  body?: string;
}

server.registerTool(
  'ca_find_articles',
  {
    title: 'Find a posted article to correct',
    description:
      'Searches posted articles — news and concept primers, drafts and published alike — by text in the title or body. Use this FIRST when something needs fixing, to get the id. Filter by article_role ("event" for news, "concept" for primers) when a title could match either. Returns no body; call ca_get_article to read one before changing it.',
    inputSchema: {
      search: z.string().min(2).describe('Text from the title or body, e.g. "Nasha Mukt Yuva".'),
      article_role: z
        .enum(['event', 'concept'])
        .optional()
        .describe('"event" = news article, "concept" = evergreen primer. Omit to search both.'),
      status: z
        .enum(['draft', 'in_review', 'approved', 'published', 'archived'])
        .optional()
        .describe('Omit to search every status — a wrong article is often still a draft.'),
      content_kind: z.string().optional(),
      limit: z.number().int().positive().max(100).optional(),
    },
  },
  async ({ search, article_role, status, content_kind, limit }) =>
    run(async () => {
      // The list endpoint filters by a single status, so an unfiltered search
      // has to union the statuses that matter rather than silently returning
      // published-only and looking like the article does not exist.
      const base = { search, article_role, content_kind, limit: limit ?? 25 };
      const statuses = status ? [status] : ['published', 'draft', 'in_review', 'approved'];
      const results = await Promise.all(
        statuses.map((s) => api.get<ArticleRow[]>('/api/v1/current-affairs/articles', { ...base, status: s })),
      );
      const byId = new Map<number, ArticleRow>();
      for (const row of results.flat()) if (row) byId.set(row.id, row);
      const found = [...byId.values()];
      return {
        count: found.length,
        articles: found.map((a) => ({
          id: a.id,
          title: a.title,
          slug: a.slug,
          status: a.status,
          article_role: a.article_role,
          content_kind: a.content_kind,
          publication_date: a.publication_date,
        })),
        note:
          found.length === 0
            ? 'Nothing matched. Widen the search text before concluding the article does not exist.'
            : undefined,
      };
    }),
);

server.registerTool(
  'ca_get_article',
  {
    title: 'Read one posted article in full',
    description:
      'Returns a single article including its full current body, whatever its status. Read the article before correcting it — a rewrite composed from memory of what was posted tends to drop details that were right, and the returned body is also what an edit must preserve the HTML shape of.',
    inputSchema: {
      article_id: z.number().int().positive().describe('From ca_find_articles.'),
    },
  },
  async ({ article_id }) =>
    run(() => api.get(`/api/v1/current-affairs/admin/articles/${article_id}`)),
);

server.registerTool(
  'ca_update_article',
  {
    title: 'Correct a posted article',
    description:
      'Edits an already-posted article or concept primer — the fix for one that turns out to be factually wrong. Only the fields passed are changed; everything else is left exactly as it is, so a single wrong figure does not require resupplying the whole article. Call ca_get_article first. Bodies must be HTML (<p>, <h2>, <strong>, <ul><li>), same as when posting.\n\nNEVER edit on your own judgement. Every change to anything already posted — drafts included — must be put to the user and agreed by them first, then sent with confirm_change. If you notice something wrong while doing other work, say so and wait; do not fix it silently. A published article needs confirm_live_edit as well, since students are reading it. To pull a live article down instead of fixing it in place, set status to "draft".',
    inputSchema: {
      article_id: z.number().int().positive().describe('From ca_find_articles.'),
      title: z.string().min(1).optional(),
      body: z
        .string()
        .min(1)
        .optional()
        .describe('The complete replacement body as HTML — not a fragment, not a diff.'),
      category_node_ids: z
        .array(z.number().int().positive())
        .max(50)
        .optional()
        .describe('Replaces the existing categories outright. Omit to leave filing untouched.'),
      publication_date: z.string().optional().describe('YYYY-MM-DD.'),
      status: z
        .enum(['draft', 'in_review', 'approved', 'published', 'archived'])
        .optional()
        .describe('Set "draft" to unpublish something wrong while it is being rewritten.'),
      source_name: z.string().optional(),
      source_url: z.string().optional(),
      seo_title: z.string().optional(),
      seo_description: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      confirm_change: z
        .literal('user-approved')
        .optional()
        .describe(
          'Required for EVERY edit, drafts included. Send it only after the user has seen what you propose to change and agreed to it in this request. Never edit an article on your own judgement.',
        ),
      confirm_live_edit: z
        .literal('update-live-article')
        .optional()
        .describe(
          'Required IN ADDITION to confirm_change when the target is currently published, because students are reading it right now.',
        ),
    },
  },
  async ({ article_id, confirm_change, confirm_live_edit, ...fields }) =>
    run(async () => {
      const current = await api.get<ArticleRow>(`/api/v1/current-affairs/admin/articles/${article_id}`);
      if (!current) throw new Error(`No article with id ${article_id}.`);

      const changed = Object.entries(fields).filter(([, v]) => v !== undefined);
      if (changed.length === 0) {
        throw new Error('No fields to change were supplied.');
      }

      // Editing anything already posted is the user's call, not the agent's —
      // drafts included. Their content is not ours to revise on our own
      // judgement, so the gate is on every edit rather than only on live ones.
      if (confirm_change !== 'user-approved') {
        throw new Error(
          `Article ${article_id} ("${current.title}", status: ${current.status}) was not changed. ` +
            `Every edit must be agreed by the user first. Show them what you propose to change to ` +
            `${changed.map(([k]) => k).join(', ')}, and once they agree, resend with confirm_change: "user-approved".`,
        );
      }

      // A published article is being read right now, so it carries a second
      // gate on top of the user's agreement. Unpublishing is exempt from this
      // one: pulling wrong content down is the safe direction.
      const isUnpublishing = fields.status !== undefined && fields.status !== 'published';
      if (current.status === 'published' && confirm_live_edit !== 'update-live-article' && !isUnpublishing) {
        throw new Error(
          `Article ${article_id} ("${current.title}") is PUBLISHED — this edit would change what students see immediately. ` +
            'Confirm that with the user too, then resend with confirm_live_edit: "update-live-article" alongside confirm_change. ' +
            'To take it offline instead, set status: "draft" (needs confirm_change only).',
        );
      }

      const updated = await api.patch<ArticleRow>(
        `/api/v1/current-affairs/articles/${article_id}`,
        Object.fromEntries(changed),
      );

      return {
        updated: true,
        id: article_id,
        title: updated?.title ?? current.title,
        article_role: current.article_role,
        status_before: current.status,
        status_after: updated?.status ?? current.status,
        fields_changed: changed.map(([k]) => k),
        live: (updated?.status ?? current.status) === 'published',
      };
    }),
);

server.registerTool(
  'ca_link_concept',
  {
    title: 'Link a background concept to news articles',
    description:
      'Attaches an evergreen concept primer to one or more event articles — the same two writes the admin "Add Concept" modal performs on publish. Pass concept_article_id to reuse an existing concept (strongly preferred; call ca_find_concepts first), or `concept` to compose one when genuinely none exists. Passing several links at once is how an older article gets back-linked when its concept is only written later. Safe to re-run: a link that already exists is reported, not duplicated.',
    inputSchema: {
      concept_article_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Existing concept to reuse, from ca_find_concepts. Always prefer this.'),
      concept: z
        .object({
          title: z.string().min(1),
          body: z
            .string()
            .min(1)
            .describe(
              'HTML, never Markdown. The evergreen explainer — no dates, no "recently". ' +
                'Same Format Library shape you would use for a news article about this entity ' +
                '(scheme, report/index, organisation, etc. — whichever fits), just written ' +
                'evergreen and at full depth rather than trimmed for a specific day\'s news.',
            ),
          slug: z.string().optional(),
          category_node_ids: z
            .array(z.number().int().positive())
            .max(50)
            .optional()
            .describe(
              'The CONCEPT\'S OWN category from list_current_affairs_categories — the subject the entity belongs to, not the category of today\'s news article, which is usually a different lookup. First id is primary. Omit only when the entity is genuinely cross-cutting or you are not confident; say so to the user rather than guessing, the same as an uncategorised news article, an uncategorised concept is effectively invisible on the site.',
            ),
          status: z
            .enum(['draft', 'published'])
            .optional()
            .describe('Defaults to draft. Publishing AI-written prose needs confirm_publish_ai_content.'),
        })
        .optional()
        .describe(
          'Compose a new concept. Reused automatically if its slug or title already matches one, so this cannot create a duplicate by accident.',
        ),
      confirm_publish_ai_content: z
        .string()
        .optional()
        .describe('Only with concept.status "published", and only when the user asked for it in this request.'),
      confirm_new_concept: z
        .literal('user-approved')
        .optional()
        .describe(
          'Required only when `concept` creates a NEW page AND a Mains Note or an Editorial Summary is among the linking articles. Daily news creates concepts automatically — its concept is the entity the story is about, so no confirmation is needed there. Reusing an existing concept (concept_article_id, or a title/slug that already matches) never needs it either. A note mentions many entities in passing, and a summary argues about one while naming several more, so whether any deserves its own page is an editorial call: put it to the user before sending this.',
        ),
      is_core: z
        .boolean()
        .default(true)
        .describe(
          'true = Core Concept: the entity the development is actually about (there is normally exactly one). false = Related Concept: something touched in passing.',
        ),
      links: z
        .array(
          z.object({
            article_id: z.number().int().positive().describe('The event article to link from.'),
            note: z
              .string()
              .max(300)
              .optional()
              .describe(
                'One line on what this article changed, e.g. "Coverage extended to 100 more districts." Becomes this entry on the concept page timeline, so write it to be read on its own.',
              ),
          }),
        )
        .min(1)
        .max(50),
    },
  },
  async ({ concept_article_id, concept, confirm_publish_ai_content, confirm_new_concept, is_core, links }) =>
    run(async () => {
      if (!concept_article_id && !concept) {
        throw new Error(
          'Provide concept_article_id (preferred — call ca_find_concepts first) or a `concept` to compose.',
        );
      }

      let conceptId = concept_article_id;
      let conceptRow: ConceptRow | undefined;
      let reused = conceptId !== undefined;

      if (!conceptId && concept) {
        const slug = concept.slug?.trim() || conceptSlug(concept.title);
        const wantedTitle = concept.title.trim().toLowerCase();
        // Match on slug or exact title only. A loose match here would silently
        // link the wrong primer, which is worse than one extra concept.
        const existing = (await findConcepts(concept.title, 50)).find(
          (c) => c.slug === slug || c.title.trim().toLowerCase() === wantedTitle,
        );

        if (existing) {
          conceptId = existing.id;
          conceptRow = existing;
          reused = true;
        } else {
          // Creating a concept page is a decision about the site's structure,
          // not a mechanical side effect of writing an article — a thin page
          // on a passing term is worse than no page at all, and once created
          // it is what every later article links to.
          //
          // But that judgement only needs a human in the Mains-prep flows. A
          // news article's concept is the entity the story is *about*, chosen
          // by the same research that produced the article, and creating it
          // has been automatic and working; gating it would break a hands-off
          // pipeline to solve a problem it does not have.
          //
          // Mains Notes and Editorial Summaries are the opposite case. A note
          // mentions many entities in passing. A summary argues *about* an
          // entity, and its analysis names several more along the way — so
          // "which of these deserves a page?" is a real editorial call in both,
          // and the wrong answer leaves a thin page the whole site then links
          // to.
          //
          // Reuse is never gated either way — it is always the outcome to
          // prefer, and friction there would push toward duplicates.
          const ASK_FIRST_KINDS = new Set(['mains_topic_note', 'daily_editorial_summary']);
          const linkingKinds = await Promise.all(
            links.slice(0, 5).map(async (l) => {
              try {
                const row = await api.get<ArticleRow>(`/api/v1/current-affairs/admin/articles/${l.article_id}`);
                return row?.content_kind;
              } catch {
                return undefined; // a bad id is reported later, by the link loop
              }
            }),
          );
          const gatingKind = linkingKinds.find((k) => k !== undefined && ASK_FIRST_KINDS.has(k));

          if (gatingKind && confirm_new_concept !== 'user-approved') {
            const why =
              gatingKind === 'daily_editorial_summary'
                ? 'An Editorial Summary argues about one entity and names several more in passing, so a new concept page needs the user first.'
                : 'A Mains Note mentions many entities in passing, so a new concept page needs the user first.';
            const fallback =
              gatingKind === 'daily_editorial_summary'
                ? 'If it does not, drop the concept argument — the summary stands on its own without one.'
                : 'If it does not, drop the concept argument and keep it as a keyword in the note instead.';
            throw new Error(
              `No concept page exists for "${concept.title}", and one was not created. ${why} ` +
                'The bar: an entity substantial enough to stand on its own and needing a full description — ' +
                'an institution, statutory body, scheme, doctrine, law or index that recurs across topics — not a term mentioned in passing. ' +
                'If it clears that bar, put it to the user (what the page would cover, and why a keyword alone is not enough), ' +
                `then resend with confirm_new_concept: "user-approved". ${fallback}`,
            );
          }
          const status = concept.status ?? 'draft';
          // Concept bodies are prose like any other; the same gate that stops
          // ca_commit publishing AI writing live applies to them.
          assertPublishable(status === 'published' ? 'auto' : 'review', concept, confirm_publish_ai_content);
          conceptRow = await api.post<ConceptRow>('/api/v1/current-affairs/articles', {
            content_kind: 'daily_current_affairs',
            article_role: 'concept',
            title: concept.title,
            slug,
            body: concept.body,
            category_node_id: concept.category_node_ids?.[0],
            category_node_ids: concept.category_node_ids,
            status,
            is_ai_generated: true,
          });
          conceptId = conceptRow.id;
        }
      }

      const relationType = is_core ? 'prerequisite' : 'related_reference';
      const label = is_core ? 'Core Concept' : 'Related Concept';
      const results: Array<{ article_id: number; linked: boolean; reason?: string; error?: string }> = [];

      for (const link of links) {
        try {
          // Re-running a post is routine (a retry, a second development landing
          // the same day). Linking twice would double the concept's timeline
          // entry, so check before writing.
          const existing = await api.get<{ outgoing?: Array<{ target_article_id: number }> }>(
            `/api/v1/current-affairs/articles/${link.article_id}/relations`,
          );
          if ((existing?.outgoing ?? []).some((rel) => rel.target_article_id === conceptId)) {
            results.push({ article_id: link.article_id, linked: false, reason: 'already linked' });
            continue;
          }

          await api.post(`/api/v1/current-affairs/articles/${link.article_id}/relations`, {
            target_article_id: conceptId,
            relation_type: relationType,
            label,
            note: link.note,
          });
          results.push({ article_id: link.article_id, linked: true });
        } catch (error) {
          // One bad article id should not lose the other links in the batch.
          results.push({
            article_id: link.article_id,
            linked: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        concept: {
          id: conceptId,
          title: conceptRow?.title,
          slug: conceptRow?.slug,
          status: conceptRow?.status,
          reused,
        },
        classification: label,
        links: results,
      };
    }),
);

/**
 * Editorial Summary → Mains Note linking.
 *
 * Structurally the same many-to-one shape as event → concept: many summaries
 * (content_kind daily_editorial_summary) feed pointers into one durable Mains
 * Note topic (mains_topic_note) — e.g. several India-China summaries across
 * months all contribute to one "India-China Relations" note. Reuses the
 * generic article-relations table with relation_type "mains_fodder", a type
 * that already existed in the schema for exactly this and was unused.
 *
 * Deliberately no "compose a new topic" branch here, unlike ca_link_concept.
 * When no matching topic exists, the skill proposes one to the user and waits
 * — if agreed, the topic is created through the normal mains-notes posting
 * flow (ca_parse + ca_commit), then linked with this tool. One creation path,
 * not two.
 *
 * This tool only records the link; it does not touch the topic's body. Use
 * ca_update_article for the actual merge, so there is exactly one place that
 * asks for edit confirmation rather than two.
 */
/** Public URL of an article — what a pointer's reference link points at. */
function articleUrl(slug: string): string {
  const site = (process.env.COACHING_API_URL ?? '').replace(/\/+$/, '');
  return `${site}/current-affairs/articles/${slug}`;
}

server.registerTool(
  'ca_link_to_mains_note',
  {
    title: 'Link a summary or news article to its Mains Note topic',
    description:
      'Records that a source article fed pointers into a durable Mains Note — the Mains-side counterpart to ca_link_concept. The source can be an Editorial Summary OR a daily news article: a judgment or committee report filed as daily news is just as much fodder for a topic note as a summary is. Find the topic first with ca_find_articles (content_kind: "mains_topic_note").\n\nReturns the source\'s public URL as reference_url — use exactly that in the pointer\'s <a href> inside the note body, rather than composing a URL by hand.\n\nThis tool ONLY records the relation; writing the pointers into the note body is a separate ca_update_article call. Propose both to the user together and get one agreement, then make the two calls. Safe to re-run: an existing link is reported, not duplicated.',
    inputSchema: {
      source_article_id: z
        .number()
        .int()
        .positive()
        .describe('The Editorial Summary or daily news article the pointers came from.'),
      topic_article_id: z.number().int().positive().describe('The Mains Note — the target. From ca_find_articles.'),
      note: z
        .string()
        .max(300)
        .optional()
        .describe('One line on what this source added, e.g. "SC ruling on NOTA in Rajya Sabha polls."'),
      confirm_change: z
        .literal('user-approved')
        .describe(
          'Required, same as ca_update_article. The user must have agreed to this link (and to the pointers merge that goes with it) before it is sent.',
        ),
    },
  },
  async ({ source_article_id, topic_article_id, note, confirm_change }) =>
    run(async () => {
      if (confirm_change !== 'user-approved') {
        throw new Error(
          `Not linked. Propose the link (source ${source_article_id} → topic ${topic_article_id}) to the user and wait for agreement, then resend with confirm_change: "user-approved".`,
        );
      }

      const [source, topic] = await Promise.all([
        api.get<ArticleRow>(`/api/v1/current-affairs/admin/articles/${source_article_id}`),
        api.get<ArticleRow>(`/api/v1/current-affairs/admin/articles/${topic_article_id}`),
      ]);
      if (!source) throw new Error(`No article with id ${source_article_id} (source).`);
      if (!topic) throw new Error(`No article with id ${topic_article_id} (topic).`);
      if (topic.content_kind !== 'mains_topic_note') {
        throw new Error(`Article ${topic_article_id} is content_kind "${topic.content_kind}", not "mains_topic_note".`);
      }
      if (source.id === topic.id) {
        throw new Error('A note cannot be linked to itself.');
      }

      // The label is what an editor sees on the relation in the admin panel,
      // so it should say which kind of source this was without them opening it.
      const label = source.content_kind === 'daily_editorial_summary' ? 'Source Summary' : 'Source Article';
      const reference_url = articleUrl(source.slug);

      const existing = await api.get<{ outgoing?: Array<{ target_article_id: number }> }>(
        `/api/v1/current-affairs/articles/${source_article_id}/relations`,
      );
      if ((existing?.outgoing ?? []).some((rel) => rel.target_article_id === topic_article_id)) {
        return {
          linked: false,
          reason: 'already linked',
          reference_url,
          source: { id: source.id, title: source.title, content_kind: source.content_kind },
          topic: { id: topic.id, title: topic.title },
        };
      }

      try {
        await api.post(`/api/v1/current-affairs/articles/${source_article_id}/relations`, {
          target_article_id: topic_article_id,
          relation_type: 'mains_fodder',
          label,
          note,
        });
      } catch (error) {
        // The check above has a race (two near-simultaneous calls can both
        // pass it before either write lands), so the database's own unique
        // constraint is the real guarantee against a duplicate row. A 409
        // here means someone already made this same link — report it the
        // same way the pre-check does, not as a failure.
        if (error instanceof ApiError && error.status === 409) {
          return {
            linked: false,
            reason: 'already linked',
            reference_url,
            source: { id: source.id, title: source.title, content_kind: source.content_kind },
            topic: { id: topic.id, title: topic.title },
          };
        }
        throw error;
      }

      return {
        linked: true,
        reference_url,
        source: {
          id: source.id,
          title: source.title,
          content_kind: source.content_kind,
          status: source.status,
        },
        topic: { id: topic.id, title: topic.title, status: topic.status },
      };
    }),
);

// ─── Generation ──────────────────────────────────────────────────────────────
//
// These *create* content that no human has read. None of them write anything —
// they return drafts, which must go back through ca_commit / assessment_commit
// with publish_mode "review". The skills forbid auto-publishing generated
// content; that boundary is the whole point of keeping generation separate.

server.registerTool(
  'list_style_guides',
  {
    title: 'List current-affairs style guides',
    description:
      'Lists saved writing-style guides. Pass the chosen id as style_guide_id to ca_generate_articles so drafts come out in the house voice instead of generic model prose.',
    inputSchema: {},
  },
  async () => run(() => api.get('/api/v1/current-affairs/admin/ai/style-guide')),
);

server.registerTool(
  'list_style_profiles',
  {
    title: 'List assessment style profiles',
    description:
      'Lists saved question-writing style profiles. Pass the chosen id as style_profile_id to assessment_generate_questions or assessment_draft_mains_question.',
    inputSchema: {},
  },
  async () => run(() => api.get('/api/v1/assessment/admin/ai/style-profiles')),
);

server.registerTool(
  'list_question_formats',
  {
    title: 'List question formats',
    description:
      'Lists question formats (MCQ shapes, statement-based patterns, etc.). Required as question_format_id by ca_generate_questions_from_article.',
    inputSchema: {},
  },
  async () => run(() => api.get('/api/v1/assessment/question-formats')),
);

server.registerTool(
  'ca_generate_articles',
  {
    title: 'Generate current-affairs articles from topics',
    description:
      'Writes NEW article drafts from a list of topics or source URLs. For each topic it gathers grounding material (scrapes the page if you pass a URL, otherwise runs a web search), routes it into your live category tree, and drafts in the chosen style guide. Returns drafts only — nothing is saved. ALWAYS check the returned `research` block: any topic listed under `research.failures` was written WITHOUT grounding material and its specifics must be verified before it goes anywhere near publication.',
    inputSchema: {
      topics: z
        .array(z.string().min(1))
        .min(1)
        .max(25)
        .describe(
          'Topic lines or source URLs. A URL gets scraped; a short phrase gets searched; a long pasted passage is used as its own source material.',
        ),
      content_type: z
        .enum(['prelims_ca', 'mains_ca', 'prelims_pyq', 'mains_pyq'])
        .optional()
        .describe('Omit to let the router agent classify each topic.'),
      instructions: z.string().max(4000).optional(),
      subject_id: z.number().int().positive().optional(),
      style_guide_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('From list_style_guides. Strongly recommended.'),
      ai_provider: z.string().optional().describe('Defaults to the server configuration.'),
      ai_model: z.string().optional(),
    },
  },
  async ({ topics, content_type, instructions, subject_id, style_guide_id, ai_provider, ai_model }) =>
    runGeneration(() =>
      api.post('/api/v1/current-affairs/admin/ai/generate', {
        topics,
        content_type,
        instructions,
        subject_id,
        style_guide_id,
        ai_provider: ai_provider ?? 'gemini',
        ai_model: ai_model ?? '',
      }),
    ),
);

/** Content types as the AI-Settings screens name them, so rules and format match exactly. */
const CA_CONTENT_KINDS = [
  'daily_current_affairs',
  'daily_editorial_summary',
  'mains_topic_note',
  'mains_summary',
  'mains_article',
  'prelims_pyq',
  'mains_pyq',
  'study_note',
] as const;

server.registerTool(
  'ca_generate_and_post',
  {
    title: 'Generate current affairs and post them',
    description:
      'The full pipeline in one call: researches each topic, writes it using the instructions and output format saved for that exact content type in AI Settings, converts the result into articles, and posts them. Defaults to drafts for review. Prefer this over ca_generate_articles + ca_commit — it applies the per-content-type format server-side instead of leaving you to reshape the output by hand. Always report the `research` summary and any per-article `warnings` back to the user.',
    inputSchema: {
      content_kind: z
        .enum(CA_CONTENT_KINDS)
        .describe(
          'The exact content type as named in AI Settings. Determines which saved instructions and output format are used.',
        ),
      topics: z
        .array(z.string().min(1))
        .min(1)
        .max(25)
        .describe(
          'Topic lines or source URLs. A URL is scraped and used as source material; a short phrase is searched; a long pasted passage is used as its own source.',
        ),
      publish_mode: z
        .enum(['auto', 'review'])
        .default('review')
        .describe(
          '"review" (default) stages drafts in the admin panel. "auto" publishes live and additionally requires confirm_publish_ai_content.',
        ),
      confirm_publish_ai_content: z
        .string()
        .optional()
        .describe(
          'Only when the user explicitly asked, in this request, to publish live. Never set on your own initiative.',
        ),
      category_node_ids: z
        .array(z.number().int().positive())
        .optional()
        .describe('Fallback categories when the generated item resolves none of its own.'),
      publication_date: z.string().optional().describe('YYYY-MM-DD.'),
      subject_id: z.number().int().positive().optional(),
      style_guide_id: z.number().int().positive().optional().describe('From list_style_guides.'),
      instructions: z
        .string()
        .max(4000)
        .optional()
        .describe("Extra direction for this run; overrides the saved rules where they conflict."),
      dry_run: z
        .boolean()
        .optional()
        .describe('Generate and convert but do not post, so the user can review the drafts first.'),
    },
  },
  async (args) =>
    run(async () => {
      const generated = (await api.post('/api/v1/current-affairs/admin/ai/generate-articles', {
        content_kind: args.content_kind,
        topics: args.topics,
        instructions: args.instructions,
        subject_id: args.subject_id,
        style_guide_id: args.style_guide_id,
        category_node_ids: args.category_node_ids,
        publication_date: args.publication_date,
      })) as {
        articles: Array<Record<string, unknown>>;
        research?: unknown;
        content_family?: string;
      };

      // Fingerprint before any commit so the publish gate can recognise it.
      recordGenerated(generated);

      const allArticles = generated.articles ?? [];
      if (allArticles.length === 0) {
        throw new Error('Generation produced no articles — nothing was posted.');
      }

      // Generation is non-deterministic: a run occasionally returns a shape the
      // converter cannot turn into body text. Drop those here rather than
      // letting the commit fail with a schema error that says nothing about
      // what actually went wrong.
      const articles = allArticles.filter((a) => String(a.body ?? '').trim().length > 0);
      const emptyTitles = allArticles
        .filter((a) => String(a.body ?? '').trim().length === 0)
        .map((a) => String(a.title ?? 'Untitled'));

      if (articles.length === 0) {
        throw new Error(
          `Generation returned ${allArticles.length} item(s) but none had usable body text, so ` +
            `nothing was posted. This usually means the output format configured for ` +
            `"${args.content_kind}" in AI Settings did not produce prose. Try again, or check ` +
            `that content type's format.`,
        );
      }

      if (args.dry_run) {
        return { posted: false, reason: 'dry_run', research: generated.research, articles };
      }

      const publishMode = args.publish_mode ?? 'review';
      assertPublishable(publishMode, articles, args.confirm_publish_ai_content);

      const commit = await api.post('/api/v1/current-affairs/admin/agent/commit', {
        content_kind: args.content_kind,
        publish_mode: publishMode,
        articles,
      });

      return {
        posted: true,
        publish_mode: publishMode,
        posted_count: articles.length,
        skipped_empty: emptyTitles.length > 0 ? emptyTitles : undefined,
        research: generated.research,
        warnings: articles.flatMap((a) => (a.warnings as string[] | undefined) ?? []),
        commit,
      };
    }),
);

server.registerTool(
  'ca_generate_questions_from_article',
  {
    title: 'Generate questions from a published article',
    description:
      'Generates practice questions grounded in one existing article, so the questions cannot drift from content already on your site. Returns a generation job with the drafted questions; nothing is published.',
    inputSchema: {
      article_id: z.number().int().positive(),
      question_format_id: z.number().int().positive().describe('From list_question_formats.'),
      question_count: z.number().int().min(1).max(20).optional().describe('Default 5.'),
      instructions: z.string().optional(),
      taxonomy: z
        .object({
          exam_id: z.number().int().positive(),
          exam_level_id: z.number().int().positive(),
          subject_node_id: z.number().int().positive(),
          source_node_id: z.number().int().positive().optional(),
          topic_node_id: z.number().int().positive().optional(),
          subtopic_node_id: z.number().int().positive().optional(),
          question_nature_id: z.number().int().positive().optional(),
        })
        .optional()
        .describe('Where the generated questions should be filed.'),
    },
  },
  async ({ article_id, ...body }) =>
    runGeneration(() =>
      api.post(`/api/v1/current-affairs/articles/${article_id}/question-generation`, body),
    ),
);

server.registerTool(
  'assessment_generate_questions',
  {
    title: 'Generate objective questions from a prompt',
    description:
      'Writes NEW GK or CSAT questions from a topic prompt, in a saved style profile. Returns drafts only — nothing is saved. Generated questions have no source document behind them, so answer keys and factual claims must be reviewed before they reach students.',
    inputSchema: {
      prompt: z.string().min(1).describe('Topic or brief, e.g. "Monetary policy instruments of the RBI".'),
      quiz_type: z
        .string()
        .describe('Question shape, e.g. "mcq", "statement_based", "match_the_following".'),
      count: z.number().int().min(1).max(50).optional(),
      content_type: z.enum(['gk', 'aptitude']).optional(),
      style_profile_id: z.number().int().positive().optional().describe('From list_style_profiles.'),
      instructions: z.string().max(4000).optional(),
      ai_provider: z.string().optional(),
      ai_model: z.string().optional(),
    },
  },
  async (args) => runGeneration(() => api.post('/api/v1/assessment/admin/ai/generate-quiz', args)),
);

server.registerTool(
  'assessment_draft_mains_question',
  {
    title: 'Draft a Mains question',
    description:
      'Drafts a Mains-style question (with directive, marks and word limit) on a topic. Returns a draft only — nothing is saved.',
    inputSchema: {
      topic: z.string().min(1),
      instructions: z.string().optional(),
      style_profile_id: z.number().int().positive().optional(),
      ai_provider: z.string().optional(),
      ai_model: z.string().optional(),
    },
  },
  async (args) =>
    runGeneration(() => api.post('/api/v1/assessment/admin/ai/draft-mains-question', args)),
);

server.registerTool(
  'ca_reword',
  {
    title: 'Reword a passage',
    description:
      'Rewrites a passage in the platform house style without inventing facts. Modes: concise, expand, simplify, exam_tone, grammar.',
    inputSchema: {
      text: z.string().min(1).max(20000),
      mode: z.enum(['concise', 'expand', 'simplify', 'exam_tone', 'grammar']).optional(),
      instructions: z.string().max(2000).optional(),
    },
  },
  async (args) => run(() => api.post('/api/v1/current-affairs/admin/agent/reword', args)),
);

// ─── Assessment questions ────────────────────────────────────────────────────

server.registerTool(
  'assessment_extract',
  {
    title: 'Extract text (assessment)',
    description:
      'Phase 1 for question banks. Pulls raw text out of a local Word/PDF/image file or a URL.',
    inputSchema: {
      file_path: z.string().optional(),
      url: z.string().url().optional(),
    },
  },
  async ({ file_path, url }) =>
    run(async () => {
      if (!file_path && !url) throw new Error('Provide either file_path or url.');
      const source = url ? { kind: 'url' as const, url } : await fileSource(file_path!);
      return api.post('/api/v1/assessment/admin/agent/extract', source);
    }),
);

server.registerTool(
  'assessment_parse',
  {
    title: 'Parse assessment questions',
    description:
      'Phase 2 for question banks. Splits a document into questions (GK, CSAT/aptitude, or Mains), extracts stems/options/answers/explanations, and classifies each into the deepest matching taxonomy node. Returns candidates for review — nothing is saved yet.',
    inputSchema: {
      raw_text: z.string().optional(),
      file_path: z.string().optional(),
      url: z.string().url().optional(),
      content_type: z
        .enum(['gk', 'aptitude', 'mains'])
        .describe('"gk" = prelims GS, "aptitude" = CSAT, "mains" = written.'),
      exam_id: z.number().int().positive().describe('From list_exams.'),
      instructions: z.string().max(4000).optional(),
    },
  },
  async ({ raw_text, file_path, url, ...rest }) =>
    run(async () => {
      const body: Record<string, unknown> = { ...rest };
      if (raw_text) body.raw_text = raw_text;
      else if (url) body.source = { kind: 'url', url };
      else if (file_path) body.source = await fileSource(file_path);
      else throw new Error('Provide raw_text, file_path or url.');
      return api.post('/api/v1/assessment/admin/agent/parse', body);
    }),
);

server.registerTool(
  'assessment_commit',
  {
    title: 'Save assessment questions',
    description:
      'Phase 3 — THIS WRITES TO THE QUESTION BANK. publish_mode "auto" publishes questions immediately; "review" saves them as drafts for the questions manager. Prefer "review" unless the user explicitly asked to publish. taxonomy_node_ids is the ordered node path root → leaf; questions without it are rejected.',
    inputSchema: {
      content_type: z.enum(['gk', 'aptitude', 'mains']),
      exam_id: z.number().int().positive(),
      publish_mode: z.enum(['auto', 'review']),
      confirm_publish_ai_content: z
        .string()
        .optional()
        .describe(
          'Only when the user explicitly asked, in this request, to publish AI-written content live. See the refusal message for the exact value. Never set this on your own initiative.',
        ),
      passage_title: z.string().optional().describe('For comprehension sets (CSAT).'),
      passage_text: z.string().optional(),
      questions: z
        .array(
          z.object({
            question_statement: z.string().min(1),
            supp_question_statement: z.string().optional(),
            question_prompt: z.string().optional(),
            options: z
              .array(z.object({ label: z.string(), text: z.string() }))
              .optional()
              .describe('Objective questions only. Labels are usually A–D.'),
            correct_answer: z.string().optional().describe('The label of the correct option.'),
            explanation: z.string().optional(),
            word_limit: z.number().int().positive().optional().describe('Mains only.'),
            marks: z.number().positive().optional().describe('Mains only.'),
            directive: z.string().optional().describe('Mains only, e.g. "Discuss", "Critically examine".'),
            taxonomy_node_ids: z
              .array(z.number().int().positive())
              .max(6)
              .optional()
              .describe('Ordered root → leaf path from list_assessment_taxonomy.'),
          }),
        )
        .min(1)
        .max(500),
    },
  },
  async (args) =>
    run(() => {
      const { confirm_publish_ai_content, ...body } = args;
      assertPublishable(args.publish_mode, args.questions, confirm_publish_ai_content);
      return api.post('/api/v1/assessment/admin/agent/commit', body);
    }),
);

return server;
}
