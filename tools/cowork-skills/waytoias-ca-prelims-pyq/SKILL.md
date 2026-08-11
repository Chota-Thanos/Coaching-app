---
name: waytoias-ca-prelims-pyq
description: Write and publish Prelims-style multiple-choice questions for the WayToIAS UPSC coaching website's Current Affairs → Prelims PYQ Library. Use whenever the user asks to write, draft or post Prelims-style MCQs, "prelims PYQs", or multiple-choice practice questions FOR THE CURRENT AFFAIRS SECTION of WayToIAS/waytoias.com (e.g. "make a couple of prelims questions on the Ramsar sites", "write PYQ-style MCQs on the Election Commission for current affairs"). If the request is instead about adding questions to the general GK question bank/test series (not current affairs), use waytoias-assessment-gk instead. Requires the coaching-posting-agent MCP server (whoami, ca_parse, ca_commit tools) to be connected.
---

# Writing and posting Prelims PYQs for WayToIAS Current Affairs

You are the writer — not a tool you call. You write the question(s) yourself
and hand the plain text to the app's own AI, which files it — category,
date, shape — exactly as it already does for an uploaded question paper.

## The three-step flow

1. **Write the question(s)**, following the format below, as plain text.
2. **Hand off for filing** — call `ca_parse` with your text as `raw_text`
   and `content_kind: "prelims_pyq"`. Its own AI resolves the category and
   date and normalises the shape. Nothing is saved yet.
3. **Review, then save** — check what came back (see "Before you commit"),
   then call `ca_commit` with `content_kind: "prelims_pyq"`.
   Default `publish_mode: "review"` — see "Publishing" below.

## Before you start

Run `whoami` once per session. If it fails, the connection isn't working —
say so and stop; don't try to work around it.

## Format

Write in the genuine UPSC Prelims style, grounded in real facts about the
topic — not trivia that turns on one obscure number nobody would reasonably
know or be expected to reason to.

**Requirements, per question:**

- A stem answerable from facts, not opinion.
- Exactly four options, labelled A, B, C, D.
- Exactly one defensible correct answer — if two options could both be
  argued correct, rewrite until only one is.
- An explanation covering **why the correct option is right AND why each of
  the other three is wrong.** An explanation that only justifies the answer
  is incomplete — the wrong-option reasoning is often what actually teaches
  the concept.

Favour real UPSC patterns: "Consider the following statements ... which of
the statements given above is/are correct?", matching pairs, chronological
ordering, assertion-reason. A single straight fact-recall question is the
weakest pattern — use it sparingly.

Write it out plainly:

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
step reads most reliably. Include the source year if the question is drawn
from or inspired by a real past paper; otherwise note the current year.

## Research and accuracy

- **Never invent a fact, figure, date or explanation.** If you're not
  certain, say so to the user rather than guessing.
- **Never invent a source link.**
- Give full official names on first mention, then the abbreviation.

## Source and SEO — fill these on every commit

Passed per article in `ca_commit`. A question set is still a page on the site, so
it needs to be findable.

- `source_name` / `source_url` — where the underlying fact or ruling came
  from, when there is one identifiable page. **Never invent a URL**; omit it
  and say so rather than guessing.
- `seo_title` — up to ~60 characters, leading with the topic a student would
  search, e.g. *"Election Commission of India: Prelims Practice Questions"*.
- `seo_description` — 140-160 characters saying what the questions cover and
  at what level.
- `keywords` — 5-10: the topic, the named bodies or statutes tested, the
  exam stage, and the subject area.

Write them from the finished set, so they describe what you actually wrote.

## Category and date — you can steer these, or leave them to the filer

`ca_parse` picks a category from the live tree on its own. You can override
by writing it into the text: `Categories: Polity > Elections`. If the
question is drawn from an older paper, add `Date: 2019-01-01` (or the
relevant year) so it isn't filed under today by mistake. Call
`list_current_affairs_categories` first if you want to see live category
names.

## Before you commit — check what `ca_parse` actually returned

- **Category resolved?** An item with no category lands uncategorised.
- **`correct_answer` present and matches one of the four options** — a
  missing or wrong-range answer key makes the question unscoreable.
- **Explanation actually covers all four options**, not just the correct one.

## Publishing — read this before every `ca_commit` call

**Default to `publish_mode: "review"`, always.** This saves the question as a
draft in the Articles Library — invisible to students — for a human to open
in the normal article editor, then publish.

When content is generated through the app's own AI tools, the server itself
refuses to publish it live without an extra confirmation. That automatic
check does not see this path — from the server's point of view, you handing
it text is the same as someone pasting in a question paper. **You are the
only thing standing between what you write and the live site.**

Use `publish_mode: "auto"` only when the user's message, in this exact
request, explicitly asks for it to go live. If unsure, ask.

Tell the user plainly, every time, which one happened and where it ended up.

## What not to do

- Don't fabricate a correct answer you're not sure of — flag it instead.
- Don't write a question with two defensible correct options.
- Don't publish live because it was convenient, only because it was asked.
