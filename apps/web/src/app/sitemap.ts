import type { MetadataRoute } from "next";
import { getArticles } from "../lib/api";
import { CURRENT_AFFAIRS_HUBS, articleHref, hubHref } from "../lib/current-affairs";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://waytoias.com";

  // Core platform pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0
    },
    {
      url: `${baseUrl}/study-plans`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8
    },
    {
      url: `${baseUrl}/mentors`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7
    },
    {
      url: `${baseUrl}/assessment/gk`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8
    }
  ];

  // Current affairs hub routes
  const hubRoutes: MetadataRoute.Sitemap = CURRENT_AFFAIRS_HUBS.map((hub) => ({
    url: `${baseUrl}${hubHref(hub)}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.9
  }));

  // Dynamic Current Affairs articles
  let articleRoutes: MetadataRoute.Sitemap = [];
  try {
    const [newsRes, notesRes] = await Promise.all([
      getArticles({ contentKind: "daily_current_affairs", page: 1, limit: 100 }).catch(() => null),
      getArticles({ contentKind: "mains_topic_note", page: 1, limit: 100 }).catch(() => null)
    ]);

    const items = [
      ...(newsRes?.items || []),
      ...(notesRes?.items || [])
    ];

    articleRoutes = items.map((article) => ({
      url: `${baseUrl}${articleHref(article.slug)}`,
      lastModified: article.publication_date ? new Date(article.publication_date) : new Date(),
      changeFrequency: "monthly",
      priority: 0.8
    }));
  } catch (err) {
    console.error("Sitemap article fetch error:", err);
  }

  return [...staticRoutes, ...hubRoutes, ...articleRoutes];
}
