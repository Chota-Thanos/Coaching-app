import { Calendar, Globe, Tag } from "lucide-react";
import type { ArticleSummary } from "../../lib/api";
import { ArticleCard } from "./article-card";

export function ArticleList({ articles }: { articles: ArticleSummary[] }) {
  if (articles.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
        <p className="text-2xl">🔍</p>
        <h2 className="mt-3 text-base font-bold text-ink">No articles found</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted">
          Try removing a filter or switching to another month or category.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="overflow-x-auto w-full">
        <table className="w-full border-collapse text-left table-fixed min-w-[768px]">
          <thead>
            <tr className="bg-paper/40 border-b border-line text-left">
              <th className="w-[160px] px-4 py-2.5 text-xs font-semibold text-muted border border-line/60 select-none">
                <div className="flex items-center gap-1.5 uppercase tracking-wider">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  Date
                </div>
              </th>
              <th className="w-[140px] px-4 py-2.5 text-xs font-semibold text-muted border border-line/60 select-none">
                <div className="flex items-center gap-1.5 uppercase tracking-wider">
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  Source
                </div>
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold text-muted border border-line/60 select-none">
                <div className="flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="font-sans text-[11px] font-bold shrink-0">Aa</span>
                  Article Title
                </div>
              </th>
              <th className="w-[165px] px-4 py-2.5 text-xs font-semibold text-muted border border-line/60 select-none">
                <div className="flex items-center gap-1.5 uppercase tracking-wider">
                  <Tag className="h-3.5 w-3.5 shrink-0" />
                  GS Paper
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/45">
            {articles.map((article) => (
              <ArticleCard article={article} key={article.id} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

