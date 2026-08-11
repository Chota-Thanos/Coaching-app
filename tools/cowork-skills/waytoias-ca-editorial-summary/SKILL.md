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

### Format Library — variants by editorial type

The six sections above are the **default**, and they fit most opinion
pieces. Some editorial types carry a different kind of information and
deserve their own shape — the same way the daily-news skill picks a template
per story type rather than forcing one set of headings on everything.

**How to use this library:** if a variant below matches the editorial, use
its sections in place of the default body (the spine — Context first, Mains
Angle last — stays either way). If none matches, use the default. A variant
that is still marked *"To be defined"* has no agreed shape yet: use the
default and say so plainly in your report, rather than inventing a
structure and presenting it as house style.

<!-- FORMAT LIBRARY — editorial variants.
     Add or edit templates here, then re-save the skill (see "Adjusting the
     format later"). Keep each entry in the same shape: a bold type name,
     one line on when it applies, then its sections as a list. -->

**General editorial / opinion piece** *(default — defined above)*
- Context → The Core Argument → Supporting Points → Counter-View →
  Evaluation → Mains Angle.

**Judgment or legal commentary** *(To be defined)*
- When it applies: an editorial arguing about a court ruling, a
  constitutional question or a piece of legislation.
- Sections: *to be filled in.*

**Economic or data-led editorial** *(To be defined)*
- When it applies: an editorial built on figures — a budget, an index, a
  policy's measured effect.
- Sections: *to be filled in.*

**Foreign policy or international relations editorial** *(To be defined)*
- When it applies: an editorial on a bilateral relationship, a treaty, or
  India's position in a grouping.
- Sections: *to be filled in.*

**Social issue or governance editorial** *(To be defined)*
- When it applies: an editorial on a welfare question, a vulnerable
  section, or an administrative failure.
- Sections: *to be filled in.*

<!-- Add further editorial types below this line. -->

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

## Concepts — the entity the editorial argues about

An editorial argues *about* something: a Bill, an Act, a scheme, an
institution, a doctrine. That entity usually deserves a concept page — the
evergreen explainer of what it actually is — so a student who hasn't met it
before can follow the argument. The summary carries the argument; the
concept carries the definition.

**A summary with no concept attached is the common gap.** If the editorial
turns on an entity a reader might not know, check before you finish.

### Which entity earns a page

The bar is the same as everywhere else: an entity **substantial enough to
stand on its own and needing a full description** — an institution,
statutory body, scheme, doctrine, law or index that recurs across topics.

An editorial names several things in passing while making its case. Usually
**only one** of them is what the piece is actually about; that's the
candidate. The rest stay as ordinary mentions.

### The flow

1. **Search first, always.** `ca_find_concepts` with the entity name, and
   try more than one phrasing — a law is often filed under its formal name
   rather than the phrase the editorial used. If a concept exists,
   **reuse that exact id**; never write a second copy because the existing
   one looks thin. Reuse needs no confirmation and is always the preferred
   outcome.
2. **If none exists**, apply the bar. If the entity doesn't clear it, leave
   the summary without a concept — that's a normal outcome, not a failure.
3. **If it does clear the bar, ask the user.** Say what the page would
   cover and why the summary reads incompletely without it, then wait.
   **The tool enforces this** — creating a new concept from a summary
   without `confirm_new_concept: "user-approved"` is refused outright, and
   the refusal restates the bar. Treat that refusal as the rule working,
   not an error to route around.
4. **On agreement**, `ca_link_concept` with `concept: {...}` and
   `confirm_new_concept: "user-approved"` composes and links it in one call
   (it still reuses silently if the slug or title already matches, so this
   cannot create a duplicate by accident). Use `is_core: true` — for a
   summary there is normally exactly one entity the piece is about.

Write the concept body **evergreen**: no "recently", no "this week", no
dates tied to this editorial. It has to still read correctly in three
years, and it will be linked from future articles that have nothing to do
with today's piece.

*(Daily news is exempt from the confirmation step — its concept is the
entity the story is plainly about. Summaries and Mains Notes ask, because
both name several entities while making their case.)*

## After committing — check for a Mains Note topic

A summary is one dated piece; a Mains Note is the durable topic it feeds —
many summaries contribute to one note over time (several India-China
summaries across months all feed the one "India-China Relations" note).
Do this after every `ca_commit`, once the summary has an id:

1. **Search for the topic** — `ca_find_articles` with the entity/topic name
   and `content_kind: "mains_topic_note"`.

2. **If a topic exists:** read it with `ca_get_article`. Identify which of
   its **section headings** this summary's content actually adds to —
   usually one or two, not all of them. A note's sections are named things
   (*Issues and Challenges*, *Evolution*, *Recommendations and Reforms*, and
   so on, depending on subject); route each pointer to the section it truly
   belongs to, never to a "Recent Developments" dump at the bottom.

   Pull out only the pointers worth a student remembering (a fact, a figure,
   a named argument), not the whole summary. Each pointer is one bullet:
   the substance to the point, then a reference link back to this summary —
   using the exact `reference_url` that `ca_link_to_mains_note` returns,
   never a hand-composed URL.

   **Propose this to the user before touching anything**: which section(s),
   and the exact bullet text. Wait for agreement.

   Once agreed: merge the new pointers into the topic's existing body under
   the matching headings (`ca_get_article` again if time has passed, so
   you're editing the current body, not a stale copy) and save with
   `ca_update_article`, `confirm_change: "user-approved"` (plus
   `confirm_live_edit` if the topic is published) — the body replaces the
   whole body, so send the existing note with your additions merged in, not
   just the new bullets. Then record the link with `ca_link_to_mains_note`,
   same confirmation. Two calls, one agreement — don't ask twice for the
   same change.

3. **If no topic exists:** tell the user plainly — "no Mains Note exists yet
   for X" — and propose creating one. Don't create it yourself. If they
   agree, write it through the normal `waytoias-ca-mains-notes` flow, then
   link the two with `ca_link_to_mains_note`.

4. **Never re-summarise the same ground into a second topic.** If a topic
   already exists but looks thin, that's a reason to improve it in place
   (step 2), never to start a competing one.

## What not to do

- Don't summarise an editorial you couldn't actually find or read — say so.
- Don't invent a source name or URL to make the piece look better-cited.
- Don't publish live because it was convenient, only because it was asked.
- Don't skip or shrink the Counter-View section to save time.
- Don't invent a shape for a variant marked *To be defined*. Use the default
  and say which you used.
- Don't create a concept page for every entity the editorial names. One
  piece is about one thing; the rest are mentions.
- Don't create a second concept when `ca_find_concepts` already returned
  one. Reuse the id.

## Adjusting the format later

This skill's format spec — the default structure, the Format Library, the
sourcing rules, or anything else in this file — is a persistent, editable
spec, not something re-decided each run.

If the user asks to change any of it, **update this skill and re-save it**
(via the skill-saving tool, with overwrite) rather than only applying the
change for one run. Editing files on disk does not persist to the installed
skill; a real change has to go through re-saving the skill itself.

A variant marked *To be defined* is deliberately empty, not an oversight.
Filling one in is a real editorial decision — confirm the section list with
the user before writing it in, the same as any other change to their
content.
