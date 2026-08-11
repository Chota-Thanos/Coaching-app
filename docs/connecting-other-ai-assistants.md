# Connecting another AI assistant to WayToIAS

How to let an AI assistant other than Claude Desktop post to and manage
content on waytoias.com — as a fallback when Claude's limits are used up, or
to run two assistants side by side.

Companion docs: [`claude-mcp-connection.md`](claude-mcp-connection.md) for how
the connection works and how to repair it, and
[`content-posting-runbook.md`](content-posting-runbook.md) for day-to-day
posting.

**Everything below assumes the assistant runs on this machine** and can
spawn a local process — true for desktop apps like ChatGPT desktop or
Cursor. If the product you want to connect runs somewhere else entirely (a
hosted web app, a cloud agent platform) and has no way to launch a local
process, it needs a URL instead — see
[`claude-mcp-connection.md` §11](claude-mcp-connection.md#11-remote-access--connecting-a-client-that-cant-run-a-local-process)
for the remote HTTP option, which is a materially different security
picture (a public endpoint, not a file only you can run) and worth reading
in full before setting up.

---

## 1. What you are connecting to

The connector is a small local program — an **MCP server** — that sits
between an assistant and your website:

```
Any MCP-capable AI assistant
        │  stdio (MCP protocol, an open standard)
        ▼
node E:/Coaching App/tools/posting-agent-mcp/dist/index.js
        │  HTTPS + X-Api-Key header
        ▼
https://waytoias.com
```

**Nothing in it is Claude-specific.** MCP is an open standard, so any
assistant that speaks it runs the same program, with the same API key, and
gets the same tools and the same safety rules.

### What transfers automatically

All **25 tools**, and every guardrail — because those live inside the
connector, not inside the assistant:

- refusal to publish AI-written content without explicit confirmation
- `confirm_change` required before editing anything already posted
- `confirm_live_edit` on top of that for published articles
- `confirm_new_concept` before a Mains Note creates a concept page
- automatic Markdown → HTML conversion of article bodies
- category filing and date resolution through your site's own Gemini
  classifier

A different assistant cannot bypass these by being a different model.

### What does NOT transfer

**The skill files.** The eight Cowork skills in `tools/cowork-skills/` hold
the writing structure — section formats, research rules, the concept bar,
the review-by-default rule. They are packaged in Claude's format and mean
nothing to another assistant.

Another assistant will have the tools but no idea what a WayToIAS daily-news
article should look like. Porting that guidance is the real work; see §6.

---

## 2. Before you start

You need three things on the machine that will run the assistant:

| Requirement | How to check |
|---|---|
| Node.js installed | `node --version` — currently **v22.14.0** here |
| The connector built | `ls "E:/Coaching App/tools/posting-agent-mcp/dist/index.js"` |
| An API key for the target site | §3 |

If the built file is missing, rebuild it:

```bash
npm --prefix tools/posting-agent-mcp run build
```

Node's full path on this machine, needed if a tool can't find `node` on its
own PATH:

```
C:/Program Files/nodejs/node.exe
```

---

## 3. Step 1 — Mint a separate API key

**Do not reuse the key Claude Desktop uses.** One key per assistant means you
can see which one posted what, and revoke one without breaking the other.

```bash
npm run api:key -- create simplifyprep@gmail.com "chatgpt desktop"
```

Name it after the assistant so the list stays readable. The key is printed
**once and is never recoverable** — copy it immediately.

Managing keys:

```bash
npm run api:key -- list
npm run api:key -- revoke <prefix>
```

**A key is tied to one database.** A key minted against your local dev
database returns 401 against waytoias.com, and vice versa. This is the single
most common cause of "it says success but nothing appears on the site" — see
§7.

---

## 4. Step 2 — Add the connector to the assistant

Every MCP client uses near-identical configuration. The block is the same;
only the filename and the wrapper key differ.

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
        "COACHING_API_KEY": "the-new-key-you-just-minted"
      }
    }
  }
}
```

Where each client keeps it:

| Client | Location | Note |
|---|---|---|
| ChatGPT desktop | Settings → Connectors / Developer mode | |
| Cursor | `~/.cursor/mcp.json` | |
| VS Code (Copilot agent mode) | `.vscode/mcp.json` | uses `"servers"`, **not** `"mcpServers"` |
| Gemini CLI, open-source agents | their own `settings.json` equivalent | |

**Verify the current location in that vendor's own documentation.** These
menus move between versions; the JSON block is the stable part.

### Two rules that cause most failures

1. **Use forward slashes in the path.** `E:/Coaching App/...`, never
   `E:\Coaching App\...`. In JSON, `\t` means a tab character, so a Windows
   path with single backslashes silently becomes
   `E:Coaching App<TAB>oolsposting-agent-mcpdistindex.js` — a file that does
   not exist. The assistant then reports "server disconnected", which sounds
   like a network fault and is not. This cost hours once; see
   `claude-mcp-connection.md` §6.1.

2. **If `node` is not found, use its full path** in `command`:
   `C:/Program Files/nodejs/node.exe`.

### Optional settings

| Variable | Default | Use |
|---|---|---|
| `COACHING_API_URL` | `http://localhost:4000` | **Always set this to `https://waytoias.com`** for the live site |
| `COACHING_API_KEY` | — | Required |
| `COACHING_API_TIMEOUT_MS` | `180000` | Raise only if long documents time out |

