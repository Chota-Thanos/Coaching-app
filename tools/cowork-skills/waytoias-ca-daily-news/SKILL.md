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

### Structure the concept body — the same Format Library, written evergreen

A concept isn't a separate document type with its own fixed spec. It's
**the same shape the news article itself would use**, chosen the same way:
pick whichever template in the Format Library below actually fits the
entity — a scheme's concept uses the scheme template, an index's concept
uses the report/index template, a regulatory body's concept uses the
organisation template. The topic decides the shape. There is no universal
list of sections every concept must have.

Two things differ from writing the news article, and only these two:

- **Write it evergreen.** No "today", no trigger event, no framing around
  what just happened — a concept exists independent of any single day's
  news. Where the news template has a field anchored to an action
  ("Launched — date, and by whom"), the concept states that same fact
  plainly, as permanent history, not as today's headline.
- **Write it full, not trimmed.** The trimming rule under "When this
  article links a background concept" (in the Format Library section
  below) applies to the *news article*, never to the concept. The concept
  is exactly where that definitional weight is supposed to end up — give
  every field that genuinely applies its full due, not a shortened version.

Everything else about how you write it is identical to any other article:
the same fact-field-vs-list-field split, the same shared "Basic Details"
heading, the same bold-inside-values rule, the same discipline against
turning a single fact into its own heading. Composing a concept is not a
different writing task from composing a news article — it's the same task,
aimed at a topic instead of an event.

This only applies when composing a **new** concept. An existing concept
you're reusing keeps whatever structure it already has — see "Reuse the
concept" above.

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

Frame every article the same way the `current-affairs` skill frames a study
entry: a short universal spine, then a body assembled from whichever format
in the library below actually matches the story. Don't force every story
through one fixed set of headings — a scheme launch, a court judgment, a
report release, and an appointment don't carry the same kind of information.

### Always present, in order

