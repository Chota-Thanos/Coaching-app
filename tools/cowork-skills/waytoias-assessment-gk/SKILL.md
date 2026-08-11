---
name: waytoias-assessment-gk
description: Write and post GK / Prelims General Studies multiple-choice questions into the WayToIAS UPSC coaching website's question bank (test series). Use whenever the user asks to write, draft, make or add GK questions, Prelims General Studies MCQs, or general practice questions for the WayToIAS test series/question bank (e.g. "make 5 GK questions on the Panchayati Raj system", "add some prelims MCQs on the Indian economy to the test series"). Do NOT use this for CSAT/aptitude questions (use waytoias-assessment-csat), Mains questions (use waytoias-assessment-mains), or for questions specifically meant for the Current Affairs → Prelims PYQ Library (use waytoias-ca-prelims-pyq instead). Requires the coaching-posting-agent MCP server (whoami, list_exams, assessment_parse, assessment_commit, list_assessment_taxonomy tools) to be connected.
---

# Writing and posting GK questions for WayToIAS

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
   `raw_text`, plus `content_type: "gk"` and `exam_id`. It classifies each
   question into the deepest matching taxonomy node itself.
5. **Check what came back** (see "Before you commit"), then call
   `assessment_commit` with `content_type: "gk"`. Default
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

Same standard as a genuine UPSC Prelims General Studies paper — grounded in
real, checkable facts, never trivia that turns on one obscure number.

**Requirements, per question:**

- A stem answerable from facts, not opinion.
- Exactly four options, labelled A, B, C, D.
- Exactly one defensible correct answer.
- An explanation covering why the correct option is right **and** why each
  of the other three is wrong — the wrong-option reasoning is often what
  actually teaches the concept, so don't skip it.

Favour real UPSC patterns: "Consider the following statements ... which of
the statements given above is/are correct?", matching pairs, chronological
ordering, assertion-reason. A single straight fact-recall question is the
weakest pattern — use it sparingly.

Write it out plainly, one question after another:

```
Q1. <stem>
(a) <option>
(b) <option>
(c) <option>
(d) <option>

Correct Answer: (b)

Explanation: <why b is right, why a/c/d are wrong>
```

Don't wrap it in a markdown table — plain text like this is what the filing
step reads most reliably.

## Accuracy — non-negotiable

- **Never invent a `correct_answer`.** If you're not certain which option is
  right, say so to the user rather than guessing — a wrong answer key
  actively teaches the wrong thing, which is worse than no question at all.
- **The explanation must actually support the stated answer.** Don't write a
  confident-sounding explanation for an answer you're unsure of.
- Don't repeat the same fact across several questions in one request — a
  common failure past ~10 questions on one topic.

## Taxonomy — checking `assessment_parse`'s work

The path is `subject → source_bucket → topic → subtopic`, root to leaf.
Before committing, check every question actually got a `taxonomy_node_ids` —
**`assessment_commit` rejects any question without one; that's a guard, not
a bug you should route around.** If one is missing, use
`list_assessment_taxonomy` with `tree: "objective"` (and `search`) to find
the right node yourself rather than dropping the question.

If every question in a batch lands on the exact same node, that's usually a
sign the classification didn't really differentiate between them — worth a
second look before committing.

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
- Don't invent a taxonomy node to force a commit through.
- Don't publish live because it seemed like what they'd want — only because
  they asked, in this request.