---

## 5. Step 3 — Verify before trusting it

Restart the assistant **fully** (quit, not just close the window — MCP
servers are read only at startup), then ask it to run `whoami`.

A correct setup returns your admin account:

```json
{ "id": 2, "email": "simplifyprep@gmail.com", "username": "Alpha", "role": "admin" }
```

If it fails, test the connector on its own, bypassing the assistant
entirely — this is the fastest way to tell whether the problem is the
connector or the client:

```bash
printf '%s\n' \
'{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
'{"jsonrpc":"2.0","method":"notifications/initialized"}' \
'{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
| COACHING_API_URL="https://waytoias.com" COACHING_API_KEY="<key>" \
  node "E:/Coaching App/tools/posting-agent-mcp/dist/index.js"
```

Healthy output names the server and lists 25 tools. If this works but the
assistant still fails, the fault is in the client's config, not the
connector.

---

## 6. Step 4 — Give it the writing rules

Without this the assistant has the tools but no editorial guidance, and will
post something structurally wrong.

The source of truth is `tools/cowork-skills/`. For each content type you
want that assistant to handle, open its `SKILL.md` and paste the body into
whatever the assistant calls custom instructions, a system prompt, a project
file, or an agent definition.

| Skill folder | Covers |
|---|---|
| `waytoias-ca-daily-news` | Daily current affairs (largest — the Format Library lives here) |
| `waytoias-ca-editorial-summary` | Editorial / opinion summaries |
| `waytoias-ca-mains-notes` | Durable Mains topic notes |
| `waytoias-ca-prelims-pyq` | Prelims MCQs for Current Affairs |
| `waytoias-ca-mains-pyq` | Mains questions for Current Affairs |
| `waytoias-assessment-gk` | GK / Prelims question bank |
| `waytoias-assessment-csat` | CSAT / aptitude question bank |
| `waytoias-assessment-mains` | Mains question bank |

**Strip the YAML frontmatter** (everything between the opening and closing
`---` at the top). That block is Claude's skill-discovery metadata and is
meaningless elsewhere.

Practical notes:

- **Start with one content type.** Get daily news working end to end before
  adding the rest. The skills are long, and most assistants have an
  instruction-length limit.
- If instructions must be trimmed, keep in this order: the structure/Format
  Library, the research and accuracy rules, the review-by-default rule.
  Drop the worked examples first.
- Skills reference each other (`waytoias-ca-mains-notes` mentions the
  daily-news Format Library). If you port only one, that cross-reference
  will dangle — paste the referenced section too, or delete the sentence.

---

## 7. Safety: what to be careful about

**The guardrails live in the connector, not the website.** Anything that
talks to the REST API *directly* — a script, an automation platform, a
custom GPT Action — bypasses every rule listed in §1. The raw API will
publish live immediately if asked, by design, because your staff and other
integrations need that.

So:

- Prefer the MCP route (§4) over direct API calls. It is the same key and
  the same endpoints, but with the safety rules in front of them.
- If you must call the API directly, always send `publish_mode: "review"` so
  content lands as a draft.
- Mint a separate key per system, so one can be revoked without disturbing
  the others.

**Point at production deliberately.** If `COACHING_API_URL` is left at its
`http://localhost:4000` default, the assistant will report successful posts
that went into a local database and never appear on the site. This has
already happened once and was genuinely confusing to diagnose.

---

## 8. Quick reference

```bash
# Rebuild the connector after changing its source
npm --prefix tools/posting-agent-mcp run build

# Mint / list / revoke keys
npm run api:key -- create <admin-email> "<label>"
npm run api:key -- list
npm run api:key -- revoke <prefix>

# Is the site up and the key valid? 200 = both fine, 401 = wrong key/database
curl -s -o /dev/null -w "%{http_code}\n" \
  https://waytoias.com/api/v1/auth/me -H "X-API-Key: <key>"
```

Checklist for a new assistant:

- [ ] Node available; connector built
- [ ] Separate API key minted and labelled
- [ ] Config added, **forward slashes**, `COACHING_API_URL` set to `https://waytoias.com`
- [ ] Assistant fully quit and reopened
- [ ] `whoami` returns the admin account
- [ ] Writing rules pasted in, frontmatter stripped
- [ ] One test article posted as a **draft** and checked in the Articles Library

---

## 9. The other fallback — your site's own AI

Worth knowing before setting any of this up: your platform's built-in
generation runs on **Gemini**, not Claude, and is reachable from the admin
panel with no configuration at all. If the goal is simply "Claude ran out
today", that path already exists and costs nothing to set up — see the AI
posting agent in the Current Affairs admin section.

Connecting a second assistant is worth doing when you want another one
working *the way Claude does* — same tools, same guardrails, same skills.
