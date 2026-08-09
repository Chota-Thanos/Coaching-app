# The Claude ↔ WayToIAS connection — how it works and how to fix it

Everything needed to understand, verify, change, or repair the link that lets
Claude (Cowork **and** Claude Code) post content into WayToIAS.

Written after a long debugging session that hit five separate failure modes.
Section 6 is the one to read first when something breaks — every entry there is
a real failure that actually happened, not a hypothetical.

Companion docs: [`content-posting-runbook.md`](content-posting-runbook.md) for
day-to-day posting workflow (note: parts of it assume a local dev server — see
§3), [`deployment.md`](deployment.md) for shipping API changes to production.

---

## 1. What connects to what

```
Claude (Cowork session / Claude Code session)
        │  stdio (MCP protocol)
        ▼
node E:/Coaching App/tools/posting-agent-mcp/dist/index.js     ← local process
        │  HTTPS + X-Api-Key header
        ▼
https://waytoias.com/api/v1/...                                 ← live site
        │
        ▼
production database
```

Four things must all be correct. A failure in any one looks roughly the same
from inside Claude ("server disconnected" or "fetch failed"), which is why
diagnosis has to be done by elimination, not by guessing:

| # | Thing | Where it lives |
|---|---|---|
| 1 | The built server | `tools/posting-agent-mcp/dist/index.js` |
| 2 | The launch config | `%APPDATA%\Claude\claude_desktop_config.json` |
| 3 | The target URL | `COACHING_API_URL` env var in that config |
| 4 | The API key | `COACHING_API_KEY` env var in that config |

The server exposes **19 tools** when healthy (`whoami`, `ca_parse`,
`ca_commit`, `assessment_parse`, `assessment_commit`,
`list_current_affairs_categories`, `list_assessment_taxonomy`, `list_exams`,
and others).

---

## 2. The known-good configuration

