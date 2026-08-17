---
name: "waytoias-ca-daily-news"
description: "Research, write and publish a Daily Current Affairs news article for the WayToIAS UPSC coaching website's Current Affairs → Daily News section, splitting off a reusable background concept when the story is a development on something that already exists. Use whenever the user asks to write, draft, research or post a daily current-affairs piece, \"today's CA\", or a news-style current-affairs article for WayToIAS/waytoias.com (e.g. \"write today's daily CA on the RBI's rate decision\", \"draft a current affairs piece on the new PM-KISAN guidelines\", \"post this news story to current affairs\"). Do NOT use this for an editorial/opinion summary (use waytoias-ca-editorial-summary), a durable Mains topic note (use waytoias-ca-mains-notes), or PYQs (use waytoias-ca-prelims-pyq / waytoias-ca-mains-pyq). Requires the coaching-posting-agent MCP server (whoami, ca_parse, ca_commit, ca_find_concepts, ca_link_concept tools) to be connected."
---

# Writing and posting Daily Current Affairs for WayToIAS

You are the writer — not a tool you call. You research the topic yourself (web search, or a link the user gives you) and write the article in your own words. The app's own AI still has a job here, but a different one: it takes what you wrote and files it — the right category, the right date, the right shape for the database — exactly the way it already does when a human uploads a Word document. **You are replacing the document, not the filing step.**

**How these articles are different from a plain news summary:** they give a reader both the day's update and enough concept detail to actually understand it, in the same simple, active-voice style throughout. Balance simplification against usefulness for a UPSC aspirant — never simplify away a term or distinction that the exam actually tests.

## The four-step flow

1. **Check for an existing concept** — call `ca_find_concepts` with the name of the law, scheme, body or index the story is about. What comes back feeds into how you write (see "Framing the news article — three types" below).
2. **Research and write**, following the structure below, as plain markdown.
3. **Hand it off for filing** — call `ca_parse` with your text as `raw_text` and `content_kind: "daily_current_affairs"`. Its own AI resolves the category and date and normalises the shape. Nothing is saved yet.
4. **Review, save, then link** — check what came back (see "Before you commit"), call `ca_commit` with `content_kind: "daily_current_affairs"` (default `publish_mode: "review"`), then call `ca_link_concept` with the article id the commit returned.

### Before you start

Run `whoami` once per session. If it fails, the connection isn't working — say so and stop; don't try to work around it.

