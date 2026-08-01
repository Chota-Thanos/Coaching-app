import assert from "node:assert/strict";
import { test } from "node:test";
import { convertGeneratedToArticle, convertGenerationResult } from "./generated-article.service.js";

/**
 * Pure conversion, no database.
 *
 * The case that matters most is the custom output format: an admin can define
 * their own structure in AI Settings, and the old browser-only converter only
 * understood `sections[]`, so anything else produced an empty article body.
 */

test("sections become markdown headings", () => {
  const article = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: {
      title: "MPC holds rates",
      sections: [
        { section_title: "Why in news", content: "The MPC met this week." },
        { section_title: "Analysis", content: "Rates were held at 6.5%." }
      ]
    }
  });

  assert.equal(article.title, "MPC holds rates");
  assert.match(article.body, /## Why in news\n\nThe MPC met this week\./);
  assert.match(article.body, /## Analysis\n\nRates were held at 6\.5%\./);
});

test("a prelims question becomes a readable question body", () => {
  const article = convertGeneratedToArticle({
    contentKind: "prelims_pyq",
    item: {
      title: "MPC composition",
      year: "2023",
      question_statement: "How many members does the MPC have?",
      options: [
        { label: "A", text: "Four" },
        { label: "B", text: "Six" },
        { label: "C", text: "Eight" },
        { label: "D", text: "Ten" }
      ],
      correct_answer: "B",
      explanation: "Three from the RBI and three nominated."
    }
  });

  assert.match(article.body, /### Year: 2023/);
  assert.match(article.body, /\(b\) Six/);
  assert.match(article.body, /\*\*Correct Answer: \(B\)\*\*/);
  assert.match(article.body, /### Explanation\nThree from the RBI/);
});

test("a mains question carries marks and word limit", () => {
  const article = convertGeneratedToArticle({
    contentKind: "mains_pyq",
    item: {
      title: "Monetary policy",
      year: "2024",
      max_marks: "15",
      word_limit: "250",
      question_statement: "Examine the role of the MPC.",
      answer_approach: "Define, then evaluate.",
      model_answer: "The MPC sets the repo rate…"
    }
  });

  assert.match(article.body, /Marks: 15 \| Word Limit: 250/);
  assert.match(article.body, /### Answer Approach\nDefine, then evaluate\./);
  assert.match(article.body, /### Model Answer/);
});

test("a custom output format still produces a real article body", () => {
  // Shape taken from an actual generation run against a live style guide —
  // none of these keys are ones the converter knows by name.
  const article = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: {
      title: "Monetary Policy Committee (MPC) of RBI",
      suggested_category_slug: "banking-monetary-policy",
      about_monetary_policy_committee: {
        overview:
          "The MPC is responsible for fixing the benchmark interest rate in India, primarily the repo rate, under the RBI Act."
      },
      latest_updates: [
        {
          title: "58th meeting",
          description:
            "The 58th meeting of the MPC was held from December 3-5, 2025 under the chairmanship of the Governor."
        }
      ]
    }
  });

  assert.ok(article.body.length > 0, "custom formats must not yield an empty body");
  assert.match(article.body, /About Monetary Policy Committee/);
  assert.match(article.body, /benchmark interest rate/);
  assert.match(article.body, /58th meeting/);
  assert.ok(
    article.warnings?.some((w) => /custom output format/i.test(w)),
    "should flag that the layout is worth checking"
  );
});

test("metadata keys are not repeated as body headings", () => {
  const article = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: {
      title: "Title here",
      meta_description: "Should not appear as a heading.",
      suggested_category_slug: "economy",
      body_text: "The actual content of the article, long enough to be rendered as prose."
    }
  });

  assert.doesNotMatch(article.body, /Meta Description/);
  assert.doesNotMatch(article.body, /Suggested Category Slug/);
  assert.match(article.body, /actual content of the article/);
});

test("a missing category is flagged rather than silently uncategorised", () => {
  const without = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: { title: "X", sections: [{ section_title: "A", content: "B" }] }
  });
  assert.ok(without.warnings?.some((w) => /category/i.test(w)));

  const withFallback = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: { title: "X", sections: [{ section_title: "A", content: "B" }] },
    fallbackCategoryNodeIds: [12]
  });
  assert.deepEqual(withFallback.category_node_ids, [12]);
  assert.ok(!withFallback.warnings?.some((w) => /category/i.test(w)));
});

test("the item's own category beats the fallback", () => {
  const article = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: { title: "X", category_node_id: 7, sections: [{ content: "B" }] },
    fallbackCategoryNodeIds: [12]
  });
  assert.deepEqual(article.category_node_ids, [7]);
});

test("keywords are accepted as a list or a delimited string", () => {
  const fromString = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: { title: "X", meta_keywords: "rbi, mpc; repo rate" }
  });
  assert.deepEqual(fromString.keywords, ["rbi", "mpc", "repo rate"]);

  const fromArray = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: { title: "X", keywords: ["rbi", "mpc"] }
  });
  assert.deepEqual(fromArray.keywords, ["rbi", "mpc"]);
});

