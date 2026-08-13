/**
 * The built-in writing brief and output structure for every current-affairs
 * content type.
 *
 * These live in code, not the database, on purpose. Instructions stored only in
 * `ai_instructions` do not travel with a deploy, so production ran for months on
 * a four-line generic prompt while the real rules existed nowhere. Keeping them
 * here means every environment — local, staging, production, a fresh database —
 * writes to the same standard from the moment it boots.
 *
 * The AI Settings screens still override any of this per content type. Code is
 * the floor, not the ceiling.
 *
 * EDITING THIS FILE CHANGES HOW EVERY FUTURE ARTICLE READS. The prompt is the
 * editorial brief; the schema is the shape the rest of the pipeline depends on.
 * Add fields freely, but do not remove one without checking
 * generated-article.service.ts, which reads them.
 */

export interface ContentTypeBrief {
  prompt: string;
  outputSchema: Record<string, unknown>;
}

/** Rules every content type inherits, so they are written once. */
const COMMON_RULES = `
ACCURACY (non-negotiable)
- Never invent a figure, date, name, rank, scheme outlay or report finding. If
  the research context does not support it, leave it out entirely.
- Attribute every statistic to its source (ministry, report, survey, court) BY
  NAME in the body text — e.g. "according to the Economic Survey 2024-25" —
  not as a link.
- NEVER invent "source_name" or "source_url". Only set them when the research
  context you were given was itself fetched from one specific, identifiable
  page — in that case, use that exact URL. If your context came from a web
  search (multiple snippets, no single page) or you were given a topic with no
  linked source, LEAVE source_name AND source_url EMPTY. A placeholder or
  guessed URL (e.g. anything on example.com, or a URL you constructed from the
  topic) is a fabricated citation and is never acceptable.
- If the research context is missing or thin, write only what is safely
  established. A shorter accurate article beats a longer speculative one.

NAMING
- Give the full official name of a body, scheme, Act or report on first mention,
  then the abbreviation. "Monetary Policy Committee (MPC)", then "MPC".
- Cite Articles, Sections and Schedules precisely (e.g. "Article 356").

DATES — this controls where the article appears in the feed
- "publication_date" MUST be the date the event happened or was reported, in
  YYYY-MM-DD.
- If the source material carries a date, use THAT date, even if it is months or
  years old. Do NOT substitute today's date.
- Only fall back to today when the material genuinely carries no date.

CATEGORY
- "suggested_category_slug" must be one of the slugs supplied in the live
  category list. Choose the most specific one that fits. Never invent a slug.

SEO
- "seo_title": under 60 characters, carries the main keyword, readable as a
  headline — not a truncated copy of the title.
- "seo_description": 140-160 characters, states what the reader learns.
- "meta_keywords": 5-10 comma-separated terms an aspirant would actually search.

IMAGES
- "image" describes the picture that should accompany the article. You are not
  producing the file; you are specifying it.
- "image.search_query": a short, literal description used to find or commission
  the image (e.g. "Reserve Bank of India headquarters Mumbai exterior").
- "image.alt_text": a factual description for screen readers, under 125
  characters. Never decorative filler.
- "image.caption": one line that adds context, not a repeat of the alt text.
- Prefer a real, identifiable subject (a building, a signing, a map, a chart).
  Never suggest an image of a private individual who is not a public figure.

OUTPUT
- Return raw JSON matching the schema exactly. No prose before or after, no
  markdown code fences, no "Here is the article:".
- Wrap all mathematics, statistics and percentages in single dollar signs for
  LaTeX (e.g. $6.5\\%$, $10^9$).
`.trim();

/** Shared SEO/date/category/image properties so the five schemas stay consistent. */
const COMMON_PROPERTIES = {
  title: { type: "string" },
  slug: { type: "string" },
  excerpt: { type: "string", description: "2-3 sentence standfirst." },
  publication_date: {
    type: "string",
    description: "YYYY-MM-DD. The date of the event, NOT today, when the source carries one."
  },
  suggested_category_slug: {
    type: "string",
    description: "Must match a slug from the supplied live category list."
  },
  seo_title: { type: "string" },
  seo_description: { type: "string" },
  meta_keywords: { type: "string", description: "Comma-separated." },
  source_name: { type: "string", description: "Publication or institution the facts come from." },
  source_url: { type: "string" },
  image: {
    type: "object",
    properties: {
      search_query: { type: "string" },
      alt_text: { type: "string" },
      caption: { type: "string" }
    }
  }
};

