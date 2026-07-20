"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ArticleSummary } from "../../lib/api";
import { articleHref } from "../../lib/current-affairs";
import { StudentStatusBadge } from "./student-status-badge";
import { useAuth, authenticatedDelete } from "../auth/auth-context";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Undated";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(d);
}

function getSourceStyles(source: string | null): string {
  if (!source) return "bg-slate-50 text-slate-700 border-slate-200/50";
  const s = source.toLowerCase();
  if (s.includes("express")) {
    return "bg-amber-50 text-amber-800 border-amber-200/60";
  }
  if (s.includes("hindu")) {
    return "bg-indigo-50 text-indigo-800 border-indigo-200/60";
  }
  if (s.includes("pib")) {
    return "bg-emerald-50 text-emerald-800 border-emerald-200/60";
  }
  if (s.includes("mint")) {
    return "bg-sky-50 text-sky-800 border-sky-200/60";
  }
  if (s.includes("down") || s.includes("earth")) {
    return "bg-lime-50 text-lime-800 border-lime-200/60";
  }
  return "bg-slate-50 text-slate-800 border border-slate-200/60";
}

function getCategoryStyles(categoryName: string | null | undefined): string {
  if (!categoryName) return "bg-slate-50 text-slate-700 border-slate-200/50";
  const name = categoryName.toLowerCase();
  
  if (name.includes("economy") || name.includes("economic") || name.includes("infra") || name.includes("budget") || name.includes("finance")) {
    return "bg-purple-50 text-purple-700 border-purple-200/60";
  }
  if (name.includes("environment") || name.includes("climate") || name.includes("ecology") || name.includes("disaster") || name.includes("pollution")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
  }
  if (name.includes("polity") || name.includes("constitution") || name.includes("judiciary") || name.includes("parliament") || name.includes("law")) {
    return "bg-rose-50 text-rose-700 border-rose-200/60";
  }
  if (name.includes("international") || name.includes("bilateral") || name.includes("diplomacy") || name.includes("security") || name.includes("border") || name.includes("defense")) {
    return "bg-blue-50 text-blue-700 border-blue-200/60";
  }
  if (name.includes("science") || name.includes("tech") || name.includes("space") || name.includes("health") || name.includes("medical") || name.includes("drug")) {
    return "bg-amber-50 text-amber-700 border-amber-200/60";
  }
  if (name.includes("history") || name.includes("culture") || name.includes("society") || name.includes("social") || name.includes("education")) {
    return "bg-teal-50 text-teal-700 border-teal-200/60";
  }
  if (name.includes("governance") || name.includes("admin")) {
    return "bg-slate-50 text-slate-700 border-slate-200/60";
  }
  return "bg-slate-50 text-slate-700 border border-slate-200/50";
}

export function ArticleCard({ article }: { article: ArticleSummary }) {
  const { token, user } = useAuth();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const isMains = article.content_family === "mains";
  const isAdmin = user && ["admin", "moderator", "content_editor"].includes(user.role);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete this current affairs article:\n"${article.title}"?`)) {
      return;
    }
    setDeleting(true);
    try {
      await authenticatedDelete(`/api/v1/current-affairs/articles/${article.id}`, token);
      router.refresh();
    } catch (err) {
      alert("Failed to delete article. Please try again.");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <tr className="group hover:bg-paper/30 transition-colors duration-150">
      {/* 1. Date cell with thick left border indicating content family */}
      <td
        className={`px-4 py-3 text-sm font-medium text-muted border border-line/60 bg-surface align-middle border-l-[3.5px] transition-colors group-hover:bg-paper/10 ${
          isMains ? "border-l-saffron" : "border-l-civic"
        }`}
      >
        {formatDate(article.publication_date)}
      </td>

      {/* 2. Source cell with custom pill */}
      <td className="px-4 py-3 text-sm border border-line/60 bg-surface align-middle transition-colors group-hover:bg-paper/10">
        {article.source_name ? (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wide capitalize border ${getSourceStyles(
              article.source_name
            )}`}
          >
            {article.source_name}
          </span>
        ) : (
          <span className="text-xs text-muted/65 italic font-medium">Unknown</span>
        )}
      </td>

      {/* 3. Title cell with link, status badge, tags, and inline action buttons */}
      <td className="px-4 py-3 text-sm border border-line/60 bg-surface align-middle transition-colors group-hover:bg-paper/10">
        <div className="flex items-start justify-between gap-4 min-w-0">
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <Link
                href={articleHref(article.slug)}
                className="font-medium text-ink hover:text-civic transition-colors text-sm sm:text-[15px] leading-snug"
              >
                {article.title}
              </Link>
              {article.article_role === "concept" && (
                <span className="inline-flex items-center rounded bg-berry/10 px-1.5 py-0.5 text-[10px] font-bold text-berry uppercase tracking-wide">
                  Concept
                </span>
              )}
              <StudentStatusBadge articleId={article.id} />
            </div>

            {article.institute_tags?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {article.institute_tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-paper/60 border border-line/30 px-1.5 py-0.2 text-[10px] font-semibold text-muted"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 select-none">
            <Link
              href={articleHref(article.slug)}
              className="inline-flex items-center rounded border border-line bg-paper/60 px-2 py-0.5 text-[10px] font-bold tracking-wider text-muted hover:border-civic hover:bg-civic hover:text-white transition-all duration-150 shadow-sm"
            >
              OPEN
            </Link>
            {isAdmin && (
              <>
                <Link
                  href={`${(() => {
                    switch (article.content_kind) {
                      case "daily_current_affairs":
                        return "/admin/current-affairs/create/daily-news";
                      case "daily_editorial_summary":
                        return "/admin/current-affairs/create/summaries";
                      case "mains_topic_note":
                        return "/admin/current-affairs/create/mains-notes";
                      case "prelims_pyq":
                        return "/admin/current-affairs/create/prelims-pyq";
                      case "mains_pyq":
                        return "/admin/current-affairs/create/mains-pyq";
                      default:
                        return "/admin/current-affairs/create/daily-news";
                    }
                  })()}?edit=${article.id}`}
                  className="inline-flex items-center rounded border border-line bg-paper/60 px-2 py-0.5 text-[10px] font-bold tracking-wider text-muted hover:border-civic hover:bg-civic hover:text-white transition-all duration-150 shadow-sm"
                >
                  EDIT
                </Link>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center rounded border border-line bg-paper/60 px-2 py-0.5 text-[10px] font-bold tracking-wider text-muted hover:border-berry hover:bg-berry hover:text-white transition-all duration-150 shadow-sm disabled:opacity-50"
                >
                  {deleting ? "..." : "DELETE"}
                </button>
              </>
            )}
          </div>
        </div>
      </td>

      {/* 4. GS Paper / Category cell */}
      <td className="px-4 py-3 text-sm border border-line/60 bg-surface align-middle transition-colors group-hover:bg-paper/10">
        {article.category ? (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wide border ${getCategoryStyles(
              article.category.name
            )}`}
          >
            {article.category.name}
          </span>
        ) : (
          <span className="text-xs text-muted/65 italic font-medium">Undefined category</span>
        )}
      </td>
    </tr>
  );
}