1. **Title** — a title-case headline naming the topic, written by you. Don't
   just adopt the phrasing the user gave you when they described the topic,
   or copy a source article's own headline verbatim — a source headline is
   often written for clicks, not precision, and the user's own phrasing was
   a topic description, not a drafted title. State exactly what happened,
   built around the specific figure, entity, ruling or decision that makes
   this story what it is, in as few words as that actually requires.
   Qualifier clauses stitched on for exhaustiveness ("...as X% of Y across
   Z, following W") cost readability without adding anything a title needs
   — that detail belongs in "Key Facts" or the Introduction, not squeezed
   into the headline. If the source or the user's phrasing already is
   precise, keep it; don't rewrite for the sake of rewriting.
2. **Why in the News?** — a short lead stating the trigger event and its
   date; bold the key facts/figures.
3. **Introduction** — one plain sentence stating what the topic
   fundamentally *is*, in language a newcomer would understand. Never skip
   straight from "Why in the News" into field-by-field details without
   this line. **If this article links a background concept** (see "First
   occurrence vs development" above), this is also where the recap goes:
   extend the Introduction to two or three sentences — state what the
   concept is, then move straight into today's development. The concept
   article carries the full explanation; this is not the place to repeat
   it. For the de-addiction example: *"The Nasha Mukt Bharat Abhiyaan,
   launched in 2020 under the Ministry of Social Justice and Empowerment,
   runs India's demand-reduction drive against substance abuse across its
   most vulnerable districts."* — then straight into the approval.
4. The topic-specific body — assembled from whichever format below matches
   the story; combine building blocks if it straddles more than one.
5. *Source* — italic closing line naming the source(s) used.

### Format Library — pick the body that fits the story

Each template below lists **fields**, but a field is not automatically a
heading. Every field is one of exactly two kinds, and confusing them is the
single most common formatting mistake this skill produces:

- **A fact field** — one short, named attribute (ministry, date, outlay,
  who they are). A fact field is a single bulleted line: the label bold,
  the value after it — `**Ministry:** Ministry of Youth Affairs and
  Sports.` It never gets its own heading. All the fact fields in a template
  are grouped together under **one shared heading, "Basic Details"** — one
  `## Basic Details` for the whole group, not one heading per fact.
- **A list field** — something that genuinely has several items or points
  (Salient Features, Key Findings, Significance, Functions & Powers, and
  similar). A list field gets its own heading, and under that heading is an
  actual bulleted or numbered list — real list markup (`-` lines in your
  Markdown, which becomes `<ul><li>` in the stored HTML), never a paragraph
  of sentences run together. If a list field only has one genuine point,
  write one bullet — still a bullet, not a sentence loose under a heading
  with nothing else in it.

Skeleton for a scheme launch, to make the shape unambiguous:

```
## Basic Details
- **Ministry:** Ministry of X.
- **Launched:** 2 August 2026, by the Prime Minister.
- **Objective:** ...
- **Beneficiaries:** ...

## Salient Features
- First feature, one clean sentence.
- Second feature, one clean sentence.

## Significance
- First angle, most important first.
- Second angle.
```

Never emit a heading for a single fact — no `## Launched`, no `## Aim`, no
`## Who They Are`. If you catch yourself about to write `##` immediately
followed by a two- or three-word label with one short line under it, that's
a fact field: move it into "Basic Details" instead.

**Bold inside a value, not just the label.** A value that names a
particular figure, threshold, Act, body or deadline gets that specific
detail bolded too, not just the field label — `**Aim:** To ensure every
inhabited village has access to a banking outlet **within 5 km**.` Bold
what a reader would scan for, not every word — one or two salient terms per
line, not the whole sentence.

**When this article links a background concept, don't use a template
below at full length.** Every field in it assumes the reader knows nothing
about the entity yet — correct for a first occurrence, wrong for a
development. Once a concept exists, its evergreen facts (what the thing is,
its legal basis, its general design, the standards it runs on) live *there*,
not here. Keep only whichever fields — or parts of a field — are actually
about *today's* development: what's new, what changed, the figures specific
to this action. Ask of each field: would this line read identically whether
posted today or a year ago? If yes, it belongs in the concept, not repeated
here — drop it, or fold a one-clause version into the Introduction's recap
instead of giving it its own section. A linked article should end up
noticeably shorter than a first-occurrence one on the same kind of story,
because the definitional weight moved to the concept.

**Scheme, policy or government initiative launch**
- *Basic Details:* Ministry / implementing body. Launched — date, and by
  whom. Objective — official framing, simplified language, without
  changing the meaning. Beneficiaries — who's included, who's excluded.
  Financial Outlay, if applicable — sub-bullets if there are multiple
  components.
- *Own heading, real list:* Salient Features — the scheme's design, as an
  ordered list. Don't add a separate "Achievements / Progress So Far" field
  — a scheme that was just launched has no track record yet. If the story
  genuinely is about an implementation milestone (cards issued, funds
  disbursed), that dated figure is its own bullet here, not its own
  heading.
- *Own heading, real list:* Significance — one angle per bullet, ordered by
  importance.

**Report, index or ranking release**
- *Basic Details:* Released by. Aim.
- *Own heading, real list:* Key Findings.
- *Own heading, real list:* Key Recommendations.
- *Own heading, real list:* Significance.

**Organisation, institution, committee or body in the news**
- *Basic Details:* Formation — who/when established, legal basis. Aim &
  Objective — official framing, simplified language.
- *Own heading, real list:* Functions & Powers.
- *Own heading, real list:* Significance.

**Judicial or legal development**
- *Basic Details:* Case/matter name, court and bench, Article/Section
  invoked.
- *Own heading:* The Ruling — the order itself. A single-point ruling can
  be one bullet or two clean sentences; a multi-point one is a real list.
- *Own heading, real list:* Significance.

**Personality in the news**
- *Basic Details:* Who they are, in one line. The biographical details tied
  to why they're in the news today — not a full biography.
- *Own heading, real list:* Significance / Legacy.

**International or bilateral development**
- *Basic Details:* Countries/bodies involved.
- *Own heading:* The Agreement or Outcome — key figures present, terms
  reached. Real list if there are several distinct outcomes.
- *Own heading, real list:* Significance.

**Science & technology development**
- *Basic Details:* Organisation involved. What it is — a brief,
  easy-to-understand description of the technology, discovery or mission.
- *Own heading, real list:* Technological Concepts Involved — the
  standards, frequencies or mechanisms at work, with examples where
  possible.
- *Own heading:* Applications — stated purpose or use cases. Real list if
  there's more than one.
- *Own heading, real list:* Significance.

If a story doesn't fit any of these cleanly, use judgment — but the
fact-field-vs-list-field split above still applies. Dense, scannable
content (exact figures, dates, Article/Section numbers, official scheme
names) beats prose either way; smart structure beats mechanically following
a field list into headings that don't deserve to be headings.

**Voice:** neutral, factual, analytical — a briefing, not an opinion piece.

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
- **No heading exists for a single fact.** Scan every `##` — if what's under
  it is one short line about one named attribute, that's a "Basic Details"
  fact, not a heading. Merge it in before committing.
- **Every list field is an actual list.** Key Findings, Significance,
  Salient Features and similar — check they rendered as bullets, not a
  paragraph of sentences run together.
- **Is the title precise, not just the source or the user's phrasing
  copied through?** A title stitched together from qualifier clauses is the
  kind of thing that also produces an unreasonably long slug — tighten it.
- **If this article links a concept, is the body actually trimmed?** Reread
  the topic-specific section against the concept it links — if a field
  restates evergreen facts the concept already carries, cut it before
  committing rather than leaving the full first-occurrence-shaped template in.
- **If you composed a new concept, does it have its own category?** This is
  separate from the article check above — `ca_parse` never sees the concept,
  so nothing resolves it automatically. Confirm you set
  `concept.category_node_ids` (or deliberately decided the entity is
  cross-cutting) before calling `ca_link_concept`.
- **If you composed a new concept, is it actually full, not trimmed?**
  Reread it against the Format Library template you picked — every field
  that genuinely applies to the entity should be there at full depth. The
  trimming rule is for the news article, never for the concept.

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
- Don't repeat the concept's full explanation inside the Introduction of an
  article that links it — a short recap, not a rewrite.
- Don't assume a new concept inherits the news article's category — look up
  the entity's own category separately, or state that you're deliberately
  leaving it uncategorised and why.
- Don't re-categorise an existing concept as a side effect of linking a new
  article to it. Flag a gap you notice; don't silently fix it.
- Don't trim a concept's fields down for brevity. Trimming is for the news
  article that links it, never for the concept itself.
- Don't force a fixed section list onto every concept. Pick whichever
  Format Library template actually fits the entity, the same as you would
  for a news article about it — the topic decides the shape, not a
  template borrowed from somewhere else.
- Don't use a Format Library template at full length on an article that
  links a concept. Definitional fields (what the entity is, its legal
  basis, its general design, standards it runs on) belong in the concept —
  repeating them in the news article is the exact duplication concepts
  exist to remove.
- Don't treat the user's topic phrasing or a source's headline as the
  title. Write your own precise one — see "Title" above.
- Don't turn a single fact into its own heading. "Ministry", "Launched",
  "Aim", "Who they are" and similar are one bulleted line each under
  "Basic Details" — never `## Launched` with one sentence under it.
- Don't leave a list field (Key Findings, Significance, Salient Features,
  Functions & Powers) as a paragraph. It's a real bulleted or numbered
  list, always.
- Don't bold only field labels and leave the values plain. Bold the
  specific figures, thresholds, Act names or deadlines inside a value too
  — that's what a reader is actually scanning for.

## Adjusting the format later

This skill's format spec (the Format Library, the common spine, sourcing
rules, or anything else in this file) is meant to be a persistent, editable
spec, not something re-decided each run. If the user asks to change any of
it, update this skill and re-save it (via the skill-saving tool with
overwrite) rather than only applying the change ad hoc for one run — editing
the skill's files on disk directly does not persist, so a real change has to
go through re-saving the skill itself.