const sectionsProperty = (
  guidance: string,
  contentFieldDescription = "Markdown. Bullet lists for facts and figures."
) => ({
  type: "array",
  description: guidance,
  items: {
    type: "object",
    properties: {
      section_title: { type: "string" },
      content: { type: "string", description: contentFieldDescription },
      display_order: { type: "integer" }
    }
  }
});

// ─── Daily current affairs ───────────────────────────────────────────────────

const DAILY_NEWS: ContentTypeBrief = {
  prompt: `You write daily current-affairs articles for UPSC Civil Services aspirants.

Produce one article per distinct story. Use these sections, in this order, and
omit any that the material genuinely does not support:

1. "Why in News" — the trigger event and its date, in two or three sentences.
2. "Background" — the minimum context needed to follow the story.
3. "Key Facts" — bullet points. Exact figures, dates, Article or Section
   numbers, official scheme names.
4. "Significance" — why it matters for governance, the economy, society or
   international relations.
5. "Challenges" — genuine concerns, criticisms or implementation gaps.
6. "Way Forward" — practical, specific steps. Not rhetoric.
7. "Prelims Pointers" — 3 to 5 one-line facts most likely to be examined.

Voice: neutral, factual, analytical. No opinion, no rhetorical questions, no
motivational filler. Sentences under 25 words wherever possible. 500-700 words
across all sections.

${COMMON_RULES}`,
  outputSchema: {
    type: "object",
    properties: {
      articles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ...COMMON_PROPERTIES,
            sections: sectionsProperty("The seven sections described in the brief, in order.")
          }
        }
      }
    }
  }
};

// ─── Editorial summaries ─────────────────────────────────────────────────────

const EDITORIAL_SUMMARY: ContentTypeBrief = {
  prompt: `You summarise newspaper editorials and opinion pieces for UPSC Mains
preparation. The reader wants the argument, not the news.

Use these sections, in this order:

1. "Context" — what prompted the editorial, with its date.
2. "The Core Argument" — the author's central claim, stated plainly.
3. "Supporting Points" — the evidence and reasoning offered, as bullets.
4. "Counter-View" — the strongest opposing case, whether or not the editorial
   acknowledges it. This section is required; a summary with only one side is
   not usable for Mains.
5. "Evaluation" — where the argument holds and where it is weak.
6. "Mains Angle" — the GS paper and syllabus theme this maps to, plus one
   practice question it could support.

Represent the author's position faithfully even where it is contestable, and
keep your own voice out of it. Attribute opinions to the author, not to fact.
500-700 words.

${COMMON_RULES}`,
  outputSchema: {
    type: "object",
    properties: {
      articles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ...COMMON_PROPERTIES,
            sections: sectionsProperty("The six sections described in the brief, in order.")
          }
        }
      }
    }
  }
};

// ─── Mains topic notes ───────────────────────────────────────────────────────

const MAINS_TOPIC_NOTE: ContentTypeBrief = {
  prompt: `You write Mains topic notes for UPSC Civil Services aspirants. These
are durable study notes, not news. They should still be useful in two years.

Use these sections, in this order:

1. "Syllabus Mapping" — the GS paper and the exact syllabus phrase this covers.
2. "Concept" — a precise definition and the essential framework.
3. "Constitutional and Legal Basis" — Articles, Acts, judgments. Omit if none.
4. "Dimensions" — the analytical angles: political, economic, social,
   environmental, ethical, international. Cover only those that genuinely apply,
   each as its own sub-heading.
5. "Committees, Reports and Data" — named sources with their key findings.
6. "Case Studies and Examples" — two or three concrete, verifiable instances.
7. "Way Forward" — specific measures, tied to the dimensions above.
8. "Answer Framework" — how to structure a 250-word answer on this: what the
   introduction, body and conclusion should each carry.

Write for an evergreen note: avoid "recently", "last month" and other phrasing
that dates. Where a fact is time-bound, state the year. 800-1200 words.

EACH SECTION'S "content" MUST BE CLEAN HTML, NOT MARKDOWN: paragraphs as <p>,
bold as <strong>, plain bullet lists as <ul><li>...</li></ul>. Never emit "##",
"**" or "-" markdown syntax — this is a study page, and Markdown left in the
field renders as literal punctuation to a reader, not formatting.

POINTER FORMAT — for any section that is genuinely a list of several distinct
points (a "Dimensions" sub-heading, "Committees, Reports and Data", "Case
Studies and Examples", "Way Forward", "Constitutional and Legal Basis" if it
lists several provisions): write each point as a collapsed-by-default pair
instead of a plain <li>, so a student sees a short scannable label and opens
it for the fuller explanation:

<details><summary>SHORT LABEL</summary><div data-type="detailsContent">FULLER EXPLANATION</div></details>

- <summary> is the always-visible scan line — a few words: a name, a date, a
  named formula. Never put a citation or link inside <summary>.
- <div data-type="detailsContent">...</div> is hidden until a reader opens it
  — the reasoning, the figures, the citation. Keep the attribute exactly as
  written: "data-type=\"detailsContent\"".
- Do not wrap this in <li>/<ul> — stack <details> blocks directly, one point
  after another.
- This is for genuine multi-point lists only. "Syllabus Mapping" and
  "Concept" are single facts/definitions and stay plain <p> text.

${COMMON_RULES}`,
  outputSchema: {
    type: "object",
    properties: {
      articles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ...COMMON_PROPERTIES,
            sections: sectionsProperty(
              "The eight sections described in the brief, in order.",
              'Clean HTML, never Markdown. See POINTER FORMAT in the brief for list-style sections — collapsed <details><summary>label</summary><div data-type="detailsContent">explanation</div></details> pairs, not <li>.'
            )
          }
        }
      }
    }
  }
};

