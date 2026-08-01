# Cowork skills for WayToIAS

Claude Skills for Claude.ai / Claude Desktop / Cowork — a different mechanism
from `.claude/skills/`, which only Claude Code reads. These are packaged and
installed through Claude's own **Settings → Capabilities → Skills**, not by
anything in this repo. Nothing here is deployed to the server; editing these
files has no effect until the resulting `.skill` file is re-uploaded.

## Why two skills, and why they don't write JSON

`waytoias-current-affairs-writer` and `waytoias-assessment-writer` each teach
Claude to research and write content directly — full prose, not the
JSON-schema payloads `apps/api/.../content-type-prompts.ts` sends to the app's
*own* AI. That file still exists and still works (§ generation pipeline,
`ca_generate_and_post` etc.) — this is a second, independent path where Claude
itself is the writer instead of directing the app's AI to write.

Both paths end at the same place: the app's existing `ca_parse`/`ca_commit` and
`assessment_parse`/`assessment_commit` tools (via the `coaching-posting-agent`
MCP server), which classify, date and file the content exactly as they do for
an uploaded document — nothing new was built there.

## Rebuilding after an edit

```bash
cd tools/cowork-skills
# from the skill-creator skill's own directory, PYTHONIOENCODING=utf-8 avoids
# a Windows console crash on its emoji output:
PYTHONIOENCODING=utf-8 python -X utf8 -m scripts.package_skill "$(pwd)/waytoias-current-affairs-writer"
PYTHONIOENCODING=utf-8 python -X utf8 -m scripts.package_skill "$(pwd)/waytoias-assessment-writer"
```

Then re-upload the produced `.skill` file in Skills settings — it replaces the
previous version under the same name.

## A gap worth knowing about

The MCP server's code-level rule — AI-written content can't publish live
without an explicit confirmation — only recognises content that passed
through the app's own generation tools (`ca_generate_and_post` and friends).
Content Claude writes directly and hands to `ca_parse`/`ca_commit` is
indistinguishable, at the code level, from a document a human uploaded, so
that check does not fire here.

Both `SKILL.md` files carry the instruction-level version of the same rule —
default to `publish_mode: "review"`, only use `"auto"` when explicitly asked in
that request — but that is enforced by the skill being followed, not by code
that cannot be talked past. If stronger, code-level enforcement is wanted for
this path too, it needs a way to tell "Claude wrote this" apart from "a real
uploaded document said this," which doesn't exist yet.
