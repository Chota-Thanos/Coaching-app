"use client";

import { ArticleList } from "./article-list";
import type { ArticleSummary, CategoryNode } from "../../lib/api";

type Props = {
  articles: ArticleSummary[];
  categories: CategoryNode[];
};

/**
 * Browsing/listing current-affairs content — including the Mains hub
 * (Editorial Summaries, Mains Notes, Mains PYQ) — is open to everyone,
 * signed in or not. This used to hard-block the Mains listing behind
 * `current_affairs.editorial_access` with no login option at all, just a
 * "View Pricing Plans" button, for both signed-out visitors and signed-in
 * users without a paid plan. That contradicted the access model already in
 * place on the article-detail page (GatedArticleBody): subscription
 * entitlements are deliberately not enforced right now, and the only limit
 * is a per-article, sign-in-nudging read count for signed-out visitors,
 * applied when they open an article — not when they browse the list.
 *
 * The plan/entitlement machinery still exists server-side, so restoring a
 * paid gate here later means re-adding the `useSubscription` check this
 * file used to have (see git history), not rebuilding it.
 */
export function GatedArticleList({ articles, categories }: Props) {
  return <ArticleList articles={articles} categories={categories} />;
}
