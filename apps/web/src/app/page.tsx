import type { Metadata } from "next";
import { getFreeDiagnosticTestId, getHomepageArticles, getHomepageMentors } from "../lib/api";
import { HomeGate } from "../components/home/home-gate";
import { MarketingHome } from "../components/home/marketing-home";

/**
 * The home page is a server component so that the marketing page — the headline,
 * the roadmap, the pricing, and the links into current affairs and mentors — is
 * actually present in the HTML. It used to be `"use client"` and returned a
 * spinner until auth resolved from localStorage, which cannot happen on the
 * server, so the only thing ever served to a crawler was "Loading WayToIAS...".
 * The signed-in dashboard is swapped in on the client by `HomeGate`.
 */

// Was `force-dynamic`, which rebuilt the whole marketing page on every single
// request. Nothing on it changes more than hourly.
export const revalidate = 3600;

export const metadata: Metadata = {
  // The home page previously declared no canonical at all.
  alternates: { canonical: "/" },
  openGraph: {
    title: "WayToIAS — UPSC Preparation Platform",
    description:
      "Free daily current affairs, a custom test builder, a notes workspace, and 1:1 mentorship from verified officers — feeding one live performance console.",
    url: "/",
    siteName: "WayToIAS",
    type: "website"
  }
};

/**
 * Each read is isolated: a mentor API hiccup should cost the page its mentor
 * cards, not the entire home page. The old client-side versions swallowed
 * failures the same way, minus the logging.
 */
async function safely<T>(label: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.error(`Home page: ${label} failed`, error);
    return fallback;
  }
}

export default async function HomePage() {
  const [articles, mentors, diagnosticTestId] = await Promise.all([
    safely("articles", () => getHomepageArticles(5), null),
    safely("mentors", () => getHomepageMentors(), [] as any[]),
    safely("diagnostic test", () => getFreeDiagnosticTestId(), null)
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://waytoias.com";

  /**
   * The publisher entity behind every `publisher:` block already emitted by the
   * article and hub pages, declared once here on the home page — this is where
   * Google looks for it. The `@id` gives those other pages something stable to
   * be pointing at, rather than a fresh anonymous Organization per page.
   *
   * No `sameAs`: that field is for verified social profiles, and the site
   * currently links to none. Listing URLs we cannot vouch for would be worse
   * than omitting the field.
   */
  const jsonLdOrganization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${baseUrl}/#organization`,
    name: "WayToIAS",
    url: baseUrl,
    description:
      "UPSC Civil Services preparation platform offering free daily current affairs, self-assessment tests, a notes workspace, and 1:1 mentorship from verified officers.",
    // The real brand logo, not the 32x32 favicon the article and hub pages
    // point their `publisher.logo` at — Google requires at least 112x112 and
    // ignores anything smaller. Served from public/ so the URL stays stable
    // across builds; the app itself keeps using the bundled import, which gets
    // a content-hashed filename that would break this reference every deploy.
    logo: {
      "@type": "ImageObject",
      url: `${baseUrl}/logo.png`,
      width: 845,
      height: 501
    }
  };

  /**
   * Deliberately no `potentialAction`/`SearchAction`. That property is what
   * enables the sitelinks search box, but Google requires it to point at a
   * working search results URL, and this site has no search route. Declaring
   * one that 404s is invalid markup, not a free feature — add it here if and
   * when a real `/search` page exists.
   */
  const jsonLdWebSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    name: "WayToIAS",
    url: baseUrl,
    inLanguage: "en-IN",
    publisher: { "@id": `${baseUrl}/#organization` }
  };

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }} type="application/ld+json" />
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebSite) }} type="application/ld+json" />
      <HomeGate
        marketing={
          <MarketingHome
            latestArticles={articles?.items ?? []}
            mentors={mentors.slice(0, 3)}
            diagnosticTestId={diagnosticTestId}
          />
        }
      />
    </>
  );
}
