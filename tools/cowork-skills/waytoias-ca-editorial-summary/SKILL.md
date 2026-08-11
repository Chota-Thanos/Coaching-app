---
name: "waytoias-ca-editorial-summary"
description: "Research, write and publish an editorial/opinion-piece summary for the WayToIAS UPSC coaching website's Current Affairs → Editorial Summaries section. Use whenever the user asks to summarise, write or post a newspaper editorial, opinion piece, or \"editorial summary\" for WayToIAS/waytoias.com (e.g. \"summarise this editorial on federalism\", \"write today's editorial summary from this link\", \"post this opinion piece breakdown\"). Do NOT use this for a plain news article (use waytoias-ca-daily-news) or a durable Mains topic note (use waytoias-ca-mains-notes). Requires the coaching-posting-agent MCP server (whoami, ca_parse, ca_commit tools) to be connected."
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

1. **Research and write**, following the structure below, as plain HTML.
2. **Hand it off for filing** — call `ca_parse` with your text as `raw_text`
   and `content_kind: "daily_editorial_summary"`. Its own AI resolves the
   category and date and normalises the shape. Nothing is saved yet. Note:
   `ca_parse` has been observed silently dropping the Mains Angle section
   from the returned body — always diff the candidate's body against what
   you sent, and re-add anything that went missing before committing.
3. **Run the validator script** (see "Run the validator before every
   commit" below) against the body you're about to send. Fix everything it
   reports as an error. This is not optional and does not get skipped for
   time — it is the actual mechanism that makes "Before you commit" real
   instead of aspirational.
4. **Commit** — call `ca_commit` with `content_kind: "daily_editorial_summary"`.
   Default `publish_mode: "review"` — see "Publishing" below.

## Before you start

Run `whoami` once per session. If it fails, the connection isn't working —
say so and stop; don't try to work around it.

**How to reconnect depends on how you're running.** If you're running
locally (Claude Desktop or Claude Code, spawned as a process on the user's
own machine), the fix is local: the user should fully quit and reopen
Claude Desktop, or check their MCP config for a wrong path or key. If
you're a **remote/online connected app** (Gemini's "custom connected app,"
or similar — anything reached over the internet rather than spawned
locally), a failed `whoami` almost always means the login has expired, not
that anything is broken — the server holds sessions in memory and a
routine restart on its end clears them, with no warning to you. There's
nothing local to diagnose in that case. Tell the user plainly that the
connection needs re-authorising, and that the fix is to disconnect and
reconnect this app in wherever they manage connected apps/integrations for
the assistant you're running in — that triggers a fresh sign-in.

## Run the validator before every commit

Manually re-reading a draft for length, heading count, and label quality is
exactly the step that has failed before — it's easy to convince yourself a
piece "reads fine" without actually counting words or headings, especially
when writing several pieces in one sitting. Don't rely on that. Use the
script below instead, every time, for every article, including edits to
already-published pieces.

**How to use it:**
1. Write the script below to a file in the sandbox (e.g.
   `/tmp/validate_editorial.py`) if it isn't already there this session.
2. Write the article's body HTML to a second file.
3. Run `python3 /tmp/validate_editorial.py <bodyfile.html>`.
4. If it prints anything under `ERRORS`, fix the body and rerun until it
   prints `none`. Items under `WARNINGS` are worth a manual look (commas in
   a list of proper nouns or figures are usually fine) but aren't blocking.
5. Only then call `ca_commit` or `ca_update_article`.

