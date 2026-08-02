---
name: waytoias-ca-mains-pyq
description: Write and publish Mains-style subjective questions with model answers for the WayToIAS UPSC coaching website's Current Affairs → Mains PYQ Library. Use whenever the user asks to write, draft or post Mains-style subjective questions, "mains PYQs", or answer-writing practice FOR THE CURRENT AFFAIRS SECTION of WayToIAS/waytoias.com (e.g. "write a mains PYQ-style question on federalism for current affairs", "draft a model answer on judicial review"). If the request is instead about adding to the general Mains question bank/test series (not current affairs), use waytoias-assessment-mains instead. Requires the coaching-posting-agent MCP server (whoami, ca_parse, ca_commit tools) to be connected.
---

# Writing and posting Mains PYQs for WayToIAS Current Affairs

You are the writer — not a tool you call. You write the question and model
answer yourself and hand the plain text to the app's own AI, which files it
— category, date, shape — exactly as it already does for an uploaded
question paper.

## The three-step flow

1. **Write the question and answer**, following the format below, as plain
   text.
2. **Hand off for filing** — call `ca_parse` with your text as `raw_text`
   and `content_kind: "mains_pyq"`. Its own AI resolves the category and
   date and normalises the shape. Nothing is saved yet.
3. **Review, then save** — check what came back (see "Before you commit"),
   then call `ca_commit` with `content_kind: "mains_pyq"`.
   Default `publish_mode: "review"` — see "Publishing" below.

## Before you start

Run `whoami` once per session. If it fails, the connection isn't working —
say so and stop; don't try to work around it.

## Format

Write a question with a full model answer, in the genuine UPSC Mains style.

**Requirements, per question:**

- A **directive verb** used precisely and consistently with the answer you
  write: Discuss, Examine, Critically examine, Elucidate, Comment, Evaluate.
  The directive determines the structure — "critically examine" demands both
  a case for and against; don't write a one-sided answer to a directive that
  calls for balance.
- **Marks and word limit that match convention**: 10 marks / 150 words, or
  15 marks / 250 words — pick whichever fits the question's scope.
- **Answer approach** — the skeleton: what the introduction should
  establish, what each body paragraph should cover, what the conclusion
  should do. Keep this separate from the model answer.
- **Model answer** — a complete answer written to the stated word limit,
  actually following the skeleton, with real data, committee names and
  examples woven into the argument rather than tacked on as a list.

Write it out plainly:

```
Q1. <directive> <question> (<marks> marks, <word limit> words)

Answer Approach:
<skeleton>

Model Answer:
<full answer>
```

Include the source year if the question is drawn from a real past paper;
otherwise note the current year.

## Balance

Where the directive invites critique ("critically examine", "evaluate"), the
model answer must genuinely present both the case for and the case against
before reaching a conclusion. A one-sided "critical" answer is a common,
easy mistake — check your own draft against this before finishing.

## Research and accuracy

- **Never invent a fact, figure, committee name or citation.** If you're not
  certain, say so to the user rather than guessing.
- **Never invent a source link.**
- Give full official names on first mention, then the abbreviation.
- Wrap maths and statistics in single dollar signs for LaTeX (e.g. `$6.5\%$`).

## Category and date — you can steer these, or leave them to the filer

`ca_parse` picks a category from the live tree on its own. You can override
by writing it into the text: `Categories: Polity > Federalism`. If the
question is drawn from an older paper, add `Date: 2019-01-01` (or the
relevant year). Call `list_current_affairs_categories` first if you want to
see live category names.

## Before you commit — check what `ca_parse` actually returned

- **Category resolved?**
- **Marks and word limit are present and match convention.**
- **The model answer actually matches the stated word limit** — not wildly
  over or under.
- **Balance check** — re-read: does the answer genuinely show both sides
  where the directive calls for it?

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

- Don't fabricate data, a committee name, or a citation to fill out the
  model answer.
- Don't write a one-sided answer to a directive that demands balance.
- Don't publish live because it was convenient, only because it was asked.
