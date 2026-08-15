---
name: waytoias-assessment-gk
description: Write and post GK / Prelims General Studies MCQs into the WayToIAS UPSC coaching website's question bank (test series), in the real formats UPSC and state PCS papers use — statement-based, Statement-I/II, pairs and multi-column rows, identify-from-clues, assertion-with-basis, relationship-among-statements, cross-topic — not just generic stem-plus-4-options. Use whenever the user asks to write, draft, make or add GK questions, Prelims General Studies MCQs, or practice questions for the WayToIAS test series/question bank (e.g. "make 5 GK questions on Panchayati Raj", "add prelims MCQs on the Indian economy", "write a 2026-style analytical question on Sagarmala"). Do NOT use for CSAT/aptitude (use waytoias-assessment-csat), Mains (use waytoias-assessment-mains), or Current Affairs → Prelims PYQ Library questions (use waytoias-ca-prelims-pyq). Requires the coaching-posting-agent MCP server (whoami, list_exams, assessment_parse, assessment_commit, list_assessment_taxonomy, list_question_natures, assessment_find_questions, assessment_get_question, assessment_update_question).
---

# Writing and posting GK questions for WayToIAS

You are the writer — not a tool you call. You write the question(s) yourself,
then hand your plain text to the app's own AI, which files each one into the
right place in the syllabus tree and saves it in the shape the question bank
needs — the same job it already does when a human uploads a question paper.

## The flow

1. `whoami` once per session — confirms the connection works.
2. `list_exams` — get `exam_id`. Normally there is exactly one (UPSC CSE),
   but read it rather than assuming its id.
3. **Pick the format(s)** — see "Choosing a question format" below — then
   **write the question(s)** yourself, following that format's file and the
   shared explanation and variety rules further down.
4. **Hand off for filing** — call `assessment_parse` with your text as
   `raw_text`, plus `content_type: "gk"` and `exam_id`. It splits the text
   into questions and attempts taxonomy classification.
   - **Pass `raw_text`, not `file_path`.** The server runs on the user's own
     machine, so it can't see files in your workspace — a path you wrote
     will fail with ENOENT against a completely different filesystem.
   - **Send only a few questions per call.** Large payloads fail with an
     opaque HTTP 500 rather than a useful message; roughly 8,000 characters
     went through fine while ~18,000 did not. Split a big batch into
     several calls instead of debugging a 500.
5. **Check what came back** (see "Taxonomy and Question Nature" below), then
   call `assessment_commit` with `content_type: "gk"`. Default
   `publish_mode: "review"` — see "Publishing" below.
   - `assessment_parse` **rewrites your explanation** into its own house
     formatting, and it **flattens `Statement-I:` / `Statement-II:` labels
     into a plain `1.` / `2.` numbered list** — which quietly breaks
     Statement-I/II questions, since their options refer to the statements
     by name. When wording matters (and for every Statement-I/II item),
     build the `questions` array for `assessment_commit` yourself from what
     you wrote, rather than passing the parsed candidates through
     unchanged. Parse is useful for structure-checking and splitting; it is
     not a faithful copier.
   - When you build the explanation yourself this way, write it as clean
     HTML (`<p>`, `<strong>`) rather than Markdown — the site renders the
     explanation with no Markdown interpretation at all, so `**bold**`
     would show a student literal asterisks, never actual bold text.

## Choosing a question format

Real UPSC/PCS papers don't run one template — they mix several distinct
question *shapes*, and each shape tests differently even on the same
content. Defaulting to plain "stem + 4 options" every time is the weakest,
most guessable pattern in the exam — use it only when the content genuinely
doesn't support anything richer (a single unambiguous fact with no related
claims to test around it).

Before writing, look at what the source content actually gives you and match
it to a shape, then read that shape's reference file for the full spec
(structure, depth, and how to select/relate the facts) before writing.
Formats are organised by tier in `references/format-evolution.md` — read
that file too before a batch, since it tracks which patterns UPSC is
actually leaning on right now versus which are the stable foundation, and
it's meant to be updated as new papers get analysed rather than staying
fixed at what's written here today.

**Tier 1 — foundational, always valid:**
- **A single fact with no natural related claims around it** → the plain
  single-best-answer shape, described inline below. Keep this rare.
- **A cluster of related claims about one topic/entity**, each independently
  true or false → `references/types/statement-based.md` (the
  "which/how many of the above are correct" family, including the
  negation variant — the most common UPSC pattern by far).
