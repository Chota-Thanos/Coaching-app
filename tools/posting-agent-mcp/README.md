# Posting-agent MCP server

Lets an AI agent running on your machine post content into the live app —
current affairs, editorials, concept primers, study notes, and GK/CSAT/Mains
questions — by driving the admin posting endpoints that already exist in the
API.

It is deliberately a **transport, not a second brain**. Extraction (Word / PDF /
scanned-PDF OCR / URL), AI segmentation, date resolution, taxonomy
classification and publishing all run server-side, in the same code paths the
admin UI uses. Nothing is duplicated locally, so the two can't drift apart.

The editorial judgement — which content kind to use, what to check before
committing, when to publish versus stage for review — lives in the skills at
`.claude/skills/post-current-affairs/` and `.claude/skills/post-assessment-questions/`.

```
   your machine                             the app
┌──────────────────┐   stdio   ┌──────────┐  HTTPS + API key  ┌─────────────┐
│ Claude Code      │◀─────────▶│   MCP    │──────────────────▶│  Fastify    │
│  + skills        │           │  server  │                   │  admin API  │
└──────────────────┘           └──────────┘                   └─────────────┘
                                                                     │
                                                              extract → parse
                                                              → classify → commit
```

## Setup

### 1. Apply the migration

The API key table ships in `database/migrations/051_auth_api_keys.sql`.

```bash
npm run db:migrate
```

### 2. Mint a key

Bind it to an admin (or content-editor) account. The key authenticates *as* that
user, inheriting exactly its permissions — it is not a parallel permission
system.

```bash
npm run api:key -- create you@example.com "local posting agent"
```

The secret prints once and is not recoverable. Only its SHA-256 hash is stored.

Other commands:

```bash
npm run api:key -- list
npm run api:key -- revoke <key-prefix>
```

### 3. Build the server

```bash
npm --prefix tools/posting-agent-mcp install
npm --prefix tools/posting-agent-mcp run build
```

### 4a. Claude Desktop and Cowork

Claude Desktop reads `mcpServers` from its own config and **bridges those servers
into Cowork's sandbox**, so one entry covers both — no public hosting and no
OAuth needed.

Windows (standard install): `%APPDATA%\Claude\claude_desktop_config.json`
(Microsoft Store install:
`%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "coaching-posting-agent": {
      "command": "node",
      "args": ["E:\\Coaching App\\tools\\posting-agent-mcp\\dist\\index.js"],
      "env": {
        "COACHING_API_URL": "http://localhost:4000",
        "COACHING_API_KEY": "wtia_..."
      }
    }
  }
}
```

Restart Claude Desktop fully afterwards, then ask it to run `whoami` to confirm.

A **remote** MCP server (Streamable HTTP + OAuth, hosted on the VPS) is only
needed if you want to reach this from a device that never runs Claude Desktop —
a phone, or a colleague's machine. Anthropic's cloud connects to remote
connectors from its own IP ranges, so such a server must be publicly reachable
and properly authenticated; the SDK ships both pieces
(`server/streamableHttp.js`, `server/auth/router.js`).

### 4b. Point it at an environment

`.mcp.json` at the repo root already registers the server. Set the two env vars
in your shell (or your Claude Code settings) before starting Claude Code:

```bash
export COACHING_API_KEY=wtia_...
export COACHING_API_URL=http://localhost:4000   # or https://your-domain
```

`COACHING_API_URL` defaults to `http://localhost:4000`. **Point it at production
only when you mean it** — `ca_commit` and `assessment_commit` with
`publish_mode: "auto"` write straight to the live public site.

## Tools

### Lookups

| Tool | What it does |
|---|---|
| `whoami` | Verifies the key; returns the account and role |
| `list_exams` | Exam ids for assessment posting |
| `list_current_affairs_categories` | Category tree → `category_node_ids` |
| `list_assessment_taxonomy` | Objective or mains tree → `taxonomy_node_ids` |
| `list_style_guides` | Article writing styles → `style_guide_id` |
| `list_style_profiles` | Question writing styles → `style_profile_id` |
| `list_question_formats` | Question shapes → `question_format_id` |

### Posting — moves a document you supply onto the site

| Tool | Writes? | What it does |
|---|---|---|
| `ca_extract` | no | Word/PDF/image/URL → raw text |
| `ca_parse` | no | Segment, date, classify, normalise → candidates |
| `ca_commit` | **yes** | Publish (`auto`) or stage as drafts (`review`) |
| `ca_reword` | no | House-style rewrite of a passage |
| `assessment_extract` | no | Word/PDF/image/URL → raw text |
| `assessment_parse` | no | Split into questions, classify into taxonomy |
| `assessment_commit` | **yes** | Publish or save as drafts to the question bank |

### Generation — creates content nobody has read

`ca_generate_and_post` writes; the rest return drafts that go back through
`ca_commit` / `assessment_commit`.

Publishing defaults to drafts. Sending AI-written content live additionally
requires `confirm_publish_ai_content`, enforced in the server — so it cannot
happen by default, by accident, or because a model decided it was reasonable.

| Tool | What it does |
|---|---|
| `ca_generate_and_post` | **The pipeline.** Topics/URLs → researched, formatted, categorised, posted |
| `ca_generate_articles` | Generation only, raw structure out (prefer the pipeline tool) |
| `ca_generate_questions_from_article` | Questions grounded in one published article |
| `assessment_generate_questions` | GK/CSAT questions from a prompt |
| `assessment_draft_mains_question` | One Mains question with directive/marks/word limit |

**Check the `research` block** that `ca_generate_articles` returns:
`{ topics_total, topics_grounded, failures[], warning? }`. Any topic in
`failures` was written without grounding material — the search was blocked or
the source URL was unreachable — and its specifics need verifying before
publication.

## Notes

- **`review` is the safe default.** Both commit tools accept
  `publish_mode: "review"`, which stages content as drafts for a human to
  approve in the admin UI. The skills instruct the agent to use it unless you
  explicitly ask to publish.
- **AI credentials are server-side.** The parse tools need the API's own
  `GEMINI_API_KEY` / Vertex / `OPENAI_API_KEY` configuration. A 5xx from a parse
  call usually means the server has no AI credentials or has hit a quota, not
  that the MCP server is broken.
- **Timeouts.** Long documents can take minutes to parse. The client waits
  `COACHING_API_TIMEOUT_MS` (default 180000).
- **Revoke, don't rotate silently.** If a key might have leaked,
  `npm run api:key -- revoke <prefix>` takes effect on the next request.
