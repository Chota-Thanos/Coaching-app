import type { MetadataRoute } from "next";
import { getArticles } from "../lib/api";
import { CURRENT_AFFAIRS_HUBS, articleHref, hubHref } from "../lib/current-affairs";

export const revalidate = 3600;

/**
 * The frontend list endpoint's `limit` cap (currently 100, raised from an
 * earlier 30). An older version of this file asked for 100 when the cap was
 * still 30, so every request failed validation and was swallowed by a
 * .catch(() => null) — the published sitemap contained zero articles, only
 * the static and hub routes. Still pages through rather than assuming one
 * request covers everything, so this stays correct regardless of what the
 * cap is set to.
 */
const PAGE_SIZE = 100;
/** Safety stop, so a bad total_pages can never spin forever. */
const MAX_PAGES_PER_HUB = 40;

type SitemapEntry = MetadataRoute.Sitemap[number];

async function articlesForHub(
  hub: (typeof CURRENT_AFFAIRS_HUBS)[number],
  baseUrl: string
): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    let response;
    try {
      response = await getArticles({
        contentKind: hub.contentKind,
        // Concepts are a separate role and are excluded by default, which is
        // why every concept page was missing even when the request worked.
        articleRole: hub.articleRole,
        page,
        limit: PAGE_SIZE,
      });
    } catch (error) {
      // Log rather than swallow — a silently empty sitemap is the bug this
      // rewrite exists to fix.
      console.error(`Sitemap: ${hub.path} page ${page} failed`, error);
      break;
    }

    for (const article of response.items) {
      entries.push({
        url: `${baseUrl}${articleHref(article.slug)}`,
        lastModified: article.publication_date ? new Date(article.publication_date) : new Date(),
        changeFrequency: "monthly",
        // Concepts are evergreen and get linked from many articles, so they
        // are worth slightly more than a single dated piece.
        priority: hub.articleRole === "concept" ? 0.7 : 0.8,
      });
    }

    totalPages = response.total_pages || 1;
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES_PER_HUB);

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://waytoias.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/study-plans`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/mentors`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/assessment/gk`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
  ];

  const hubRoutes: MetadataRoute.Sitemap = CURRENT_AFFAIRS_HUBS.map((hub) => ({
    url: `${baseUrl}${hubHref(hub)}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.9,
  }));

  // Driven by the hub list rather than a hand-written set of content kinds, so
  // every section the site actually publishes is covered — daily news,
  // concepts, editorial summaries, mains notes and both PYQ libraries — and a
  // new hub is included automatically.
  const perHub = await Promise.all(CURRENT_AFFAIRS_HUBS.map((hub) => articlesForHub(hub, baseUrl)));

  // Two hubs share a content kind (news and concepts), so de-duplicate by URL.
  const seen = new Set<string>();
  const articleRoutes = perHub.flat().filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });

  return [...staticRoutes, ...hubRoutes, ...articleRoutes];
}
