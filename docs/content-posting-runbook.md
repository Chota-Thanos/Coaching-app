# Posting content from Claude — runbook

How to send content into WayToIAS from Claude on your PC, and how to control
what it produces.

---

## 1. One-time setup

| Step | Command / place | Notes |
|---|---|---|
| Apply the database change | `npm run db:migrate` | Adds the API-key table (migration 051) |
| Build the connector | `npm --prefix tools/posting-agent-mcp run build` | Re-run after any change to `tools/posting-agent-mcp` |
| Create a key | `npm run api:key -- create abrarsaifi00@gmail.com "claude desktop"` | Printed once, never recoverable |
| Paste the key | `%APPDATA%\Claude\claude_desktop_config.json` | Replace `COACHING_API_KEY` |
| Restart Claude Desktop | Right-click tray icon → **Quit**, reopen | Settings are read only at startup |

Key management:

```bash
npm run api:key -- list
npm run api:key -- revoke <prefix>
```

A key is tied to one database. A local key will not work against
waytoias.com, and vice versa.

---

## 2. Before every session

The app must be running, or every request fails with `fetch failed`:

```bash
npm run dev:api
```

Check the connection in Claude Desktop:

```
Run whoami on the coaching posting agent.
```

Expected: your email, `role: admin`, `is_active: true`.

---

## 3. Posting a document you already have

**Where:** Claude Desktop, new chat. Plain English, no commands.

```
Post this file to current affairs as drafts: C:\path\to\file.docx
```

```
Add these mains questions to the question bank as drafts: C:\path\to\paper.pdf
```

Accepted: `.docx`, `.doc`, `.pdf`, `.txt`, `.md`, `.png`, `.jpg`, `.webp`, or a URL.
Scanned PDFs are read as images automatically.

**What happens**

1. Reads the file.
2. Splits it into separate items, resolves each date, picks categories — applying your saved rules (§5).
3. Shows you what it found. Nothing is saved yet.
4. You confirm.
5. Saves as drafts.

**Say "as drafts" if you want a review step.** Documents you supply are not
gated — the app assumes you have read your own file, so "post this" can publish
straight away. AI-*written* content is the opposite: drafts unless you ask (§6).

**Where drafts land**

| Content | Screen |
|---|---|
| Current affairs | Articles Library, filtered by Draft — open and edit like any article |
| GK questions | `/admin/assessment/objective-questions` |
| CSAT questions | `/admin/assessment/csat-questions` |
| Mains questions | `/admin/assessment/mains-questions` |

---

## 4. The generation pipeline (main use)

One instruction runs the whole chain: research → write to your saved format →
convert to articles → post.

```
Write mains notes on these topics and save as drafts: Fiscal deficit, MPC, Inflation targeting
```

```
Write today's daily current affairs from these links and put them live:
https://... , https://...
```

Behind that: `ca_generate_and_post`. It uses the instructions **and output
format** saved for that exact content type (§5).

| You say | What happens |
|---|---|
| "save as drafts" / nothing | Staged in the admin panel for you to approve |
| "put it live" / "publish it" | Published to the site |
| "show me first" | Generated and converted, nothing written |

**Prefer links over bare topics.** A link is read and used as source material.
A bare phrase gets a web search, which is much weaker.

Always check what it reports back:

- `research` — any topic under `failures` was written **without** source
  material. Verify those facts before approving.
- `warnings` — "custom output format" means check the layout; "no category
  resolved" means it will be filed uncategorised.
- `skipped_empty` — an occasional run returns an item with no usable text;
  those are dropped rather than posted blank.

For questions, use `assessment_generate_questions`,
`assessment_draft_mains_question`, or — best where it applies —
`ca_generate_questions_from_article`, which grounds questions in an article
already on your site.

---

## 5. Controlling the output — rules per content type

One set of rules per content type. The same screen edits an existing set or
creates a new one; there is no separate "add".

### Current affairs

Admin → Current Affairs → **AI Settings**

| Content type | Address |
|---|---|
| Daily News | `/admin/current-affairs/ai-settings/daily-news` |
| Editorial Summaries | `/admin/current-affairs/ai-settings/summaries` |
| Mains Notes | `/admin/current-affairs/ai-settings/mains-notes` |
| Prelims PYQ | `/admin/current-affairs/ai-settings/prelims-pyq` |
| Mains PYQ | `/admin/current-affairs/ai-settings/mains-pyq` |

