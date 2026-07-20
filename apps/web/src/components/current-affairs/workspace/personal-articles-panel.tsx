"use client";

import { FileText, Save } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import type { StudentArticle, StudentCollection } from "../../../lib/api";
import { createUniqueWorkspaceSlug } from "../../../lib/workspace";
import { authenticatedPost, useAuth } from "../../auth/auth-context";
import { RepositoryAttachControl } from "./repository-attach-control";

type PersonalArticlesPanelProps = {
  articles: StudentArticle[];
  collections: StudentCollection[];
  onChanged: () => Promise<void>;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function PersonalArticlesPanel({ articles, collections, onChanged }: PersonalArticlesPanelProps) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createDraft(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token) return;

    setPending(true);
    setMessage(null);
    try {
      await authenticatedPost<StudentArticle>("/api/v1/current-affairs/me/articles", token, {
        title,
        slug: createUniqueWorkspaceSlug(title),
        body,
        source_url: sourceUrl.trim() || undefined,
        personal_tags: splitTags(tags),
        status: "draft"
      });
      setTitle("");
      setBody("");
      setSourceUrl("");
      setTags("");
      await onChanged();
      setMessage("Draft saved.");
    } catch {
      setMessage("Could not save draft. Check the source URL is a valid link and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText aria-hidden="true" className="h-5 w-5 text-civic" />
        <h2 className="text-lg font-black text-ink">Personal articles</h2>
      </div>

      <form className="grid gap-3 rounded-lg border border-line bg-white p-4" onSubmit={createDraft}>
        <label className="grid gap-1 text-sm font-bold text-ink">
          Title
          <input
            className="h-11 rounded-md border border-line px-3 text-base font-normal"
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-ink">
          Notes body
          <textarea
            className="min-h-28 rounded-md border border-line px-3 py-2 text-base font-normal leading-6"
            onChange={(event) => setBody(event.target.value)}
            required
            value={body}
          />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold text-ink">
            Source URL
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onChange={(event) => setSourceUrl(event.target.value)}
              type="url"
              value={sourceUrl}
            />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink">
            Tags
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onChange={(event) => setTags(event.target.value)}
              placeholder="polity, economy"
              value={tags}
            />
          </label>
        </div>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          <Save aria-hidden="true" className="h-4 w-4" />
          {pending ? "Saving..." : "Save draft"}
        </button>
        {message && <p className="text-sm font-semibold text-civic">{message}</p>}
      </form>

      <div className="grid gap-3">
        {articles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-white p-4 text-sm text-ink/65">
            Your own notes and article drafts will appear here.
          </p>
        ) : (
          articles.map((article) => (
            <article className="rounded-lg border border-line bg-white p-4" key={article.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold leading-snug text-ink">{article.title}</h3>
                  <p className="mt-1 text-sm text-ink/65">
                    {article.status} - Updated {formatDate(article.updated_at)}
                  </p>
                </div>
                <span className="w-fit rounded-md bg-paper px-2 py-1 text-xs font-bold text-ink/65">{article.personal_tags.length} tags</span>
              </div>
              <div className="mt-4">
                <RepositoryAttachControl collections={collections} studentArticleId={article.id} onAdded={onChanged} />
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
