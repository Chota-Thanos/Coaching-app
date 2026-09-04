import { resolveMediaUrl } from "../../lib/api";

function paragraphs(body: string | null | undefined): string[] {
  if (!body) return [];
  return body.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
}

export const isHtml = (content: string | null | undefined) => {
  if (!content) return false;
  return /<[a-z][\s\S]*>/i.test(content);
};

/**
 * Makes every image in a stored body loadable.
 *
 * An uploaded file is stored as a site-relative path ("/uploads/2026/..."),
 * which is served by the API and not by this app — so an <img> carrying one
 * resolves against the wrong origin and shows nothing. The hero image goes
 * through resolveMediaUrl for exactly this reason; a body image cannot,
 * because the body is injected as raw HTML, so the rewrite happens on the
 * markup itself.
 *
 * Deliberately narrow: it only touches src values that begin with "/uploads/",
 * so an absolute URL, a data: URI, or anything else an editor pasted is left
 * exactly as it was.
 */
export function resolveBodyMedia(html: string): string {
  return html.replace(
    /(<img\b[^>]*?\bsrc=)(["'])(\/uploads\/[^"']*)\2/gi,
    (_match, prefix: string, quote: string, url: string) => `${prefix}${quote}${resolveMediaUrl(url) ?? url}${quote}`
  );
}

export function RenderedContent({ content, className }: { content: string | null | undefined; className?: string }) {
  if (!content) return null;
  if (isHtml(content)) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: resolveBodyMedia(content) }}
      />
    );
  }

  return (
    <div className={className}>
      {paragraphs(content).map((paragraph, idx) => (
        <p key={idx} className="mb-4 last:mb-0">
          {paragraph.split("\n").map((line, lIdx, arr) => (
            <span key={lIdx}>
              {line}
              {lIdx < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
