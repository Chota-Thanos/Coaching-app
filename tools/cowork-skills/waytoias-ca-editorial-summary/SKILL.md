---
name: waytoias-ca-editorial-summary
description: Research, write and publish an editorial/opinion-piece summary for the WayToIAS UPSC coaching website's Current Affairs → Editorial Summaries section. Use whenever the user asks to summarise, write or post a newspaper editorial, opinion piece, or "editorial summary" for WayToIAS/waytoias.com (e.g. "summarise this editorial on federalism", "write today's editorial summary from this link", "post this opinion piece breakdown"). Do NOT use this for a plain news article (use waytoias-ca-daily-news) or a durable Mains topic note (use waytoias-ca-mains-notes). Requires the coaching-posting-agent MCP server (whoami, ca_parse, ca_commit tools) to be connected.
---

# Writing and posting Editorial Summaries for WayToIAS

You are the writer — not a tool you call. You read the editorial yourself (or
research the general debate if only a topic is given) and write the summary
in your own words. The app's own AI still has a job here, but a different
one: it takes what you wrote and **files it** — the right category, the
right date, the right shape for the database — exactly the way it already
does when a human uploads a Word document. You are replacing the document,
not the filing step.

## The three-step flow

1. **Research and write**, following the structure below, as plain markdown.
2. **Hand it off for filing** — call `ca_parse` with your text as `raw_text`
   and `content_kind: "daily_editorial_summary"`. Its own AI resolves the
   category and date and normalises the shape. Nothing is saved yet.
3. **Review, then save** — check what came back (see "Before you commit"),
   then call `ca_commit` with `content_kind: "daily_editorial_summary"`.
   Default `publish_mode: "review"` — see "Publishing" below.

## Before you start

Run `whoami` once per session. If it fails, the connection isn't working —
say so and stop; don't try to work around it.

## Structure

This is a summary of someone else's argument, for Mains preparation — the
reader wants the reasoning, not the news. If the user gives you a link to the
actual editorial, read it and represent it faithfully; if they only give a
topic, be explicit in the piece that you're synthesising the general debate
rather than one named author's column.

Use these sections, in this order:

1. **Context** — what prompted the editorial, with its date.
2. **The Core Argument** — the author's central claim, stated plainly, in
   your words but without softening or distorting it.
3. **Supporting Points** — the evidence and reasoning offered, as bullets.
4. **Counter-View** — the strongest opposing case, whether or not the
   original piece acknowledges it. **This section is required.** A summary
   with only one side isn't usable for a Mains answer, which has to show both.
5. **Evaluation** — where the argument holds up and where it's weak. This is
   your own analysis, clearly separated from the author's claims above it.
6. **Mains Angle** — the GS paper and syllabus theme this maps to, plus one
   practice question it could support.

**Voice:** represent the author's position faithfully even where you
disagree with it — attribute opinions to the author ("the author argues
that…"), not to fact. Keep your own voice mainly to the Evaluation section.
500-700 words.

## Research and accuracy — this is what makes the content trustworthy

- **Never invent a figure, date, name, rank or finding.** If you can't find
  it, leave it out. A shorter accurate piece beats a longer speculative one.
- **Attribute statistics by name in the text.**
- **Never invent a source link.** Only cite a URL you actually fetched or
  were given. If your grounding came from a general web search rather than
  one identifiable page, don't attach a source URL at all.
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

Without a `Date:` line, a piece about an older editorial risks landing under
today by mistake. Call `list_current_affairs_categories` first if you want
to see the live category names before writing one in.

## Before you commit — check what `ca_parse` actually returned

- **Category resolved?** An item with no category lands uncategorised.
- **Date sane?**
- **Both sides of the argument actually present** — the required
  counter-view is the thing most likely to get thinned out; check it's
  substantive, not a token sentence.

## Publishing — read this before every `ca_commit` call

**Default to `publish_mode: "review"`, always.** This stages the piece in
the site's Ingestion Queue — invisible to students — for a human to read
and approve.

When content is generated through the app's own AI tools, the server itself
refuses to publish it live without an extra confirmation. That automatic
check does not see this path — from the server's point of view, you handing
it text is the same as someone pasting in a Word document. **You are the
only thing standing between what you write and the live site.**

Use `publish_mode: "auto"` only when the user's message, in this exact
request, explicitly asks for it to go live. Not because a similar request
went live last time. If you're not sure, ask.

Tell the user plainly, every time, which one happened and where it ended up.

## What not to do

- Don't summarise an editorial you couldn't actually find or read — say so.
- Don't invent a source name or URL to make the piece look better-cited.
- Don't publish live because it was convenient, only because it was asked.
- Don't skip or shrink the Counter-View section to save time.