**How to reconnect depends on how you're running.** If you're running locally (Claude Desktop or Claude Code, spawned as a process on the user's own machine), the fix is local: the user should fully quit and reopen Claude Desktop, or check their MCP config for a wrong path or key. If you're a **remote/online connected app** (Gemini's "custom connected app," or similar — anything reached over the internet rather than spawned locally), a failed `whoami` almost always means the login has expired, not that anything is broken — the server holds sessions in memory and a routine restart on its end clears them, with no warning to you. There's nothing local to diagnose in that case. Tell the user plainly that the connection needs re-authorising, and that the fix is to disconnect and reconnect this app in wherever they manage connected apps/integrations for the assistant you're running in — that triggers a fresh sign-in.

## Concepts — reuse, structure, and categorisation

How the news article itself gets framed — and how much of a given topic belongs in the news article versus the linked concept — is covered in "Framing the news article — three types" below. This section covers the mechanics of the linked concept itself, once you know which one(s) an article needs.

### Reuse the concept — never write a second copy

`ca_find_concepts` comes first for a reason. If a concept for that entity already exists, link that exact id. Do not compose a fresh one because the existing body looks thin or you'd have phrased it differently — a duplicate splits that concept's news timeline in two and both halves are then wrong. If the existing primer genuinely needs improving, raise it with the user and improve it in place with `ca_update_article` — don't fork it.

Only pass `concept: {...}` to `ca_link_concept` when the search genuinely found nothing. Write that body evergreen: no "recently", no "this week", no dates tied to today's story. It has to still read correctly in three years.

### Structure the concept body — the same Format Library, written evergreen

A concept isn't a separate document type with its own fixed spec. It's the same shape the news article itself would use, chosen the same way: pick whichever template in the Format Library below actually fits the entity — a scheme's concept uses the scheme template, an index's concept uses the report/index template, a regulatory body's concept uses the organisation template. The topic decides the shape. There is no universal list of sections every concept must have.

Two things differ from writing the news article, and only these two:

- **Write it evergreen.** No "today", no trigger event, no framing around what just happened — a concept exists independent of any single day's news. Where the news template has a field anchored to an action ("Launched — date, and by whom"), the concept states that same fact plainly, as permanent history, not as today's headline.
- **Write it full, not trimmed.** The trimming rule under "When this article links a background concept" (in the Format Library section below) applies to the news article, never to the concept. The concept is exactly where that definitional weight is supposed to end up — give every field that genuinely applies its full due, not a shortened version.

Everything else about how you write it is identical to any other article: the same fact-field-vs-list-field-vs-narrative-field split, the same shared "Basic Details" heading, the same bold-inside-values rule, the same discipline against turning a single fact into its own heading. Composing a concept is not a different writing task from composing a news article — it's the same task, aimed at a topic instead of an event.

This only applies when composing a **new** concept. An existing concept you're reusing keeps whatever structure it already has — see "Reuse the concept" above.

### Give the new concept its own category — a separate decision from the article's

A concept is filed under the subject the entity itself belongs to, which is frequently not the category the day's news article lands under. The Index of Core Industries concept belongs under Economy → Index & Reports; whichever single month's update article happens to be about — say a methodology revision — might get filed by `ca_parse` under Banking & Monetary Policy on its own merits. Both are correct. They are two separate lookups, not one shared value, and composing the concept without doing this lookup is how a concept ends up uncategorised.

When composing a new `concept: {...}`, call `list_current_affairs_categories` for the entity, not the news event, and pass the id(s) as `concept.category_node_ids` (first id is primary). Do this at the same time you write the concept body — it's part of composing the concept, not an afterthought before commit.

Sometimes the concept genuinely doesn't need one — a handful of entities are cross-cutting enough that no single node fits. That's fine, but it's a judgment call you state, not a default you fall into: if you're omitting `category_node_ids` because you're unsure rather than because it's genuinely cross-cutting, say so to the user instead of guessing. An uncategorised concept is exactly as invisible on the site as an uncategorised news article — see "Before you commit" below.

Reusing an existing concept is different — **don't touch its category.** `ca_find_concepts` returns each match's current category. If it's already set, leave it; a category chosen when the concept was first written is not something to second-guess from inside an unrelated day's news posting. If it comes back null on a concept you're about to reuse, that's a pre-existing gap worth flagging to the user, not something to silently fix as a side effect of linking today's article.

### When the concept has to be written late

A story you filed months ago as a first occurrence gets its second development today. The concept has to exist now — and the earlier article should point at it too, or the timeline starts mid-story.

`ca_link_concept` takes several links in one call, so pass both: today's article and the older one. Search for the earlier piece first to get its id.

## Framing the news article — three types

One article per distinct story — if the user gives you several unrelated stories, write and file them as separate articles, not one piece stitched together.

Every story is one of three types, and which one it is decides how much detail lives in the news article itself versus how much moves to the linked concept page. This replaces judging a story purely as "first occurrence" or "development" — almost every story ends up with a linked concept; what varies is how much of the substance sits in the news article versus the concept.

### Type 1 — Major, exam-relevant development

Use this when a major, exam-relevant development has happened and the news itself needs real detail, not just a pointer to the concept. Typical cases: a new technology that improves how an existing technology works (the existing technology is the core concept); a new component added to an existing government scheme (the scheme is the core concept); a new or amended provision in an existing law (the law is the core concept); a report, index or ranking release, where this year's findings are the real story and the report/index's own basic details belong to the concept; an award, GI tag, or similar recognition; the conclusion of an international conference with real outcomes; a new edition of an ongoing military exercise; or any comparable case where the update itself carries substantial exam-relevant weight. Apply the same logic to any article type not listed here.

Sections, in order:

1. **News** — the headline of the story: what happened and its focus area, in enough words that a reader immediately understands the update. Add a few more points if the story genuinely needs them.
   - *Example:* "Recently, scientists at the Indian Institute of Technology (IIT) Patna developed an innovative hybrid magneto-rheometer. It will help in better understanding the performance of magnetorheological (MR) fluids."
2. **Updates** — the real detail of what happened, with basic details where they apply. Keep this to the major highlights, not an exhaustive breakdown. The example below uses exactly one heading beyond Basic Details, with a handful of bullets under it — that's the level of compactness to aim for. Resist the urge to fragment the update into several separate headings, one per sub-category or angle; a story rarely needs that, and one well-curated list says more than three or four thin ones.
   - *Example:* **Developed by:** Indian Institute of Technology (IIT) Patna. **Aim:** Real-world understanding of MR fluid performance. **About the Innovation** (own heading, real list): "Hybrid Magneto-Rheometer is a testing device to characterise the real-world operating performance of smart fluids like MR fluids." / "In the real world, MR fluids are subject to two simultaneous mechanical forces — compression and shear — previously the least understood aspect of their behaviour." / "This device lets scientists and engineers simulate actual working environments accurately, helping them engineer high-performance, energy-efficient smart fluids." / "Beyond MR fluids, the rheometer can test the viscoelastic properties of advanced materials across polymers, pharmaceuticals, food processing, cosmetics, and petrochemicals."
3. **Concept brief** — a short, passing reference to the linked concept, just enough for the Updates section to make sense on its own. Not the full concept treatment.
   - *Example:* **About MR (Magnetorheological) Fluids** — "Magnetorheological (MR) fluids are 'smart' materials that change properties under a magnetic field. In a magnetic field, the fluid's viscosity increases instantly, turning it into a viscoelastic solid." **Function:** "In this solid state, the fluid can transmit force, and an electromagnet can precisely control its stiffness." **Applications:** "This makes MR fluids ideal for brakes, clutches, shock absorbers, and vibration control systems."
4. **Concept article** — a full, separate concept article on the core concept (here, MR Fluids), built per the concept format and linked to this news article.

### Type 2 — Minor update, low exam relevance

Use this when a small update has happened and the details of the update itself aren't important from an exam standpoint — a passing reference to the news is enough. Typical cases: states submitting proposals under an existing scheme; damage from a natural phenomenon; flora or fauna found dead or in poor condition; new appointments to constitutional bodies; the spread of a new disease; and comparable cases where the event itself is thin but touches on something worth understanding.

Sections, in order:

1. **News** — write the news itself, as a short paragraph. No separate Updates section.
   - *Example:* "The Indian government today increased the windfall tax on petrol exports to **₹3.5 per litre** from **₹2.5 per litre**, effective **3 August**. Windfall taxes are adjusted every two weeks in response to movements in international crude prices. This time the tax was increased in response to rising global energy prices."
2. **Concept/topic brief details** — below the news, give the important details of whichever concept or topic is needed to understand it, as a heading followed by 2–4 points. **"Brief" describes the length, not the depth.** These 2–4 points still have to explain the actual concept — what it is, how it works or its defining feature, why it's relevant right now — the same substance the full concept page below will eventually carry, just compressed into a handful of lines. Don't mistake this for a shallow restatement of facts already sitting in the News line above it: administrative details like who announced something or the exact date belong in the News, not here — this section's job is to teach the reader the underlying topic itself. Only the topic that's actually necessary to follow the story gets a place here — not every term the article touches.
   - *Example:* **About Windfall Tax** (a concept page will also be created for this, with the full structured detail): "A windfall tax is a tax governments impose on industries earning significantly above-average profits from favourable economic conditions." "The Centre reviews windfall taxes on petroleum products every two weeks." **Objective:** "To capture a portion of these unexpected gains to fund public projects, reduce deficits, or redistribute wealth." **Reason for This Increase:** "As global energy prices surge, private refiners earn unusually high margins exporting fuel abroad. The higher tax makes exports costlier, discouraging excessive exports during periods of supply uncertainty."
3. **Concept page** — a concept page linked to the article (here, Windfall Tax), built per the concept format.

### Type 3 — Genuinely new topic or concept

Use this when a topic or concept is appearing in the news for the first time — a new judgment, a new scheme, a new mission, a newly discovered species, or anything genuinely new with no existing background to speak of.

Sections, in order:

1. **News** — write the news.
   - *Example:* "Scientists have developed nanorobots that can target cancer cells precisely."
2. **Concept brief** — a brief, compressed rundown of the important details of the concept: its definition, how it works or its defining features, and its applications or significance — the same substance the full concept article below will carry, just compressed to a few lines. **"Brief" means shorter, not shallower.** This section still has to teach the reader the actual concept; it is not a placeholder and not a restatement of the News line above it. Don't fill it with administrative facts (who announced it, the exact date) instead of real substance — those belong in the News line; this section explains what the thing actually is. This is still a brief, not the full concept article — don't use concept-article structure (no Basic Details block, no multiple headings) here.
   - *Example:* **About Nanorobots:** "Programmable nanoscale devices (~50–100 nm wide) designed to perform specific tasks inside the body." (Nanometre: 1 nm = 10⁻⁹ m; the nanoscale spans 1–100 nm.) **Working:** "Stimulus-responsive — guided by external stimuli (near-infrared light, magnetic fields) or internal stimuli (pH, enzymes) for precise action." **Applications:** "Targeted cancer therapy, controlled drug delivery, biosensing, minimally invasive surgery, tissue repair, and regenerative medicine." **Advantages:** "High precision, reduced systemic side effects, improved therapeutic efficacy."
3. **Concept article** — a full, structured concept article on the topic, built per the concept format and linked to this news article.

**Two recurring mistakes worth flagging explicitly, since both have slipped through before:** the Type 1 Updates section is for major highlights, not an exhaustive multi-heading account — match the compactness of that example, not the length of the Format Library templates below. And a "brief" — Type 2's concept/topic brief details, Type 3's concept brief — is brief in length only. It still has to explain the real concept, the way the worked examples above do (a definition, a mechanism or defining feature, why it matters), not gesture at it with surface-level or administrative facts instead. Picture it as the concept article compressed to a few lines, not a thinner, different kind of content.

### Selecting concepts to link — core and related

An article isn't limited to one concept. It has exactly one **core concept** — the entity the story is actually about — and can have any number of **related concepts** — things touched in passing that are worth their own page but aren't the main subject.

- *Example:* "The MPC kept the policy repo rate under the liquidity adjustment facility (LAF) unchanged at 5.25%, maintaining a neutral stance." Here, the **repo rate** is the core concept; the **Monetary Policy Committee (MPC)** and the **Liquidity Adjustment Facility (LAF)** are related concepts.

Use `is_core: true` for the core concept and `is_core: false` for each related one when calling `ca_link_concept`. Every link still takes a one-line note saying what this article changed or touched — "Coverage extended to 100 additional districts." It becomes that entry on the concept page's news timeline, where students read it next to entries from other months, so write it to stand on its own. Don't write "as discussed above" or repeat the headline verbatim.

### Title and Source, still required on every article

Every article, regardless of type, still opens with a **Title** you write yourself — a title-case headline naming the topic. Don't just adopt the phrasing the user gave you when they described the topic, or copy a source article's own headline verbatim — a source headline is often written for clicks, not precision, and the user's own phrasing was a topic description, not a drafted title. State exactly what happened, built around the specific figure, entity, ruling or decision that makes this story what it is, in as few words as that actually requires. If the source or the user's phrasing already is precise, keep it; don't rewrite for the sake of rewriting.

Every article still closes with an italic **Source** line naming and linking the source(s) used — see "Preferred sources, and always link them" below for which outlets to reach for and how to get a real, citable URL.

### Preferred sources, and always link them

When a story has run in more than one outlet, prefer these six, in this order: **The Hindu**, **Indian Express**, **PIB**, **Livemint**, then **Economic Times**, **Financial Express**. Search these first; only reach for a different outlet once none of the six has actually carried the story.

Don't stop at a search-result snippet. Open the specific article page on whichever outlet you're citing and take its real URL — that's what makes the citation actually checkable. Use that URL as `source_url` when composing the piece, and as the link on the closing Source line: `*Source: [The Hindu](https://...)*`, not just the bare outlet name with no link. A source line with no link is for the genuine edge case — grounding that came from a general search with no single identifiable page to point to. That should stay the exception; fetching the actual page and linking it is the normal path now, not something to skip because a search snippet already gave you the facts.

## Voice, formatting, and content discipline

This is the shared toolkit for how everything gets written — the News section, the Updates or brief sections, and the full concept article alike. It's gathered in one place because it applies uniformly across all of them; it isn't specific to any one type or template.

### Voice and reading level

- **Voice:** neutral, factual, analytical — a briefing, not an opinion piece.
- **Reading level:** write for a reader at roughly a 6th-grade reading level — but never at the cost of the core keywords and technical terms a topic actually turns on. Simplifying the sentence around a term is good; diluting or dropping the term itself is not, since the exam tests precisely that vocabulary.
- **Active voice:** default to it.
- **Sentence length:** keep sentences to about one and a half lines — roughly 30 words — and break anything longer into separate, justifiable parts rather than one dense clause chained to another. For example, instead of "The United Nations Assistance Mission in Afghanistan is a United Nations Special Political Mission established to support the Afghan people through peacebuilding, political outreach, development coordination, and humanitarian assistance," write it as two: "The United Nations Assistance Mission in Afghanistan is a United Nations Special Political Mission. It was established to support the Afghan people through peacebuilding, political outreach, development coordination, and humanitarian assistance." **Check every sentence you write against this before moving on — not just narrative paragraphs, but News paragraphs and any sentence inside a bullet too.** A sentence that chains three or more distinct facts together with commas ("X happened on [date], reported by [who], covering [what], under [scheme]...") is the most common way this rule gets missed — if you can find a natural seam, split it, even when the result is two shorter sentences instead of one long one that technically parses.

### Field kinds — fact, list, or narrative

Every field you write is one of **three kinds**, and confusing them is the single most common formatting mistake this skill produces:

- **A fact field** — one short, named attribute (ministry, date, outlay, who they are). A fact field is a single bulleted line: the label bold, the value after it — `**Ministry:** Ministry of Youth Affairs and Sports.` It never gets its own heading. All the fact fields in a group are gathered under one shared heading, "Basic Details" — one `## Basic Details` for the whole group, not one heading per fact.
- **A list field** — something that genuinely has several items or points (Salient Features, Key Findings, Significance, Functions & Powers, and similar). A list field gets its own heading, and under that heading is an actual bulleted or numbered list — real list markup (`- ` lines in your Markdown, which becomes `<ul><li>` in the stored HTML), never a paragraph of sentences run together, and never a point left unbulleted and running inline as part of a sentence. Every single point gets its own bullet marker — no exceptions. If a list field only has one genuine point, write one bullet — still a bullet, not a sentence loose under a heading with nothing else in it. Lead each bullet with a short bold keyword and a colon, then the sentence — `**Institutional Independence:** Its independence from executive control makes the CVC a key institutional check on corruption.` **One bullet, one aspect.** Never club two different aspects into a single bullet just because they're related — if a point covers two distinct ideas ("who did it" and "why it matters," say), split it into two bullets even if that makes the list longer. A reader scanning the list should be able to take in one idea per line.
- **A narrative field** — a short passage that doesn't reduce to a clean list (what a court actually ruled, the background facts of a case, what a concept is and how it works). It still gets its own heading, but under that heading is one to three clean sentences or a very short paragraph, not a forced bullet list and not a fact folded into Basic Details. Use this sparingly — most fields are fact or list fields; reach for narrative only when the content genuinely is a short explanation rather than a set of named attributes or a set of discrete points.

Never emit a heading for a single fact — no `## Launched`, no `## Who They Are`. If you catch yourself about to write `##` immediately followed by a two- or three-word label with one short line under it, that's a fact field: move it into "Basic Details" instead. **Aim and Objectives is the one field that flips between the two:** when a story has several aims worth stating in full, give them their own list heading; only fold a single, genuinely one-line aim into Basic Details as an `**Objective:**` fact.

**Bold inside a value, not just the label.** A value that names a particular figure, threshold, Act, body or deadline gets that specific detail bolded too, not just the field label — `**Aim:** To ensure every inhabited village has access to a banking outlet **within 5 km**.` Bold what a reader would scan for, not every word — one or two salient terms per line, not the whole sentence.

### Selecting, sourcing, and ordering the important points

This applies to every list field in every article type — Provisions, Salient Features, Significance, Key Findings, Functions and Powers, and any other section where the substance is a set of major points.

- **Go to the authentic, official source for the list itself — not a secondary summary.** For Provisions or Salient Features, that's the actual Act/Bill text or the ministry's own release, not a news article's paraphrase of it. For Significance or Key Findings, that's the report itself, the ministry/PIB page, or the body's own site. Working from a secondary summary is how a major point gets missed and a minor or incorrect one gets included instead — go to the primary, official record so the list is both complete and accurate.
- **Curate down to the major points — don't pad them out.** Pull only the points that actually matter — the ones a reader needs to understand what it is and why it's significant. A "Key Features" or "Significance" list with eight minor, overlapping, or filler bullets is worse than one with four sharp ones. Every bullet should earn its place: if two bullets are really saying the same thing, merge them; if a bullet is trivia rather than something the topic is actually known or tested for, cut it. Dense and to-the-point beats exhaustive.
- **Order the points — by importance, and in sequence where the source has one.** Lead with the point a reader most needs, not whichever one happened to come to mind first. Where the source material itself has a natural order — a provision-by-provision walk through a Bill, the stages of a process, a chronological sequence of events — preserve that order rather than shuffling points around; where it doesn't, rank by importance, most significant first.
- **Objectives and aims deserve their full length, even while you're curating.** When a field lists aims, objectives, or terms of reference, state each one clearly and at the length it actually needs — don't compress a real objective into a vague, ambiguous fragment just to save space. "To consolidate 1,25,000 km of rural road routes to improve the movement of people and goods" is one aim, written out in full, not trimmed to "road consolidation." Curating means cutting weak or overlapping bullets, not shortening the ones that stay.
- **Dense beats padded, but dense still means real sentences.** Exact figures, dates, Article/Section numbers, and official names beat vague prose; smart structure beats mechanically following a field list into headings that don't deserve to be headings.
- **Every bullet opens with a bolded keyword, and every bullet is actually bulleted.** These are two of the most common slips, so check both explicitly before moving on: no point should be missing its bullet marker and running inline as prose, and no point should open with an unbolded label when a short bold keyword-and-colon would let a reader scan the list at a glance — see "Field kinds" above.

This clean field/heading structure, curated content, and plain sentence length aren't just cosmetic — it's how the app's filing AI (via `ca_parse`) understands what it's looking at, and how a reader actually gets through the article quickly. A fact folded into "Basic Details," a real list under its own heading, and a narrative passage kept short all file correctly; a wall of undifferentiated or padded prose doesn't. See "Research and accuracy" and "Before you commit" below for the sourcing and structural checks that back this up.

**All of this — the field-kind split, the one-bullet-one-aspect rule, the sourcing and ordering rules, and the bold-keyword rule — applies uniformly across every article type and every template in the Format Library below.** It isn't specific to any one of the 13 templates; wherever a template below calls for a list (Provisions, Salient Features, Significance, Key Findings, and so on), write it exactly this way.

## Format Library — pick the body that fits the story

The fact/list/narrative field-kind rules, the heading discipline, the bold-value rule, and the curation rule in "Voice, formatting, and content discipline" above apply to every template below — this section is about which template fits which story, not how to format what goes into it.

**Skeleton for a scheme launch**, to make the shape unambiguous:

```
## Basic Details
- **Ministry:** Ministry of X.
- **Launched:** 2 August 2026, by the Prime Minister.
- **Type of Scheme:** Central Sector Scheme.
- **Beneficiaries:** ...

## Aim and Objectives
- First aim, written out in full.
- Second aim, written out in full.

## Key Features
- First feature, one clean sentence.
- Second feature, one clean sentence.

## Significance
- First angle, most important first.
- Second angle.
```

**When this article links a background concept,** don't use a template below at full length. Every field in it assumes the reader knows nothing about the entity yet — correct for a first occurrence, wrong for a development. Once a concept exists, its evergreen facts (what the thing is, its legal basis, its general design, the standards it runs on) live there, not here. Keep only whichever fields — or parts of a field — are actually about today's development: what's new, what changed, the figures specific to this action. Ask of each field: would this line read identically whether posted today or a year ago? If yes, it belongs in the concept, not repeated here — drop it, or fold a one-clause version into the Introduction's recap instead of giving it its own section. A linked article should end up noticeably shorter than a first-occurrence one on the same kind of story, because the definitional weight moved to the concept.

The 13 templates below cover the article types this skill produces. If a story genuinely doesn't fit any of them, use judgment — but the fact/list/narrative split from "Voice, formatting, and content discipline" above still applies.

### 1. Scheme, programme or government initiative launch

- **Introduction cue:** what the scheme is and the umbrella programme it sits under, if any.
  - *Example:* "Nasha Mukt Vidyalaya (Drug-Free Schools) is a specialised initiative under the broader Nasha Mukt Bharat Abhiyan (NMBA). It is designed to transform educational institutions into a primary defence against drug addiction."
- **Basic Details:** `Launched and implemented by` (can be the same or different institutions) · `Launched in` (year — name the umbrella scheme if this is part of one) · `Beneficiaries` · `Type of scheme` (Centrally Sponsored Scheme, Central Sector Scheme, or other) · `Financial outlay`, if applicable (sub-bullets if there are multiple components).
- **Own heading, real list — Aim and Objectives:** each aim written out in full, one per bullet, in the order they matter.
  - *Example:* "To consolidate 1,25,000 km of rural road routes to improve the movement of people and goods." / "To connect rural habitations to Gramin Agricultural Markets (GrAMs), Higher Secondary Schools, and Hospitals." / "To boost the rural economy by reducing transportation time and costs for agricultural and non-farm products."
- **Own heading, real list — Key Features:** every major component and provision, as a real list, showing how the scheme actually works.
  - *Example:* "**Drug-Free Zones:** Mandatory declaration of the area within a 500-metre radius of every school as a drug-free zone." / "**Mandatory Reporting:** School heads and nodal teachers are required to report any drug-related violations within the protected zone to local police and authorities." / "**Peer-Led Initiatives:** Active engagement of students through peer-led programmes to foster a culture of mutual support and prevention." / "**Capacity Building:** Systematic training of teachers and school heads to recognise early signs of abuse and manage sensitisation programmes." / "**Integrated Monitoring:** A clearly defined reporting framework at the school, district, and state levels to track progress and ensure measurable outcomes."
- **Own heading, real list — Significance:** every major significance of the scheme, one angle per bullet.

Don't add a separate "Achievements / Progress So Far" heading for a scheme that was just launched — it has no track record yet. If the story genuinely is about an implementation milestone (cards issued, funds disbursed), that dated figure is one bullet inside Key Features, not its own heading.

### 2. Bills and Acts in news

This one differs from a scheme in emphasis: it majorly focuses on the introduction, the aims, which act(s) it amends or replaces, and the salient provisions — **not** on beneficiaries or outlay.

- **Introduction cue:** what the bill/act does and, if it's an amendment, what it replaces — in plain terms.
  - *Example:* "The Dramatic Performances Act, 1876 was enacted by the British colonial government to curb nationalist expression through theatre and stage performances. It gave authorities the power to ban plays, pantomimes, and public performances that were deemed seditious, obscene, defamatory, or scandalous."
  - *Example:* "The Immigration and Foreigners Bill, 2025 aims to consolidate and modernise existing immigration laws in India."
- **Own heading, list or narrative — Aims and Objectives:** the reasons behind the bill or act — an issue it handles, a previous act it changes, or a new dimension it covers.
- **Own heading, real list — Important Provisions / Salient Features.**
  - *Example (Bills of Lading Bill, 2025):* "**Legal Modernisation:** Replaces colonial-era provisions with a more structured and simplified framework." / "**Enhanced Business Efficiency:** Streamlines shipping documentation, reducing litigation risks and legal disputes." / "Establishes clear guidelines for carriers, shippers, and consignees." / "**Alignment with Global Standards:** Adapts international best practices to boost India's role in global maritime trade." / "**Government Empowerment:** Allows the Central Government to issue directions for effective implementation." / "Introduces a standard repeal and saving clause to maintain legal continuity." / "**User-Friendly Provisions:** Simplifies language and structure without altering the substantive principles of the original law." / "**Boost to Maritime Trade:** Strengthens India's position as a maritime hub, supporting ease of doing business."
  - A provisions list can run long and cover procedure in detail where the story calls for it — for AFSPA, for instance, this section would cover the procedure to declare an area "disturbed," the enforcement term, the states currently under it, the removal process, and the powers it grants (use of force, arrests without warrant, search without warrant, protection from prosecution) — each as its own bullet, not compressed into a summary line.

### 3. Organisation or institution in news

- **Introduction cue:** what the body is and its core mandate, in plain terms.
  - *Example:* "The Central Vigilance Commission (CVC) is the apex integrity institution of the Government of India. It works to promote transparency and accountability in public administration and to check corruption in central government organisations."
- **Basic Details:** `Type` (statutory body, constitutional body, etc.) · `Headquarters` · `Statutory basis` · `Reports to` — list only what's necessary to place the body; don't pad this out.
- **Own heading, real list — Genesis:** how and why the body was created — the recommending committee, founding event, or original legislation, and any change in legal status over time. Lead each point with a short bold keyword and a colon.
  - *Example:* "**Recommending Committee:** The Santhanam Committee on Prevention of Corruption recommended setting up the CVC in 1964." / "**Initial Status:** The government created the CVC through an executive resolution in 1964, without statutory backing." / "**Statutory Backing:** Parliament gave it statutory status through the Central Vigilance Commission Act, 2003."
- **Own heading, narrative — Composition/Structure:** members, appointing authority, and tenure, only if it helps explain how the body functions.
  - *Example:* "The Commission consists of a Central Vigilance Commissioner and up to two Vigilance Commissioners. The President appoints all three on the recommendation of a committee comprising the Prime Minister, the Home Minister, and the Leader of the Opposition in the Lok Sabha."
- **Own heading, real list — Powers and Functions:** what the body actually does, its core mandate in action.
  - *Example:* "**Advisory Role:** Advises central government departments on vigilance matters and corruption complaints." / "**Superintendence over CBI:** Exercises superintendence over the Central Bureau of Investigation's work relating to offences under the Prevention of Corruption Act." / "**Review of Investigations:** Reviews the progress of investigations conducted by the CBI in corruption cases."
- **Own heading, real list — Significance.**
  - *Example:* "**Institutional Independence:** Its independence from executive control makes the CVC a key institutional check on corruption in the central government."

### 4. Report, index or ranking in news

These cover periodic reports, indices, and rankings released by government or international bodies. Focus on what is measured, India's position, and the key findings.

- **Introduction cue:** what the report/index measures and who releases it.
  - *Example:* "The Global Hunger Index (GHI) is an annual report that measures and tracks hunger at the global, regional, and national levels. Concern Worldwide and Welthungerhilfe jointly publish it every year."
- **Basic Details:** `Released by` · `Frequency` · `Indicators used` · `Countries covered`.
  - *Example:* Released by – Concern Worldwide and Welthungerhilfe. Frequency – Annual. Indicators used – Undernourishment, child stunting, child wasting, child mortality. Countries covered – 123 countries in the 2025 report.
- **Own heading, real list — Key Findings:** India's rank/score and the most important findings, compared with previous years where useful.
  - *Example:* "**India's Rank:** India ranked 102nd out of 123 countries in the Global Hunger Index 2025, with a score of 25.8." / "**Severity Classification:** The report classified India's hunger level as 'serious.'" / "**Child Undernutrition:** One in three Indian children is stunted, and 172 million people remain undernourished." / "**Improving Trend:** India's score has improved from 38.1 in 2000 to 25.8 in 2025."
- **Own heading, real list — Key Recommendations,** if the report makes any.
- **Own heading, real list — Concerns / Significance:** note any government critique of the methodology, and explain why the report matters despite that.
  - *Example:* "**Government's Critique:** The Government of India has questioned the report's sample size and methodology and argues it does not reflect the country's actual nutrition indicators." / "**Continued Relevance:** Even so, the index remains an important benchmark to track hunger and malnutrition trends over time."

### 5. Committee or Commission in news

These cover expert committees and constitutional commissions set up to study an issue or make recommendations.

- **Introduction cue:** what the committee/commission is and why it was formed.
  - *Example:* "The Sixteenth Finance Commission is a constitutional body formed to recommend how tax revenue should be shared between the Centre and the states."
- **Basic Details:** `Constituted by` · `Chairman` · `Date of constitution` · `Type` (constitutional, statutory, or non-statutory).
  - *Example:* Constituted by – President of India. Chairman – Dr. Arvind Panagariya. Date of constitution – 31 December 2023. Type – Constitutional body.
- **Own heading, real list — Terms of Reference / Mandate:** the key questions the body was asked to examine.
  - *Example:* "**Tax Devolution:** To recommend how tax proceeds should be shared between the Union and the states." / "**Grants-in-Aid Principles:** To lay down the principles governing grants-in-aid to states." / "**Local Body Resources:** To suggest ways to boost the resources of local bodies, including panchayats and municipalities." / "**Disaster Management Financing:** To review financing arrangements for disaster management under the Disaster Management Act, 2005."
- **Own heading, real list — Key Recommendations:** summarise the committee's main recommendations once submitted; until then, note the submission deadline and award/reference period instead.
  - *Example:* "**Submission Timeline:** The Commission must submit its report by 31 October 2025, covering the award period from 1 April 2026 to 31 March 2031."
- **Own heading, real list — Significance.**

### 6. Court judgment or legal development in news

These cover important rulings by the Supreme Court or High Courts.

- **Introduction cue:** name the case, the court, and state the ruling in one line.
  - *Example:* "In Harish Rana v. Union of India (March 2026), the Supreme Court allowed the withdrawal of life-sustaining treatment for a patient in a persistent vegetative state, permitting passive euthanasia in India for the first time."
- **Own heading, narrative — Background / Facts:** what led to the case reaching the court.
  - *Example:* "The patient had remained in a persistent vegetative state for 13 years, with no realistic chance of recovery. The family petitioned the court to allow withdrawal of life support."
- **Own heading, narrative — Question of Law:** the legal issue the court had to decide, stated as one sentence.
  - *Example:* "Whether the right to die with dignity under Article 21 permits courts to allow withdrawal of life-sustaining treatment in cases of irreversible vegetative states."
- **Own heading, list or narrative — Verdict / Key Observations:** what the court held. A single-point ruling can be one bullet or two clean sentences; a multi-point one is a real list, each point led by a short bold keyword.
  - *Example:* "**Right to Die with Dignity:** The Court held that the right to die with dignity is part of the right to life under Article 21." / "**Safeguards Prescribed:** It laid down safeguards for medical boards and families to follow before withdrawing treatment."
- **Own heading, real list — Significance.**

### 7. Place, monument or geographical feature in news

These cover national parks, tiger reserves, wildlife sanctuaries, wetlands, heritage sites, rivers, and other locations in the news. A location carries more describable physical and ecological detail than almost any other template — give it the full treatment below rather than collapsing it into a couple of generic paragraphs.

- **Introduction cue:** describe the place in general terms — what kind of place it is and where. Keep this evergreen; save today's specific trigger for "Why in News" below.
  - *Example:* "Manas National Park is a UNESCO World Heritage Site and Tiger Reserve located in western Assam, at the foothills of the Eastern Himalayas, bordering Bhutan's Royal Manas National Park."
- **Basic Details:** `Location` (state/region, and any bordering park, river, or range worth naming) · `Recognitions/Designations` (every national or international status it holds, each with the date conferred — National Park, Tiger Reserve, Wildlife Sanctuary, Biosphere Reserve, Ramsar site, UNESCO World Heritage Site, Elephant Reserve, Important Bird Area, and similar; list every one that applies, not just whichever is in today's headline) · `Established/Declared` (the date it first got protected status, and the date of any later upgrade — a sanctuary declared in one year and elevated to national park in another are two separate facts, not one) · `Area` (sq km, or hectares for a smaller site) · any other identifying fact that doesn't fit the above (elevation range, administering state/UT, indigenous communities in the area).
  - *Example:* Location – Western Assam, at the foothills of the Eastern Himalayas; bordered to the north by Bhutan's Royal Manas National Park. Recognitions – UNESCO World Heritage Site (1985), National Park (1990), Tiger Reserve (core zone), Biosphere Reserve, Elephant Reserve (core), Important Bird Area. Established – Originally a sanctuary in 1928; declared a National Park in 1990. Area – 850 sq km. Elevation – 60 to 1,500 metres.
- **Own heading, real list — Geographical Features:** the terrain, climatic zone, associated river(s), and vegetation types that give the place its physical character, each its own bullet — not a repeat of the location fact.
  - *Example:* "**Terrain:** Sits at the junction of the Sub-Himalayan Bhabar Terai and Himalayan subtropical broadleaf forest zones, which gives it unusually rich biodiversity for its size." / "**River System:** The Manas River flows through the park." / "**Vegetation Types:** Four types occur across the terrain — semi-evergreen forest, moist and dry deciduous forest, alluvial savanna woodland, and semi-evergreen alluvial grassland."
- **Own heading, real list — Flora:** the recorded plant diversity — a total species count if available, then the dominant and other notable species, each its own bullet.
  - *Example:* "**Recorded Diversity:** More than 540 plant species have been recorded in the park." / "**Dominant Species:** Hoolong trees are the dominant species." / "**Other Notable Trees:** Jamun, Indian Bay Leaf, Silk Cotton Tree, Haritaki, Wild Guava, Jarul, Amari, Dewa Sam, Himolu, and Garjan."
- **Own heading, real list — Fauna:** the recorded animal diversity — species counts by group where available, then the major and rare/endangered species, each its own bullet.
  - *Example:* "**Recorded Diversity:** 55 mammal, 36 reptile, and 3 amphibian species have been recorded." / "**Major Species:** Tiger, Asian elephant, one-horned rhinoceros, gaur, wild buffalo, swamp deer, and Gangetic dolphin." / "**Rare and Endangered Species:** Golden langur, clouded leopard, fishing cat, pygmy hog, hispid hare, and red panda." / "**Birdlife:** Migratory species such as river chats, forktails, cormorants, and ruddy shelducks visit seasonally, alongside hornbills, Finn's baya, and Bengal florican."
- **Own heading, real list — Significance:** ecological, conservation, or strategic importance — why the place matters beyond its species list.
  - *Example:* "**Genetic Reservoir:** As part of the larger Manas–Royal Manas transboundary landscape shared with Bhutan, the park supports genetically healthier tiger and elephant populations than isolated reserves can." / "**Conservation Turnaround:** Removed from UNESCO's List of World Heritage in Danger in 2011, after successful rehabilitation of habitat degraded during years of civil unrest."
- **Own heading, narrative — Why in News:** the specific trigger — a new listing, a dispute, a restoration project, a wildlife study, and so on. This is the only dated, event-specific field in the template; everything above should read the same whether posted today or five years ago.
  - *Example:* "A decade-long study tracking rhinos reintroduced to Manas under the Indian Rhino Vision 2020 programme has found encouraging signs of reproduction and adaptation among the translocated population."

Don't collapse Flora and Fauna into one "Biodiversity" heading — they're two fields a reader scans for separately, and merging them is how a rich species list turns into a thin paragraph. Not every location has recorded flora/fauna worth a full section (a monument or a purely geological feature, say) — drop whichever of these headings doesn't genuinely apply rather than padding it out; the shape is a menu, not a mandatory checklist. When a place is only mentioned in passing inside a story that's really about something else (a scheme launched *at* a national park, say), the shorter "About X" pocket described earlier is enough instead of this full template.

### 8. Personality in news

These cover individuals in the news through a death, an award, an appointment, or a major achievement.

- **Introduction cue:** who the person is and why they're in the news.
  - *Example:* "Arvind Panagariya is an economist and former Vice-Chairman of NITI Aayog, now serving as Chairman of the Sixteenth Finance Commission."
- **Basic Details:** `Field` · `Known for` (past role) · `Current role`.
  - *Example:* Field – Economics/Public policy. Known for – Vice-Chairman, NITI Aayog (2015–2017). Current role – Chairman, Sixteenth Finance Commission.
- **Own heading, real list — Key Contributions / Achievements:** the person's major work relevant to why they're in the news, one per bullet.
- **Own heading, narrative — Why in News:** the specific recent event that brought them into the news.

Keep this to the biographical detail tied to why they're in the news today, not a full biography.

### 9. International summit or agreement in news

These cover bilateral or multilateral summits and the agreements/outcomes signed during them.

- **Introduction cue:** describe the summit/agreement mechanism in general terms — who it's between and what it's meant to achieve. Keep this evergreen; put this year's specific edition, date, and venue in Basic Details below.
  - *Example:* "The India–Japan Annual Summit is the annual bilateral summit mechanism between the Prime Ministers of India and Japan, used to review and advance strategic cooperation across defence, economic security, clean energy, and emerging technologies."
- **Basic Details:** `Host/Venue` · `Date` · `Participants` · `Edition`.
  - *Example:* Host/Venue – New Delhi. Date – July 2026. Participants – India and Japan. Edition – 16th Annual Summit.
- **Own heading, real list — Agenda / Key Outcomes:** the key agreements signed or announcements made.
  - *Example:* "**UNICORN Defence Project:** India and Japan reached an agreement in principle on the UNICORN radio antenna project, their first defence co-development programme." / "**Economic Security Declaration:** The two countries adopted a Joint Declaration on Economic Security Cooperation covering semiconductors, critical minerals, and clean energy." / "**Biogas Initiative:** They launched the India–Japan Cooperative Biogas for Growth Initiative."
- **Own heading, real list — Significance for India.**

### 10. Species, wildlife or ecology in news

These cover new species discoveries, IUCN status changes, and other conservation developments.

- **Introduction cue:** describe what kind of organism this is in general terms — classification and typical range. Keep this evergreen; save the specific news trigger for "Why in News" below.
  - *Example:* "The Sistan sand boa (Eryx sistanensis) is a small, non-venomous, burrowing snake of the sand boa family (Erycidae). It was earlier known only from the arid regions of Iran and Pakistan."
- **Basic Details:** `Scientific name` · `Family/Classification` · `Habitat/Distribution` · `Conservation status`.
  - *Example:* Scientific name – Eryx sistanensis. Family – Erycidae (sand boas). Habitat/Distribution – Arid, sandy regions with sparse vegetation, often close to human habitation; earlier recorded only in Iran and Pakistan. Conservation status – Not yet evaluated by IUCN; listed under Schedule II of the Wildlife (Protection) Act.
- **Own heading, real list — Features:** distinguishing physical or behavioural features.
  - *Example:* "**Body Size:** Weighs between 100 and 200 grams, with a short, slender tail that gradually tapers to the tip." / "**Distinctive Banding:** Retains dark, sooty bands on its body throughout its life, unlike the related red sand boa, which loses its bands as it matures." / "**Burrowing Behaviour:** Burrows into sand to regulate body temperature, hide from predators, and ambush prey." / "**Diet:** Feeds mainly on small rodents and lizards found in farmland and scrubland."
- **Own heading, narrative — Why in News:** the specific event (discovery, sighting, IUCN status change) that brought the species into the news.
  - *Example:* "Researchers confirmed the first record of the Sistan sand boa in India, in the northern Thar Desert of Rajasthan, in 2026. The species was formally described only in 2020."
- **Own heading, real list — Significance:** why this discovery or status change matters.
  - *Example:* "**Expanded Range:** The record expands the known range of the Sistan sand boa beyond Iran and Pakistan and adds to India's documented reptile diversity."

### 11. Defence exercise or space mission in news

These cover joint military exercises and ISRO launches.

- **Introduction cue:** describe the mission/exercise in general terms — its programme, scope, and purpose. Keep this evergreen; save today's specific update for "Latest Update/Why in News" below.
  - *Example:* "The Gaganyaan Mission is India's ongoing project to send a 3-day crewed mission to Low Earth Orbit (LEO) at about 400 km, with a crew of three members, and bring them safely back to Earth. As part of this programme, the Government of India has approved two uncrewed missions and one crewed mission."
- **Basic Details:** for a mission — `Agency/participants`, `launch vehicle`. For an exercise — `participating countries`, `location`. General programme-level facts only.
  - *Example:* Agency – ISRO. Launch vehicle – Human-rated LVM3 (HLVM3). Crew size (for the eventual crewed flight) – 3. Orbit – Low Earth Orbit, about 400 km altitude.
- **Own heading, real list — Features:** anything important about the mission/exercise design — components, stages, or elements that are new or different.
  - *Example:* "**Orbital Module:** The spacecraft has a Crew Module, shaped like a truncated cone, and a Service Module powered by liquid propellant engines; together they form the Orbital Module." / "**Test Flight Stages:** The programme includes two uncrewed test flights, G1 and G2, before the crewed flight, H1." / "**Vyommitra:** The first uncrewed flight, G1, carries Vyommitra, a half-humanoid robot that occupies the astronaut's seat to check life-support and safety systems."
- **Own heading, real list — Objectives:** state each objective clearly and at the length it actually needs; don't compress a real objective into a vague, ambiguous fragment just to save space.
  - *Example:* "**To Demonstrate Indigenous Capability:** Its immediate aim is to demonstrate indigenous capability to undertake human space flights." / "**Human Space Exploration:** In the long run, it will lay the foundation for a sustained Indian human space exploration programme." / "**Micro-gravity Experiments:** As part of the mission, Gaganyaan also encourages and supports micro-gravity experiments."
- **Own heading, narrative — Latest Update / Why in News:** the specific event or date that brought the mission/exercise into today's news.
  - *Example:* "Gaganyaan-1 (G1), the first uncrewed test flight of the programme, is planned for 2026, to be followed by a second uncrewed flight, G2, before the crewed flight in 2027."
- **Own heading, real list — Significance.**
  - *Example:* "**Global Recognition:** A successful crewed flight would make India only the fourth nation, after the US, Russia, and China, to independently send humans to space."

### 12. Technological or scientific concept in news

These cover a scientific or technological concept that has entered the news through a discovery, launch, or policy announcement. Break it down the way a good teacher would — what it is, how it works, and why it matters — and always close the loop with something the reader already knows.

- **Introduction cue (Context/Why in News):** the trigger — the discovery, policy announcement, launch, or event that brought this concept into the news.
  - *Example:* "The Union Budget 2026 announced the Biopharma SHAKTI strategy to boost domestic production of biologics and biosimilars, along with a shift toward non-animal drug testing."
- **Own heading, narrative — What Is It (Definition):** the concept in one or two plain sentences, contrasting it with something more familiar where possible.
  - *Example:* "Biologics are medicines made using living cells, such as bacteria or yeast, unlike ordinary tablets like aspirin, which are manufactured through chemical reactions."
- **Own heading, real list — How It Works:** the process or mechanism broken into short, ordered points, each led by a short bold keyword.
  - *Example:* "**Host Cell Selection:** Scientists select living cells, such as bacteria, yeast, or mammalian cells, to act as tiny factories." / "**Genetic Engineering:** They insert the DNA sequence for the desired protein into these cells." / "**Large-Scale Culture:** The cells are grown in large tanks called bioreactors under controlled conditions." / "**Purification:** The protein is then extracted and purified before it is used as medicine."
- **Own heading, real list — Key Features:** the properties that scientifically distinguish this concept.
  - *Example:* "**Molecular Complexity:** Biologics are much larger and more complex than ordinary chemical drugs." / "**Living Sources:** They come from living systems, such as microorganisms or animal cells." / "**High Specificity:** They target specific cells in the body, allowing precise treatment with fewer side effects." / "**Sensitivity:** They are sensitive to heat and light and usually need cold storage."
- **Own heading, narrative — Real-Life Relevance (Analogy):** one relatable, real-life example, with enough detail (what exactly is used, why it behaves the way it does) that a non-expert reader truly understands the concept — not just a one-line label.
  - *Example:* "Insulin, used daily by diabetics, is itself a biologic. It is produced by inserting the human insulin gene into genetically engineered E. coli bacteria or yeast cells, which then act as tiny factories to manufacture the protein inside large steel tanks. Because insulin is a protein, its 3-dimensional shape is fragile – heat or rough handling can cause it to unfold (denature) and lose its ability to work in the body. This is why insulin, unlike a chemically synthesised tablet such as paracetamol, must be kept refrigerated and cannot simply be stored at room temperature."
- **Own heading, real list — Significance.**
  - *Example:* "**Treatment Breakthrough:** Biologics have turned once-fatal conditions, such as certain blood cancers, into manageable chronic illnesses." / "**India's Biosimilar Ambition:** Through Biopharma SHAKTI, India aims to become a global hub for affordable biosimilars."

### 13. Economic concept in news

These cover an economic term, policy tool, or indicator that has come into the news through a data release or policy decision. Always ground the explanation in a real, concrete example so the concept is easy to relate to.

- **Introduction cue (Context/Why in News):** the data release or policy decision that brought the concept into the news.
  - *Example:* "The RBI's Monetary Policy Committee kept the repo rate unchanged at 5.25% at its August 2026 meeting, retaining a neutral stance amid global uncertainty."
- **Own heading, narrative — What Is It (Definition):** the concept in one or two plain sentences, plus its objective as a fact line if useful.
  - *Example:* "The repo rate is the interest rate at which the Reserve Bank of India lends short-term funds to commercial banks against government securities." Objective – Used as the main tool to balance economic growth against inflation.
- **Own heading, narrative — Real-Life Example:** one concrete, real instance of the concept in action — a real bank/institution and how the change actually played out, not a restatement of the definition.
  - *Example:* "Imagine the State Bank of India (SBI) faces a temporary cash shortage. To solve this, SBI goes to the 'bank of banks' — the RBI. The RBI agrees to lend money to SBI for a short period. In return, the RBI charges an interest rate on this loan. This specific interest rate is the repo rate. To get this loan, SBI must temporarily sell government bonds to the RBI as collateral. SBI promises to buy these bonds back later."
- **Own heading, real list — Features:** the concept's defining characteristics. A step-by-step "how it works" isn't always needed for an economic concept; features are often enough.
  - *Example:* "**Set by:** RBI's Monetary Policy Committee (MPC), a six-member panel that meets every two months." / "**Short-Term Lending:** It is strictly a short-term credit facility, from one day (overnight) to a few weeks." / "**Collateral Requirement:** Banks must pledge approved Government Securities (G-Secs) or treasury bills as collateral to the RBI." / "**Repurchase Agreement:** The transaction includes a binding legal contract. The borrowing bank promises to buy back the pledged securities at a predetermined price and future date." / "**SLR Quota Exclusion:** Banks cannot pledge securities from their mandatory Statutory Liquidity Ratio (SLR) quota for standard repo borrowings — they must use excess securities." / "**Quantitative Tool:** It is a primary quantitative instrument of the RBI's Monetary Policy. It regulates the total volume of money supply in the economy rather than directing credit to specific sectors."
- **Own heading, real list — Significance/Impact:** the significance for the economy and for an ordinary citizen. Work through both directions of a policy lever where relevant, as its own short list under each direction rather than compressing the mechanism away.
  - *Example, repo rate increase (tight monetary policy):* borrowing from the RBI becomes expensive for commercial banks → banks pass the extra cost to customers → interest rates on home, car and business loans go up → people and businesses borrow less → spending drops, decreasing the overall money supply → this drop in demand helps bring down inflation.
  - *Example, repo rate decrease (expansionary monetary policy):* borrowing becomes cheap for commercial banks → banks lower interest rates for retail and corporate customers → people take more loans to buy houses, cars, or expand businesses → spending rises, increasing the money supply → this boosts overall economic growth.

## Research and accuracy — this is what makes the content trustworthy

Everything you write is going in front of people preparing for a real exam. Treat these as load-bearing, not stylistic preferences:

- **Never invent** a figure, date, name, rank, scheme outlay or report finding. If you can't find it, leave it out. A shorter accurate piece beats a longer speculative one — a wrong number in exam-prep material is the kind of mistake that costs someone marks.
- **Stay current.** Always look for authoritative, authentic sources, and make sure your facts are current. If a topic has appeared in the news multiple times, look for the latest update before writing — don't work from a stale version of the story.
- **Attribute statistics by name** in the text — "according to the Economic Survey 2024-25", not a bare number.
- **Never invent a source link.** Only cite a URL you actually fetched or were given. If your grounding came from a general web search rather than one identifiable page, don't attach a source URL at all — a plausible-looking fake link is worse than no link. See "Preferred sources, and always link them" under Title and Source for which outlets to reach for first and why fetching the real page, rather than stopping at a search snippet, should be the default.
- **Spell out names on first mention.** Give the full official name of a body, scheme, Act or report on first mention, then the abbreviation: "Monetary Policy Committee (MPC)", then "MPC". Cite Articles/Sections precisely (e.g. "Article 356").
- **Maths formatting:** wrap only genuine mathematical expressions — formulas, equations, fractions, exponents (e.g. `$10^9$`, `$\frac{a}{b}$`) — in single dollar signs for LaTeX; the site renders these specially. A plain number, year, or percentage sitting in ordinary prose (e.g. "grew 6.5% in FY26", "since 2016") is not a formula — leave it as normal text, never wrapped in $ signs.

## SEO — fill these on every commit

`source_name`/`source_url` are already covered above under "Preferred sources, and always link them" — carry those through into `ca_commit`. Alongside them, every commit also takes:

- `seo_title` — up to ~60 characters. Lead with the entity or scheme name a student would search, not the news framing.
- `seo_description` — 140-160 characters, plainly stating what happened and why it matters. Not a truncated first paragraph.
- `keywords` — 5-10: the scheme/body/Act named, the ministry, the subject area, and the exam relevance. Real search terms, no stuffing.

Write them from the finished article, so they describe what you actually wrote. The linked concept, if composed new, gets its own `seo_title`/`seo_description`/`keywords` too — it's a separate page with its own search intent, evergreen rather than dated.

## Category and date — you can steer these, or leave them to the filer

`ca_parse` picks a category from the live tree and works out a date on its own. You can override either by writing it directly into the text:

```
Categories: Economy > Banking & Finance
Date: 2024-03-15
```

Do this whenever you know the right answer — it's more reliable than the parser's guess, especially for anything back-dated. Without a `Date:` line, back-dated content risks landing under today by mistake. Call `list_current_affairs_categories` first if you want to see the live category names before writing one in.

## Before you commit — check what ca_parse actually returned

- **Category resolved?** An item with no category lands uncategorised — effectively invisible on the site. Fix it before committing.
- **Date sane?** If you wrote a `Date:` line and it wasn't honoured, or a clearly historical item came back dated today, fix it in the payload you send to `ca_commit`.
- **Nothing truncated or duplicated.**
- **No heading exists for a single fact.** Scan every `##` — if what's under it is one short line about one named attribute, that's a "Basic Details" fact, not a heading. Merge it in before committing.
- **Every list field is an actual list, one aspect per bullet.** Key Findings, Significance, Salient Features and similar — check every point rendered as its own bullet, not a paragraph of sentences run together, and check no single bullet is quietly clubbing two different aspects into one point.
- **Every bullet opens with a bolded keyword.** Scan the list fields for any point that opens with a plain, unbolded label — fix it before committing.
- **List fields are ordered — by importance, or by the source's own sequence.** Not just whatever order the points occurred to you in.
- **Every narrative field is actually short.** Background/Facts, Question of Law, What Is It, and similar should be one to three clean sentences, not a stretched-out essay.
- **Every sentence — narrative, News paragraph, or inside a bullet — is checked against the ~30-word sentence-length rule.** This has slipped through repeatedly; don't treat it as covered just because the field-kind and bullet checks above passed. A compliant list of bullets can still contain one bullet whose single sentence chains four facts together — check sentence length as its own pass, separate from checking bullet structure.
- **Is the title precise,** not just the source or the user's phrasing copied through? A title stitched together from qualifier clauses is the kind of thing that also produces an unreasonably long slug — tighten it.
- **If this article links a concept, is the body actually trimmed?** Reread the topic-specific section against the concept it links — if a field restates evergreen facts the concept already carries, cut it before committing rather than leaving the full first-occurrence-shaped template in.
- **If you composed a new concept, does it have its own category?** This is separate from the article check above — `ca_parse` never sees the concept, so nothing resolves it automatically. Confirm you set `concept.category_node_ids` (or deliberately decided the entity is cross-cutting) before calling `ca_link_concept`.
- **If you composed a new concept, is it actually full, not trimmed?** Reread it against the Format Library template you picked — every field that genuinely applies to the entity should be there at full depth. The trimming rule is for the news article, never for the concept.
- **Does the Source line have a real, working link?** Per "Preferred sources, and always link them," a bare outlet name with no URL should be the exception, not the default — confirm you actually opened the cited page and captured its URL before treating the source line as done.

## Publishing — read this before every ca_commit call

Default to `publish_mode: "review"`, always. This saves the piece as a draft in the Articles Library — invisible to students — for a human to open in the normal article editor, then publish.

When content is generated through the app's own AI tools, the server itself refuses to publish it live without an extra confirmation. That automatic check does not see this path — from the server's point of view, you handing it text is the same as someone pasting in a Word document. **You are the only thing standing between what you write and the live site.**

Use `publish_mode: "auto"` only when the user's message, in this exact request, explicitly asks for it to go live — "publish it", "put it live". Not because a similar request went live last time. If you're not sure, ask.

Tell the user plainly, every time, which one happened and where it ended up.

## Correcting something already posted

A piece that is already on the site can be edited in place. Use this whenever something turns out to be wrong — a bad figure, a wrong date, a mis-stated fact, a clumsy heading. **Never re-post a corrected copy.** A second article about the same development splits its timeline in two and leaves both halves wrong; the fix is always an edit, never a new post.

Three tools, in this order — do not skip a step:

1. `ca_find_articles` — find it by text from its title or body. Searches drafts and published alike. Filter with `article_role` when a title could match both a news article ("event") and a concept primer ("concept").
2. `ca_get_article` — read the full current body before changing anything. A rewrite composed from memory of what you posted drops details that were right. Read it first, every time.
3. `ca_update_article` — send only the fields that change. Everything you leave out stays exactly as it is, so a single wrong figure does not mean resupplying the whole article.

`body` must be the complete replacement, as HTML — not a fragment, not a description of the change. Same tags as when posting: `<p>`, `<h2>`, `<strong>`, `<ul><li>`.

**Never change a posted article on your own judgement — not even a draft, not even an obvious mistake.** If you notice something wrong while doing other work, say so and stop there. Tell the user which article it is, what looks wrong, and what you would change it to, then wait. Only once they agree, in this request, do you send the edit with `confirm_change: "user-approved"`. The tool refuses without it and names the fields you were about to change — that refusal is the rule working, not an error to route around.

### Editing something that is already live

If the article's status is `published`, students are reading it right now. That edit needs `confirm_live_edit: "update-live-article"` **as well as** `confirm_change` — say plainly that it is live when you ask.

Taking something down is the one thing that doesn't need the live gate: set `status: "draft"` on a live article that is wrong (still ask first). If a fix will take a while to get right, pull it down and correct it as a draft.

### Concept primers are editable too

Concept primers are ordinary articles with `article_role: "concept"`, so the same three tools improve them in place. If an existing primer is thin or inaccurate, **fix it** — that is now the right move, and far better than working around it.

Say plainly, every time, which article you changed, what you changed in it, and whether it was live.

## Don't go looking for Mains Notes

A daily news article is finished when it is committed (and its concept linked, if it has one). **Do not search for a Mains Note to feed it into.** Mains Notes do pull pointers from daily news, but that happens from the other side — when a note is written or updated, it goes looking for the news articles worth referencing. Pushing from here would mean every routine story triggers a topic-note hunt, and most daily news isn't Mains fodder at all.

## What not to do

- Don't write about a topic you couldn't find real grounding for. Say so.
- Don't invent a source name or URL to make the piece look better-cited.
- Don't publish live because it was convenient, only because it was asked.
- Don't skip the category/date check because `ca_parse` "usually gets it right".
- Don't write a second copy of a concept that already exists. Search first, link the id you find.
- Don't repeat the concept's full explanation inside the Introduction of an article that links it — a short recap, not a rewrite.
- Don't assume a new concept inherits the news article's category — look up the entity's own category separately, or state that you're deliberately leaving it uncategorised and why.
- Don't re-categorise an existing concept as a side effect of linking a new article to it. Flag a gap you notice; don't silently fix it.
- Don't trim a concept's fields down for brevity. Trimming is for the news article that links it, never for the concept itself.
- Don't force a fixed section list onto every concept. Pick whichever Format Library template actually fits the entity, the same as you would for a news article about it — the topic decides the shape, not a template borrowed from somewhere else.
- Don't use a Format Library template at full length on an article that links a concept. Definitional fields (what the entity is, its legal basis, its general design, standards it runs on) belong in the concept — repeating them in the news article is the exact duplication concepts exist to remove.
- Don't treat the user's topic phrasing or a source's headline as the title. Write your own precise one — see "Title" above.
- Don't name a source without linking it. Fetch the actual page from a preferred outlet and cite its real URL — see "Preferred sources, and always link them" above.

The formatting-mechanics rules that used to live here as "don't" restatements — headings for single facts, list fields left as paragraphs, unbolded values, compressed objectives, diluted technical terms, padded bullet dumps, run-on sentences — are now stated once, positively, in "Voice, formatting, and content discipline" above. Check there instead of here.

## Adjusting the format later

This skill's format spec (the Format Library, the common spine, sourcing rules, or anything else in this file) is meant to be a persistent, editable spec, not something re-decided each run. If the user asks to change any of it, update this skill and re-save it (via the skill-saving tool with overwrite) rather than only applying the change ad hoc for one run — editing the skill's files on disk directly does not persist, so a real change has to go through re-saving the skill itself.