```python
#!/usr/bin/env python3
"""
Validator for waytoias-ca-editorial-summary bodies.
Usage: python3 validate_editorial.py <file.html>
Exits non-zero if any HARD violation is found. Prints WARN items too.
"""
import sys, re, html

BANNED_WORDS = ["artefact", "optics", "complementarity", "institutionalised",
                 "institutionalized", "chilling effect", "the picture", "headwinds"]
VAGUE_LABEL_HINTS = ["real ", "genuine concern", "significant", "an uncertain",
                      "growing concern", "notable", "important to", "likely to",
                      "already watching", "quietly", "concerns exist", "some concern"]
ATTRIBUTION_HEDGES = ["the article says", "the editorial argues", "the article argues",
                       "the editorial says"]
MAX_WORDS = 32
MAX_SUBSTANTIVE_HEADINGS = 4
MIN_POINTS = 3
MAX_POINTS = 6

def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()

def word_count(s):
    return len(re.findall(r"\S+", s))

def check_sentences(text, where, errors, warns):
    sentences = re.split(r'(?<=[.!?])["”’]?\s+(?=[A-Z"“])', text)
    for s in sentences:
        wc = word_count(s)
        if wc > MAX_WORDS:
            errors.append(f"[{where}] sentence too long ({wc} words): \"{s[:90]}...\"")
        if s.count(";") >= 1:
            warns.append(f"[{where}] semicolon found, check it isn't chaining two facts: \"{s[:90]}...\"")
        if s.count(",") >= 3:
            warns.append(f"[{where}] {s.count(',')} commas in one sentence, check for chaining: \"{s[:90]}...\"")

def main(path):
    raw = open(path, encoding="utf-8").read()
    errors, warns = [], []

    parts = re.split(r"(<h2>.*?</h2>)", raw, flags=re.S)
    opening = parts[0]
    if re.search(r"<ul>|<ol>", opening):
        errors.append("Opening (before first heading) contains a list — must be plain <p> paragraphs.")
    for s in re.findall(r"<p>(.*?)</p>", opening, flags=re.S):
        check_sentences(strip_tags(s), "opening", errors, warns)

    headings = []
    i = 1
    while i < len(parts):
        h2_raw = parts[i]
        heading_text = strip_tags(h2_raw)
        body = parts[i+1] if i+1 < len(parts) else ""
        headings.append((heading_text, body))
        i += 2

    substantive = [h for h in headings if h[0].strip().lower() not in ("conclusion", "mains angle")]
    if len(substantive) > MAX_SUBSTANTIVE_HEADINGS:
        errors.append(f"{len(substantive)} substantive headings found (max recommended {MAX_SUBSTANTIVE_HEADINGS}) — merge related sections.")

    has_mains_angle = any(h[0].strip().lower() == "mains angle" for h in headings)
    if not has_mains_angle:
        errors.append("No 'Mains Angle' heading found — ca_parse may have dropped it, re-add before committing.")

    slot_names = ["key arguments", "positives", "concerns", "causes", "impacts",
                  "significance", "way forward", "a. positives", "b. concerns"]
    for heading_text, body in headings:
        low = heading_text.strip().lower()
        if low in slot_names:
            errors.append(f"Heading '{heading_text}' is a literal slot name — rewrite as a topic-specific question.")

        if low == "conclusion":
            if re.search(r"<ul>|<ol>", body):
                errors.append("Conclusion contains a list — must be plain <p> paragraph(s).")
            for s in re.findall(r"<p>(.*?)</p>", body, flags=re.S):
                check_sentences(strip_tags(s), "Conclusion", errors, warns)
            continue
        if low == "mains angle":
            continue

        items = re.findall(r"<li>(.*?)</li>", body, flags=re.S)
        n = len(items)
        if n == 0:
            errors.append(f"Heading '{heading_text}' has no numbered points at all.")
        elif n < MIN_POINTS:
            errors.append(f"Heading '{heading_text}' has only {n} point(s) — fold into a related section instead of its own heading.")
        elif n > MAX_POINTS:
            warns.append(f"Heading '{heading_text}' has {n} points — consider curating down toward {MAX_POINTS}.")

        for item in items:
            label_match = re.match(r"\s*<strong>(.*?)</strong>\s*:?", item)
            label = strip_tags(label_match.group(1)) if label_match else None
            rest = item[label_match.end():] if label_match else item
            item_text = strip_tags(rest)
            if label:
                low_label = label.lower()
                for hint in VAGUE_LABEL_HINTS:
                    if hint in low_label:
                        warns.append(f"[{heading_text}] label '{label}' may be too generic (paste-test it) — matched hint '{hint.strip()}'.")
            check_sentences(item_text, heading_text, errors, warns)

    full_text_lower = strip_tags(raw).lower()
    for w in BANNED_WORDS:
        if w in full_text_lower:
            errors.append(f"Banned vague word found: '{w}'.")
    for phrase in ATTRIBUTION_HEDGES:
        if phrase in full_text_lower:
            errors.append(f"Stray attribution hedge found: '{phrase}'.")

    print("=== ERRORS (must fix before committing) ===")
    if errors:
        for e in errors:
            print(" -", e)
    else:
        print(" none")
    print("\n=== WARNINGS (re-check, may be false positives) ===")
    if warns:
        for w in warns:
            print(" -", w)
    else:
        print(" none")

    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
```

This script is a living part of the skill — if a new kind of violation shows
up that the script doesn't catch, the right fix is to extend the script (and
re-save the skill with the updated version), not to just try to remember to
check for it manually next time.

## How every piece is built

Every editorial summary is a short structured story, in this shape:

1. **Open with a plain paragraph — no heading, no bullets, no numbers.**
   Two to four sentences, in `<p>` tags, that tell the reader what happened
   in the order they'd naturally hear it: the general finding or event
   first, then the specific figures or facts that back it, then whatever
   minimum background is needed to follow the rest of the piece.

2. **Everything after that is a question heading (`<h2>`) followed by a
   numbered list (`<ol><li>`).** Each heading asks a specific question about
   the topic (see "Headings" below). Each numbered point follows one shape:
   a short bolded label, a colon, one plain sentence stating the point, and
   — only when the source actually has one to give — a second sentence in
   the same point giving the supporting detail, example, or figure.

