"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Layers3, Loader2, Sparkles, Star } from "lucide-react";
import { useAuth } from "../auth/auth-context";
import { useSubscription } from "../../lib/use-subscription";
import { PremiumLockOverlay } from "../billing/premium-lock-overlay";
import { StudentArticleActions } from "./student-article-actions";
import { InteractivePrelimsPyq, InteractiveMainsPyq } from "./interactive-pyq";
import { RenderedContent } from "./rendered-content";
import type { ArticleDetail } from "../../lib/api";

type Props = {
  article: ArticleDetail;
  heroAsset: any;
  hub: any;
};


export function GatedArticleBody({ article, heroAsset, hub }: Props) {
  const { token, isInitialized } = useAuth();
  const { hasEntitlement, loading } = useSubscription(token);
  const [isDailyLimitReached, setIsDailyLimitReached] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(true);
  const [readCount, setReadCount] = useState<number | null>(null);

  const isMains = article.content_family === "mains";

  useEffect(() => {
    if (!isInitialized || loading) return;

    // Check if subscription gives CA Pro access (daily_reads & editorial_access)
    const hasCAPro = hasEntitlement("current_affairs.editorial_access");
    
    if (isMains) {
      // Mains content always requires subscription
      setCheckingLimit(false);
      return;
    }

    // Prelims / Daily News content limit check
    if (hasCAPro || hasEntitlement("current_affairs.daily_reads")) {
      // Premium users have unlimited access
      setIsDailyLimitReached(false);
      setCheckingLimit(false);
      return;
    }

    // Free users: Check localStorage for daily read limit (5 articles/day)
    try {
      const todayStr = new Date().toDateString();
      const rawData = localStorage.getItem("coaching_hub_reads");
      let readData = rawData
        ? JSON.parse(rawData)
        : { date: todayStr, count: 0, readSlugs: [] };

      // Reset tracker if it's a new day
      if (readData.date !== todayStr) {
        readData = { date: todayStr, count: 0, readSlugs: [] };
      }

      if (readData.readSlugs.includes(article.slug)) {
        // Already read this article today, allow reading
        setIsDailyLimitReached(false);
        setReadCount(readData.count);
      } else if (readData.count >= 5) {
        // Read limit reached
        setIsDailyLimitReached(true);
      } else {
        // Increment read count
        readData.count += 1;
        readData.readSlugs.push(article.slug);
        localStorage.setItem("coaching_hub_reads", JSON.stringify(readData));
        setIsDailyLimitReached(false);
        setReadCount(readData.count);
      }
    } catch (e) {
      console.error("Failed to check daily read limit", e);
    } finally {
      setCheckingLimit(false);
    }
  }, [article.slug, isMains, isInitialized, loading, hasEntitlement]);

  if (!isInitialized || loading || checkingLimit) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
      </div>
    );
  }

  // Gating for Mains Articles
  if (isMains && !hasEntitlement("current_affairs.editorial_access")) {
    return (
      <div className="mt-6">
        <PremiumLockOverlay
          title="Unlock Premium Mains Editorial Analysis"
          description="Get access to daily editorial summaries, GS topic-wise mains analysis, issue briefs, and integrated answer writing exercises with Current Affairs Pro."
          planName="Current Affairs Pro"
        />
      </div>
    );
  }

  // Gating for Daily Reads limit
  if (isDailyLimitReached) {
    return (
      <div className="mt-6">
        <PremiumLockOverlay
          title="Daily Free Reading Limit Reached"
          description="You have read your 5 free articles for today. Upgrade to Current Affairs Pro for unlimited access to all articles, editorial summaries, and notes workspace."
          planName="Current Affairs Pro"
        />
      </div>
    );
  }

  // User is authorized, show the full article body and tools
  const allConceptRelations = article.outgoing_relations.filter(
    (rel) => rel.target_article?.article_role === "concept" || rel.relation_type === "prerequisite" || rel.relation_type === "related_reference"
  );

  const coreConcepts = allConceptRelations.filter(
    (rel) => rel.label === "Core Concept" || rel.relation_type === "prerequisite"
  );
  const relatedConcepts = allConceptRelations.filter(
    (rel) => rel.label !== "Core Concept" && rel.relation_type !== "prerequisite"
  );

  const otherOutgoingRelations = article.outgoing_relations.filter(
    (rel) => rel.target_article?.article_role !== "concept" && rel.relation_type !== "prerequisite" && rel.relation_type !== "related_reference"
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] mt-5">
      <div className="min-w-0">
        {readCount !== null && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Free Tier read: {readCount} of 5 daily articles read today. Upgrade to Current Affairs Pro for unlimited access.</span>
            <Link href="/pricing" className="ml-auto text-xs font-black text-amber-700 hover:text-amber-900 underline uppercase tracking-wider shrink-0">
              Upgrade
            </Link>
          </div>
        )}
        {heroAsset && (
          <figure className="overflow-hidden rounded-lg border border-line bg-surface">
            <img alt={heroAsset.alt_text ?? article.title} className="max-h-[28rem] w-full object-cover" src={heroAsset.file_url} />
            {heroAsset.caption && <figcaption className="p-3 text-sm text-ink/65">{heroAsset.caption}</figcaption>}
          </figure>
        )}

        {article.content_kind === "prelims_pyq" && article.body_json && Object.keys(article.body_json).length > 0 ? (
          <div className="mt-5">
            <InteractivePrelimsPyq data={article.body_json} />
          </div>
        ) : article.content_kind === "mains_pyq" && article.body_json && Object.keys(article.body_json).length > 0 ? (
          <div className="mt-5">
            <InteractiveMainsPyq data={article.body_json} />
          </div>
        ) : (
          <section className="article-body mt-5 rounded-lg border border-line bg-surface p-4 text-base text-ink shadow-sm md:p-6">
            <RenderedContent content={article.body} />
            {article.sections.map((section) => (
              <section id={section.slug} key={section.id} className="mt-6 border-t border-line/40 pt-5">
                <h2 className="text-xl font-bold text-ink mb-3">{section.heading}</h2>
                <RenderedContent content={section.body} />
              </section>
            ))}
          </section>
        )}

        {/* 1. MUST READ: CORE CONCEPTS (Top Callout) */}
        {coreConcepts.length > 0 && (
          <section className="mt-6 rounded-xl border border-amber-400/80 bg-amber-500/10 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <Star className="h-5 w-5 fill-amber-500 text-amber-700" />
              <h2 className="text-lg font-black text-amber-950">Must Read: Core Concepts</h2>
            </div>
            <p className="text-xs text-amber-900/80 mb-4 leading-relaxed font-medium">
              Essential foundational concepts that form the core part of this article:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {coreConcepts.map((rel) => (
                <Link
                  className="group rounded-xl border border-amber-300/80 bg-surface p-4 transition-all hover:border-amber-500 hover:shadow-md flex flex-col justify-between"
                  href={`/current-affairs/articles/${rel.target_article.slug}`}
                  key={rel.id}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800 flex items-center gap-1 border border-amber-500/30">
                        <Star className="h-3 w-3 fill-amber-500 text-amber-600" /> Core Concept
                      </span>
                      {rel.target_article.category && (
                        <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-bold text-ink/60">
                          {rel.target_article.category.name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-ink group-hover:text-amber-700 transition-colors leading-snug">
                      {rel.target_article.title}
                    </h3>
                    {rel.target_article.body && (
                      <p className="mt-1.5 text-xs text-ink/65 line-clamp-2 leading-relaxed">
                        {rel.target_article.body.replace(/<[^>]*>?/gm, "").replace(/^[#*`-\s]+/, "").slice(0, 140)}...
                      </p>
                    )}
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-amber-800">
                    Read Core Concept Primer →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 2. IMPORTANT ASPECTS & RELATED CONCEPTS */}
        {relatedConcepts.length > 0 && (
          <section className="mt-5 rounded-xl border border-berry/20 bg-berry/5 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen className="h-5 w-5 text-berry" />
              <h2 className="text-lg font-black text-ink">Important Aspects & Related Concepts</h2>
            </div>
            <p className="text-xs text-ink/65 mb-4 leading-relaxed">
              Secondary background aspects and related references linked to this article:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedConcepts.map((rel) => (
                <Link
                  className="group rounded-xl border border-line bg-surface p-4 transition-all hover:border-berry hover:shadow-md flex flex-col justify-between"
                  href={`/current-affairs/articles/${rel.target_article.slug}`}
                  key={rel.id}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="rounded bg-berry/10 px-2 py-0.5 text-[10px] font-extrabold uppercase text-berry border border-berry/20">
                        Related Concept
                      </span>
                      {rel.target_article.category && (
                        <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-bold text-ink/60">
                          {rel.target_article.category.name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-ink group-hover:text-berry transition-colors leading-snug">
                      {rel.target_article.title}
                    </h3>
                    {rel.target_article.body && (
                      <p className="mt-1.5 text-xs text-ink/65 line-clamp-2 leading-relaxed">
                        {rel.target_article.body.replace(/<[^>]*>?/gm, "").replace(/^[#*`-\s]+/, "").slice(0, 140)}...
                      </p>
                    )}
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-berry">
                    Read Related Concept →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {article.updates.length > 0 && (
          <section className="mt-5 rounded-lg border border-line bg-surface p-4 shadow-sm md:p-6">
            <h2 className="text-lg font-extrabold text-ink">Updates</h2>
            <ol className="mt-3 space-y-4 border-l-2 border-berry/20 pl-4">
              {article.updates.map((update) => (
                <li key={update.id}>
                  <span className="block text-xs font-bold text-berry">
                    {new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(update.created_at))}
                  </span>
                  <RenderedContent className="mt-1 text-sm text-ink/85" content={update.body} />
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
        <StudentArticleActions article={article} />
        {article.sections.length > 0 && (
          <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-ink">
              <Layers3 aria-hidden="true" className="h-4 w-4 text-civic" />
              In this article
            </h2>
            <ol className="mt-3 space-y-2">
              {article.sections.map((section) => (
                <li key={section.id}>
                  <a className="text-sm font-semibold text-ink/75 hover:text-civic" href={`#${section.slug}`}>
                    {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}
        {otherOutgoingRelations.length > 0 && (
          <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
            <h2 className="text-base font-extrabold text-ink">Related reading</h2>
            <div className="mt-3 grid gap-3">
              {otherOutgoingRelations.map((relation) => (
                <Link className="rounded-md border border-line p-3 text-sm font-semibold text-ink hover:border-civic" href={`/current-affairs/articles/${relation.target_article.slug}`} key={relation.id}>
                  {relation.label ?? relation.target_article.title}
                </Link>
              ))}
            </div>
          </section>
        )}
        {article.incoming_relations.length > 0 && (
          <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
            <h2 className="text-base font-extrabold text-ink">
              Appears in {article.appearance_count} article{article.appearance_count === 1 ? "" : "s"}
            </h2>
            <div className="mt-3 grid gap-3">
              {article.incoming_relations.map((relation) => (
                <Link className="rounded-md border border-line p-3 text-sm font-semibold text-ink hover:border-civic" href={`/current-affairs/articles/${relation.source_article.slug}`} key={relation.id}>
                  {relation.label ?? relation.source_article.title}
                </Link>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