- **Two parallel lists that pair up**, one attribute each (terms ↔
  definitions, schemes ↔ ministries) → `references/types/match-the-following.md`,
  or the simple-pairs half of `references/types/consider-the-pairs.md`.

**Tier 2 — what dominates the 2026 paper:**
- **Item plus two or more attributes that all have to hold** → the
  multi-column "rows" half of `references/types/consider-the-pairs.md`.
- **Negation** in any of its three flavours (statement-level, item-list, or
  option-level where each option is a whole pair/proposition) — covered in
  `references/types/statement-based.md` and `consider-the-pairs.md`.
- **Two linked claims where one might explain the other** →
  `references/types/assertion-reason.md` (Statement-I / Statement-II).
  Note: this appeared in 2023-24 but **not once in 2026** — use it for
  older-pattern and state PCS work, not as a current UPSC shape.
- **A sequence with a real chronological or procedural order** →
  `references/types/chronological-order.md`. Also absent from 2026.

**Tier 3 — the reasoning-over-recall formats. About a fifth of the 2026
paper. Lean into these for advanced/analytical/2026-style requests:**
- **A claim plus candidate pieces of supporting evidence** →
  `references/types/assertion-with-basis.md`.
- **Claims about how several base statements logically relate to each
  other** (validates/extends/contradicts) →
  `references/types/relationship-among-statements.md`.
- **Evidence given, candidate inferences judged for validity** →
  `references/types/inference-from-statements.md`.
- **Options that are second-order claims about how many statements are
  correct, and which** → `references/types/meta-conclusion.md`.
- **Candidate explanations or mechanisms, plausible but with embedded
  errors** → `references/types/rationale-and-mechanism.md`.
- **Several clues about one unnamed entity, four named candidates** →
  `references/types/identify-from-clues.md`.
- **A case vignette, situational-judgement scenario, or two-speaker
  dialogue to adjudicate** → `references/types/scenario-and-dialogue.md`.
- **Items pulled from unrelated topics that share one hidden attribute** →
  `references/types/cross-topic-common-thread.md`. Not evidenced in 2026 —
  treat as unconfirmed.

For which areas of a subject to actually draw content from — and whether
that subject leans factual-recall or application/analytical — see
`references/subject-coverage.md`. Don't wander into rarely-tested corners
of a subject when a request just names the subject broadly; pull from the
confirmed focused areas listed there.

