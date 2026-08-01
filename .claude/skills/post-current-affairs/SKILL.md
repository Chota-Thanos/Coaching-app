---
name: post-current-affairs
description: Post current-affairs articles, editorials, concept primers, study notes or PYQs to the live coaching app from a Word/PDF file, a URL, or pasted text. Use when the user says things like "post this to current affairs", "publish today's CA", "put this editorial on the site", "add these prelims PYQs", or hands over a document to go into the Current Affairs section. Requires the coaching-posting-agent MCP server.
---

# Posting to Current Affairs

Drives the app's existing posting pipeline through the `coaching-posting-agent`
MCP server. The AI extraction, segmentation, dating and classification all run
**server-side** — your job is to route the document correctly, sanity-check what
comes back, and decide what gets published versus staged.

## The pipeline

`ca_extract` → `ca_parse` → *(review)* → `ca_commit`

`ca_parse` accepts a `file_path` or `url` directly, so `ca_extract` is only
needed when you want to read or edit the text first (worth doing for scanned
PDFs, where OCR quality varies).

## Before you start

1. Run `whoami` once. If it fails, the API key is missing, revoked, or points at
   a non-admin account — stop and tell the user rather than retrying.
2. Establish **content kind** from what the user actually handed you:

   | Document | `content_kind` |
   |---|---|
   | Daily news roundup | `daily_current_affairs` |
   | Newspaper editorial summary | `daily_editorial_summary` |
   | Evergreen explainer / primer | `daily_current_affairs` + `article_role: concept` |
   | Prelims previous-year questions | `prelims_pyq` |
   | Mains previous-year questions | `mains_pyq` |
   | Mains topic note or article | `mains_topic_note` / `mains_article` |
   | Standalone study note | `study_note` |

   If the document plainly mixes dated news and evergreen explainers, pass
   `article_role: "auto"` and let the parser decide per item.

## Editor markers beat inference

If the user's document contains any of these, they are authoritative — do not
override them, and mention in your summary that you honoured them:

- `Title:` or a heading above a block
- `Categories: Economy > Banking; Polity > Governance` — `>` is depth, `;` or `|` separates trees
- `Date: 2026-07-14`
- `[CONCEPT]` / `[EVENT]` / `Type:`
- `---` between items
- `Instructions:` / `Note to editor:`

When the user gives guidance in chat instead ("these are all from last week",
"file everything under Environment"), pass it through `instructions` rather than
editing their text.

## Reviewing parse output — do this, don't skip it

`ca_parse` returns candidates, not published articles. Before committing, check
and report:

- **Item count.** If the parser returned 3 articles from a document the user
  described as "today's 12 topics", say so and stop. Silent under-segmentation
  is the most common real failure.
- **Dates.** Every item should have a sensible `publication_date`. Anything
  defaulted to today when the source clearly carried a date is a red flag.
- **Categories.** Items with no `category_node_ids` will land uncategorised and
  be effectively invisible. Use `list_current_affairs_categories` to fill gaps
  rather than committing them bare.
- **Truncation.** Bodies that end mid-sentence usually mean a failed extraction,
  not a short article.

Show the user a compact table (title · date · categories · role) and let them
correct it before you commit.

## Committing

**`publish_mode: "review"` is the default.** It stages the batch as drafts in
the admin UI. Only use `"auto"` — which publishes to the live public site
immediately — when the user has explicitly asked to publish, in this
conversation, for this batch. "Post it" is ambiguous; ask.

Commit in batches of ≤ 50 articles so a single failure doesn't lose the run.

After committing, report the returned ids and the admin URL
(`/admin/current-affairs`) so the user can see the result.

## Rewording

`ca_reword` rewrites a passage in house style (`concise`, `expand`, `simplify`,
`exam_tone`, `grammar`) without inventing facts. Use it when the user asks to
tighten or re-tone copy — never silently, and never on a whole batch.

## What not to do

- Don't invent facts, dates, or sources to fill gaps in a document. Flag the gap.
- Don't publish (`auto`) on the user's behalf to "save a step".
- Don't retry a failed commit unchanged — read the error; a 400 is a schema
  problem in what you sent, a 401/403 is the key.
