"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Layers3, Loader2, Sparkles, Star } from "lucide-react";
import { useAuth } from "../auth/auth-context";
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


/** Articles a signed-out visitor may read per day before being asked to log in. */
const SIGNED_OUT_DAILY_LIMIT = 5;

export function GatedArticleBody({ article, heroAsset, hub }: Props) {
  const { token, isInitialized } = useAuth();
  const [isDailyLimitReached, setIsDailyLimitReached] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(true);
  const [readCount, setReadCount] = useState<number | null>(null);

  const isSignedIn = Boolean(token);

  useEffect(() => {
    if (!isInitialized) return;

    // Signed-in readers get everything, every content type, no counting.
    //
    // Subscription entitlements (`current_affairs.editorial_access`,
    // `current_affairs.daily_reads`) are deliberately NOT consulted here for
    // now — the plans and entitlements still exist server-side, so restoring
    // paid gating later means re-adding the check, not rebuilding it.
    if (isSignedIn) {
      setIsDailyLimitReached(false);
      setReadCount(null);
      setCheckingLimit(false);
      return;
    }

    // Signed-out visitors: a few free reads, then an invitation to log in.
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
        // Already read this article today — re-reading it is always allowed,
        // so a refresh or a back-navigation never costs another read.
        setIsDailyLimitReached(false);
        setReadCount(readData.count);
      } else if (readData.count >= SIGNED_OUT_DAILY_LIMIT) {
        setIsDailyLimitReached(true);
      } else {
        readData.count += 1;
        readData.readSlugs.push(article.slug);
        localStorage.setItem("coaching_hub_reads", JSON.stringify(readData));
        setIsDailyLimitReached(false);
        setReadCount(readData.count);
      }
    } catch (e) {
      // A blocked or full localStorage must not cost a reader the article.
      console.error("Failed to check daily read limit", e);
      setIsDailyLimitReached(false);
    } finally {
      setCheckingLimit(false);
    }
  }, [article.slug, isInitialized, isSignedIn]);

  if (!isInitialized || checkingLimit) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Signed-out reader who has used their free reads: ask them to sign in,
  // not to pay — an account is all that is required right now.
  if (isDailyLimitReached) {
    const next = encodeURIComponent(`/current-affairs/articles/${article.slug}`);
    return (
      <div className="mt-6">
        <PremiumLockOverlay
          title="Log in to keep reading"
          description={`You have read your ${SIGNED_OUT_DAILY_LIMIT} free articles for today. Log in — it is free — for unlimited access to current affairs, editorial summaries, mains notes and the notes workspace.`}
          planName="Free account"
          ctaText="Log in to continue"
          ctaHref={`/login?next=${next}`}
          secondaryCtaText="Create a free account"
          secondaryCtaHref={`/register?next=${next}`}
        />
      </div>
    );
  }

  // User is authorized, show the full article body and tools
  // 1. CONCEPTS: ONLY target articles with article_role === 'concept' or relation_type === 'prerequisite'
  const conceptRelations = article.outgoing_relations.filter(
    (rel) => rel.target_article?.article_role === "concept" || rel.relation_type === "prerequisite"
  );

  const coreConcepts = conceptRelations.filter(
    (rel) => rel.label === "Core Concept" || rel.relation_type === "prerequisite"
  );
  const relatedConcepts = conceptRelations.filter(
    (rel) => rel.label !== "Core Concept" && rel.relation_type !== "prerequisite"
  );

  // 2. MAINS NOTE: the durable topic page this summary/news item feeds into.
  // Split out from the generic "related" bucket because the relationship is a
  // specific one a reader benefits from being told about — this dated piece is
  // one entry in a topic they can study whole.
  const mainsNoteRelations = article.outgoing_relations.filter(
    (rel) => rel.relation_type === "mains_fodder"
  );

  // 3. LINKED ARTICLES & REFERENCES: Regular linked articles (NOT concepts,
  // and not the Mains Note, which gets its own section above).
  const relatedArticles = article.outgoing_relations.filter(
    (rel) =>
      rel.target_article?.article_role !== "concept" &&
      rel.relation_type !== "prerequisite" &&
      rel.relation_type !== "mains_fodder"
  );

  // Source pieces feeding a Mains Note — the same relation seen from the
  // topic's side. Named for what they are rather than the generic
  // "Appears in N articles".
  const sourceContributions = article.incoming_relations.filter(
    (rel) => rel.relation_type === "mains_fodder"
  );
  const otherIncoming = article.incoming_relations.filter(
    (rel) => rel.relation_type !== "mains_fodder"
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] mt-5">
      <div className="min-w-0">
        {readCount !== null && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              Article {readCount} of {SIGNED_OUT_DAILY_LIMIT} free reads today. Log in — free — for
              unlimited access.
            </span>
            <Link
              href={`/login?next=${encodeURIComponent(`/current-affairs/articles/${article.slug}`)}`}
              className="ml-auto text-xs font-black text-amber-700 hover:text-amber-900 underline uppercase tracking-wider shrink-0"
            >
              Log in
            </Link>
          </div>
        )}
        {heroAsset && (
          <figure className="overflow-hidden rounded-lg border border-line bg-surface">
            <img alt={heroAsset.alt_text ?? article.title} className="max-h-[28rem] w-full object-cover" src={heroAsset.file_url} />
            {heroAsset.caption && <figcaption className="p-3 text-sm text-ink/65">{heroAsset.caption}</figcaption>}
          </figure>
        )}

        {/* BACKGROUND STRIP: orients a reader before the news body, since a
            development article deliberately keeps its own recap short and
            leans on the linked concept for the full explanation. Sits above
            the body on purpose — the "Must Read: Core Concepts" section below
            covers the same ground in depth, for after reading. */}
        {coreConcepts.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-400/60 bg-amber-500/10 px-4 py-2.5 text-sm">
            <Star className="h-4 w-4 shrink-0 fill-amber-500 text-amber-700" />
            <span className="font-bold text-amber-950">Background:</span>
            {coreConcepts.map((rel, index) => (
              <span key={rel.id}>
                <Link
                  className="font-extrabold text-amber-800 underline decoration-amber-400 decoration-2 underline-offset-2 hover:text-amber-950"
                  href={`/current-affairs/articles/${rel.target_article.slug}`}
                >
                  {rel.target_article.title}
                </Link>
                {index < coreConcepts.length - 1 && <span className="text-amber-900/60">, </span>}
              </span>
            ))}
            <span className="text-amber-900/70">— read this first for full context.</span>
          </div>
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

        {/* MAINS NOTE — the durable topic this dated piece contributes to */}
        {mainsNoteRelations.length > 0 && (
          <section className="mt-5 rounded-xl border border-berry/25 bg-berry/5 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen className="h-5 w-5 text-berry" />
              <h2 className="text-lg font-black text-ink">
                Part of a Mains Note
              </h2>
            </div>
            <p className="text-xs text-ink/65 mb-4 leading-relaxed">
              This piece feeds into a durable topic note. Read the whole topic
              in one place:
            </p>
            <div className="grid gap-3">
              {mainsNoteRelations.map((rel) => (
                <Link
                  className="group rounded-xl border border-line bg-surface p-4 transition-all hover:border-berry hover:shadow-md"
                  href={`/current-affairs/articles/${rel.target_article.slug}`}
                  key={rel.id}
                >
                  <p className="text-sm font-black text-ink group-hover:text-berry">
                    {rel.target_article.title}
                  </p>
                  {rel.note && (
                    <p className="mt-1 text-xs text-ink/65 leading-relaxed">{rel.note}</p>
                  )}
                  <span className="mt-2 inline-block text-xs font-bold text-berry">
                    Read the full topic note →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 3. LINKED RELATED ARTICLES & CROSS REFERENCES */}
        {relatedArticles.length > 0 && (
          <section className="mt-5 rounded-xl border border-civic/20 bg-civic/5 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <Layers3 className="h-5 w-5 text-civic" />
              <h2 className="text-lg font-black text-ink">Linked Related Articles & References</h2>
            </div>
            <p className="text-xs text-ink/65 mb-4 leading-relaxed">
              Related current affairs, issue briefs, and editorial analyses linked to this article:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedArticles.map((rel) => (
                <Link
                  className="group rounded-xl border border-line bg-surface p-4 transition-all hover:border-civic hover:shadow-md flex flex-col justify-between"
                  href={`/current-affairs/articles/${rel.target_article.slug}`}
                  key={rel.id}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="rounded bg-civic/10 px-2 py-0.5 text-[10px] font-extrabold uppercase text-civic border border-civic/20">
                        {rel.target_article.content_kind ? rel.target_article.content_kind.replace(/_/g, " ") : "Linked Article"}
                      </span>
                      {rel.target_article.category && (
                        <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-bold text-ink/60">
                          {rel.target_article.category.name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-ink group-hover:text-civic transition-colors leading-snug">
                      {rel.target_article.title}
                    </h3>
                    {rel.target_article.body && (
                      <p className="mt-1.5 text-xs text-ink/65 line-clamp-2 leading-relaxed">
                        {rel.target_article.body.replace(/<[^>]*>?/gm, "").replace(/^[#*`-\s]+/, "").slice(0, 140)}...
                      </p>
                    )}
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-civic">
                    Read Linked Article →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ON CONCEPT PAGES: NEWS TIMELINE — every dated development linked to this concept */}
        {article.article_role === "concept" && article.incoming_relations.length > 0 && (
          <section className="mt-6 rounded-xl border border-civic/20 bg-civic/5 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="h-5 w-5 text-civic" />
              <h2 className="text-lg font-black text-ink">
                News Timeline ({article.incoming_relations.length})
              </h2>
            </div>
            <p className="text-xs text-ink/65 mb-4 leading-relaxed font-medium">
              Every development reported on this concept, most recent first:
            </p>
            {/* Already ordered newest-first by the API — this is a reading
                timeline, not a set of cards, so it stays chronological rather
                than being re-sorted client-side. */}
            <ol className="space-y-4 border-l-2 border-civic/30 pl-5">
              {article.incoming_relations.map((rel: any) => {
                const src = rel.source_article;
                if (!src) return null;
                const pubDateStr = src.publication_date || src.created_at;
                const formattedDate = pubDateStr
                  ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(pubDateStr))
                  : "Undated";
                const catPath = src.category_path || src.category?.name;
                const brief =
                  rel.note ||
                  (src.body ? `${src.body.replace(/<[^>]*>?/gm, "").replace(/^[#*`-\s]+/, "").slice(0, 160)}...` : "");

                return (
                  <li className="relative" key={rel.id}>
                    <span className="absolute -left-[1.65rem] top-1.5 h-2.5 w-2.5 rounded-full bg-civic ring-4 ring-civic/15" />
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-black uppercase tracking-wide text-civic">{formattedDate}</span>
                      {catPath && (
                        <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-bold text-ink/65 line-clamp-1 max-w-[180px]" title={catPath}>
                          {catPath}
                        </span>
                      )}
                    </div>
                    <Link
                      className="group inline-block"
                      href={`/current-affairs/articles/${src.slug}`}
                    >
                      <h3 className="text-base font-extrabold text-ink group-hover:text-civic transition-colors leading-snug">
                        {src.title}
                      </h3>
                    </Link>
                    {brief && <p className="mt-1 text-xs text-ink/65 leading-relaxed">{brief}</p>}
                    <Link
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-black text-civic"
                      href={`/current-affairs/articles/${src.slug}`}
                    >
                      Read Full Article →
                    </Link>
                  </li>
                );
              })}
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
        {relatedArticles.length > 0 && (
          <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
            <h2 className="text-base font-extrabold text-ink">Related reading</h2>
            <div className="mt-3 grid gap-3">
              {relatedArticles.map((relation) => (
                <Link className="rounded-md border border-line p-3 text-sm font-semibold text-ink hover:border-civic" href={`/current-affairs/articles/${relation.target_article.slug}`} key={relation.id}>
                  {relation.label ?? relation.target_article.title}
                </Link>
              ))}
            </div>
          </section>
        )}
        {/* Sources feeding this Mains Note — named, and showing what each
            contributed, rather than folded into the generic count below. */}
        {sourceContributions.length > 0 && (
          <section className="rounded-lg border border-berry/25 bg-berry/5 p-4 shadow-sm">
            <h2 className="text-base font-extrabold text-ink">
              Built from {sourceContributions.length} source
              {sourceContributions.length === 1 ? "" : "s"}
            </h2>
            <p className="mt-1 text-xs text-ink/65 leading-relaxed">
              Summaries and news pieces this note draws on:
            </p>
            <div className="mt-3 grid gap-3">
              {sourceContributions.map((relation) => (
                <Link
                  className="rounded-md border border-line bg-surface p-3 hover:border-berry"
                  href={`/current-affairs/articles/${relation.source_article.slug}`}
                  key={relation.id}
                >
                  <p className="text-sm font-semibold text-ink">
                    {relation.source_article.title}
                  </p>
                  {relation.note && (
                    <p className="mt-1 text-xs text-ink/65 leading-relaxed">{relation.note}</p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
        {otherIncoming.length > 0 && (
          <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
            <h2 className="text-base font-extrabold text-ink">
              Appears in {otherIncoming.length} article{otherIncoming.length === 1 ? "" : "s"}
            </h2>
            <div className="mt-3 grid gap-3">
              {otherIncoming.map((relation) => (
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
