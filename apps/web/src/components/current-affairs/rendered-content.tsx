function paragraphs(body: string | null | undefined): string[] {
  if (!body) return [];
  return body.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
}

export const isHtml = (content: string | null | undefined) => {
  if (!content) return false;
  return /<[a-z][\s\S]*>/i.test(content);
};

export function RenderedContent({ content, className }: { content: string | null | undefined; className?: string }) {
  if (!content) return null;
  if (isHtml(content)) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: content }}
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
