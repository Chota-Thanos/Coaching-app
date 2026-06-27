"use client";

import { useAuth } from "../auth/auth-context";
import { useSubscription } from "../../lib/use-subscription";
import { ArticleList } from "./article-list";
import { PremiumLockOverlay } from "../billing/premium-lock-overlay";
import type { ArticleSummary } from "../../lib/api";
import { Loader2 } from "lucide-react";

type Props = {
  articles: ArticleSummary[];
  isMains: boolean;
};

export function GatedArticleList({ articles, isMains }: Props) {
  const { token, isInitialized } = useAuth();
  const { hasEntitlement, loading } = useSubscription(token);

  if (isMains) {
    if (!isInitialized || loading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
        </div>
      );
    }

    const hasAccess = hasEntitlement("current_affairs.editorial_access");
    if (!hasAccess) {
      return (
        <PremiumLockOverlay
          title="Unlock Mains Editorial Summaries & Topic Notes"
          description="Get access to daily editorial summaries, GS topic-wise mains analysis, issue briefs, and integrated answer writing exercises with Current Affairs Pro."
          planName="Current Affairs Pro"
        />
      );
    }
  }

  return <ArticleList articles={articles} />;
}
