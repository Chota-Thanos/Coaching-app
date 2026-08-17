---
name: waytoias-assessment-mains
description: Write and post Mains subjective questions with model answers into the WayToIAS UPSC coaching website's question bank (test series). Use whenever the user asks to write, draft, make or add Mains questions, answer-writing practice, or subjective questions for the WayToIAS test series/question bank (e.g. "write a mains question on judicial review for the test series", "add a 15-mark question on federalism to the question bank"). Do NOT use this for GK or CSAT objective questions (use waytoias-assessment-gk / waytoias-assessment-csat), or for a question specifically meant for the Current Affairs → Mains PYQ Library (use waytoias-ca-mains-pyq instead). Requires the coaching-posting-agent MCP server (whoami, list_exams, assessment_parse, assessment_commit, list_assessment_taxonomy, list_question_natures tools) to be connected.
---

# Writing and posting Mains questions for WayToIAS

You are the writer — not a tool you call. You write the question and model
answer yourself, then hand your plain text to the app's own AI, which files
it into the right place in the Mains syllabus tree and saves it in the shape
the question bank needs — the same job it already does when a human uploads
a question paper.

## The flow

1. `whoami` once per session — confirms the connection works.
2. `list_exams` — get `exam_id`. Normally there is exactly one (UPSC CSE),
   but read it rather than assuming its id.
3. **Write the question and answer** yourself, in the format below.
4. **Hand off for filing** — call `assessment_parse` with your text as
   `raw_text`, plus `content_type: "mains"` and `exam_id`. It classifies the
   question into the deepest matching taxonomy node itself.
5. **Check what came back** (see "Before you commit"), then call
   `assessment_commit` with `content_type: "mains"`. Default
   `publish_mode: "review"` — see "Publishing" below.

