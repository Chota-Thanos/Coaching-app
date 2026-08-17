---
name: waytoias-assessment-csat
description: Write and post CSAT / Aptitude questions (reasoning, comprehension, numeracy) into the WayToIAS UPSC coaching website's question bank (test series). Use whenever the user asks to write, draft, make or add CSAT questions, aptitude questions, reasoning questions, or comprehension-passage questions for the WayToIAS test series/question bank (e.g. "add some CSAT reasoning questions", "write a comprehension passage with 3 questions for CSAT"). Do NOT use this for GK/general studies questions (use waytoias-assessment-gk) or Mains questions (use waytoias-assessment-mains). Requires the coaching-posting-agent MCP server (whoami, list_exams, assessment_parse, assessment_commit, list_assessment_taxonomy, list_question_natures tools) to be connected.
---

# Writing and posting CSAT / Aptitude questions for WayToIAS

You are the writer — not a tool you call. You write the question(s) yourself,
then hand your plain text to the app's own AI, which files each one into the
right place in the syllabus tree and saves it in the shape the question bank
needs — the same job it already does when a human uploads a question paper.

## The flow

1. `whoami` once per session — confirms the connection works.
2. `list_exams` — get `exam_id`. Normally there is exactly one (UPSC CSE),
   but read it rather than assuming its id.
3. **Write the question(s)** yourself, in the plain format below.
4. **Hand off for filing** — call `assessment_parse` with your text as
   `raw_text`, plus `content_type: "aptitude"` and `exam_id`. It classifies
   each question into the deepest matching taxonomy node itself.
5. **Check what came back** (see "Before you commit"), then call
   `assessment_commit` with `content_type: "aptitude"`. Default
   `publish_mode: "review"` — see "Publishing" below.

**If `whoami` fails, how you reconnect depends on how you're running.**
Running locally (Claude Desktop/Code, spawned on the user's machine): the
user should fully quit and reopen Claude Desktop, or check their MCP config
for a wrong path or key. Running as a **remote/online connected app**
(Gemini's "custom connected app," or similar): a failed `whoami` almost
always means the login expired, not that anything is broken — the server
holds sessions in memory and a routine restart clears them silently. Tell
the user to disconnect and reconnect this app wherever they manage
connected apps for the assistant you're running in, which re-authorises it.

## Format

CSAT covers reading comprehension, logical reasoning, basic numeracy and
data interpretation — not general knowledge. Match the question to whichever
of these the user actually asked for; don't default to comprehension if they
said "reasoning" or "maths".

**Comprehension sets:** several questions can share one passage. Write the
passage once, then the questions under it. When you get to filing, pass the
passage as `passage_title` / `passage_text` on `assessment_commit` rather
than repeating it inside each stem.

**Reasoning / numeracy questions:** same four-option, one-correct-answer,
full-explanation standard as a GK question:

```
Q1. <stem>
(a) <option>
(b) <option>
(c) <option>
(d) <option>

Correct Answer: (b)

Explanation: <why b is right, why a/c/d are wrong>
```

A reasoning question's explanation should walk through the logic step by
step, not just assert the answer — that's the part students are actually
trying to learn.

**Difficulty:** CSAT is not GK-with-easier-facts — genuine CSAT questions
require actually working through a passage or a piece of logic, not
recalling a fact. If a question can be answered by pattern-matching a
keyword rather than reasoning it through, it isn't a good CSAT question —
rewrite it.

## Accuracy — non-negotiable

- **Never invent a `correct_answer`.** If you're not certain, say so rather
  than guessing.
- **The explanation must actually support the stated answer**, and for
  reasoning questions must show the actual working.
- Don't repeat the same passage or logic pattern across a whole batch.

## Taxonomy and Question Nature — checking `assessment_parse`'s work

The taxonomy path is `subject → source_bucket → topic → subtopic`, root to
leaf. Before committing, check every question actually got a
`taxonomy_node_ids` — **`assessment_commit` rejects any question without
one.** If one is missing, use `list_assessment_taxonomy` with
`tree: "objective"` (and `search`) to find the right node yourself rather
than dropping the question.

### Question nature (optional for CSAT — don't force it)

A separate tag from the taxonomy tree — a difficulty/type classification
(this exam's current list is Basic/Intermediate/Advance; check
`list_question_natures` rather than assuming it stays that way). **Unlike
GK, this is never required for CSAT — `assessment_commit` will not reject
a CSAT question for missing one, even when the exam has natures
configured.** A clean difficulty tag doesn't exist for most CSAT questions
the way it does for a GK fact-recall item, so leave it blank rather than
forcing a fit.

`assessment_parse` still auto-classifies `question_nature_id` when it finds
a genuine match — pass that through if it's there. If it's missing, or the
match looks like a stretch, just omit it; there's no need to look one up
yourself or hold the question back over it. If you do want to assign one
deliberately, judge it by how much work the answer actually takes:
**Basic** — a single stated detail or a one-step calculation.
**Intermediate** — connecting two or three details, or a multi-step chain.
**Advance** — synthesising a whole passage, or a reasoning/numeracy chain
with several dependent steps.

## Publishing — read this before every `assessment_commit` call

**Default to `publish_mode: "review"`, always.** This saves the questions as
drafts in the questions manager for a human to check before students see
them.

The server's automatic block on publishing AI-written content live does not
cover this path — from its point of view, you handing over text is the same
as a human pasting in a question paper. **You are the safeguard here, not
the server.** Use `publish_mode: "auto"` only when the user's message, in
this exact request, explicitly asks for the questions to go live
immediately.

Tell the user plainly which happened and where the questions ended up.

## What not to do

- Don't fabricate a `correct_answer` you're not sure of — flag it instead.
- Don't write a "reasoning" question that's actually just a fact-recall
  question in disguise.
- Don't publish live because it seemed like what they'd want — only because
  they asked, in this request.
