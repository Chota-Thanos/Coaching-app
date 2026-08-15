# Format tiers — what's foundational, what's rising, what 2026 actually did

UPSC Prelims has not used one static template. This file tracks the shift so
the skill doesn't drift back to whatever is easiest to generate. **Update it
whenever a new paper is analysed.**

The 2026 section below is built on a **full question-by-question audit of all
100 questions of GS Paper 1, 2026 (Set D)**, cross-verified across two
independent sources. That matters, because a partial read of the 2026 paper
gives a badly wrong picture — an earlier draft of this file, built from a
summary page and three sample questions, got several things backwards.

## Tier 1 — Foundational (pre-2024 baseline, still valid)

- Plain single-best-answer (stem + 4 options). Still ~6-8 per paper in 2026,
  including "which one best describes…" definitional items.
- Statement-based, "which of the above is/are correct."
- Simple 2-column pairs, and match-the-following with a code grid.

These remain the floor for basic/intermediate difficulty. Note that
match-the-following survives in 2026 but is now concentrated in the
International Relations block (4 of the paper's 4 occurrences).

## Tier 2 — What actually dominates 2026

**The single most common shape in the 2026 paper is statement-based where the
question is carried in the stem and the closing line is just "Select the
answer using the code given below:".** Roughly 24 of questions 51-100 take
this form. The stem states the subject ("With reference to X, consider the
following statements"), the numbered items follow, and there is no separate
"Which of the statements given above is/are correct?" line — the code prompt
alone closes it. Reproduce this: it is the house style now, and always
writing the older explicit prompt reads as dated.

Also strongly present:

- **Negation**, in three distinct flavours — statement-level ("which are
  *not* correct"), item-list ("which have *not* been ratified"), and
  option-level ("which one of the following pairs is *not* correctly
  matched", where each option is itself a whole pair or proposition).
  Eight occurrences across the paper; "not" is italicised in the original.
- **Multi-column rows** — item plus two attributes, every cell must be right.
  Both prompt variants appear: "In which of the above rows are all the
  details correctly matched?" and "In how many of the above rows are the
  given details correctly matched?" See `types/consider-the-pairs.md`.

### A rigid option template you should imitate

The exact option set below appears in **eleven of the first fifty questions**:

```
(a) 1 only
(b) 1 and 2
(c) 2 and 3
(d) 3 only
```

It is deliberately non-exhaustive — there is no "1 and 3" and no "1, 2 and
3" — so the option set itself constrains the answer space. Use it for
three-item questions where it fits, rather than always enumerating every
combination.

### Roman vs Arabic numbering is semantically loaded

Where a 2026 question uses both, the convention is consistent across every
occurrence:

- **Roman numerals (I, II, III) = the base material** — the statements,
  assertion, or evidence being reasoned about.
- **Arabic numerals (1, 2, 3) = claims about that material** — inferences,
  relationships, or candidate supporting evidence.

This is the clearest structural signature of the 2026 paper. Follow it in
any two-layer question; mixing the two numbering systems arbitrarily is a
tell that a question wasn't written to current pattern.

## Tier 3 — The reasoning-over-recall formats

Around a fifth of the 2026 paper asks the reader to evaluate relationships,
inferences, rationales or mechanisms rather than recall facts. In older
papers this would have been two or three questions. These are the formats in
highest demand and each has its own file:

- **Assertion-with-basis** — `types/assertion-with-basis.md`. Two
  occurrences (Q1 Ancient History, Q8 Modern History), plus a two-base-
  statement variant at Q20.
- **Relationship-among-statements** — `types/relationship-among-statements.md`.
  Two occurrences (Q25 Economy/Sagarmala, Q31 Environment/climate). The
  relationship vocabulary is standardised: *validates / extends /
  contradicts / is empirically supported by / together establish*.
- **Inference-from-statements** — `types/inference-from-statements.md`.
  Evidence given, candidate inferences judged for validity.
- **Meta-conclusion on a statement set** — `types/meta-conclusion.md`. Four
  occurrences, all Polity. Options are second-order claims about *how many*
  statements are correct and sometimes *which*. Strongly
  elimination-resistant.
- **Rationale / mechanism selection** — `types/rationale-and-mechanism.md`.
  Candidate explanations or mechanisms, mostly plausible-sounding but
  containing embedded errors.
- **Identify-from-clues** — `types/identify-from-clues.md`. Three
  occurrences, including a bare "Identify 'X'" current-affairs variant and
  definition-to-term items in Economy.
- **Scenario and dialogue formats** — `types/scenario-and-dialogue.md`.
  New in 2026: case vignettes, situational-judgement items, and a
  two-speaker dialogue to adjudicate.

## What 2026 did NOT contain — correct earlier assumptions

Verified absent from all 100 questions:

- **No "how many of the above statements are correct"** in the classic
  correctness sense. The counting prompt survives only applied to *rows*
  ("in how many of the above rows…") and once to a factual attribute
  ("How many of the above have been awarded the Nobel Prize twice?"). The
  format that dominated 2023-24 has essentially been retired in its old
  form — do not lean on it as though it were current.
- **No Statement-I / Statement-II assertion-reason.** Not one in 100. It
  appeared in 2023-24 and an earlier draft of this file wrongly described it
  as "rising sharply." Keep `types/assertion-reason.md` for older-pattern
  and state PCS work, but it is not a 2026 shape.
- **No chronological / sequence ordering.**
- **No cross-topic / common-thread** in the hidden-shared-attribute sense.
  `types/cross-topic-common-thread.md` remains a plausible pattern from
  other papers, but it is not evidenced in 2026 — treat it as unconfirmed.

## Content note: the subject mix widened

2026 pulled in **public administration, ethics and situational judgement**
content in GS Paper 1 (principles of administration, conflict mediation,
disclosure dilemmas) — material that used to sit in GS Paper 4. It also ran
a long, contiguous Economy block (roughly Q52-Q65) and Science & Tech block
(Q66-Q75). Expect breadth beyond the classic subject list.

## How to pick a tier when the user doesn't specify

Aim for a realistic exam-like spread rather than one tier throughout. For
"2026-style", "advanced" or "analytical" requests, lean into Tier 3 and use
the stem-carried statement format with the code-only prompt as the default
for ordinary items. For "basic" or "beginner", stay in Tier 1. Don't force a
Tier 3 shape onto thin content — a synthetic relationship question built on
three barely-related facts is worse than a solid Tier 1 question.
