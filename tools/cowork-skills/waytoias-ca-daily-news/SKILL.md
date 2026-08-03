---
name: waytoias-ca-daily-news
description: Research, write and publish a Daily Current Affairs news article for the WayToIAS UPSC coaching website's Current Affairs → Daily News section, splitting off a reusable background concept when the story is a development on something that already exists. Use whenever the user asks to write, draft, research or post a daily current-affairs piece, "today's CA", or a news-style current-affairs article for WayToIAS/waytoias.com (e.g. "write today's daily CA on the RBI's rate decision", "draft a current affairs piece on the new PM-KISAN guidelines", "post this news story to current affairs"). Do NOT use this for an editorial/opinion summary (use waytoias-ca-editorial-summary), a durable Mains topic note (use waytoias-ca-mains-notes), or PYQs (use waytoias-ca-prelims-pyq / waytoias-ca-mains-pyq). Requires the coaching-posting-agent MCP server (whoami, ca_parse, ca_commit, ca_find_concepts, ca_link_concept tools) to be connected.
---

# Writing and posting Daily Current Affairs for WayToIAS

You are the writer — not a tool you call. You research the topic yourself
(web search, or a link the user gives you) and write the article in your own
words. The app's own AI still has a job here, but a different one: it takes
what you wrote and **files it** — the right category, the right date, the
right shape for the database — exactly the way it already does when a human
uploads a Word document. You are replacing the document, not the filing step.

## The four-step flow

1. **Check for an existing concept** — call `ca_find_concepts` with the name
   of the law, scheme, body or index the story is about. What comes back
   decides how you write (see "First occurrence vs development" next).
2. **Research and write**, following the structure below, as plain markdown.
3. **Hand it off for filing** — call `ca_parse` with your text as `raw_text`
   and `content_kind: "daily_current_affairs"`. Its own AI resolves the
   category and date and normalises the shape. Nothing is saved yet.
