---
name: waytoias-ca-daily-news
description: Research, write and publish a Daily Current Affairs news article for the WayToIAS UPSC coaching website's Current Affairs → Daily News section. Use whenever the user asks to write, draft, research or post a daily current-affairs piece, "today's CA", or a news-style current-affairs article for WayToIAS/waytoias.com (e.g. "write today's daily CA on the RBI's rate decision", "draft a current affairs piece on the new PM-KISAN guidelines", "post this news story to current affairs"). Do NOT use this for an editorial/opinion summary (use waytoias-ca-editorial-summary), a durable Mains topic note (use waytoias-ca-mains-notes), or PYQs (use waytoias-ca-prelims-pyq / waytoias-ca-mains-pyq). Requires the coaching-posting-agent MCP server (whoami, ca_parse, ca_commit tools) to be connected.
---

# Writing and posting Daily Current Affairs for WayToIAS

You are the writer — not a tool you call. You research the topic yourself
(web search, or a link the user gives you) and write the article in your own
words. The app's own AI still has a job here, but a different one: it takes
what you wrote and **files it** — the right category, the right date, the
right shape for the database — exactly the way it already does when a human
uploads a Word document. You are replacing the document, not the filing step.

## The three-step flow

1. **Research and write**, following the structure below, as plain markdown.
2. **Hand it off for filing** — call `ca_parse` with your text as `raw_text`
   and `content_kind: "daily_current_affairs"`. Its own AI resolves the
   category and date and normalises the shape. Nothing is saved yet.
3. **Review, then save** — check what came back (see "Before you commit"),
   then call `ca_commit` with `content_kind: "daily_current_affairs"`.
   Default `publish_mode: "review"` — see "Publishing" below.

## Before you start

Run `whoami` once per session. If it fails, the connection isn't working —
say so and stop; don't try to work around it.

## Structure

One article per distinct story — if the user gives you several unrelated
stories, write and file them as separate articles, not one piece stitched
together.

Use these sections, in this order. Omit one only when the material genuinely
doesn't support it — don't pad to keep the shape:

1. **Why in News** — the trigger event and its date, in two or three sentences.
2. **Background** — the minimum context a reader needs to follow the story.
   Don't over-explain what most aspirants already know.
3. **Key Facts** — bullet points. Exact figures, dates, Article/Section
   numbers, official scheme names. This is the section students actually scan
   for revision, so density matters more than prose style.
4. **Significance** — why it matters: governance, economy, society,
   international relations. Pick the angles that genuinely apply.
5. **Challenges** — real concerns, criticisms or implementation gaps. If
   there genuinely aren't any worth noting, say so briefly rather than
   inventing filler controversy.
6. **Way Forward** — practical, specific steps. Not slogans.
7. **Prelims Pointers** — 3 to 5 one-line facts of the kind an MCQ would
   actually test.

**Voice:** neutral, factual, analytical — a briefing, not an opinion piece.
Sentences under 25 words wherever natural. 500-700 words total; a story that
genuinely needs more room can run longer, but check you're adding substance,
not padding.

## Research and accuracy — this is what makes the content trustworthy

Everything you write is going in front of people preparing for a real exam.
Treat these as load-bearing, not stylistic preferences:

- **Never invent a figure, date, name, rank, scheme outlay or report
  finding.** If you can't find it, leave it out. A shorter accurate piece
  beats a longer speculative one — a wrong number in exam-prep material is
  the kind of mistake that costs someone marks.
- **Attribute statistics by name in the text** — "according to the Economic
  Survey 2024-25", not a bare number.
- **Never invent a source link.** Only cite a URL you actually fetched or
  were given. If your grounding came from a general web search rather than
  one identifiable page, don't attach a source URL at all — a plausible-
  looking fake link is worse than no link.
- Give the full official name of a body, scheme, Act or report on first
  mention, then the abbreviation: "Monetary Policy Committee (MPC)", then
  "MPC". Cite Articles/Sections precisely (e.g. "Article 356").
- Wrap maths, statistics and percentages in single dollar signs for LaTeX
  (e.g. `$6.5\%$`, `$10^9$`) — the site renders these specially.

## Category and date — you can steer these, or leave them to the filer

`ca_parse` picks a category from the live tree and works out a date on its
own. You can override either by writing it directly into the text:

```
Categories: Economy > Banking & Finance
Date: 2024-03-15
```

Do this whenever you know the right answer — it's more reliable than the
parser's guess, especially for anything back-dated. Without a `Date:` line,
back-dated content risks landing under today by mistake. Call
`list_current_affairs_categories` first if you want to see the live category
names before writing one in.

## Before you commit — check what `ca_parse` actually returned

- **Category resolved?** An item with no category lands uncategorised —
  effectively invisible on the site. Fix it before committing.
- **Date sane?** If you wrote a `Date:` line and it wasn't honoured, or a
  clearly historical item came back dated today, fix it in the payload you
  send to `ca_commit`.
- **Nothing truncated or duplicated.**

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
request, explicitly asks for it to go live — "publish it", "put it live".
Not because a similar request went live last time. If you're not sure, ask.

Tell the user plainly, every time, which one happened and where it ended up.

## What not to do

- Don't write about a topic you couldn't find real grounding for. Say so.
- Don't invent a source name or URL to make the piece look better-cited.
- Don't publish live because it was convenient, only because it was asked.
- Don't skip the category/date check because `ca_parse` "usually gets it right".
