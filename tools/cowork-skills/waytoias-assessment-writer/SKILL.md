---
name: waytoias-assessment-writer
description: Write and post GK/Prelims, CSAT/Aptitude, or Mains practice questions into the WayToIAS UPSC coaching website's question bank, filing them into the correct taxonomy automatically. Use this whenever the user asks to write, draft, create, make, or add practice questions, MCQs, CSAT questions, aptitude questions, or Mains questions for WayToIAS or waytoias.com, even if they only name a topic and not the exact format (e.g. "make 5 questions on the Panchayati Raj system", "write a mains question on judicial review", "add some CSAT reasoning questions"). Requires the coaching-posting-agent MCP server (whoami, list_exams, assessment_parse, assessment_commit, list_assessment_taxonomy tools) to be connected.
---

# Writing and posting practice questions for WayToIAS

You are the writer here — not a tool you call. You write the question(s)
yourself, following the format for the right question type, then hand your
plain text to the app's own AI to be classified into the correct place in the
syllabus tree and saved in the exact shape the question bank needs. That
filing step is the same one the app already runs when a human uploads a
question paper — you're replacing the paper, not the filing.

## The flow

1. `whoami` once per session — confirms the connection works.
2. `list_exams` — get `exam_id`. Normally there is exactly one (UPSC CSE),
   but read it rather than assuming its id.
3. **Pick the question type** and read its reference file:

   | The user wants | Read | `content_type` |
   |---|---|---|
   | Prelims General Studies MCQs | `references/gk-questions.md` | `gk` |
   | CSAT / aptitude / reasoning / comprehension | `references/csat-questions.md` | `aptitude` |
   | Mains subjective questions | `references/mains-questions.md` | `mains` |

   These are three different taxonomy trees. If a request mixes types (e.g.
   "some GK and some CSAT questions"), write and file each type separately —
   don't send a mixed batch through in one `content_type`.
4. **Write the question(s)** yourself, in the plain format the reference file
   shows. This is a genuine exam-paper layout — stem, options, answer,
   explanation — because that's what the filing step is built to read.
5. **Hand off for filing** — call `assessment_parse` with your text as
   `raw_text`, plus `content_type` and `exam_id`. It classifies each question
   into the deepest matching taxonomy node itself.
6. **Check what came back**, then `assessment_commit`. Default to
   `publish_mode: "review"` — see "Publishing" below.

## Accuracy — non-negotiable

- **Never invent a `correct_answer`.** If you're not certain which option is
  right, say so to the user rather than guessing — a wrong answer key
  actively teaches the wrong thing, which is worse than no question at all.
- **The explanation must actually support the stated answer.** Don't write a
  confident-sounding explanation for an answer you're unsure of.
- Don't write two questions on the same fact from the same request — repeats
  are a common failure mode past ~10 questions on one topic.

## Taxonomy — checking `assessment_parse`'s work

`taxonomy_node_ids` is an ordered path, root → leaf:

- GK/CSAT (`gk`/`aptitude`): `subject → source_bucket → topic → subtopic`
- Mains: `paper → subject_area → theme → topic`

Before committing, check every question actually got a `taxonomy_node_ids` —
**`assessment_commit` rejects any question without one; that's a guard, not a
bug you should route around.** If one is missing, use
`list_assessment_taxonomy` (with `search`) to find the right node yourself
rather than dropping the question. Use `tree: "objective"` for gk/aptitude,
`tree: "mains"` for mains — passing the wrong tree's node ids files the
question somewhere no student doing that paper will ever see it.

If every question in a batch lands on the exact same node, that's usually a
sign the classification didn't really differentiate between them — worth a
second look before committing.

## CSAT comprehension sets

When several questions share one passage, write the passage once and pass it
as `passage_title` / `passage_text` on `assessment_commit` — don't repeat it
inside every question stem.

## Publishing — read this before every `assessment_commit` call

**Default to `publish_mode: "review"`, always.** This saves the questions as
drafts in the questions manager for a human to check before students see them.

The server's automatic block on publishing AI-written content live does not
cover this path — from its point of view, you handing over text is the same
as a human pasting in a question paper. **You are the safeguard here, not the
server.** Use `publish_mode: "auto"` only when the user's message, in this
exact request, explicitly asks for the questions to go live immediately. Not
because a similar request did last time.

Tell the user plainly which happened and where the questions ended up.

## What not to do

- Don't fabricate a `correct_answer` you're not sure of — flag it instead.
- Don't invent a taxonomy node to force a commit through.
- Don't mix question types (`gk`/`aptitude`/`mains`) in one commit.
- Don't publish live because it seemed like what they'd want — only because
  they asked, in this request.
