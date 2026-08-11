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

A Mains Note is the **durable topic page** — the one place a student returns
to for everything on "Electoral System of India" or "India-China Relations".
It should read the same and be just as useful in two years. It is never a
write-up of one day's event.

**A note is a notebook, not an encyclopedia.** It carries keywords, dated
pointers and passing references, gathered from all around — not full
explanations. A student scanning it should see *what* matters and *where to
read more*, in a form that can be recalled in an exam hall. Anything that
needs paragraphs of explanation belongs in a **concept page**, which the
note links to (see "Concepts — where full explanations live"). Keeping
explanation out is what stops these notes turning into unusable walls of
text as they accumulate material over months.

### Always present, in order

1. **Title** — the topic itself, not an event: *"Electoral System of
   India"*, not *"SC Ruling on NOTA"*. One topic per note.
2. **Syllabus Mapping** — the GS paper and the exact syllabus phrase.
3. The subject-specific body — from the Format Library below.
4. **Answer Framework** — how to structure a ~250-word answer: what the
   introduction, body and conclusion should each do.

### Format Library — pick the body that fits the subject

Don't force every topic through one fixed set of headings. A polity
institution, a bilateral relationship, an economic mechanism and an
environmental issue don't carry the same kind of information. Pick the
template whose subject matches, and **use its heading names exactly as
written** — pointers get routed to sections by name, so a note whose
headings are improvised has nowhere predictable to route them to.

Skip a section that genuinely doesn't apply rather than padding it. Add one
the template lacks if the topic truly needs it.

**Polity, Governance and Constitution** — institutions, systems, rights,
bodies. *(The shape the user specified; treat it as the reference pattern.)*
- *Overview* — what this institution/system is, in plain language, and why
  it exists.
- *Components and Constituents* — its parts and who/what each is. Real list.
- *Constitutional and Legal Provisions* — Articles, Acts, rules, with exact
  citations. Real list.
- *Evolution* — a **chronology**, oldest first, showing how the present
  shape was formed: colonial-era origin → Constituent Assembly debate →
  each amendment, statute and landmark judgment that changed it. One dated
  bullet per step, in order. This is the section that grows most as
  developments land.
- *Issues and Challenges* — what is actually wrong with it now. Real list.
- *Recommendations and Reforms* — committee proposals and expert
  recommendations answering those issues, each named. Real list.

**International Relations** — bilateral/multilateral relationships, groupings.
- *Overview* — the relationship in one paragraph.
- *Historical Evolution* — chronology of the relationship's phases.
- *Pillars of Cooperation* — trade, defence, energy, diaspora, technology;
  one bullet each, with figures.
- *Areas of Friction* — disputes and irritants. Real list.
- *India's Strategic Interests* — what India actually wants here.
- *Way Forward* — specific, not generic.

**Economy** — mechanisms, sectors, policy instruments.
- *Overview* — what it is and where it sits in the economy.
- *How It Works* — the mechanism, step by step.
- *Institutional and Regulatory Framework* — who governs it, under what law.
- *Current Status and Data* — figures with their source and year. Real list.
- *Issues and Challenges* — real list.
- *Reforms and Recommendations* — committee-named where possible.

**Environment and Ecology** — ecosystems, species, climate, pollution.
- *Overview* — what it is and its ecological significance.
- *Legal and Policy Framework* — domestic Acts and rules.
- *International Conventions and Commitments* — treaties, targets, India's
  position.
- *Threats and Drivers of Degradation* — real list.
- *Conservation Measures* — schemes, protected areas, restoration efforts.
- *Way Forward*.

**Science and Technology** — technologies, missions, emerging domains.
- *Overview* — what it is, in language a non-specialist follows.
- *How It Works* — the underlying mechanism or principle.
- *Applications* — real list.
- *India's Ecosystem and Capability* — bodies, missions, indigenous
  capacity, where India stands.
- *Regulatory and Ethical Issues* — real list.
- *Way Forward*.