**If `whoami` fails, how you reconnect depends on how you're running.**
Running locally (Claude Desktop/Code, spawned on the user's machine): the
user should fully quit and reopen Claude Desktop, or check their MCP config
for a wrong path or key. Running as a **remote/online connected app**
(Gemini's "custom connected app," or similar): a failed `whoami` almost
always means the login expired, not that anything is broken — the server
holds sessions in memory and a routine restart clears them silently. Tell
the user to disconnect and reconnect this app wherever they manage
connected apps for the assistant you're running in, which re-authorises it.

## Format

Write a question with a full model answer, in the genuine UPSC Mains style.

**Requirements, per question:**

- A **directive verb** used precisely: Discuss, Examine, Critically examine,
  Elucidate, Comment, Evaluate — and the answer must actually follow what
  that directive demands. "Critically examine" needs both a case for and
  against; don't write a one-sided answer to it.
- **Marks and word limit that match convention** — 10 marks / 150 words, or
  15 marks / 250 words. Pick whichever fits the question's scope.
- **Model answer** — plan a short structural skeleton first (what the
  introduction establishes, what each body paragraph covers, what the
  conclusion does), then write the complete answer following it, to the
  stated word limit, with real data, committee names and examples woven
  into the argument rather than listed at the end. The skeleton is a
  drafting step, not a separate thing to hand off — there's no field for
  it in the question bank; only the finished answer gets saved.
- **Key evaluation points** — 4 to 8 short, specific, checkable claims a
  grader should look for in a student's answer (e.g. "Must cite Kesavananda
  Bharati v. State of Kerala (1973)", "Must name at least two elements of
  the basic structure"). These feed the site's AI answer-evaluation feature
  directly — see "Building `assessment_commit`'s fields" below — so don't
  skip them; a question with none makes every student submission against it
  harder to grade well.

Write it out plainly:

```
Q1. <directive> <question> (<marks> marks, <word limit> words)

Model Answer:
<full answer>

Key Evaluation Points:
- <point>
- <point>
...
```

## Balance

Where the directive invites critique, the model answer must genuinely
present both sides before concluding — check your own draft against this,
it's the most common way a "critical" answer ends up one-sided.

## Accuracy — non-negotiable

- **Never invent data, a committee name, or a citation.** If you're not
  certain, leave it out rather than guessing.
- Wrap only genuine mathematical expressions in single dollar signs for LaTeX (e.g. `$\frac{a}{b}$`, `$10^9$`) — a plain number, year, mark value, or percentage sitting in ordinary prose (e.g. "adopted in 2016", "target of 4%") is not a formula and stays as normal text, never wrapped in $ signs.

## Building `assessment_commit`'s fields

`assessment_parse` only extracts one shared explanation-like field — it
doesn't know about `key_points` at all, and won't split your "Key
Evaluation Points" list out on its own. **Always build the `questions`
array for `assessment_commit` yourself**, rather than passing parsed
candidates through unchanged:

- **`explanation`** — the full Model Answer text. This becomes the
  question's `model_answer` in the database (the field the app's own
  question editor labels "Grading Model Answer / Structured Framework") —
  write it as clean HTML (`<p>`, `<strong>`), not Markdown.
- **`key_points`** — an array of strings, one per evaluation point, e.g.
  `["Must cite Kesavananda Bharati (1973)", "Must name judicial review as
  part of the basic structure"]`. Genuinely separate from `explanation` —
  omitting it doesn't fail the commit, but it leaves the AI evaluation
  feature with nothing to check a student's answer against.
- **`directive`, `marks`, `word_limit`** — send these as their own fields,
  not just as words inside `question_statement`. The directive word
  naturally also appears in the question's phrasing ("Discuss the...") —
  that's correct and expected — but the `directive` field itself is read
  separately when a student's answer is graded, so both need to be right.
- **`question_prompt`** — optional, and means something different here than
  in GK/CSAT: a short instruction shown to the student near the answer box
  (e.g. "Write your answer in the space provided"), not part of the
  question itself. Fine to leave blank — nothing defaults it for you if you
  do, so only set it if you want a specific instruction to show.

## Taxonomy and Question Nature — checking `assessment_parse`'s work

The Mains path is `paper → subject_area → theme → topic`, root to leaf —
**a different tree from GK/CSAT.** Before committing, check the question got
a `taxonomy_node_ids` — **`assessment_commit` rejects any question without
one.** If missing, use `list_assessment_taxonomy` with `tree: "mains"` (and
`search`) to find the right node. Using an objective-tree node id here files
the question somewhere no student doing the Mains paper will ever see it.

### Question nature

A separate tag from the taxonomy tree — a difficulty/type classification
the exam has its own configured list of (check `list_question_natures`
rather than assuming a value). **Same guard as taxonomy: `assessment_commit`
rejects any question without one whenever the exam has natures configured
at all** — not a bug to route around. (Unlike CSAT, this is not relaxed for
Mains — a difficulty tag genuinely fits a Mains question the way it does a
GK one.)

`assessment_parse` auto-classifies `question_nature_id` the same way it
classifies taxonomy. Since you're building the `questions` array by hand
for Mains anyway (see above), carry the parsed candidate's
`question_nature_id` over, or look one up yourself with
`list_question_natures` if it's missing.

## Publishing — read this before every `assessment_commit` call

**Default to `publish_mode: "review"`, always.** This saves the question as
a draft in the questions manager for a human to check before students see it.

The server's automatic block on publishing AI-written content live does not
cover this path — from its point of view, you handing over text is the same
as a human pasting in a question paper. **You are the safeguard here, not
the server.** Use `publish_mode: "auto"` only when the user's message, in
this exact request, explicitly asks for it to go live immediately.

Tell the user plainly which happened and where it ended up.

## What not to do

- Don't fabricate data, a committee name, or a citation for the model answer.
- Don't write a one-sided answer to a directive that demands balance.
- Don't use an objective-tree taxonomy node — this question belongs on the
  Mains tree only.
- Don't skip `key_points` when you have genuine grading criteria to give —
  it's a separate field from the model answer, and it's what the AI
  evaluation feature actually checks a student's answer against.
- Don't publish live because it seemed like what they'd want — only because
  they asked, in this request.
