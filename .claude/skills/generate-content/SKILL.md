---
name: generate-content
description: Generate NEW current-affairs articles, GK/CSAT questions or Mains questions with AI and stage them as drafts in the coaching app. Use when the user asks to "write today's current affairs", "generate questions on X", "draft some MCQs", "research and write up these topics", or otherwise wants content created rather than posted from a document they supply. Requires the coaching-posting-agent MCP server.
---

# Generating content

Creates content that **nobody has read yet**. That is the entire reason this is
a separate skill from `post-current-affairs` and `post-assessment-questions`:
those move a human-authored document onto the site, this invents the words.

## Use the pipeline tool

For current affairs, prefer **`ca_generate_and_post`**. It researches, writes
using the instructions and output format saved for that exact content type,
converts the result into articles, and posts them — in one call, with the format
handling done server-side.

Pass `content_kind` exactly as the AI Settings screens name it
(`daily_current_affairs`, `mains_topic_note`, `prelims_pyq`, …), not a broad
group. That is what selects the right saved rules.

Use `dry_run: true` when the user wants to see the drafts before anything is
written.

## Publishing

**Drafts are the default.** `publish_mode` defaults to `"review"`, which stages
content in the admin panel for a human to read.

Publishing AI-written content live additionally requires
`confirm_publish_ai_content`, and the server refuses without it. The refusal
message contains the exact value.

**Only use that confirmation when the user asked, in this request, for the
content to go live.** Never set it because it seems convenient, because a
previous request used it, or to clear an error. If you are unsure whether they
meant "publish" or "save it", ask — the confirmation exists so a person decides
that unreviewed AI writing reaches students.

Human-written documents are not gated at all; a refusal means the batch really
does contain AI-written text.

Whichever route is taken, say plainly in your summary which one it was, and
where the content ended up. AI-written UPSC material that reaches students
unreviewed can teach wrong facts and wrong answer keys, and neither is
recoverable by quietly editing the article later — so the user should never be
unsure whether something went live.

## Generating articles

`ca_generate_and_post` — topics or source URLs in, articles posted out.

1. Pick the content type. `list_style_guides` gives a `style_guide_id`; pass it
   so drafts come out in the house voice.
2. **Prefer URLs over bare topics.** A URL is scraped and used as source
   material; a bare phrase gets a web search, which is far weaker grounding.
3. Read the `research` block in the response before anything else:

   ```
   research: { topics_total, topics_grounded, failures: [{topic, method, error}] }
   ```

   Anything under `failures` was written **without** grounding material — the
   model fell back on its own priors. Report those topics to the user by name.
   Figures, dates, scheme outlays and rankings in an ungrounded article are the
   most likely things to be wrong.
4. Check `warnings`. "Built from a custom output format" means the layout is
   worth a look. "No category resolved" means it will be filed uncategorised.
5. Report `posted_count`, and `skipped_empty` if present — a generation run
   occasionally returns an item with no usable text, and those are dropped
   rather than posted blank.

## Generating questions

- `assessment_generate_questions` — GK/CSAT from a prompt. Pass
  `style_profile_id` from `list_style_profiles`.
- `assessment_draft_mains_question` — one Mains question with directive, marks
  and word limit.
- `ca_generate_questions_from_article` — **preferred when it applies.**
  Questions grounded in an article already published on your site cannot drift
  from your own content, which makes them markedly safer than prompt-only
  generation.

Before committing generated questions, verify for each one:

- `correct_answer` exists and matches one of the option labels.
- The explanation actually supports the stated answer — a confidently wrong
  explanation is worse than none.
- The question isn't a near-duplicate of another in the same batch. Prompt-only
  generation repeats itself, especially past ~10 questions on one topic.
- Taxonomy path is right (see `post-assessment-questions` for the tree rules).

Then `assessment_commit` with `publish_mode: "review"`.

## Volume

Generate in small batches — 10 or so articles, 20 or so questions — and let the
user look at the first batch before running more. A hundred unreviewed drafts is
a backlog, not an achievement.

## What not to do

- Don't publish generated content unless the user asked for it in this request.
  "Add these to the site" is not the same as "put these live".
- Don't present an ungrounded draft as researched. If `research.failures` is
  non-empty, say so in your summary, unprompted.
- Don't fabricate a citation, source name or source URL for generated text.
- Don't generate questions on a topic the user hasn't asked about to "round out"
  a batch.
- Don't paper over a generation failure by writing the content yourself in the
  reply — if the tool failed, say it failed.