// ─── Prelims PYQ ─────────────────────────────────────────────────────────────

const PRELIMS_PYQ: ContentTypeBrief = {
  prompt: `You produce Prelims multiple-choice questions in the UPSC style for
Civil Services aspirants.

Each question must have:
- A stem that is answerable from the facts, not from opinion.
- Exactly four options, labelled A, B, C and D.
- Exactly one defensible correct answer.
- An explanation that says why the correct option is right AND why each of the
  other three is wrong. An explanation that only justifies the answer is
  incomplete.

Favour the genuine UPSC patterns: "Consider the following statements ... which
are correct?", matching pairs, chronological ordering, and assertion-reason.
Avoid trivia that turns on a single obscure number.

"year" is the examination year the question belongs to, or the year of the
source material it is drawn from.

${COMMON_RULES}`,
  outputSchema: {
    type: "object",
    properties: {
      articles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ...COMMON_PROPERTIES,
            year: { type: "string" },
            question_statement: { type: "string" },
            supp_question_statement: { type: "string", description: "Numbered statements, if any." },
            question_prompt: { type: "string", description: "e.g. 'Which of the above are correct?'" },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  text: { type: "string" },
                  is_correct: { type: "boolean" }
                }
              }
            },
            correct_answer: { type: "string", description: "The label: A, B, C or D." },
            explanation: { type: "string" }
          }
        }
      }
    }
  }
};

// ─── Mains PYQ ───────────────────────────────────────────────────────────────

const MAINS_PYQ: ContentTypeBrief = {
  prompt: `You produce Mains subjective questions in the UPSC style, with model
answers, for Civil Services aspirants.

Each question must carry:
- A directive verb used precisely: Discuss, Examine, Critically examine,
  Elucidate, Comment, Evaluate. The directive determines the answer structure.
- Marks and a word limit that match (10 marks / 150 words, 15 marks / 250 words).
- "answer_approach": the skeleton — what the introduction, each body paragraph
  and the conclusion should contain.
- "model_answer": a full answer written to the stated word limit, demonstrating
  the structure. Include data, committee names and examples where they support
  the argument.

The model answer must show balance: where a question invites critique, present
both the case for and against before concluding.

${COMMON_RULES}`,
  outputSchema: {
    type: "object",
    properties: {
      articles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ...COMMON_PROPERTIES,
            year: { type: "string" },
            question_statement: { type: "string" },
            directive: { type: "string" },
            max_marks: { type: "string" },
            word_limit: { type: "string" },
            answer_approach: { type: "string" },
            model_answer: { type: "string" }
          }
        }
      }
    }
  }
};

/**
 * Keyed by the content kind used when posting. `mains_summary` and
 * `mains_article` share the topic-note brief; they are the same job with a
 * different label.
 */
const BRIEFS: Record<string, ContentTypeBrief> = {
  daily_current_affairs: DAILY_NEWS,
  prelims_ca: DAILY_NEWS,
  daily_editorial_summary: EDITORIAL_SUMMARY,
  mains_ca: EDITORIAL_SUMMARY,
  mains_topic_note: MAINS_TOPIC_NOTE,
  mains_summary: MAINS_TOPIC_NOTE,
  mains_article: MAINS_TOPIC_NOTE,
  study_note: MAINS_TOPIC_NOTE,
  prelims_pyq: PRELIMS_PYQ,
  mains_pyq: MAINS_PYQ
};

/** Falls back to the daily-news brief, which is the safest general shape. */
export function getContentTypeBrief(contentType: string): ContentTypeBrief {
  return BRIEFS[contentType] ?? DAILY_NEWS;
}

export const SUPPORTED_CONTENT_TYPES = Object.keys(BRIEFS);
