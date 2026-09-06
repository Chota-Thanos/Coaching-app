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

## Pictures

Two separate things, and they are not interchangeable:

- **`ca_attach_image`** sets the article's single header picture — the one that
  shows in listings and as the social preview.
- **`ca_insert_body_image`** puts a picture *between two blocks of the body* — a
  diagram after the paragraph it explains. `after_block: 0` places it above
  everything, omitting it appends at the end; count blocks with `ca_get_article`
  first. Adding a picture is not a factual correction, so unlike
  `ca_update_article` this needs no `confirm_change`.

Both work on any content kind and on drafts as well as published articles.

### Supplying the image

Three ways, and picking the wrong one is the usual reason an upload "does
nothing". Prefer them in this order:

1. **`image_base64`** — the image itself, raw base64 or a full
   `data:image/png;base64,...` URI. Works from anywhere. Use this whenever you
   are holding a picture you generated or were handed, with nowhere to put it.
2. **`image_url`** — a public http/https URL the server downloads. Private
   addresses are refused, so a `localhost` or `192.168.*` URL will not work.
3. **`file_path`** — read *by the MCP server process*, not by you. Only use it
   when that process runs on the same machine as the file. Over a remote
   connection it cannot see your disk, and this is the option that silently
   fails.

Uploads are resized and re-encoded server-side (longest edge 1600px, WebP),
so send the original — do not shrink it yourself. Max 10MB; .png, .jpg,
.jpeg, .webp, .gif.

`ca_commit`'s `image` field is **not** an upload path. It records only a real
`url`; an `alt_text` or `search_query` on its own describes a picture that does
not exist and is now discarded rather than stored. To put a real picture on an
article, commit it first and then call one of the two tools above.

### Annotating a source image (Editorial Summaries only)

If the user hands you a photo/diagram alongside an Editorial Summary
(`daily_editorial_summary`) and asks for it to be annotated, draw the
article's major points onto it before attaching it — don't attach the source
image as-is.

One-time setup, if not already done: `pip install -r scripts/requirements.txt`
from this skill's directory.

1. From the drafted/reviewed article body, pick 3–6 major points. For each,
   write a short point (one sentence) and a short free-form dimension label
   — a couple of words naming what angle that point is ("Constitutional
   angle", "Economic impact", "Judicial precedent"). Pick labels fresh per
   article; there's no fixed list to choose from. Reused labels across points
   share a colour automatically.
2. Write those to a JSON file, e.g.:
   ```json
   [
     {"text": "Nine-judge bench widens the definition of 'industry' beyond commercial activity.", "dimension": "Judicial precedent"},
     {"text": "Extends labour protections to charitable and quasi-governmental bodies.", "dimension": "Labour rights"}
   ]
   ```
3. Run the script:
   ```
   python scripts/annotate_image.py --source <path-to-photo> --points <path-to-json> --out <path-to-annotated.png>
   ```
4. Read the output PNG yourself before attaching it — check the labels are
   legible and say what you meant, not truncated or misassigned. Re-run with
   adjusted points if not.
5. Once the article is committed (`ca_commit`), attach the annotated image
   using the article id from the commit result — `ca_attach_image` if it is the
   article's header picture, `ca_insert_body_image` with an `after_block` if it
   belongs beside the points it illustrates.
6. Report back what was attached the same way a commit is reported — id and
   admin URL.

## Rewording

`ca_reword` rewrites a passage in house style (`concise`, `expand`, `simplify`,
`exam_tone`, `grammar`) without inventing facts. Use it when the user asks to
tighten or re-tone copy — never silently, and never on a whole batch.

## What not to do

- Don't invent facts, dates, or sources to fill gaps in a document. Flag the gap.
- Don't publish (`auto`) on the user's behalf to "save a step".
- Don't retry a failed commit unchanged — read the error; a 400 is a schema
  problem in what you sent, a 401/403 is the key.
- Don't report that a picture was attached because a tool returned without an
  error — check the result carries a `file_url`, and say so with the id. An
  asset row is not the same thing as an image.
- Don't reach for `file_path` first. If the MCP server is remote it cannot see
  your disk, and the failure looks like the tool being missing rather than the
  path being wrong.
