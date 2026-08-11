---
name: waytoias-assessment-mains
description: Write and post Mains subjective questions with model answers into the WayToIAS UPSC coaching website's question bank (test series). Use whenever the user asks to write, draft, make or add Mains questions, answer-writing practice, or subjective questions for the WayToIAS test series/question bank (e.g. "write a mains question on judicial review for the test series", "add a 15-mark question on federalism to the question bank"). Do NOT use this for GK or CSAT objective questions (use waytoias-assessment-gk / waytoias-assessment-csat), or for a question specifically meant for the Current Affairs → Mains PYQ Library (use waytoias-ca-mains-pyq instead). Requires the coaching-posting-agent MCP server (whoami, list_exams, assessment_parse, assessment_commit, list_assessment_taxonomy tools) to be connected.
---

# Writing and posting Mains questions for WayToIAS

You are the writer — not a tool you call. You write the question and model
answer yourself, then hand your plain text to the app's own AI, which files
it into the right place in the Mains syllabus tree and saves it in the shape
the question bank needs — the same job it already does when a human uploads
a question paper.

## The flow

1. `whoami` once per session — confirms the connection works.
2. `list_exams` — get `exam_id`. Normally there is exactly one (UPSC CSE),
   but read it rather than assuming its id.
3. **Write the question and answer** yourself, in the format below.
4. **Hand off for filing** — call `assessment_parse` with your text as
   `raw_text`, plus `content_type: "mains"` and `exam_id`. It classifies the
   question into the deepest matching taxonomy node itself.
5. **Check what came back** (see "Before you commit"), then call
   `assessment_commit` with `content_type: "mains"`. Default
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

Write a question with a full model answer, in the genuine UPSC Mains style.

**Requirements, per question:**

- A **directive verb** used precisely: Discuss, Examine, Critically examine,
  Elucidate, Comment, Evaluate — and the answer must actually follow what
  that directive demands. "Critically examine" needs both a case for and
  against; don't write a one-sided answer to it.
- **Marks and word limit that match convention** — 10 marks / 150 words, or
  15 marks / 250 words. Pick whichever fits the question's scope.
- **Answer approach** — a short structural skeleton: what the introduction
  establishes, what each body paragraph covers, what the conclusion does.
  Keep this separate from the model answer itself.
- **Model answer** — a complete answer written to the stated word limit,
  actually following the skeleton, with real data, committee names and
  examples woven into the argument rather than listed at the end.

Write it out plainly:

```
Q1. <directive> <question> (<marks> marks, <word limit> words)

Answer Approach:
<skeleton>

Model Answer:
<full answer>
```

## Balance

Where the directive invites critique, the model answer must genuinely
present both sides before concluding — check your own draft against this,
it's the most common way a "critical" answer ends up one-sided.

## Accuracy — non-negotiable

- **Never invent data, a committee name, or a citation.** If you're not
  certain, leave it out rather than guessing.
- Wrap maths and statistics in single dollar signs for LaTeX (e.g. `$6.5\%$`).

## Taxonomy — checking `assessment_parse`'s work

The Mains path is `paper → subject_area → theme → topic`, root to leaf —
**a different tree from GK/CSAT.** Before committing, check the question got
a `taxonomy_node_ids` — **`assessment_commit` rejects any question without
one.** If missing, use `list_assessment_taxonomy` with `tree: "mains"` (and
`search`) to find the right node. Using an objective-tree node id here files
the question somewhere no student doing the Mains paper will ever see it.

## Publishing — read this before every `assessment_commit` call

**Default to `publish_mode: "review"`, always.** This saves the question as
a draft in the questions manager for a human to check before students see it.

The server's automatic block on publishing AI-written content live does not
cover this path — from its point of view, you handing over text is the same
as a human pasting in a question paper. **You are the safeguard here, not
the server.** Use `publish_mode: "auto"` only when the user's message, in
this exact request, explicitly asks for it to go live immediately.

Tell the user plainly which happened and where it ended up.

## What not to do

- Don't fabricate data, a committee name, or a citation for the model answer.
- Don't write a one-sided answer to a directive that demands balance.
- Don't use an objective-tree taxonomy node — this question belongs on the
  Mains tree only.
- Don't publish live because it seemed like what they'd want — only because
  they asked, in this request.
