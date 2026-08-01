# CSAT / Aptitude questions — `content_type: "aptitude"`

CSAT covers reading comprehension, logical reasoning, basic numeracy and
data interpretation — not general knowledge. Match the question to whichever
of these the user actually asked for; don't default to comprehension if they
said "reasoning" or "maths".

## Comprehension sets

Several questions can share one passage. Write the passage once, then the
questions under it. When you get to filing, pass the passage as
`passage_title` / `passage_text` on `assessment_commit` rather than repeating
it inside each stem — check the shared `SKILL.md` for how that works.

## Reasoning / numeracy questions

Same four-option, one-correct-answer, full-explanation standard as GK
questions (see `gk-questions.md` for the exact format) — the difference is
purely in subject matter, not in rigor. A reasoning question's explanation
should walk through the logic step by step, not just assert the answer;
that's the part students are actually trying to learn.

## Difficulty

CSAT is not GK-with-easier-facts — genuine CSAT questions require actually
working through a passage or a piece of logic, not recalling a fact. If a
question can be answered by pattern-matching a keyword rather than reasoning
it through, it isn't a good CSAT question — rewrite it.