test("both a batch and a single bare object are handled", () => {
  const batch = convertGenerationResult({
    contentKind: "daily_current_affairs",
    generated: { articles: [{ title: "One" }, { title: "Two" }] }
  });
  assert.equal(batch.articles.length, 2);
  assert.equal(batch.content_family, "prelims");

  const single = convertGenerationResult({
    contentKind: "mains_topic_note",
    generated: { title: "Solo", sections: [{ content: "Body text here." }] }
  });
  assert.equal(single.articles.length, 1);
  assert.equal(single.articles[0]?.title, "Solo");
  assert.equal(single.content_family, "mains");
});

test("an empty generation is reported, not passed off as an article", () => {
  const article = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: { title: "Nothing here" }
  });
  assert.ok(article.warnings?.some((w) => /no usable body/i.test(w)));
});

test("a title under a custom key is used instead of 'Untitled'", () => {
  // A live run put the title under `meta_title`, so every article came out
  // titled "Untitled" until the converter learned the other common keys.
  const article = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: {
      meta_title: "Monetary Policy Committee (MPC) - RBI",
      updates: [{ content: "The Reserve Bank of India announced changes this week." }]
    }
  });

  assert.equal(article.title, "Monetary Policy Committee (MPC) - RBI");
  assert.doesNotMatch(article.body, /Meta Title/, "the title must not also appear as a heading");
});

test("the model's chosen category slug resolves to a real node id", () => {
  const article = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: { title: "X", suggested_category_slug: "banking-monetary-policy", sections: [{ content: "B" }] },
    categorySlugToId: new Map([["banking-monetary-policy", 42]]),
    fallbackCategoryNodeIds: [99]
  });

  assert.deepEqual(article.category_node_ids, [42]);
  assert.ok(!article.warnings?.some((w) => /category/i.test(w)));
});

test("an unknown category slug falls back rather than failing", () => {
  const article = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: { title: "X", suggested_category_slug: "does-not-exist", sections: [{ content: "B" }] },
    categorySlugToId: new Map([["banking-monetary-policy", 42]]),
    fallbackCategoryNodeIds: [99]
  });

  assert.deepEqual(article.category_node_ids, [99]);
});

test("sections using 'heading' and an array of paragraphs still render", () => {
  // Exact shape from a live generation run against the configured style guide.
  // The old branch looked only for `section_title` + a string `content`, so
  // this produced an empty body and the commit was rejected.
  const article = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: {
      title: "Fiscal Deficit of India",
      sections: [
        {
          heading: "Introduction",
          content: [
            "Fiscal deficit refers to the difference between total expenditure and total receipts.",
            "It is expressed as a percentage of GDP."
          ]
        }
      ]
    }
  });

  assert.match(article.body, /## Introduction/);
  assert.match(article.body, /difference between total expenditure/);
  assert.match(article.body, /percentage of GDP/);
  assert.ok(!article.warnings?.some((w) => /no usable body/i.test(w)));
});

test("a back-dated article keeps its own date, not today", () => {
  const article = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: { title: "X", publication_date: "2024-03-15", sections: [{ content: "Body." }] }
  });

  assert.equal(article.publication_date, "2024-03-15");
});

test("an unusable date is rejected and flagged rather than written through", () => {
  const article = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: { title: "X", publication_date: "15 March 2024", sections: [{ content: "Body." }] }
  });

  assert.match(article.publication_date!, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(article.warnings?.some((w) => /unusable publication date/i.test(w)));
});

test("image intent survives even when no file exists yet", () => {
  const article = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: {
      title: "X",
      sections: [{ content: "Body." }],
      image: {
        search_query: "Reserve Bank of India headquarters Mumbai",
        alt_text: "The RBI headquarters building in Mumbai",
        caption: "The RBI has held the repo rate since February."
      }
    }
  });

  assert.equal(article.image?.search_query, "Reserve Bank of India headquarters Mumbai");
  assert.equal(article.image?.alt_text, "The RBI headquarters building in Mumbai");
  assert.equal(article.image?.url, undefined);
  assert.doesNotMatch(article.body, /Search Query/, "image intent must not leak into the body");
});

test("an image with neither alt text nor a search query is flagged", () => {
  const article = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: { title: "X", sections: [{ content: "Body." }], image: { caption: "Just a caption" } }
  });

  assert.ok(article.warnings?.some((w) => /alt text or a search query/i.test(w)));
});

test("SEO fields are carried through, falling back sensibly", () => {
  const explicit = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: {
      title: "Long internal title",
      seo_title: "Short SEO headline",
      seo_description: "What the reader learns.",
      meta_keywords: "rbi, mpc",
      sections: [{ content: "Body." }]
    }
  });
  assert.equal(explicit.seo_title, "Short SEO headline");
  assert.equal(explicit.seo_description, "What the reader learns.");
  assert.deepEqual(explicit.keywords, ["rbi", "mpc"]);

  const fallback = convertGeneratedToArticle({
    contentKind: "daily_current_affairs",
    item: { title: "Only a title", meta_description: "From meta.", sections: [{ content: "B." }] }
  });
  assert.equal(fallback.seo_title, "Only a title");
  assert.equal(fallback.seo_description, "From meta.");
});
