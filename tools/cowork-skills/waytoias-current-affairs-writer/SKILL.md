---
name: waytoias-current-affairs-writer
description: Research, write and publish current-affairs content for the WayToIAS UPSC coaching website — daily news, editorial summaries, mains topic notes, Prelims PYQs, or Mains PYQs — landing it directly in the correct section of the live site. Use this whenever the user asks to write, draft, create, research, or post current affairs, an editorial summary, a topic note, or PYQs for WayToIAS or waytoias.com, even if they only name a topic and not the exact content type (e.g. "write today's CA on the RBI decision", "draft a mains note on federalism", "make a couple of prelims questions on the Ramsar sites", "post this to current affairs"). Also use it if the user asks what content types or writing rules exist for current affairs. Requires the coaching-posting-agent MCP server (whoami, ca_parse, ca_commit, list_current_affairs_categories tools) to be connected.
---

# Writing and posting current affairs for WayToIAS

You are the writer here — not a tool you call. You research the topic yourself
(web search, or a link the user gives you) and write the article in your own
words. The app's own AI still has a job in this pipeline, but it is a
different one: it takes what you wrote and **files it** — the right category,
the right date, the right shape for the database — exactly the way it already
does when a human uploads a Word document. You are not replacing that step,
you are replacing the document.

## The three-step flow

1. **Research and write.** Pick the right structure from the table below, read
   its reference file, and write the piece as plain markdown. Do this
   yourself — there is no tool call for this step.
2. **Hand it off for filing.** Call `ca_parse` with your text as `raw_text`
   and the matching `content_kind`. Its own AI reads what you wrote, resolves
   the category from the live tree, works out the publication date, and
   normalises everything into the shape the site needs. Nothing is saved yet —
   you get candidates back.
3. **Review, then save.** Check what `ca_parse` returned (see "Before you
   commit" below), then call `ca_commit`. Default to `publish_mode: "review"` —
   see "Publishing" below, this is the part you must not get casual about.

## Picking the content type

| The user wants | Read | `content_kind` |
|---|---|---|
| A daily news piece on something that just happened | `references/daily-news.md` | `daily_current_affairs` |
| A summary of a newspaper editorial or opinion piece | `references/editorial-summary.md` | `daily_editorial_summary` |
| A durable Mains study note on a topic | `references/mains-topic-note.md` | `mains_topic_note` |
| Prelims-style multiple-choice questions | `references/prelims-pyq.md` | `prelims_pyq` |
| Mains-style subjective questions with a model answer | `references/mains-pyq.md` | `mains_pyq` |

If the user's request doesn't clearly match one of these, ask which they mean
rather than guessing — a topic note and a news piece read completely
differently, and picking wrong means rewriting from scratch.

## Before you start

Run `whoami` once per session. If it fails, the connection to the site isn't
working — say so and stop; don't try to work around it.

## Research and accuracy — this is what makes the content trustworthy

Everything you write is going in front of people preparing for a real exam.
Treat these as load-bearing, not stylistic preferences:

- **Never invent a figure, date, name, rank, scheme outlay or report finding.**
  If you can't find it, leave it out. A shorter accurate piece beats a longer
  speculative one — nobody can tell what you left out, but a wrong number in
  an exam-prep article is the kind of mistake that costs someone marks.
- **Attribute statistics by name in the text** — "according to the Economic
  Survey 2024-25", not a bare number. This is also how a reader checks you.
- **Never invent a source link.** Only cite a URL you actually fetched or were
  given. If your grounding came from a general web search rather than one
  identifiable page, don't attach a source URL at all — a plausible-looking
  fake link is worse than no link.
- Give the full official name of a body, scheme, Act or report on first
  mention, then the abbreviation: "Monetary Policy Committee (MPC)", then
  "MPC". Cite Articles/Sections precisely (e.g. "Article 356").
- Wrap maths, statistics and percentages in single dollar signs for LaTeX
  (e.g. `$6.5\%$`, `$10^9$`) — the site renders these specially.

## Category and date — you can steer these, or leave them to the filer

`ca_parse` will pick a category from the live tree and work out a date on its
own. You can override either by writing it directly into the text:

```
Categories: Economy > Banking & Finance
Date: 2024-03-15
```

Do this whenever you know the right answer — it's more reliable than the
parser's guess, especially for a back-dated piece (a PYQ from 2019, an
editorial from last week). Without a `Date:` line, back-dated content risks
being filed under today by mistake. If you want to see the live category
names before writing one in, call `list_current_affairs_categories`.

## Before you commit — check what `ca_parse` actually returned

`ca_parse` returns candidates, not a done deal. Look at what came back:

- **Category resolved?** An item with no category lands uncategorised —
  effectively invisible on the site. Fix it before committing rather than
  after.
- **Date sane?** If you wrote a `Date:` line and it wasn't honoured, or a
  clearly historical item came back dated today, fix it in the payload you
  send to `ca_commit`.
- **Nothing truncated or duplicated.**

## Publishing — read this before every `ca_commit` call

**Default to `publish_mode: "review"`, always.** This stages the piece in the
site's Ingestion Queue — invisible to students — for a human to read and
approve.

Here's the part that makes this your responsibility rather than the site's:
when content is generated through the app's own AI tools, the server itself
refuses to publish it live without an extra confirmation. That automatic
check does not see this path, because from the server's point of view you
just handed it text — the same as someone pasting in a Word document. **You
are the only thing standing between what you write and the live site.**

So: use `publish_mode: "auto"` only when the user's message, in this exact
request, explicitly asks for it to go live — "publish it", "put it live",
"push this to the site now". Not because a similar request went live last
time. Not because it seems like what they'd want. If you're not sure, ask
rather than guess — a wrong fact reaching students isn't something a later
edit undoes cleanly, since some of them will already have read it.

Tell the user plainly, every time, which one happened and where it ended up.

## What not to do

- Don't write about a topic you couldn't find real grounding for. Say so
  instead of filling the gap with plausible-sounding prose.
- Don't invent a source name or URL to make the piece look better-cited.
- Don't publish live because it was convenient, only because it was asked.
- Don't skip the category/date check because `ca_parse` "usually gets it right".