3. **Order the points the way they'd actually make sense** — usually
   chronological (what happened first, second, third), or by how much
   weight the editorial itself gives each one.

4. **Close with a short plain paragraph (`<p>`), not a list** — the piece's
   own stance or tone, written the same way as the opening. Use a
   "Conclusion" heading.

5. **Mains Angle stays as its own final section (`<h2>` + `<p>`)** — the GS
   paper, syllabus theme, and a practice question. This is the one part you
   compose yourself rather than draw from the editorial.

### Aim for around three to four substantive headings, not five or more

If two headings are both answering a version of "why did this happen" or
"what's the concern here," they belong under one heading with a longer,
combined numbered list — not two headings with two or three points each.

### Don't create a heading for one or two points

Fold thin sections into the neighbouring section they're most related to —
usually the opening paragraph if it's scene-setting, or the argument
section it supports, or occasionally into the Conclusion as prose if it's a
forward-looking implication rather than an argument.

### Headings — phrase every one around the topic, never the template label

The section names below ("Causes," "Key Arguments," "Significance," and so
on) are internal names for what kind of content goes where — never publish
them as the literal heading. Write the actual `<h2>` as a specific question
or statement naming the real subject. Only "Mains Angle" and a plain
"Conclusion" are ever published literally.

### The bolded label on every point — name the thing, don't summarise it

Modelled on insightsonindia.com's own labels — never a verdict or a
reaction, always the name of the actual thing being described: **"10-km
Clearance Buffer for Wetland Reserves,"** **"Nationwide Parity Principle,"**
**"Mandatory EIAs."** Each one could stand alone as a term in a glossary.

- **Name the rule, mechanism, figure, principle, case, or event — not your
  own take on it.**
- **Paste test:** could this label be pasted into a completely different
  article and still sort of fit? If yes, it's too generic — rewrite it to
  include the number, name, date, or mechanism unique to this piece.
- The sentence after the colon still does the explaining — the label's job
  is only to name the point precisely.

### Writing rules for every numbered point

- **Say the reasoning, not just the result.**
- **No word that stands in for an explanation instead of giving one** —
  avoid *artefact*, *optics*, *complementarity*, *institutionalised*,
  *chilling effect*, *the picture*, *headwinds*, or an unexplained *bias*.
- **Keep each sentence to roughly 30 words, and never chain more than two
  facts together with commas or a semicolon.**
- **Use the source's exact figures** — a number, date, percentage, Article,
  case name, or named institution, wherever the source gives you one.
- **Full name, then abbreviation**, on first mention of any Act, scheme, or
  body.
- **Curate hard.** Roughly 4–6 numbered points per section.

### Core rules

- **Stay inside the editorial.** State each point directly, no "the article
  says" hedging. Quotations are the one exception — verbatim, in quote
  marks, attributed.
- **Sections are adaptive, never forced.**
- **No outside general knowledge.**

### Which sections to build, and what each one is for

Build only what the editorial supports, in this order: **(unheaded)
Opening paragraph** → **Causes/Reasons** *(if present)* → **Key Arguments**
(Strengths, Concerns — whichever are present) → **Significance**
*(if present)* → **Impacts** *(if present)* → **Institutional/Legal
References** *(if present)* → **Way Forward** *(only if the source itself
proposes one)* → **Conclusion** → **Mains Angle**. Merge per "Aim for
around three to four substantive headings" wherever two of these would
otherwise be thin.

### Format Library — variants by editorial type

The shape above is the **default**. If a variant below matches the piece,
use its sections instead (spine stays: opening paragraph first, Mains
Angle last). A variant marked *"To be defined"* has no agreed shape — use
the default and say so, rather than inventing one.

**General editorial / opinion piece** *(default — defined above)*

**Judgment or legal commentary** *(To be defined)*
**Economic or data-led editorial** *(To be defined)*
**Foreign policy or international relations editorial** *(To be defined)*
**Social issue or governance editorial** *(To be defined)*

## Research and accuracy

- **Never invent a figure, date, name, rank or finding.**
- **Attribute statistics by name in the text.**
- **Never invent a source link.**
- Cite Articles/Sections precisely.
- Wrap maths/statistics/percentages in single dollar signs for LaTeX.

## Category and date

`ca_parse` picks a category and date on its own, or you can override:

```
Categories: Polity > Governance
Date: 2024-03-15
```

Call `list_current_affairs_categories` first if you want to see live
category names before writing one in.

## Before you commit — check what `ca_parse` actually returned

This is what "Run the validator before every commit" above operationalises
— run the script, then also sanity-check by eye:

- **Category resolved and date sane?**
- **Mains Angle still present?** (`ca_parse` has dropped it before.)
- **Quotes are real quotes**, no stray "the article says" hedging.
- **Every point carries a real figure, date, name, or example** where the
  source has one — nothing generalised into vague language.