4. **Review, save, then link** — check what came back (see "Before you
   commit"), call `ca_commit` with `content_kind: "daily_current_affairs"`
   (default `publish_mode: "review"`), then call `ca_link_concept` with the
   article id the commit returned.

## Before you start

Run `whoami` once per session. If it fails, the connection isn't working —
say so and stop; don't try to work around it.

## First occurrence vs development — the decision that shapes the article

Every story is one of two kinds, and they are written differently.

**A first occurrence.** A brand-new scheme, mission, body or index with
nothing behind it. There is no reusable background to separate, because the
background *is* the news. → **One news article. No concept. No link.**

**A development on something that already exists.** An amendment to a
standing Act, a new tranche of a running scheme, a verdict on an existing
law, a fresh edition of a recurring index, an extension of a programme. →
**The durable entity is a concept; only what changed goes in the news
article**, and the two are linked.

The test, when it isn't obvious: *would this background still be worth
reading a year from now, independent of today's event?* Yes → concept. It
only exists because of today's news → keep it in the article.

Worked example. A new district de-addiction centre is approved under the
Nasha Mukt Bharat Abhiyaan:

- **Concept** — *Nasha Mukt Bharat Abhiyaan*: launched 2020, the ministry
  that runs it, its components, the districts it covers, how it works.
  Evergreen, undated, written once and reused forever.
- **News article** — the approval itself: what was cleared, where, when,
  what it adds, why it matters now.

### Reuse the concept — never write a second copy

`ca_find_concepts` comes first for a reason. If a concept for that entity
already exists, **link that exact id**. Do not compose a fresh one because
the existing body looks thin or you'd have phrased it differently — a
duplicate splits that concept's news timeline in two and both halves are
then wrong. If the existing primer genuinely needs improving, tell the user;
don't fork it.

Only pass `concept: {...}` to `ca_link_concept` when the search genuinely
found nothing. Write that body evergreen: no "recently", no "this week", no
dates tied to today's story. It has to still read correctly in three years.

### Give the new concept its own category — a separate decision from the article's

A concept is filed under **the subject the entity itself belongs to**, which
is frequently *not* the category the day's news article lands under. The
Index of Core Industries concept belongs under Economy → Index & Reports;
whichever single month's update article happens to be about — say a
methodology revision — might get filed by `ca_parse` under Banking &
Monetary Policy on its own merits. Both are correct. They are two separate
lookups, not one shared value, and composing the concept without doing this
lookup is how a concept ends up uncategorised.

When composing a new `concept: {...}`, call `list_current_affairs_categories`
for **the entity**, not the news event, and pass the id(s) as
`concept.category_node_ids` (first id is primary). Do this at the same time
you write the concept body — it's part of composing the concept, not an
afterthought before commit.

**Sometimes the concept genuinely doesn't need one** — a handful of entities
are cross-cutting enough that no single node fits. That's fine, but it's a
judgment call you state, not a default you fall into: if you're omitting
`category_node_ids` because you're unsure rather than because it's genuinely
cross-cutting, say so to the user instead of guessing. An uncategorised
concept is exactly as invisible on the site as an uncategorised news
article — see "Before you commit" below.

**Reusing an existing concept is different — don't touch its category.**
`ca_find_concepts` returns each match's current `category`. If it's already
set, leave it; a category chosen when the concept was first written is not
something to second-guess from inside an unrelated day's news posting. If it
comes back `null` on a concept you're about to reuse, that's a pre-existing
gap worth flagging to the user, not something to silently fix as a side
effect of linking today's article.

### Core vs Related

- **Core Concept** (`is_core: true`) — the entity the development is
  actually *about*. Normally exactly one per article.
- **Related Concept** (`is_core: false`) — something touched in passing: the
  implementing ministry, an adjacent scheme, an index it feeds into.

### The `note` on each link

Every link takes a one-line `note` saying what *this* article changed —
"Coverage extended to 100 additional districts." It becomes that entry on
the concept page's news timeline, where students read it next to entries
from other months, so write it to stand on its own. Don't write "as
discussed above" or repeat the headline verbatim.

### When the concept has to be written late

A story you filed months ago as a first occurrence gets its second
development today. The concept has to exist now — and the earlier article
should point at it too, or the timeline starts mid-story.

`ca_link_concept` takes several links in one call, so pass both: today's
article and the older one. Search for the earlier piece first to get its id.

## Structure

One article per distinct story — if the user gives you several unrelated
stories, write and file them as separate articles, not one piece stitched
together.

Use these sections, in this order. Omit one only when the material genuinely
doesn't support it — don't pad to keep the shape:

1. **Why in News** — the trigger event and its date, in two or three sentences.
2. **Background** — the minimum context a reader needs to follow the story.
   Don't over-explain what most aspirants already know.
   **When the article is linked to a concept, this section is two or three
   sentences and no more** — just enough to orient someone who arrived from
   a search result, then straight into what changed. The concept carries the
   full explanation; repeating it here is the duplication the split exists to
   remove. For the de-addiction example: *"The Nasha Mukt Bharat Abhiyaan,
   launched in 2020 under the Ministry of Social Justice and Empowerment,
   runs India's demand-reduction drive against substance abuse across its
   most vulnerable districts."* — then on to the approval.
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
- **If you composed a new concept, does it have its own category?** This is
  separate from the article check above — `ca_parse` never sees the concept,
  so nothing resolves it automatically. Confirm you set
  `concept.category_node_ids` (or deliberately decided the entity is
  cross-cutting) before calling `ca_link_concept`.

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
request, explicitly asks for it to go live — "publish it", "put it live".
Not because a similar request went live last time. If you're not sure, ask.

Tell the user plainly, every time, which one happened and where it ended up.

## What not to do

- Don't write about a topic you couldn't find real grounding for. Say so.
- Don't invent a source name or URL to make the piece look better-cited.
- Don't publish live because it was convenient, only because it was asked.
- Don't skip the category/date check because `ca_parse` "usually gets it right".
- Don't write a second copy of a concept that already exists. Search first,
  link the id you find.
- Don't split off a concept for a first-of-its-kind story just because the
  article mentions a scheme name. Nothing durable exists yet.
- Don't repeat the full background inside an article that links a concept.
- Don't assume a new concept inherits the news article's category — look up
  the entity's own category separately, or state that you're deliberately
  leaving it uncategorised and why.
- Don't re-categorise an existing concept as a side effect of linking a new
  article to it. Flag a gap you notice; don't silently fix it.