Config file: `%APPDATA%\Claude\claude_desktop_config.json`
(= `C:\Users\Abrar\AppData\Roaming\Claude\claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "coaching-posting-agent": {
      "command": "node",
      "args": [
        "E:/Coaching App/tools/posting-agent-mcp/dist/index.js"
      ],
      "env": {
        "COACHING_API_URL": "https://waytoias.com",
        "COACHING_API_KEY": "wtia_73c43ca85470_..."
      }
    }
  }
}
```

**The key is deliberately not written out here** — this file is tracked in git
and the key is a live production credential. Read the real value from the
config file itself, or mint a new one (§7).

**Forward slashes in `args` are mandatory.** See §6.1 — this is the single most
destructive gotcha in this whole system.

Verified working state (2026-08-02): authenticates as `simplifyprep@gmail.com`,
username `Alpha`, role `admin`, against the live site.

---

## 3. Production vs local — the trap that silently loses content

`COACHING_API_URL` decides which **database** content lands in.

| Value | Content goes to | Visible on waytoias.com? |
|---|---|---|
| `https://waytoias.com` | production DB | yes |
| `http://localhost:4000` | your local dev DB | **no** |

This caused a real, confusing incident: the config pointed at
`localhost:4000`, Claude reported "successfully created job #31", and the
article was nowhere on the live site. Nothing was broken — it had been written
to the local database, exactly as instructed.

**An API key is tied to one database.** A local key returns 401 against
production and vice versa. When switching `COACHING_API_URL`, the key must be
switched with it.

If `COACHING_API_URL` is `localhost`, the local API must be running
(`npm run dev:api`) or every call fails with `fetch failed`.

---

## 4. Verifying the connection (in order)

Run these top to bottom; the first failure identifies the layer.

**4.1 — Is the live site reachable and is the key valid?**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://waytoias.com/api/v1/auth/me -H "X-API-Key: <key>"
```

`200` = site and key both fine. `401` = wrong key or wrong database.
Without the header it returns `401` — that alone still proves the site is up.

**4.2 — Does the built server file exist?**

```bash
ls "E:/Coaching App/tools/posting-agent-mcp/dist/index.js"
```

Missing → rebuild: `npm --prefix tools/posting-agent-mcp run build`

**4.3 — Does the server complete an MCP handshake?**

The definitive test. Bypasses Claude entirely:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | COACHING_API_URL="https://waytoias.com" COACHING_API_KEY="<key>" node "E:/Coaching App/tools/posting-agent-mcp/dist/index.js"
```

Healthy output contains `"serverInfo":{"name":"coaching-posting-agent"` and a
list of 19 tools.

**4.4 — Is the config file valid and uncorrupted?**

```bash
node -e "const j=require('C:/Users/Abrar/AppData/Roaming/Claude/claude_desktop_config.json'); const a=j.mcpServers['coaching-posting-agent'].args[0]; console.log(JSON.stringify(a), require('fs').existsSync(a));"
```

Must print the path **and** `true`. If the path looks mangled → §6.1.

**4.5 — Is the app actually running the server?**

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*posting-agent-mcp*" }
```

Empty result while Claude is open = the app is not launching it.

**4.6 — From inside Claude:** call `whoami`. Returns the account and role.

---

## 5. Where to look when it fails

| What | Path |
|---|---|
| Server's own log | `%APPDATA%\Claude\logs\mcp-server-coaching-posting-agent.log` |
| App log (server lists, load/reload) | `%APPDATA%\Claude\logs\main.log` |
| The settings UI | Settings → **Developer** (under "Desktop app") → Local MCP servers |

Useful `main.log` searches:

- `Calling SDK with N total servers` — lists every registered server by name.
  If `coaching-posting-agent` is absent, the app never loaded it.
- `"name": "coaching-posting-agent"` — shows `status` and `toolCount`.

**Reading timestamps matters.** If the server log has no entries since hours
ago but the app restarted since, the app never attempted to spawn it — a
different problem from the server starting and crashing.

---

## 6. Failure modes actually encountered

### 6.1 Backslashes in the path silently corrupt it — **most important**

In JSON, `\t` means *tab*. A Windows path written with single backslashes:

```json
"args": ["E:\Coaching App\tools\posting-agent-mcp\dist\index.js"]
```

is parsed as `E:Coaching App<TAB>oolsposting-agent-mcpdistindex.js` — the `\t`
became a tab, `\p`/`\d`/`\i` lost their backslashes. Node is handed a
nonexistent filename and exits immediately. Claude shows **"Server
disconnected"**, which sounds like a network problem but is not.

The settings UI displays the *parsed* value, so the corruption is visible
there as a mangled Arguments line — a reliable tell.

**Always use forward slashes:** `E:/Coaching App/tools/.../index.js`. Windows
and Node both accept them and they cannot be misparsed. (Doubled backslashes,
`E:\\Coaching App\\...`, are also valid JSON but are easy to mangle again when
writing the file through a shell — forward slashes are the safe default.)

### 6.2 The app owns the config file — external edits get reverted

Claude Desktop keeps MCP settings in its own memory and **rewrites
`claude_desktop_config.json` from that memory**, overwriting outside edits,
including on quit. Observed directly: a corrected file written at 21:53 was
overwritten with the old broken value at 22:00.

Consequence: **editing the file with a text editor or script is unreliable.**
Once the app has a bad value cached, it will keep restoring it.

**The fix that works:** Settings → Developer → Local MCP servers → delete the
entry with the trash icon (clears the cached value), then **Edit Config**,
paste the corrected JSON, save, restart the app.

### 6.3 The app can drop `mcpServers` entirely

Once, the app rewrote the config and removed the whole `mcpServers` block
(file shrank 2009 → 1216 bytes). Symptoms: nothing in the settings UI, no
`node` process, tools absent everywhere. Fix: re-add via **Edit Config**.

### 6.4 Pointing at localhost while expecting live content

See §3. Reports success, content invisible on the site.

### 6.5 "Restarted the app" often isn't a real restart

Closing the window leaves Claude running. A genuine restart is tray icon →
**Quit** (verify with `Get-Process claude`). Config is read only at startup.

---

## 7. Making changes safely

**Changing the target site or key** — via Settings → Developer → Edit Config
(§6.2), never by editing the file directly. Restart afterwards.

**Minting a key:**

```bash
npm run api:key -- create <admin-email> "claude desktop"
npm run api:key -- list
npm run api:key -- revoke <prefix>
```

Shown once, never recoverable. Must be created against the same database the
URL points to.

**Changing the MCP server's own code** (`tools/posting-agent-mcp/src/`):

```bash
npm --prefix tools/posting-agent-mcp run build
```

then restart Claude Desktop. The app runs `dist/`, not `src/` — forgetting the
rebuild means the old behaviour persists with no error.

**Changing the API's behaviour** (`apps/api/`): needs a production deploy
before Claude sees it — see [`deployment.md`](deployment.md).

---

## 8. Behaviour worth knowing when using the connection

- **`publish_mode: "review"` creates a real draft article** in the Articles
  Library (filter by Draft), editable in the normal editor. It does *not* go to
  the AI Ingestion page. Changed in commit `5fc36ed`; the earlier ingestion-queue
  path lost content.
- **Article bodies are HTML, never Markdown.** The parsing prompt requires HTML
  (`<p>`, `<h2>`, `<strong>`, `<ul><li>`); a converter also rescues any Markdown
  that slips through and emits a warning. Commit `4c11fe4`. Markdown left in a
  body renders to readers as literal `##` and `*`.
- **Category markers are authoritative but fall back quietly.** An unmatched
  `Categories:` value maps to the nearest node and returns a warning — read the
  warnings, and pass explicit `category_node_ids` when it matters.
- **The "never auto-publish" guardrail lives in the MCP layer**
  (`tools/posting-agent-mcp/src/provenance.ts`), *not* in the website API. The
  raw API will publish immediately if called with `publish_mode: "auto"` —
  by design, since staff and other integrations need that.

---

## 9. Correcting content that is already posted

Added 2026-08-02. News articles and concept primers are rows in the same table
separated only by `article_role` (`event` vs `concept`), so one set of tools
corrects both.

Three tools, meant to be used in order:

| Tool | Purpose |
|---|---|
| `ca_find_articles` | Search posted content by text; returns ids. Searches every status, drafts included |
| `ca_get_article` | Read one article in full, including its current body |
| `ca_update_article` | Change only the fields supplied; everything else untouched |

**Always find → read → change.** An id guessed from a title is the one mistake
here that silently rewrites the wrong article.

**Every edit needs `confirm_change: "user-approved"` — drafts included.**
(Tightened 2026-08-08, commit `5276004`; originally only published articles
were gated, which meant a draft could be revised silently. Posted content is
the user's to change, not the agent's to revise on its own judgement.) A
**published** article needs `confirm_live_edit: "update-live-article"` as
well, since the change is visible to students immediately. *Unpublishing is
exempt from the live-edit gate only* — setting `status: "draft"` on a wrong
live article still needs `confirm_change`, but not `confirm_live_edit`, since
taking bad content down is the safe direction. The tool refuses with an
explanatory error rather than editing, so neither guardrail can be tripped by
accident.

`body` must be the **complete replacement** as HTML — not a fragment, not a
diff. Markdown is converted automatically (§8), but only once the API change
in commit `5ee5308` is deployed; before that, send HTML.

No database migration and no new endpoint were needed — `PATCH
/api/v1/current-affairs/articles/:id` already existed and accepts every
creatable field. Regression cover in `article-update.test.ts` (5 tests, real
DB, self-cleaning) including a concept-post case.

---

## 10. Linking Editorial Summaries to their Mains Note topic

Added 2026-08-09. The same many-to-one shape as event → concept (§1), for the
Mains-prep side of current affairs: many dated Editorial Summaries
(`daily_editorial_summary`) each feed pointers into one durable Mains Note
topic (`mains_topic_note`) over time — several India-China summaries across
months all belong under one "India-China Relations" note.

One tool, `ca_link_mains_summary` — but it only **records the link**.
Merging a summary's pointers into the topic's body is a separate
`ca_update_article` call, so there is exactly one place that asks for edit
confirmation, not two:

1. `ca_find_articles` (content_kind `mains_topic_note`) — is there already a
   topic for this entity?
2. If yes: read it, identify which dimension(s) the summary actually adds
   to, propose the specific addition to the user, wait for agreement.
3. On agreement: `ca_update_article` to merge the pointers into the topic's
   body (`confirm_change`, plus `confirm_live_edit` if published), then
   `ca_link_mains_summary` (`confirm_change`) to record the relation.
4. If no topic exists: propose creating one — **never created
   automatically**, unlike `ca_link_concept`'s concept-composing branch. On
   agreement, it's written through the normal mains-notes posting flow, then
   linked.

Reuses the generic `article_relations` table with `relation_type:
"mains_fodder"` — a type that already existed in the schema, unused, before
this. No migration, no new endpoint.

**A real race was caught and fixed while testing this live**: two
near-simultaneous calls can both pass the "already linked?" pre-check before
either write lands, so the second hits the database's own unique constraint
`(source_article_id, target_article_id, relation_type)` instead. That 409 is
now caught and reported as `"already linked"`, the same as the pre-check
path, rather than surfaced as a raw error. The constraint itself is the real
guarantee against a duplicate row; the pre-check is only there to avoid an
unnecessary round-trip in the normal, sequential case.

---

## 11. Skill files

Eight standalone Cowork skills live in `tools/cowork-skills/` (five current
affairs, three assessment), packaged as `.skill` files and uploaded via
Claude's Skills settings. They carry the writing structure; the connection
described here is what they post through.

Article structure inside a skill is **freely editable** — section names, order,
length and depth are just body text to the pipeline. Only three things are
load-bearing: a **title line** above each item, and the **`Categories:`** and
**`Date:`** marker lines. Content type comes from which skill/tool is used, not
from the text.
