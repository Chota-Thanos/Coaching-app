"use client";

import { Edit3, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, authenticatedDelete } from "../auth/auth-context";
import type { ArticleDetail } from "../../lib/api";
import { CURRENT_AFFAIRS_HUBS } from "../../lib/current-affairs";

export function AdminArticleActions({ article }: { article: ArticleDetail }) {
  const { token, user } = useAuth();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user && ["admin", "moderator", "content_editor"].includes(user.role);

  if (!isAdmin) return null;

  const handleDelete = async () => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete this current affairs article:\n"${article.title}"?`)) {
      return;
    }
    setDeleting(true);
    try {
      await authenticatedDelete(`/api/v1/current-affairs/articles/${article.id}`, token);
      
      const hub = CURRENT_AFFAIRS_HUBS.find((h) => h.contentKind === article.content_kind);
      const dest = hub ? `/current-affairs/${hub.path}` : "/current-affairs/daily-news";
      router.push(dest);
      router.refresh();
    } catch (err) {
      alert("Failed to delete article. Please try again.");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const getCreatorPath = (kind: string) => {
    switch (kind) {
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
  };

  return (
    <div className="flex items-center gap-2 select-none shrink-0">
      <button
        onClick={() => router.push(`${getCreatorPath(article.content_kind)}?edit=${article.id}`)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-paper/60 px-3 text-xs font-bold text-ink hover:border-civic hover:bg-civic hover:text-white transition-all duration-150 shadow-sm"
      >
        <Edit3 aria-hidden="true" className="h-3.5 w-3.5" />
        Edit Page
      </button>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-paper/60 px-3 text-xs font-bold text-ink hover:border-berry hover:bg-berry hover:text-white transition-all duration-150 shadow-sm disabled:opacity-50"
      >
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        {deleting ? "Deleting..." : "Delete"}
      </button>
    </div>
  );
}
