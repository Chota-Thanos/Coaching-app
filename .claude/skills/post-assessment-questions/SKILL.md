---
name: post-assessment-questions
description: Post GK/prelims, CSAT/aptitude or Mains questions into the coaching app's question bank from a Word/PDF file, a URL, or pasted text. Use when the user says things like "add these questions to the test series", "upload this question bank", "post these PYQs to the assessment section", or hands over a question paper. Requires the coaching-posting-agent MCP server.
---

# Posting to the question bank

Drives the app's assessment posting agent through the `coaching-posting-agent`
MCP server. Parsing and taxonomy classification run **server-side** — your job
is to pick the right content type and exam, verify the classification, and
decide between draft and published.

## The pipeline

`assessment_extract` → `assessment_parse` → *(review)* → `assessment_commit`

`assessment_parse` takes a `file_path` or `url` directly; extract first only
when you want to inspect or fix the text (scanned papers especially).

## Before you start

1. `whoami` — confirm the key resolves to an admin/editor account.
2. `list_exams` — get `exam_id`. There is normally exactly one (UPSC CSE, id 1),
   but read it rather than hardcoding.
3. Pick `content_type`:
   - `gk` — prelims General Studies (objective, 4 options)
   - `aptitude` — CSAT (objective; comprehension sets share a passage)
   - `mains` — written/subjective (no options; has word limit, marks, directive)

   These are three different taxonomy trees and three different question
   families. Getting it wrong files the questions somewhere no student will
   find them, so if a document mixes types, split it and run once per type.

## Taxonomy is the part that actually goes wrong

`taxonomy_node_ids` is an **ordered path, root → leaf**:

- objective (`gk`/`aptitude`): `subject → source_bucket → topic → subtopic`
- mains: `paper → subject_area → theme → topic`

The parser classifies to the deepest node it can match and reconstructs the
ancestors. Before committing, check:

- **Every question has `taxonomy_node_ids`.** Commit rejects questions without
  one — that is a guard, not a bug. Fill them via `list_assessment_taxonomy`
  (use `search` to find a node by name) rather than dropping the questions.
- **The path belongs to the right tree.** A mains question carrying objective
  node ids will be filed wrongly. `list_assessment_taxonomy` takes
  `tree: "objective" | "mains"` — verify against the same tree you're posting to.
- **Suspiciously uniform classification.** If 60 questions all landed on one
  node, the parser probably failed to differentiate; spot-check and re-run with
  better `instructions` before committing.

## Reviewing parse output

Report to the user, and check yourself:

- **Question count** against what the document actually contains.
- **`correct_answer` present** on every objective question, and matching one of
  the option labels. A missing or out-of-range answer key makes the question
  unscoreable.
- **Option count** — 4 for standard prelims; anything else is worth flagging.
- **Explanations** — optional, but note how many are missing so the user can
  decide whether it's worth a second pass.
- **Mains fields** — `marks`, `word_limit`, `directive` ("Discuss", "Critically
  examine"). Missing marks/word limits are common in scanned papers.

For CSAT comprehension sets, pass the shared passage as `passage_title` /
`passage_text` on the commit rather than repeating it in every stem.

## Committing

**`publish_mode: "review"` is the default** — questions land as drafts in the
questions manager for human review. Use `"auto"` (immediately live to students)
only when the user explicitly asks, for this batch.

Commit in batches of ≤ 100 questions.

After committing, report counts and point the user at
`/admin/assessment` to review.

## What not to do

- Don't fabricate a `correct_answer` you can't find in the source. Flag it and
  leave it out; a wrong key silently teaches students the wrong thing.
- Don't invent taxonomy nodes to make a commit pass — search the real tree, and
  if nothing fits, tell the user which node is missing.
- Don't mix content types in one commit.
- Don't publish (`auto`) unasked.