**Society and Social Justice** — vulnerable sections, social issues,
welfare.
- *Overview* — the issue and who it affects.
- *Constitutional and Legal Safeguards* — Articles, Acts, exact citations.
- *Data and Status* — figures with source and year.
- *Causes and Structural Drivers* — real list.
- *Government Interventions* — schemes and programmes, named.
- *Issues in Implementation* — real list.
- *Way Forward*.

**Ethics (GS-IV)** — concepts, values, applied ethics.
- *Overview* — the concept defined precisely.
- *Philosophical Foundations* — thinkers and schools, named.
- *Application in Public Administration* — how it plays out in real
  administrative life.
- *Case Studies* — two or three concrete instances. Real list.
- *Ethical Dilemmas Involved* — the genuine tensions, both sides.
- *Way Forward*.

**History, Art and Culture** *(To be defined)*
- Sections: *to be filled in.* Until then, use the fallback below and say so
  in your report rather than presenting an invented shape as house style.

**Geography** *(To be defined)*
- Sections: *to be filled in.* Same fallback until then.

**Fallback for any subject not yet defined above** — build from: *Overview →
Features/Characteristics → Evolution or Distribution → Significance → Issues
→ Way Forward*, keeping the same fact-vs-list discipline.

<!-- FORMAT LIBRARY — subject templates.
     Add or edit templates here, then re-save the skill (see "Adjusting the
     format later"). Keep each entry in the same shape: a bold subject name,
     then its sections as an italicised list, heading names written exactly
     as they should appear in the note — pointers are routed to sections by
     name, so renaming a heading here changes where developments land.
     Add further subjects below this line. -->

**A note on adding subjects:** heading names inside a template are
load-bearing, not decorative. Pointers from summaries and daily news are
routed to sections *by name*, so if you rename "Issues and Challenges" to
something else in a template, existing notes built on the old name and new
ones built on the new name will diverge. Rename deliberately, and expect to
update existing notes of that subject if you do.

### Sections shared by every template

Add these to whichever template you picked, unless genuinely inapplicable:

- **Committees, Reports and Data** — named sources with their actual
  findings, not just a list of names.
- **Case Studies and Examples** — two or three concrete, verifiable
  instances (skip if the template already has its own Case Studies).

### Fact fields vs list fields

Same discipline as the daily-news skill. A **fact field** is one short named
attribute — a bulleted line with a bold label, never its own heading. A
**list field** genuinely has several points — it gets its own `##` heading
with a real bulleted list under it (`-` lines in your Markdown), never a
paragraph of sentences run together. Never emit a `##` heading for a single
short fact.

**Voice:** write for permanence — avoid "recently", "last month", or
anything that dates the note. Where a fact is genuinely time-bound (a
committee's report year, a judgment's year), state the year explicitly.
Length 800-1200 words for a new note — the longest content type here, so
budget research time before you start writing. A mature note that has
accumulated pointers over months will be considerably longer, and that's
correct.

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

## Source and SEO — fill these on every commit

Both are passed per article in `ca_commit`. Mains Notes currently have the
worst coverage of any content type here — most have none of these fields —
so treat them as part of writing the note, not an afterthought.

### Source

A note is built from many sources, so a single `source_url` rarely captures
it. Use:

- `source_name` — the principal bodies or documents the note draws on, e.g.
  `"MHA / NCORD; Ministry of Law and Justice"`. Leave out rather than
  padding with a vague label.
- `source_url` — only when the note genuinely rests on **one** identifiable
  document (a committee report, an Act's text). Otherwise omit it. The
  per-pointer reference links inside the body carry the real sourcing.

**Never invent a URL.**

### SEO — every note

- `seo_title` — up to ~60 characters, built on the topic name a student
  would search: *"Electoral System of India: Structure, Issues and
  Reforms"*.
- `seo_description` — 140-160 characters saying what the note covers and
  who it's for. A note is a study page, so say so: what a reader can revise
  from it.
- `keywords` — 5-10: the topic, its main institutions and statutes, the GS
  paper, and the syllabus theme.

Because a note accumulates pointers over months, revisit `seo_description`
when the note's scope genuinely widens — but that's an edit like any other,
so propose it and wait.

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
- **Every section of the chosen template is there**, in order, with its
  heading name written exactly as the template gives it — this is the
  content type most likely to quietly lose a section under length pressure,
  and a renamed heading is where later pointers fail to route.

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

## Concepts — where full explanations live

A note gives keywords and passing references. When a term in it genuinely
needs a full explanation — what electoral bonds *are*, how the Model Code of
Conduct works, what the Basic Structure doctrine holds — that explanation
belongs in a **concept page**, not in the note. The note carries the
keyword and a link; the concept page carries the depth.

This is the same concept pool the daily-news skill uses, so a concept
written for a news article is reused by the note, and vice versa — one
concept, many referrers.

### Which terms earn a concept page

**The bar is high, and deliberately so.** A thin page on a passing term is
worse than no page at all — once it exists, every later article links to it.

A concept page is for an entity **substantial enough to stand on its own and
needing a full description**: an institution, statutory body, scheme,
doctrine, index or law that recurs across topics. If the Monetary Policy
Committee is in the news and you are writing a note about it, the MPC earns
a page — it has a composition, a legal basis, a mandate and a history worth
several paragraphs, and it will come up again in a dozen future notes.

It does **not** apply to:
- a term adequately handled by one line in the note
- a phrase that appears in this one topic and nowhere else
- a passing reference you would not expect a student to stop and look up
- anything you are creating mainly so a keyword has somewhere to point

When in doubt, keep it as a keyword. A keyword can be promoted to a page
later; a thin page is awkward to undo.

### The flow

1. **Search first, always.** `ca_find_concepts` with the entity name. If a
   concept already exists, **reuse that exact id** — never write a second
   copy because the existing one looks thin. A duplicate splits the
   concept's timeline and both halves are then wrong. Reuse needs no
   confirmation from anyone; it is always the preferred outcome.
2. **If none exists**, apply the bar above. If the term doesn't clear it,
   leave it as a keyword and move on — don't mention it as a missed
   opportunity.
3. **If it does clear the bar, ask the user.** Say what the page would
   cover and why a keyword alone isn't enough, then wait. **The tool
   enforces this for notes** — creating a new concept from a Mains Note
   without `confirm_new_concept: "user-approved"` is refused outright, and
   the refusal explains the bar. Treat that refusal as the rule working, not
   an error to route around.

   *(Daily news is deliberately exempt: a news article's concept is the
   entity the story is about, chosen by the same research that produced the
   article, so it is created automatically there. A note is the opposite
   case — it mentions many entities in passing, which is why the call
   belongs to a human here.)*
4. **On agreement**, `ca_link_concept` with `concept: {...}` and
   `confirm_new_concept: "user-approved"` composes and links it in one call
   (it still reuses silently if the slug or title already matches, so this
   cannot create a duplicate by accident). Set `is_core` to false for a
   note — a topic note touches many concepts in passing; it rarely has one
   single "core" concept the way a news article does.

## Pointers — how developments enter a note

This is the mechanism that makes a Mains Note a living topic page rather
than a one-off write-up. **The note does the looking** — it goes out and
finds material worth referencing. Nothing pushes into it from the other
side; a daily news article never hunts for a note to feed.

Two kinds of dated content are worth pulling from:

- **Editorial Summaries** — arguments, evaluations, expert positions.
- **Daily news articles** — judgments, committee reports, bills, data
  releases. A Supreme Court ruling on NOTA is filed as daily news, and it
  belongs in the electoral-system note just as much as any summary does.

*(The one exception in the other direction: the editorial-summary skill does
check for an existing note when a summary is written, since a summary is
Mains material by definition. Daily news does not.)*

### The rule: route to the section, don't append to the end

A pointer goes into **the section it actually belongs to**, never into a
"Recent Developments" dump at the bottom. That routing is the whole point —
a student reading *Evolution* should see the 2024 judgment in its
chronological place, and a student reading *Issues* should see the problem
that judgment exposed.

Worked example, a ruling striking down a provision of the electoral system:

- the ruling itself, dated → **Evolution** (in chronological position)
- the problem it exposed → **Issues and Challenges**
- what the court directed → **Recommendations and Reforms**

One development can legitimately touch two or three sections. It can also
touch exactly one — don't manufacture entries to fill every heading.

### Pointer format

Each pointer is **one bullet**: the substance stated to the point, then the
reference link. Never paste the source's paragraphs in — a note is a
notebook of pointers, not an anthology.

```html
<li><strong>2024:</strong> SC struck down the electoral bonds scheme as
violative of Article 19(1)(a).
<a href="https://waytoias.com/current-affairs/articles/the-slug">Source</a></li>
```

Use the **exact `reference_url`** that `ca_link_to_mains_note` returns — do
not compose a URL by hand from the title or guess the slug.

Write the pointer so it stands on its own. The link is there for a student
who wants the full explanation, not a substitute for saying what happened.

### The workflow

Do this after committing a new note, and whenever a development should enter
an existing one:

1. **Go looking for the sources.** `ca_find_articles` on the topic/entity
   name — once with `content_kind: "daily_editorial_summary"`, once with
   `content_kind: "daily_current_affairs"`. Search on more than one phrasing
   if the first returns little; an empty result usually means the search
   term was too narrow, not that nothing exists.
2. **Read the note as it stands now.** `ca_get_article` on the topic —
   always immediately before proposing an edit, so you're working from the
   current body and not a stale copy from earlier in the session.
3. **Decide what actually adds something.** Skip a source whose substance is
   already in the note. A name match is not a reason to link — if the
   article doesn't genuinely bear on this topic, leave it out and say so.
4. **Propose to the user, and wait.** State: which source, which section(s)
   it goes into, and the exact bullet text you'd add. Never write first and
   report after.
5. **On agreement, make two calls:**
   - `ca_update_article` — the note's full body with the pointers merged
     into their sections, `confirm_change: "user-approved"` (plus
     `confirm_live_edit` if the note is published).
   - `ca_link_to_mains_note` — records the relation, `confirm_change:
     "user-approved"`.

   One agreement covers both calls. Don't ask twice for the same change.

**Body edits replace the whole body**, so send the existing note with your
additions merged in — never just the new bullets, which would wipe
everything else.

### What not to do here

- Don't append a pointer to the end of the note because routing it was
  harder.
- Don't restate a development already covered — check before adding.
- Don't link a source that doesn't genuinely bear on the topic.
- Don't paste summary paragraphs into the note. Pointers, with links.
- Don't explain a concept at length inside the note — that's what a concept
  page is for. Keyword plus link.
- Don't create a second note on a topic that already has one. If the
  existing note is thin, that's a reason to improve it in place.
- Don't create a second concept when `ca_find_concepts` already returned
  one. Reuse the id.

## What not to do

- Don't write about a topic you couldn't find real grounding for. Say so.
- Don't invent a source name or citation to fill a thin section.
- Don't publish live because it was convenient, only because it was asked.
- Don't drop sections from the chosen template to save time. Skipping one
  that genuinely doesn't apply is fine; thinning the note because it got
  long is not.
- Don't invent a structure for a subject marked *To be defined*. Use the
  fallback and say which you used.

## Adjusting the format later

This skill's format spec — the Format Library, the shared spine, the
pointer-routing rules, the concept bar, or anything else in this file — is a
persistent, editable spec, not something re-decided each run.

If the user asks to change any of it, **update this skill and re-save it**
(via the skill-saving tool, with overwrite) rather than only applying the
change for one run. Editing files on disk does not persist to the installed
skill; a real change has to go through re-saving the skill itself.

Two things to be careful with when editing the Format Library:

- **Heading names are load-bearing.** Pointers route to sections by name.
  Renaming a heading in a template splits existing notes from new ones.
- **A subject marked *To be defined* is deliberately empty**, not an
  oversight. Filling one in is a real editorial decision — confirm the
  section list with the user before writing it in, the same as any other
  change to their content.
