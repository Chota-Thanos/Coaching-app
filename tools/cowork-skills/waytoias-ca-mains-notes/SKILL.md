---
name: waytoias-ca-mains-notes
description: Research, write and publish a durable Mains topic note for the WayToIAS UPSC coaching website's Current Affairs → Mains Notes section. Use whenever the user asks to write, draft or post a Mains topic note, syllabus note, or study note for WayToIAS/waytoias.com (e.g. "write a mains note on cooperative federalism", "draft a topic note on judicial review for GS2", "post a study note on climate finance"). Do NOT use this for a dated news piece (use waytoias-ca-daily-news) or an editorial summary (use waytoias-ca-editorial-summary). Requires the coaching-posting-agent MCP server (whoami, ca_parse, ca_commit tools) to be connected.
---

# Writing and posting Mains Topic Notes for WayToIAS

You are the writer — not a tool you call. You research the topic yourself
and write the note in your own words. The app's own AI still has a job here,
but a different one: it takes what you wrote and **files it** — the right
category, the right date, the right shape for the database — exactly the way
it already does when a human uploads a Word document. You are replacing the
document, not the filing step.

## The three-step flow

1. **Research and write**, following the structure below, as plain markdown.
2. **Hand it off for filing** — call `ca_parse` with your text as `raw_text`
   and `content_kind: "mains_topic_note"`. Its own AI resolves the category
   and date and normalises the shape. Nothing is saved yet.
3. **Review, then save** — check what came back (see "Before you commit"),
   then call `ca_commit` with `content_kind: "mains_topic_note"`.
   Default `publish_mode: "review"` — see "Publishing" below.

## Before you start

Run `whoami` once per session. If it fails, the connection isn't working —
say so and stop; don't try to work around it.

## Structure

This is a durable study note, not news — it should read the same and be just
as useful in two years. If the topic has a recent news hook, mention it
briefly for relevance, but the note itself should stand on its own as
something a student returns to repeatedly.

1. **Syllabus Mapping** — the GS paper and the exact syllabus phrase this
   topic falls under.
2. **Concept** — a precise definition and the essential framework. Assume the
   reader is prepping seriously but wants clarity, not a textbook wall of
   text.
3. **Constitutional and Legal Basis** — relevant Articles, Acts, judgments.
   Omit entirely if the topic genuinely has none, rather than stretching for
   a tenuous citation.
4. **Dimensions** — political, economic, social, environmental, ethical,
   international. Give each applicable angle its own sub-heading; skip any
   that don't genuinely apply.
5. **Committees, Reports and Data** — named sources with their actual key
   findings, not just a list of names.
6. **Case Studies and Examples** — two or three concrete, verifiable
   instances.
7. **Way Forward** — specific measures, each tied back to a dimension raised
   above, not generic recommendations.
8. **Answer Framework** — how a student should structure a ~250-word answer
   on this topic: what the introduction, body and conclusion should each do.

**Voice:** write for permanence — avoid "recently", "last month", or
anything that dates the note. Where a fact is genuinely time-bound (a
committee's report year, a scheme's launch year), state the year explicitly.
Length 800-1200 words — the longest content type here, so budget research
time before you start writing.

## Research and accuracy — this is what makes the content trustworthy

- **Never invent a figure, date, name, rank, committee finding or citation.**
  If you can't find it, leave it out.
- **Attribute statistics by name in the text.**
- **Never invent a source link.** If your grounding came from a general web
  search rather than one identifiable page, don't attach a source URL.
- Give the full official name of a body, scheme, Act or report on first
  mention, then the abbreviation. Cite Articles/Sections precisely.
- Wrap maths, statistics and percentages in single dollar signs for LaTeX
  (e.g. `$6.5\%$`, `$10^9$`).

## Category and date — you can steer these, or leave them to the filer

`ca_parse` picks a category from the live tree and works out a date on its
own. You can override either by writing it directly into the text:

```
Categories: Polity > Governance
Date: 2024-03-15
```

Since this is an evergreen note, the date usually just marks when it was
written — today is normally fine unless the user wants it dated otherwise.
Call `list_current_affairs_categories` first if you want to see the live
category names before writing one in.

## Before you commit — check what `ca_parse` actually returned

- **Category resolved?** An item with no category lands uncategorised.
- **Nothing truncated** — this is the longest content type, so check the end
  of the note wasn't cut off in handling.
- **The eight sections are actually all there**, in order — this is the
  content type most likely to quietly lose a section under length pressure.

## Publishing — read this before every `ca_commit` call

**Default to `publish_mode: "review"`, always.** This saves the piece as a
draft in the Articles Library — invisible to students — for a human to open
in the normal article editor, then publish.

When content is generated through the app's own AI tools, the server itself
refuses to publish it live without an extra confirmation. That automatic
check does not see this path — from the server's point of view, you handing
it text is the same as someone pasting in a Word document. **You are the
only thing standing between what you write and the live site.**

Use `publish_mode: "auto"` only when the user's message, in this exact
request, explicitly asks for it to go live. Not because a similar request
went live last time. If you're not sure, ask.

Tell the user plainly, every time, which one happened and where it ended up.

## After committing — check for Editorial Summaries to link back

This note is the durable topic that many dated Editorial Summaries feed over
time (several India-China summaries across months all belong under one
"India-China Relations" note). If summaries on this topic already exist —
written before this note was — they should point to it too, not sit
unlinked.

`ca_find_articles` with the entity/topic name and
`content_kind: "daily_editorial_summary"`. For each real match, propose
linking it to the user (which summary, why it fits) and, if there's a
pointer from that summary genuinely missing from the note, propose adding it
to the relevant dimension the same way described in the editorial-summary
skill's "After committing" section. Wait for agreement on both before
calling `ca_update_article` and `ca_link_mains_summary` — same confirmation
rule as everywhere else in this pipeline.

Don't force a link where the summary doesn't actually bear on this topic —
an unrelated match found by name alone is not a reason to connect them.

## What not to do

- Don't write about a topic you couldn't find real grounding for. Say so.
- Don't invent a source name or citation to fill a thin section.
- Don't publish live because it was convenient, only because it was asked.
- Don't compress the eight sections into fewer to save time.