## Publishing

**Default to `publish_mode: "review"`, always.** Use `"auto"` only when the
user's message, in this exact request, explicitly asks for it to go live.
Tell the user plainly, every time, which happened and where it landed.

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

### Link the concept inside the summary body, where it's needed

The site shows linked concepts in their own panel, but that's *after* the
argument. A reader meeting an unfamiliar Bill in paragraph two shouldn't
have to hunt for the explanation — **put the link where the term first
carries weight**, usually in the opening paragraph or the first section
that turns on it.

One inline link per concept, on its first substantive mention:

```html
<p>The Lok Sabha passed the
<a href="https://waytoias.com/current-affairs/articles/the-concept-slug">Bankers'
Books Evidence Bill, 2026</a>, replacing a statute written for paper
ledgers.</p>
```

Rules:

- **Link the term itself**, not a trailing "(read more)". The linked words
  should be the entity's name.
- **Once per concept.** Linking every mention turns the summary into a mess
  of blue text.
- Use the concept's real URL —
  `https://waytoias.com/current-affairs/articles/<concept-slug>` — taken
  from what `ca_link_concept` returns, not composed from the title.
- If you link a concept inline, still record the relation with
  `ca_link_concept`; the inline link and the relation are two different
  things and the panel depends on the relation.
- Never link a concept that doesn't exist yet. Create it first (asking, per
  above), then link.

*(Daily news is exempt from the confirmation step — its concept is the
entity the story is plainly about. Summaries and Mains Notes ask, because
both name several entities while making their case.)*

## Source and SEO — fill these on every commit

Both are passed per article in `ca_commit`. Neither is optional in practice:
an unsourced summary can't be checked, and an article with no SEO fields is
invisible to search.

### Source — required for a summary

A summary represents someone else's argument, so the reader must be able to
reach it.

- `source_name` — the publication and, where known, the author:
  `"The Hindu"`, `"Indian Express — Editorial"`.
- `source_url` — **the exact URL you actually read.** It becomes a
  clickable link on the article page.

**Never invent a URL.** If you only have the topic, or your grounding came
from a general search rather than one identifiable page, set `source_name`
to the publication if you know it and **leave `source_url` out entirely** —
then say so plainly in your report. A wrong link is worse than none.

### SEO — every article

- `seo_title` — up to ~60 characters. The topic in searchable words, not a
  clever headline. Front-load the entity a student would type: *"Bankers'
  Books Evidence Bill 2026: Key Changes and Concerns"*.
- `seo_description` — 140-160 characters, one or two plain sentences saying
  what the piece covers and what a reader gains. Not a truncated first
  paragraph.
- `keywords` — 5-10 entries. The named entities (Act, Bill, body, scheme,
  index), the syllabus theme, and the exam paper. Real terms someone would
  search; no keyword stuffing, no near-duplicates of one phrase.

Write them from the finished piece, not before — they should describe what
you actually wrote.

## After committing — check for a Mains Note topic

1. **Search** — `ca_find_articles` with the entity/topic name and
   `content_kind: "mains_topic_note"`.
2. **If a topic exists:** read it, identify which section(s) this adds to,
   propose the exact addition to the user, then merge in and save with
   `confirm_change: "user-approved"` (+ `confirm_live_edit` if published),
   and record the link with `ca_link_to_mains_note`.
3. **If no topic exists:** tell the user and propose creating one — don't
   create it yourself.
4. **Never re-summarise into a second competing topic.**

## What not to do

- Don't summarise an editorial you couldn't find or read — say so.
- Don't invent a source name, URL, figure, date, or finding.
- Don't publish live unless explicitly asked.
- Don't force a section, or give one or two points their own heading.
- Don't publish a slot name as a literal heading.
- Don't put the opening or Conclusion in a list.
- Don't chain three or more facts into one sentence, anywhere.
- Don't label a point with a verdict or a mood when a specific name, rule,
  figure, or event is available.
- Don't reach for an abstract word in place of a plain description.
- Don't assert a causal claim without its reasoning in the same point.
- Don't hedge a directly-stated point behind "the article says."
- Don't add your own verdict in the Conclusion.
- Don't invent a shape for a *To be defined* Format Library variant.
- **Don't skip running the validator script** — for one article or four.
- Don't create a concept page for every entity the editorial names. One
  piece is about one thing; the rest are mentions.
- Don't create a second concept when `ca_find_concepts` already returned
  one. Reuse the id.

## Adjusting the format later

This skill's format spec, including the validator script, is a persistent,
editable spec. If the user asks to change any of it, **update this skill
and re-save it** — and if a new violation type shows up that the validator
doesn't catch, extend the script itself in the same edit, not just the
prose rules around it.