### Assessment

Admin → Assessment → **AI Settings** — `/admin/assessment/ai-settings`

| Setting name | Applies to |
|---|---|
| Premium GK Quiz | GK questions |
| Premium Passage Quiz | CSAT comprehension |
| Premium Maths Quiz | CSAT maths / reasoning |
| Mains Question Generation | Mains questions |
| Mains Answer AI Evaluation | Marking student answers (not posting) |

### How the rules stack

Last one wins where they disagree:

1. Rules for the content type
2. Rules for the subject, if set
3. What you type in the request

A content type with no rules of its own borrows from a related one — e.g.
Mains Summary falls back to Mains Notes. Every post reports which rules were
applied, so you can see this rather than guess.

---

## 6. What is published, and what is held back

| Source | Goes live when |
|---|---|
| A document you supplied | You ask — it assumes you have read your own file |
| Content the AI wrote | You ask **in that request** |

AI-written content defaults to drafts, enforced in the program itself rather
than by instructions. Publishing it needs a second, explicit confirmation, so it
cannot happen by default or by accident. If you did not ask for it to go live,
it will not.

---

## 7. Putting content in the right section

Categories are **not** set by the rules in §5. Two ways to control them:

**Preferred — state it in the document:**

```
Categories: Economy > Banking & Finance
Categories: Polity > Governance; Economy > Banking
```

`>` goes deeper. `;` files it under more than one. This overrides any guess.

**Otherwise** the AI picks from your live category tree:

- Current affairs → `/admin/current-affairs/categories`
- GK / CSAT → `/admin/assessment/assessment-categories`
- Mains → `/admin/assessment/mains-categories`

Other markers you can put in a document:

| Marker | Effect |
|---|---|
| `Title:` or a heading line | Names that item |
| `Date:` | Sets publication date |
| `[CONCEPT]` / `[EVENT]` | Evergreen explainer vs dated news |
| `---` | Separates two items |
| `Instructions:` | Directions for the AI, not published |

---

## 8. Available tools

| Tool | Writes? |
|---|---|
| `whoami`, `list_exams`, `list_current_affairs_categories`, `list_assessment_taxonomy` | no |
| `list_style_guides`, `list_style_profiles`, `list_question_formats` | no |
| `ca_extract`, `ca_parse`, `ca_reword` | no |
| `ca_commit` | **yes** |
| `assessment_extract`, `assessment_parse` | no |
| `assessment_commit` | **yes** |
| `ca_generate_and_post` | **yes** |
| `ca_generate_articles`, `ca_generate_questions_from_article` | no |
| `assessment_generate_questions`, `assessment_draft_mains_question` | no |

---

## 9. Going live on waytoias.com

Order matters — a key must be created on the database it will be used against.

1. Commit and push.
2. On the server, from `/var/www/coaching`: `bash deploy.sh`
   Pulls, applies migrations, rebuilds, restarts.
3. On the server: `npm run api:key -- create <your-email> "claude desktop"`
4. In `claude_desktop_config.json`, set:
   - `COACHING_API_URL` → `https://waytoias.com`
   - `COACHING_API_KEY` → the key from step 3
5. Restart Claude Desktop.

From then on every save writes to the live site.

---

## 10. When something breaks

| Symptom | Cause | Fix |
|---|---|---|
| `fetch failed` | App not running | `npm run dev:api` |
| `Authentication required` | Key missing or placeholder | Check `claude_desktop_config.json` |
| `Invalid or revoked API key` | Key cancelled, expired, or wrong database | Create a new one |
| No tools in Claude Desktop | Not fully quit, or Store version | Quit from tray; Store path is `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json` |
| Admin pages show "page not found" | Stale build | Delete `apps/web/.next`, restart |
| Held back: contains AI-written content | You did not ask for it to go live | Say "publish it" explicitly, or accept drafts (§6) |
| "none had usable body text" | The output format for that type produced no prose | Check that content type's format in §5 |
| Rules seem ignored | No rules for that type | Check the "applied rules" line in the report; set them in §5 |

---

## 11. Known gaps

- **Email sending is not configured.** Student "Forgot password" silently does
  nothing. Needs mail-server details in `.env`.
- **Claude Desktop does not load the skill files** in `.claude/skills/`. Those
  apply in Claude Code only. In Desktop, state what you want explicitly.
- **The mobile app is not in this repo.** `deploy.sh` does not ship it.
