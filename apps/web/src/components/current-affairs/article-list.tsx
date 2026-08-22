import { Calendar, Globe, Tag } from "lucide-react";
import type { ArticleSummary, CategoryNode } from "../../lib/api";
import { buildCategoryIndex } from "../../lib/current-affairs";
import { ArticleCard, ArticleMobileCard } from "./article-card";

export function ArticleList({ articles, categories }: { articles: ArticleSummary[]; categories: CategoryNode[] }) {
  const categoriesById = buildCategoryIndex(categories);
  if (articles.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line dark:border-slate-800 bg-surface dark:bg-slate-900 p-10 text-center">
        <p className="text-2xl">🔍</p>
        <h2 className="mt-3 text-base font-bold text-ink dark:text-white">No articles found</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted dark:text-slate-400">
          Try removing a filter or switching to another month or category.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Mobile Card List View (< md) */}
      <div className="block md:hidden space-y-3">
        {articles.map((article) => (
          <ArticleMobileCard article={article} key={article.id} />
        ))}
      </div>

      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block w-full overflow-hidden rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900 shadow-card">
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse text-left table-fixed">
            <thead>
              <tr className="bg-paper/40 dark:bg-slate-800/50 border-b border-line dark:border-slate-800 text-left">
                <th className="w-[160px] px-4 py-2.5 text-xs font-semibold text-muted dark:text-slate-400 border border-line/60 dark:border-slate-800 select-none">
                  <div className="flex items-center gap-1.5 uppercase tracking-wider">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    Date
                  </div>
                </th>
                <th className="w-[140px] px-4 py-2.5 text-xs font-semibold text-muted dark:text-slate-400 border border-line/60 dark:border-slate-800 select-none">
                  <div className="flex items-center gap-1.5 uppercase tracking-wider">
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    Source
                  </div>
                </th>
                <th className="w-[38%] px-4 py-2.5 text-xs font-semibold text-muted dark:text-slate-400 border border-line/60 dark:border-slate-800 select-none">
                  <div className="flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="font-sans text-[11px] font-bold shrink-0">Aa</span>
                    Article Title
                  </div>
                </th>
                <th className="w-[220px] px-4 py-2.5 text-xs font-semibold text-muted dark:text-slate-400 border border-line/60 dark:border-slate-800 select-none">
                  <div className="flex items-center gap-1.5 uppercase tracking-wider">
                    <Tag className="h-3.5 w-3.5 shrink-0" />
                    Categories
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/45 dark:divide-slate-800">
              {articles.map((article) => (
                <ArticleCard article={article} categoriesById={categoriesById} key={article.id} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