If the user names a format explicitly ("write an assertion-reason question
on..."), skip straight to that file. If they don't, aim for a realistic
exam-like spread across a batch — mostly Tier 1–2, with Tier 3 where the
content supports it — rather than defaulting entirely to one tier or
letting every question in a set collapse into the same format.

**Plain single-best-answer** (use sparingly):

```
Q1. <stem>
(a) <option>
(b) <option>
(c) <option>
(d) <option>

Answer: (b)

Explanation:
Answer is (b).
<why b is right, why a/c/d are wrong>
```

Still follow the explanation rules below even for this simplest shape.

## Plain-text conventions — keep these identical across every format

The filing step reads your raw text, so stay consistent regardless of which
format you picked. Mixing conventions inside one batch is what tends to
confuse it:

- **Number every question** `Q1.`, `Q2.`, ... in a batch, so the parser has
  an unambiguous boundary between questions.
- **Label the key `Answer: (x)`** — one line, on its own. Don't switch to
  "Correct Answer" or "Ans" partway through a batch.
- **Head the explanation with a bare `Explanation:` line**, then open the
  body by restating the answer ("Answer is (x).") per the explanation rules
  below.
- **Separate questions with a blank line**, and don't wrap anything in a
  markdown table — plain text is what the filing step reads most reliably.
- **Prefer the 2026 house style for statement questions**: carry the
  question in the stem ("With reference to X, consider the following
  statements") and close with just `Select the answer using the code given
  below:` rather than adding a separate "Which of the statements given above
  is/are correct?" line. This is the single most common shape in the current
  paper; always using the older explicit prompt reads as dated. See
  `references/format-evolution.md`.
- **Use Roman numerals for base material and Arabic for claims about it**
  in any two-layer question (evidence → inferences, statements →
  relationships, assertion → candidate bases). This convention holds across
  every 2026 occurrence and is the clearest signature of the current paper.
- **For pairs/rows, use a clear text delimiter** (an em dash or a colon)
  between the item and its attributes rather than relying on column
  alignment by spaces — whitespace alignment doesn't survive parsing.

## Writing the explanation

This applies to every format that has more than one gradable part —
statements, an assertion and a reason, pairs, a sequence — which is most of
them. It serves two jobs at once: proving the stated answer is right, and
teaching the underlying concept well enough that someone who got it wrong
understands *why*, not just *what*.

Structure, in order:

1. **State the answer first.** e.g. "Answer is (b)."
2. **Go through each gradable part in turn** — each statement, the assertion
   and the reason separately, each pair, each sequence item — and give its
   verdict plus the reasoning that actually proves it. Don't just restate
   the fact; show the logic or evidence that settles it.
3. **For anything marked incorrect, also explain the trap** — what's the
   half-true or adjacent-but-wrong idea that makes it tempting? This is
   often the most instructive line in the whole explanation, so don't skip
   it for the sake of brevity.
4. **Close with a short, self-contained concept overview** — a paragraph
   that explains the underlying rule or topic on its own terms, not phrased
   as "statement 2 was about X." Someone should be able to read just this
   paragraph and come away understanding the concept, independent of the
   question.

Writing a genuinely rigorous explanation is also a built-in accuracy check:
if you can't produce a real justification for why something is wrong, that's
a sign the answer key itself may be shaky — flag it rather than writing a
confident-sounding explanation you're not sure of (see "Accuracy" below).

## Keeping questions unpredictable across the session

A test bank fails its purpose if a student can learn to answer the *shape*
of the questions instead of the content — e.g. the correct combination
always including the first and last statement, the correct option always
landing on (b), a batch always having exactly 2 of 4 statements true, or the
"trap" statement always sitting in the same position. Any of these becomes
a learnable shortcut, and shortcuts defeat the question bank.

Treat this as a running check across the **whole session**, not just within
one batch — if you write 20 questions over the course of a session, by
question 20 none of the following should be true:

- The correct answer clusters heavily on one or two option letters.
- The count of correct statements/pairs (1 of 4, 2 of 4, all correct, none
  correct...) repeats the same value far more than the others.
- Statements or pairs are consistently ordered the same logical way (e.g.
  always definition → cause → effect → exception), or the trap always sits
  in the same numbered position.
- Option combinations are always "obvious leftovers by elimination" rather
  than genuinely plausible alternative groupings.

Before committing a batch, briefly check it against everything written
earlier in the session (it's still in context) and reshuffle order, option
letters, or which combination is correct if things are clustering. This
should never come at the cost of a wrong or misleading answer key — vary the
*presentation*, never distort the *content* to force variety.

**When variety and accuracy pull against each other, accuracy always wins.**
This comes up most with Statement-I/II, where the fixed option template
means the facts fully determine the letter — options (a) and (b) are only
reachable when both statements are true, so you can't freely spread letters
across a run of those. The right move is to vary at the *content-selection*
stage — choose which claims to test, knowing what verdict they'll produce —
never to adjust a verdict after the fact to fill a gap in the distribution.
If a batch's letters still cluster after honest content selection, that's
acceptable; a distorted answer key never is.

## Accuracy — non-negotiable

- **Never invent a `correct_answer`.** If you're not certain which option is
  right, say so to the user rather than guessing — a wrong answer key
  actively teaches the wrong thing, which is worse than no question at all.
- **The explanation must actually support the stated answer**, for every
  part, correct and incorrect alike. Don't write a confident-sounding
  explanation for a verdict you're unsure of.
- Don't repeat the same fact across several questions in one request — a
  common failure past ~10 questions on one topic.

## Taxonomy and Question Nature — checking `assessment_parse`'s work

The full path is `subject → source_bucket → topic → subtopic`, root to leaf
— but **most of that tree doesn't exist yet.** In practice several subjects
are currently only two levels deep: a subject node, then source buckets
under it (e.g. Indian Polity → `M. Laxmikanth`, `NCERT`, `Current Affairs`,
`Previous Year's Quiz (PYQs)`). Don't assume a deep leaf is available;
walk the tree with `list_assessment_taxonomy` (`tree: "objective"`, plus
`parent_id` to descend, or `search`) and use the deepest path that actually
exists.

Expect `assessment_parse` to return **empty** `taxonomy_node_ids` with a
"No taxonomy node matched" warning — that's common, not an error, and it's
your job to fill in. `assessment_commit` rejects any question without a
node, which is a guard rather than a bug to route around. Pass the ordered
path root → leaf, e.g. `[1, 2]` for Indian Polity → M. Laxmikanth.

Choose the source bucket by where the content actually comes from: standard
syllabus/textbook material under the subject's textbook bucket, dated
news-driven material under `Current Affairs`, and reserve the PYQ bucket for
genuine past-paper questions rather than original ones written in that style.

Because the tree is shallow, **a whole batch legitimately landing on one
node is normal** — don't read that as a classification failure. It's only
worth a second look when deeper, genuinely distinct nodes did exist and
everything still collapsed onto one.

### Question nature

A separate tag from the taxonomy tree — a difficulty/type classification
(e.g. "Factual", "Analytical") the exam has its own configured list of.
Treated the same way as taxonomy: assigned on every question, checked
before you commit, and **`assessment_commit` rejects any question without
one whenever the exam has natures configured at all** — same guard as a
missing taxonomy node, not a bug to route around. (An exam with none
configured yet is never blocked — there'd be nothing to assign.)

`assessment_parse` auto-classifies each question's `question_nature_id`
against the exam's live list the same way it auto-classifies taxonomy —
nothing extra to do when passing parsed candidates through unchanged.

**When you build the `questions` array yourself instead** (Statement-I/II,
or anything else where wording matters — see above), carry the
`question_nature_id` the parse candidate returned over into what you send
`assessment_commit`, or look one up yourself with `list_question_natures` if
writing a question that never went through parse at all — same discipline
as filling in a taxonomy node yourself when parse didn't find one.

## Publishing — read this before every `assessment_commit` call

**Default to `publish_mode: "review"`, always.** This saves the questions as
drafts in the questions manager for a human to check before students see
them.

The server's automatic block on publishing AI-written content live does not
cover this path — from its point of view, you handing over text is the same
as a human pasting in a question paper. **You are the safeguard here, not
the server.** Use `publish_mode: "auto"` only when the user's message, in
this exact request, explicitly asks for the questions to go live
immediately.

Tell the user plainly which happened and where the questions ended up.

## Correcting something already posted

A question already on the site can be edited in place. Use this whenever
something turns out to be wrong — a bad answer key, a shaky explanation, a
mis-tagged category. **Never re-post a corrected copy.** A duplicate splits
its attempt history in two and leaves both halves wrong; the fix is always
an edit, never a new question.

Three tools, in this order — do not skip a step:

1. `assessment_find_questions` — find it by text from the question
   statement. Searches every status, drafts included.
2. `assessment_get_question` — read the full current content and taxonomy
   before changing anything. A rewrite composed from memory of what you
   posted drops details that were right. Read it first, every time.
3. `assessment_update_question` — send only the fields that change.
   Everything you leave out stays exactly as it is, so fixing one wrong
   option does not mean resupplying the whole question.

`options`, if you're changing any, must be the complete replacement set —
all four, not just the one that was wrong. `explanation` is HTML, same as
when posting — write it, don't paste raw prose. `taxonomy_node_ids`, if
you're changing taxonomy, replaces the whole path — the tool fills in
whichever levels you don't pass from what's currently saved, so you only
need to give the level that's actually wrong.

**Never change a posted question on your own judgement — not even a draft,
not even an obvious mistake.** If you notice something wrong while doing
other work, say so and stop there. Tell the user which question it is, what
looks wrong, and what you would change it to, then wait. Only once they
agree, in this request, do you send the edit with
`confirm_change: "user-approved"`. The tool refuses without it and names
the fields you were about to change — that refusal is the rule working,
not an error to route around.

### Editing something that is already live

If the question's status is `published`, students are reading it right
now. That edit needs `confirm_live_edit: "update-live-question"` **as
well as** `confirm_change` — say plainly that it is live when you ask.

Taking something down is the one thing that doesn't need the live gate:
set `status: "draft"` on a live question that is wrong (still ask first).
If a fix will take a while to get right, pull it down and correct it as a
draft.

Say plainly, every time, which question you changed, what you changed in
it, and whether it was live.

**Doesn't cover Mains-only fields** (word limit, marks, directive, model
answer detail) — those live in a separate part of the schema this tool
doesn't reach. Not relevant here since this skill is GK-only, but worth
knowing if you're also working from the Mains skill in the same session.

## What not to do

- Don't fabricate a `correct_answer` you're not sure of — flag it instead.
- Don't invent a taxonomy node or a question nature to force a commit
  through.
- Don't publish live because it seemed like what they'd want — only because
  they asked, in this request.
- Don't default every question to plain stem-plus-4-options when the content
  supports a richer, more realistic format.
- Don't let a batch or session settle into a recognisable shape — see
  "Keeping questions unpredictable" above.
- Don't re-post a corrected copy of a question instead of editing it in
  place.
- Don't change anything already posted — drafts included — without the
  user agreeing first, in this request.
