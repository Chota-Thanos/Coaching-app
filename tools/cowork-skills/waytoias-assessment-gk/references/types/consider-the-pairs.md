# Consider the following pairs (and multi-column rows)

Confirmed from real papers — spans Tier 1 (simple 2-column pairs) and Tier
2 (3-column rows, rising since 2025), see `../format-evolution.md`. Close
cousin of statement-based, but each gradable unit is a **row** (an item plus
one or more associated attributes) instead of a free-standing statement.

## Structure and components

Two variants, same underlying logic:

- **Simple pairs** — Item : Feature, one attribute per item.
  ```
  Consider the following pairs:
  Item                  Feature
  1. <item>             <feature>
  2. <item>             <feature>
  3. <item>             <feature>
  ```
- **Multi-column rows** — item plus *two or more* attributes that all have
  to be correct for the row to count as "correctly matched." Confirmed real
  examples: `Organisation | Function | Works under`,
  `Country | Resource-rich in`, `Action | Act it's covered under`,
  `Army rank | Air Force equivalent | Navy equivalent`. This is
  meaningfully harder than simple pairs — a row with one right cell and one
  wrong cell is still a wrong row, so skimming for "does this look
  roughly right" doesn't work.

Prompt is either "which of the pairs/rows given above is/are correctly
matched?" (combinations) or "how many of the above pairs/rows are correctly
matched?" (count — the elimination-resistant variant, see
`../format-evolution.md`).

**Formatting note:** the skeletons below show columns aligned with spaces
for readability, but space alignment doesn't survive the plain-text handoff
to the filing step. Write pairs and rows with an explicit delimiter — an em
dash or a colon between the item and each attribute — keeping a header line
to name the columns. See "Plain-text conventions" in SKILL.md.

## Depth

Leans factual by default (does item X actually go with feature Y), but the
multi-column version pushes it higher just by construction — verifying two
or three facts per row instead of one, and rejecting the whole row if any
single cell is wrong. Push depth further by choosing features that require
understanding a classification rather than a single memorised fact — e.g.
pairing an institution with the *category* of body it belongs to, where a
wrong pairing reflects a genuine conceptual mix-up (confusing two similar
but distinct categories), not a random wrong number.

## Scope — selecting the pairs/rows

Pull items from one coherent domain so the wrong pairings are genuine
near-misses (a feature that's true of a *different but related* item, not
something obviously unrelated) — this is what makes each row worth
individually verifying instead of skippable by common sense. Strongest
sources by subject: Polity and Economy for institutional rows (body →
function → parent ministry/authority), Geography and Ancient History for
place/monument ↔ feature pairs, International Relations for
country/organisation ↔ attribute pairs (see `../subject-coverage.md` for
the fuller subject map).

## Skeleton — simple pairs

```
Consider the following pairs:
Item                        Feature
1. <item>                   <feature>
2. <item>                   <feature>
3. <item>                   <feature>

Which of the pairs given above is/are correctly matched?
(a) <combination>
(b) <combination>
(c) <combination>
(d) <combination>

Answer: (x)

Explanation:
Answer is (x).

Pair 1 is <correct/incorrect>. <justification>.
[If incorrect: name what the item is actually correctly paired with, and
why the stated feature is a plausible-but-wrong match.]
Pair 2 is ...
Pair 3 is ...

<Self-contained paragraph on the underlying classification/domain that ties
the pairs together.>
```

## Skeleton — multi-column rows

```
Consider the following information:
Item                   Attribute A                  Attribute B
1. <item>              <attribute>                   <attribute>
2. <item>              <attribute>                   <attribute>
3. <item>              <attribute>                   <attribute>

In how many of the above rows is the information correctly matched?
(a) Only one
(b) Only two
(c) All three
(d) None

Answer: (x)

Explanation:
Answer is (x).

Row 1: Attribute A is <correct/incorrect> because <justification>. Attribute
B is <correct/incorrect> because <justification>. Row overall:
<correct/incorrect>.
Row 2: ...
Row 3: ...

<Self-contained paragraph on the domain connecting the rows.>
```

## Variety reminders

- Rotate which pair/row carries the error, vary how many are correct across
  a batch/session, and build distractor combinations from genuinely
  plausible near-miss pairs, not leftovers.
- For multi-column rows, vary *which* column carries the error (not always
  the second one) and don't always make exactly one cell wrong — sometimes
  both attributes in a row should be wrong.
