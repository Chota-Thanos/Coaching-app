# Cowork skills for WayToIAS

Claude Skills for Claude.ai / Claude Desktop / Cowork — a different mechanism
from `.claude/skills/`, which only Claude Code reads. These are packaged and
installed through Claude's own **Settings → Capabilities → Skills**, not by
anything in this repo. Nothing here is deployed to the server; editing these
files has no effect until the resulting `.skill` file is re-uploaded.

## Eight standalone skills, one per content type

Each content type is its own fully independent skill — not a shared bundle.
A skill can't borrow instructions from another skill, so each one carries its
own complete copy of the workflow and the accuracy/date/source rules, not
just the parts unique to it. That's the tradeoff for each one triggering
precisely and being editable/removable on its own.

**Current affairs** (→ `ca_parse` / `ca_commit`, `content_kind`):

| Skill | `content_kind` |
|---|---|
| `waytoias-ca-daily-news` | `daily_current_affairs` |
| `waytoias-ca-editorial-summary` | `daily_editorial_summary` |
| `waytoias-ca-mains-notes` | `mains_topic_note` |
| `waytoias-ca-prelims-pyq` | `prelims_pyq` |
| `waytoias-ca-mains-pyq` | `mains_pyq` |

**Assessment / question bank** (→ `assessment_parse` / `assessment_commit`,
`content_type`):

| Skill | `content_type` |
|---|---|
| `waytoias-assessment-gk` | `gk` |
| `waytoias-assessment-csat` | `aptitude` |
| `waytoias-assessment-mains` | `mains` |

## Why they don't write JSON

Each teaches Claude to research and write full prose directly — not the
JSON-schema payloads `apps/api/.../content-type-prompts.ts` sends to the
app's *own* AI. That file still exists and still works (the
`ca_generate_and_post` pipeline etc.) — this is a second, independent path
where Claude itself is the writer instead of directing the app's AI to write.

Both paths end at the same filing tools (`ca_parse`/`ca_commit`,
`assessment_parse`/`assessment_commit`) via the `coaching-posting-agent` MCP
server, so a document Claude writes is filed exactly like one a human
uploaded — nothing new was built there.

## Using one as a template for a new content type

Since each skill is self-contained, copying one is a clean starting point —
duplicate the closest match (e.g. `waytoias-ca-daily-news` for another
current-affairs type, `waytoias-assessment-gk` for another question type),
then edit: the `name`/`description` in the frontmatter, the `content_kind` /
`content_type` value in every tool-call instruction, and the "Format"/
"Structure" section. The shared rules (accuracy, sources, dates, publishing)
can usually be copied unchanged.

## Rebuilding after an edit

```bash
cd tools/cowork-skills
# from the skill-creator skill's own directory, PYTHONIOENCODING=utf-8 avoids
# a Windows console crash on its emoji output:
PYTHONIOENCODING=utf-8 python -X utf8 -m scripts.package_skill "$(pwd)/waytoias-ca-daily-news"
# ...repeat per skill you changed
```

Then re-upload the produced `.skill` file in Skills settings — it replaces
the previous version under the same name.

## A gap worth knowing about

The MCP server's code-level rule — AI-written content can't publish live
without an explicit confirmation — only recognises content that passed
through the app's own generation tools (`ca_generate_and_post` and friends).
Content Claude writes directly and hands to `ca_parse`/`assessment_parse`
then `ca_commit`/`assessment_commit` is indistinguishable, at the code level,
from a document a human uploaded, so that check does not fire here.

Every one of the 8 skills carries the instruction-level version of the same
rule — default to `publish_mode: "review"`, only use `"auto"` when explicitly
asked in that request — but that is enforced by the skill being followed,
not by code that cannot be talked past. If stronger, code-level enforcement
is wanted for this path too, it needs a way to tell "Claude wrote this" apart
from "a real uploaded document said this," which doesn't exist yet.
